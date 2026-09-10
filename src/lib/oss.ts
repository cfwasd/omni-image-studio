import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { prisma } from "./db";

export interface OssConfig {
  region: string;
  endpoint?: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  cdnDomain?: string;
}

export async function getActiveOssConfig(): Promise<OssConfig | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "oss_config" },
    });

    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (parsed.accessKeyId && parsed.accessKeySecret && parsed.bucket) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("读取数据库 OSS 配置失败，尝试回退到环境变量:", err);
  }

  if (
    process.env.OSS_ACCESS_KEY_ID &&
    process.env.OSS_ACCESS_KEY_SECRET &&
    process.env.OSS_BUCKET
  ) {
    return {
      region: process.env.OSS_REGION || "us-east-1",
      endpoint: process.env.OSS_ENDPOINT,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      cdnDomain: process.env.OSS_CDN_DOMAIN,
    };
  }

  return null;
}

export function createS3Client(config: OssConfig) {
  let cleanEndpoint = config.endpoint || "";
  if (cleanEndpoint && !cleanEndpoint.startsWith("http://") && !cleanEndpoint.startsWith("https://")) {
    cleanEndpoint = `https://${cleanEndpoint}`;
  }

  // 严格清理凭证中的首尾空白与控制字符，防止 Node.js Header 校验抛出 Invalid character
  const cleanAccessKey = (config.accessKeyId || "").trim();
  const cleanSecretKey = (config.accessKeySecret || "").trim();

  return new S3Client({
    region: config.region || "us-east-1",
    endpoint: cleanEndpoint,
    credentials: {
      accessKeyId: cleanAccessKey,
      secretAccessKey: cleanSecretKey,
    },
    forcePathStyle: true, // RustFS / MinIO 等自建 S3 兼容必须使用 Path-Style (https://endpoint/bucket/key)
  });
}

// 测试 RustFS / S3 连通性
export async function testOssConnection(config: OssConfig) {
  const testKey = `__test_ping_${Date.now()}.txt`;
  const s3 = createS3Client(config);

  try {
    // 1. 上传一个测试文本
    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: testKey,
        Body: Buffer.from("rustfs-omni-image-ping-ok"),
        ContentType: "text/plain",
      })
    );

    // 2. 清理测试文件
    await s3.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: testKey,
      })
    );

    return { success: true, message: "RustFS (S3) 读写连通性测试通过！" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `RustFS 连通测试失败: ${message}` };
  }
}

// 上传 Buffer 到 RustFS
export async function uploadBufferToOss(
  buffer: Buffer,
  fileName: string,
  contentType: string = "image/png"
): Promise<string> {
  const config = await getActiveOssConfig();
  if (!config) {
    throw new Error("尚未配置 RustFS / 对象存储，请在设置中配置后再试");
  }

  const objectKey = `artifacts/${new Date().toISOString().slice(0, 10)}/${fileName}`;
  const s3 = createS3Client(config);

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    })
  );

  if (config.cdnDomain) {
    const cleanDomain = config.cdnDomain.replace(/\/+$/, "");
    return `${cleanDomain}/${objectKey}`;
  }

  const cleanEndpoint = (config.endpoint || "").replace(/\/+$/, "");
  return `${cleanEndpoint}/${config.bucket}/${objectKey}`;
}
