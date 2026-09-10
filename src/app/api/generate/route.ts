import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadBufferToOss, getActiveOssConfig } from "@/lib/oss";

// 辅助函数：将 referenceImageUrl (网络URL 或 data:base64) 解析为纯二进制 Buffer
async function resolveImageBuffer(imgRef: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (imgRef.startsWith("data:")) {
    const matches = imgRef.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches[2]) {
      const mimeType = matches[1] || "image/png";
      const buffer = Buffer.from(matches[2], "base64");
      return { buffer, mimeType };
    }
    const raw = imgRef.split(",")[1] || imgRef;
    return { buffer: Buffer.from(raw, "base64"), mimeType: "image/png" };
  }

  // 网络 URL
  const res = await fetch(imgRef, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`无法获取参考底图资源 (${res.status}): ${imgRef}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const mimeType = res.headers.get("content-type") || "image/png";
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      providerId,
      selectedModel,
      taskType, // "TEXT_TO_IMAGE" | "IMAGE_TO_IMAGE"
      prompt,
      originalPrompt,
      negativePrompt,
      referenceImageUrl,
      parameters, // { width, height, aspectRatio, steps, cfgScale, seed, denoiseStrength, samplerName, batchSize }
    } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "正向提示词不能为空" }, { status: 400 });
    }

    // 查找选中的 Provider
    let provider = null;
    if (providerId) {
      provider = await prisma.imageProviderConfig.findUnique({ where: { id: providerId } });
    }
    if (!provider) {
      provider = await prisma.imageProviderConfig.findFirst({
        where: { userId: user.id, isDefault: true },
      });
    }
    if (!provider) {
      provider = await prisma.imageProviderConfig.findFirst({
        where: { userId: user.id },
      });
    }

    if (!provider) {
      return NextResponse.json(
        { error: "尚未配置任何生图服务接口，请先前往「系统与服务配置」添加" },
        { status: 400 }
      );
    }

    // 确定本次实际调用的模型名称
    const effectiveModel = (selectedModel || provider.modelName || "").trim();

    // 记录生成任务到数据库 (状态: PROCESSING)
    const task = await prisma.generationTask.create({
      data: {
        userId: user.id,
        taskType: taskType || "TEXT_TO_IMAGE",
        providerSnapshot: JSON.stringify({
          providerName: provider.name,
          protocolType: provider.protocolType,
          baseUrl: provider.baseUrl,
          modelName: effectiveModel,
        }),
        prompt: prompt.trim(),
        originalPrompt: originalPrompt || null,
        negativePrompt: negativePrompt || null,
        referenceImageUrl: referenceImageUrl || null,
        parameters: JSON.stringify(parameters || {}),
        status: "PROCESSING",
      },
    });

    const cleanBaseUrl = provider.baseUrl.replace(/\/+$/, "");
    const { width = 1024, height = 1024, steps = 25, cfgScale = 7.5, seed = -1, denoiseStrength = 0.75 } = parameters || {};
    const effectiveSeed = seed === -1 ? Math.floor(Math.random() * 1000000000) : seed;

    let generatedImageUrls: string[] = [];

    // =========================================================================
    // 协议 A: OPENAI 兼容生图规范 (含标准文生图 /generations 与 强记忆图生图 /edits)
    // =========================================================================
    if (provider.protocolType === "OPENAI") {
      let resData: { data?: Array<{ url?: string; b64_json?: string }> } = {};

      if (taskType === "IMAGE_TO_IMAGE" && referenceImageUrl) {
        // ----------------- 图生图 / 修图模式 -----------------
        // 1. 将参考底图转为真实 Buffer，组装为符合 OpenAI /images/edits 规范的 multipart/form-data
        const { buffer: refBuffer, mimeType } = await resolveImageBuffer(referenceImageUrl);

        const formData = new FormData();
        const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
        formData.append("image", new Blob([new Uint8Array(refBuffer)], { type: mimeType }), `init_image.${ext}`);
        formData.append("prompt", prompt);
        formData.append("model", effectiveModel);
        formData.append("n", String(parameters?.batchSize || 1));
        formData.append("size", `${width}x${height}`);

        const headers: Record<string, string> = {};
        if (provider.apiKeyEncrypted) {
          headers["Authorization"] = `Bearer ${provider.apiKeyEncrypted}`;
        }

        // 尝试请求 /images/edits
        let editsRes = await fetch(`${cleanBaseUrl}/images/edits`, {
          method: "POST",
          headers,
          body: formData,
          signal: AbortSignal.timeout(180000),
        });

        // 降级策略：如果上游不支持 /images/edits (返回 404/405)，则尝试将原图转为 base64 附加在 /images/generations 中传递
        if (!editsRes.ok && (editsRes.status === 404 || editsRes.status === 405)) {
          console.warn(`/images/edits 返回 ${editsRes.status}，尝试 fallback 到 /images/generations 携带 image 参数`);
          const fallbackHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (provider.apiKeyEncrypted) fallbackHeaders["Authorization"] = `Bearer ${provider.apiKeyEncrypted}`;

          const fallbackRes = await fetch(`${cleanBaseUrl}/images/generations`, {
            method: "POST",
            headers: fallbackHeaders,
            body: JSON.stringify({
              model: effectiveModel,
              prompt: prompt,
              image: `data:${mimeType};base64,${refBuffer.toString("base64")}`,
              init_images: [`data:${mimeType};base64,${refBuffer.toString("base64")}`],
              n: parameters?.batchSize || 1,
              size: `${width}x${height}`,
            }),
            signal: AbortSignal.timeout(180000),
          });

          if (!fallbackRes.ok) {
            const errText = await fallbackRes.text();
            throw new Error(`图生图接口调用失败 (${fallbackRes.status}): ${errText.slice(0, 200)}`);
          }
          resData = await fallbackRes.json();
        } else if (!editsRes.ok) {
          const errText = await editsRes.text();
          throw new Error(`图生图 (/images/edits) 错误 (${editsRes.status}): ${errText.slice(0, 200)}`);
        } else {
          resData = await editsRes.json();
        }
      } else {
        // ----------------- 标准文生图模式 -----------------
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (provider.apiKeyEncrypted) {
          headers["Authorization"] = `Bearer ${provider.apiKeyEncrypted}`;
        }

        const openaiRes = await fetch(`${cleanBaseUrl}/images/generations`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: effectiveModel,
            prompt: prompt,
            n: parameters?.batchSize || 1,
            size: `${width}x${height}`,
            response_format: "b64_json",
          }),
          signal: AbortSignal.timeout(180000),
        });

        if (!openaiRes.ok) {
          const errText = await openaiRes.text();
          throw new Error(`文生图服务返回错误 (${openaiRes.status}): ${errText.slice(0, 200)}`);
        }
        resData = await openaiRes.json();
      }

      const items = resData.data || [];
      const ossConfig = await getActiveOssConfig();

      for (const item of items) {
        if (item.b64_json) {
          const buffer = Buffer.from(item.b64_json, "base64");
          if (ossConfig) {
            const fileName = `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            const ossUrl = await uploadBufferToOss(buffer, fileName, "image/png");
            generatedImageUrls.push(ossUrl);
          } else {
            generatedImageUrls.push(`data:image/png;base64,${item.b64_json}`);
          }
        } else if (item.url) {
          try {
            const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(30000) });
            const imgBuf = Buffer.from(await imgRes.arrayBuffer());
            if (ossConfig) {
              const fileName = `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
              const ossUrl = await uploadBufferToOss(imgBuf, fileName, "image/png");
              generatedImageUrls.push(ossUrl);
            } else {
              generatedImageUrls.push(item.url);
            }
          } catch {
            generatedImageUrls.push(item.url);
          }
        }
      }
    } else if (provider.protocolType === "SD_WEBUI") {
      // =========================================================================
      // 协议 B: SD WebUI 规范 (/sdapi/v1/txt2img 或 /sdapi/v1/img2img)
      // =========================================================================
      const endpoint = taskType === "IMAGE_TO_IMAGE" ? "/sdapi/v1/img2img" : "/sdapi/v1/txt2img";
      const payload: Record<string, unknown> = {
        prompt,
        negative_prompt: negativePrompt || "",
        steps,
        cfg_scale: cfgScale,
        width,
        height,
        seed: effectiveSeed,
        batch_size: parameters?.batchSize || 1,
      };

      if (effectiveModel) {
        payload.override_settings = { sd_model_checkpoint: effectiveModel };
      }

      if (taskType === "IMAGE_TO_IMAGE" && referenceImageUrl) {
        const { buffer: refBuffer } = await resolveImageBuffer(referenceImageUrl);
        payload.init_images = [refBuffer.toString("base64")];
        payload.denoising_strength = denoiseStrength;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider.apiKeyEncrypted) headers["Authorization"] = `Bearer ${provider.apiKeyEncrypted}`;

      const sdRes = await fetch(`${cleanBaseUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(180000),
      });

      if (!sdRes.ok) {
        const errText = await sdRes.text();
        throw new Error(`SD 接口返回错误 (${sdRes.status}): ${errText.slice(0, 200)}`);
      }

      const sdData = await sdRes.json();
      const images: string[] = sdData.images || [];
      const ossConfig = await getActiveOssConfig();

      for (const b64 of images) {
        const buffer = Buffer.from(b64, "base64");
        if (ossConfig) {
          const fileName = `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          const ossUrl = await uploadBufferToOss(buffer, fileName, "image/png");
          generatedImageUrls.push(ossUrl);
        } else {
          generatedImageUrls.push(`data:image/png;base64,${b64}`);
        }
      }
    } else {
      throw new Error(`暂未支持的协议类型: ${provider.protocolType}`);
    }

    if (generatedImageUrls.length === 0) {
      throw new Error("模型未返回任何有效图像数据");
    }

    const costTime = Date.now() - startTime;

    await prisma.generationTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        costTimeMs: costTime,
      },
    });

    const artifacts = [];
    for (const url of generatedImageUrls) {
      const art = await prisma.imageArtifact.create({
        data: {
          taskId: task.id,
          userId: user.id,
          storageUrl: url,
          thumbnailUrl: url,
          width,
          height,
        },
      });
      artifacts.push(art);
    }

    return NextResponse.json({
      success: true,
      taskId: task.id,
      modelUsed: effectiveModel,
      costTimeMs: costTime,
      artifacts,
    });
  } catch (err: unknown) {
    const costTime = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    console.error("Generate image failed:", err);

    return NextResponse.json({ error: message, costTimeMs: costTime }, { status: 500 });
  }
}
