import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 解析模型列表工具函数
function parseModels(modelName: string, modelsJson?: string | null): string[] {
  let list: string[] = [];
  if (modelsJson) {
    try {
      const parsed = JSON.parse(modelsJson);
      if (Array.isArray(parsed)) {
        list = parsed.map((m) => String(m).trim()).filter(Boolean);
      }
    } catch {
      // 容错按逗号/换行切分
      list = modelsJson
        .split(/[\n,]/)
        .map((m) => m.trim())
        .filter(Boolean);
    }
  }
  if (modelName && !list.includes(modelName.trim())) {
    list.unshift(modelName.trim());
  }
  return list.length ? list : [modelName || "default-model"];
}

// 获取当前用户的生图接口列表
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const providers = await prisma.imageProviderConfig.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // 脱敏 API Key 并格式化模型数组
  const safeList = providers.map((p) => ({
    ...p,
    apiKeyEncrypted: p.apiKeyEncrypted
      ? p.apiKeyEncrypted.slice(0, 4) + "••••••••" + p.apiKeyEncrypted.slice(-4)
      : "",
    hasKey: Boolean(p.apiKeyEncrypted),
    modelList: parseModels(p.modelName, p.models),
  }));

  return NextResponse.json({ providers: safeList });
}

// 新增或更新生图服务接口（支持批量模型与在线拉取模型）
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      id,
      name,
      protocolType,
      baseUrl,
      apiKey,
      modelName,
      models, // 字符串（换行/逗号）或数组
      isDefault,
      extraHeaders,
      action,
    } = body;

    const cleanBaseUrl = (baseUrl || "").trim().replace(/\/+$/, "");

    // 动作 1：自动探测拉取上游接口支持的模型列表 (Fetch Models)
    if (action === "fetch_models") {
      let finalKey = apiKey;
      if (!finalKey && id) {
        const exist = await prisma.imageProviderConfig.findUnique({ where: { id } });
        finalKey = exist?.apiKeyEncrypted;
      }

      if (!cleanBaseUrl) {
        return NextResponse.json({ success: false, error: "请填写 Base URL" }, { status: 400 });
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (finalKey) headers["Authorization"] = `Bearer ${finalKey}`;

      if (protocolType === "SD_WEBUI") {
        const sdRes = await fetch(`${cleanBaseUrl}/sdapi/v1/sd-models`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(10000),
        });
        if (!sdRes.ok) {
          return NextResponse.json({ success: false, error: `获取失败 HTTP ${sdRes.status}` }, { status: 400 });
        }
        const sdData = await sdRes.json();
        const modelNames = Array.isArray(sdData) ? sdData.map((item) => item.model_name || item.title).filter(Boolean) : [];
        return NextResponse.json({ success: true, models: modelNames });
      }

      // 默认走 OpenAI 规范 GET /models
      const res = await fetch(`${cleanBaseUrl}/models`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ success: false, error: `获取失败 HTTP ${res.status}: ${err.slice(0, 100)}` }, { status: 400 });
      }

      const data = await res.json();
      const modelItems = data.data || [];
      const modelNames = modelItems.map((m: { id?: string }) => m.id).filter(Boolean);

      return NextResponse.json({
        success: true,
        models: modelNames,
        message: `成功检测并拉取到 ${modelNames.length} 个模型！`,
      });
    }

    // 动作 2：连通性测试
    if (action === "test") {
      let finalKey = apiKey;
      if (!finalKey && id) {
        const exist = await prisma.imageProviderConfig.findUnique({ where: { id } });
        finalKey = exist?.apiKeyEncrypted;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (finalKey) headers["Authorization"] = `Bearer ${finalKey}`;

      const testUrl =
        protocolType === "OPENAI"
          ? `${cleanBaseUrl}/models`
          : protocolType === "SD_WEBUI"
          ? `${cleanBaseUrl}/sdapi/v1/sd-models`
          : cleanBaseUrl;

      const testRes = await fetch(testUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(8000),
      }).catch((e) => {
        throw new Error(`网络请求异常: ${e.message}`);
      });

      if (!testRes.ok && testRes.status !== 404 && testRes.status !== 405) {
        return NextResponse.json({
          success: false,
          error: `接口返回状态码 HTTP ${testRes.status}`,
        });
      }

      return NextResponse.json({
        success: true,
        message: `接口通信正常 (HTTP ${testRes.status})`,
      });
    }

    if (!name || !baseUrl) {
      return NextResponse.json({ error: "配置名称与 Base URL 不能为空" }, { status: 400 });
    }

    // 格式化 models 为标准 JSON 数组存储
    let formattedModelList: string[] = [];
    if (Array.isArray(models)) {
      formattedModelList = models.map((m) => String(m).trim()).filter(Boolean);
    } else if (typeof models === "string") {
      formattedModelList = models
        .split(/[\n,]/)
        .map((m) => m.trim())
        .filter(Boolean);
    }

    const primaryModel = (modelName || formattedModelList[0] || "default").trim();
    if (!formattedModelList.includes(primaryModel)) {
      formattedModelList.unshift(primaryModel);
    }

    // 如果设置为默认，先将该用户其它配置取消默认
    if (isDefault) {
      await prisma.imageProviderConfig.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    if (id) {
      const existing = await prisma.imageProviderConfig.findUnique({ where: { id } });
      if (!existing || existing.userId !== user.id) {
        return NextResponse.json({ error: "未找到该接口配置" }, { status: 404 });
      }

      const updated = await prisma.imageProviderConfig.update({
        where: { id },
        data: {
          name,
          protocolType: protocolType || "OPENAI",
          baseUrl: cleanBaseUrl,
          apiKeyEncrypted: apiKey ? apiKey.trim() : existing.apiKeyEncrypted,
          modelName: primaryModel,
          models: JSON.stringify(formattedModelList),
          isDefault: Boolean(isDefault),
          extraHeaders: extraHeaders ? JSON.stringify(extraHeaders) : null,
        },
      });

      return NextResponse.json({
        success: true,
        provider: {
          ...updated,
          modelList: formattedModelList,
        },
      });
    } else {
      const count = await prisma.imageProviderConfig.count({ where: { userId: user.id } });
      const shouldBeDefault = count === 0 ? true : Boolean(isDefault);

      const created = await prisma.imageProviderConfig.create({
        data: {
          userId: user.id,
          name,
          protocolType: protocolType || "OPENAI",
          baseUrl: cleanBaseUrl,
          apiKeyEncrypted: apiKey?.trim() || "",
          modelName: primaryModel,
          models: JSON.stringify(formattedModelList),
          isDefault: shouldBeDefault,
          extraHeaders: extraHeaders ? JSON.stringify(extraHeaders) : null,
        },
      });

      return NextResponse.json({
        success: true,
        provider: {
          ...created,
          modelList: formattedModelList,
        },
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 删除生图接口
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });

  const existing = await prisma.imageProviderConfig.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  await prisma.imageProviderConfig.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
