import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_SYSTEM_PROMPT = `You are a world-class AI art prompt engineer.
Your task is to take the user's short description (often in Chinese or simple English) and produce:
1. "positive": Highly detailed, expressive English prompt for image models (Flux/Midjourney/SDXL), including subject details, artistic style, lighting, composition, camera angle, color palette, and high aesthetic keywords.
2. "negative": Suggested negative prompt to avoid deformed limbs, blurry faces, low quality, bad anatomy, text artifacts.

Return strictly a JSON object:
{
  "positive": "...",
  "negative": "..."
}`;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const config = await prisma.lLMConfig.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    config: config
      ? {
          baseUrl: config.baseUrl,
          modelName: config.modelName,
          systemPromptTemplate: config.systemPromptTemplate || DEFAULT_SYSTEM_PROMPT,
          apiKeyEncrypted: config.apiKeyEncrypted
            ? config.apiKeyEncrypted.slice(0, 4) + "••••••••" + config.apiKeyEncrypted.slice(-4)
            : "",
          hasKey: Boolean(config.apiKeyEncrypted),
        }
      : {
          baseUrl: "https://api.openai.com/v1",
          modelName: "gpt-4o-mini",
          systemPromptTemplate: DEFAULT_SYSTEM_PROMPT,
          apiKeyEncrypted: "",
          hasKey: false,
        },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  try {
    const { baseUrl, apiKey, modelName, systemPromptTemplate, action } = await req.json();

    if (action === "test") {
      let finalKey = apiKey;
      if (!finalKey) {
        const exist = await prisma.lLMConfig.findUnique({ where: { userId: user.id } });
        finalKey = exist?.apiKeyEncrypted;
      }
      if (!finalKey) {
        return NextResponse.json({ success: false, error: "请提供 API Key 进行测试" }, { status: 400 });
      }

      const cleanUrl = (baseUrl || "").replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${finalKey}`,
        },
        body: JSON.stringify({
          model: modelName || "gpt-4o-mini",
          messages: [{ role: "user", content: "Ping! Please respond 'OK'." }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ success: false, error: `调用失败: ${errText.slice(0, 150)}` }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "大语言模型通信正常！" });
    }

    if (!baseUrl || !modelName) {
      return NextResponse.json({ error: "Base URL 和模型名称不能为空" }, { status: 400 });
    }

    const exist = await prisma.lLMConfig.findUnique({ where: { userId: user.id } });
    const finalKey = apiKey ? apiKey.trim() : exist?.apiKeyEncrypted || "";

    const saved = await prisma.lLMConfig.upsert({
      where: { userId: user.id },
      update: {
        baseUrl: baseUrl.trim(),
        modelName: modelName.trim(),
        systemPromptTemplate: systemPromptTemplate || DEFAULT_SYSTEM_PROMPT,
        apiKeyEncrypted: finalKey,
      },
      create: {
        userId: user.id,
        baseUrl: baseUrl.trim(),
        modelName: modelName.trim(),
        systemPromptTemplate: systemPromptTemplate || DEFAULT_SYSTEM_PROMPT,
        apiKeyEncrypted: finalKey,
      },
    });

    return NextResponse.json({ success: true, config: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
