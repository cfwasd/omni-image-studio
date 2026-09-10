import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_SYSTEM_PROMPT = `You are a world-class AI art prompt engineer for modern image models (Flux, Midjourney, SDXL).
The user provides a concept, raw text, or short keywords (often in Chinese or simple English).

Your job is to generate:
1. "positive": A highly detailed, descriptive English prompt describing subject, environment, artistic style, lighting, camera angle, color scheme, and composition. Do NOT include markdown, quotes, or conversational filler.
2. "negative": Key negative prompt words to avoid flaws (e.g. blurry, low quality, bad anatomy, deformed limbs, watermark, text, lowres).

You MUST respond strictly with a valid JSON object only. No intro, no outro, no markdown fences outside of JSON.
Example output format:
{"positive":"cinematic portrait of a warrior girl, neon lights, 35mm lens, 8k resolution, photorealistic","negative":"blurry, low quality, distorted, extra limbs, bad anatomy, watermark"}`;

// 极其健壮的清洗与 JSON 提取函数，完美兼容 DeepSeek / OpenAI / Claude / 开源模型
function cleanAndExtractPromptJson(rawContent: string, originalFallback: string): { positive: string; negative: string } {
  if (!rawContent) {
    return { positive: originalFallback, negative: "blurry, low quality, deformed, watermark" };
  }

  // 1. 过滤 <think>...</think> 思考链 (如 deepseek-r1)
  let text = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. 剥除 markdown 代码块 (```json ... ``` 或 ``` ...)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // 3. 尝试在文本中寻找最外层的 { ... } JSON 结构
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = text.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      // 容错匹配各种可能的 key 名
      const positive =
        parsed.positive ||
        parsed.positive_prompt ||
        parsed.prompt ||
        parsed.image_prompt ||
        parsed.en ||
        parsed.english ||
        "";
      const negative =
        parsed.negative ||
        parsed.negative_prompt ||
        parsed.neg ||
        parsed.avoid ||
        "";

      if (positive && typeof positive === "string") {
        return {
          positive: cleanPurePromptText(positive),
          negative: cleanPurePromptText(typeof negative === "string" ? negative : ""),
        };
      }
    } catch {
      // 继续向下尝试正则解析
    }
  }

  // 4. 正则提取常见键值对 (针对残缺 JSON 或非标格式)
  const posMatch =
    text.match(/["']?(?:positive|positive_prompt|prompt)["']?\s*:\s*["']([^"']+)["']/i) ||
    text.match(/(?:Positive Prompt|正向提示词|正向词)[:：]\s*([^\n\r]+)/i);

  const negMatch =
    text.match(/["']?(?:negative|negative_prompt)["']?\s*:\s*["']([^"']+)["']/i) ||
    text.match(/(?:Negative Prompt|负向提示词|负向词)[:：]\s*([^\n\r]+)/i);

  if (posMatch && posMatch[1]) {
    return {
      positive: cleanPurePromptText(posMatch[1]),
      negative: negMatch && negMatch[1] ? cleanPurePromptText(negMatch[1]) : "blurry, low quality, bad anatomy, deformed, watermark",
    };
  }

  // 5. 极端降级：模型直接返回了纯文本提示词，过滤掉开头引导语
  const pureText = cleanPurePromptText(text);
  return {
    positive: pureText || originalFallback,
    negative: "blurry, low quality, bad anatomy, deformed fingers, watermark, lowres",
  };
}

// 清洗提示词文本，确保绝不包含 JSON 结构、引号、大括号或前缀
function cleanPurePromptText(str: string): string {
  if (!str) return "";
  let s = str.trim();

  // 剥除首尾的花括号、中括号、双引号、单引号
  s = s.replace(/^[\{\[\s"']+|[\}\]\s"']+$/g, "").trim();

  // 剥除 "positive": 或 "prompt": 等前缀遗留
  s = s.replace(/^(?:["']?positive["']?|["']?prompt["']?|Positive Prompt|Prompt)[:：]\s*/i, "");

  // 再次剥除首尾残留引号
  s = s.replace(/^["']+|["']+$/g, "").trim();

  // 剥除可能残留的尾随逗号
  s = s.replace(/,\s*$/, "").trim();

  return s;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  try {
    const { prompt } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "请输入原始提示词内容" }, { status: 400 });
    }

    const trimmedInput = prompt.trim();

    // 获取用户的 LLM 配置，若无则使用默认环境变量
    const llmConfig = await prisma.lLMConfig.findUnique({
      where: { userId: user.id },
    });

    const baseUrl = (llmConfig?.baseUrl || process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const apiKey = llmConfig?.apiKeyEncrypted || process.env.LLM_API_KEY || "";
    const modelName = llmConfig?.modelName || process.env.LLM_MODEL || "gpt-4o-mini";
    const systemPrompt = llmConfig?.systemPromptTemplate || DEFAULT_SYSTEM_PROMPT;

    if (!apiKey) {
      return NextResponse.json(
        { error: "尚未配置大语言模型 API Key，请前往「系统与服务配置」中添加" },
        { status: 400 }
      );
    }

    const payloadBody: Record<string, unknown> = {
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Raw user concept: "${trimmedInput}"` },
      ],
      temperature: 0.7,
    };

    // 针对支持 json_object 的模型增加约束
    if (modelName.toLowerCase().includes("gpt") || modelName.toLowerCase().includes("deepseek")) {
      payloadBody.response_format = { type: "json_object" };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payloadBody),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `LLM 调用失败 (${response.status}): ${errText.slice(0, 150)}` },
        { status: 400 }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json({ error: "LLM 返回内容为空" }, { status: 500 });
    }

    // 执行强健清洗提取
    const result = cleanAndExtractPromptJson(rawContent, trimmedInput);

    return NextResponse.json({
      success: true,
      original: trimmedInput,
      positive: result.positive,
      negative: result.negative,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
