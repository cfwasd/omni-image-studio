import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveOssConfig, testOssConnection, OssConfig } from "@/lib/oss";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const activeConfig = await getActiveOssConfig();
  if (!activeConfig) {
    return NextResponse.json({ configured: false, config: null });
  }

  return NextResponse.json({
    configured: true,
    config: {
      region: activeConfig.region,
      endpoint: activeConfig.endpoint || "",
      bucket: activeConfig.bucket,
      accessKeyId: activeConfig.accessKeyId,
      hasSecret: Boolean(activeConfig.accessKeySecret),
      cdnDomain: activeConfig.cdnDomain || "",
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可配置系统对象存储" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { region, endpoint, accessKeyId, accessKeySecret, bucket, cdnDomain, action } = body;

    const saved = await getActiveOssConfig();

    // 智能处理 Key 与 Secret：如果前端传的是掩码或为空，则回退已保存的真实值
    const cleanAccessKey = (!accessKeyId || accessKeyId.includes("••"))
      ? saved?.accessKeyId || ""
      : accessKeyId.trim();

    const cleanSecret = (!accessKeySecret || accessKeySecret.includes("••"))
      ? saved?.accessKeySecret || ""
      : accessKeySecret.trim();

    const targetConfig: OssConfig = {
      region: region || "us-east-1",
      endpoint: (endpoint || "").trim() || undefined,
      accessKeyId: cleanAccessKey,
      accessKeySecret: cleanSecret,
      bucket: (bucket || "").trim(),
      cdnDomain: (cdnDomain || "").trim() || undefined,
    };

    // 如果只是测试连通性
    if (action === "test") {
      if (!targetConfig.accessKeyId || !targetConfig.accessKeySecret || !targetConfig.bucket) {
        return NextResponse.json(
          { success: false, message: "AccessKeyId、Secret 与 Bucket 不能为空" },
          { status: 400 }
        );
      }
      const testResult = await testOssConnection(targetConfig);
      return NextResponse.json(testResult);
    }

    // 保存配置
    if (!targetConfig.accessKeyId || !targetConfig.accessKeySecret || !targetConfig.bucket) {
      return NextResponse.json({ error: "AccessKeyId、Secret 与 Bucket 不能为空" }, { status: 400 });
    }

    // 先做一次真机连通性验证
    const testRes = await testOssConnection(targetConfig);
    if (!testRes.success) {
      return NextResponse.json({ error: `无法保存：${testRes.message}` }, { status: 400 });
    }

    await prisma.systemSetting.upsert({
      where: { key: "oss_config" },
      update: {
        value: JSON.stringify(targetConfig),
        description: "RustFS / S3 对象存储凭证与 Bucket 设置",
      },
      create: {
        id: "oss_config",
        key: "oss_config",
        value: JSON.stringify(targetConfig),
        description: "RustFS / S3 对象存储凭证与 Bucket 设置",
      },
    });

    return NextResponse.json({ success: true, message: "RustFS (S3) 配置已成功保存并通过连通性校验！" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `保存失败: ${message}` }, { status: 500 });
  }
}
