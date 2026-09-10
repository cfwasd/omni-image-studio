import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadBufferToOss, getActiveOssConfig } from "@/lib/oss";

// 上传图片（参考图或生成图片）并持久化到 OSS，若未配置 OSS 则回退存 base64
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "未找到上传文件" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 尝试上传至 OSS
    const ossConfig = await getActiveOssConfig();
    if (ossConfig) {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await uploadBufferToOss(buffer, fileName, file.type || "image/png");
      return NextResponse.json({ success: true, url });
    } else {
      // 容错：转为 base64 data url
      const base64 = `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
      return NextResponse.json({ success: true, url: base64 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
