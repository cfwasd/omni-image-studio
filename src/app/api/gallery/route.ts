import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MOCK_DEMO_ARTIFACTS = [
  {
    id: "demo-art-1",
    taskId: "task-1",
    userId: "demo_admin_user",
    storageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&q=80",
    width: 1024,
    height: 1024,
    isFavorited: true,
    createdAt: new Date().toISOString(),
    task: {
      id: "task-1",
      taskType: "TEXT_TO_IMAGE",
      prompt: "A futuristic glowing crystal monolith in a misty cyberpunk desert, neon purple and cyan volumetric fog, 8k resolution, octane render, cinematic lighting",
      negativePrompt: "blurry, low quality, deformed, extra limbs, bad anatomy, text, watermark",
      parameters: JSON.stringify({ width: 1024, height: 1024, steps: 30, cfgScale: 7.5, seed: 428912 }),
      costTimeMs: 4200,
    },
  },
  {
    id: "demo-art-2",
    taskId: "task-2",
    userId: "demo_admin_user",
    storageUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&q=80",
    width: 1024,
    height: 768,
    isFavorited: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    task: {
      id: "task-2",
      taskType: "TEXT_TO_IMAGE",
      prompt: "Renaissance oil painting style of an astronaut floating inside an ancient Roman cathedral, soft golden hour sunlight through stained glass windows",
      negativePrompt: "modern artifacts, photography, lowres, deformed hands",
      parameters: JSON.stringify({ width: 1024, height: 768, steps: 28, cfgScale: 8.0, seed: 182741 }),
      costTimeMs: 3800,
    },
  },
  {
    id: "demo-art-3",
    taskId: "task-3",
    userId: "demo_admin_user",
    storageUrl: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=500&q=80",
    width: 720,
    height: 1280,
    isFavorited: true,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    task: {
      id: "task-3",
      taskType: "IMAGE_TO_IMAGE",
      prompt: "Cybernetic fox with glowing azure runes standing on a rain-slicked neon street, Japanese neo-Tokyo alley, anime aesthetic, Makoto Shinkai style",
      negativePrompt: "ugly, blurry, cropped, watermark",
      referenceImageUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300",
      parameters: JSON.stringify({ width: 720, height: 1280, steps: 25, cfgScale: 7.0, seed: 994812, denoiseStrength: 0.65 }),
      costTimeMs: 5100,
    },
  },
];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "ALL";
  const query = searchParams.get("q") || "";

  try {
    const whereCondition: Record<string, unknown> = {
      userId: user.id,
    };

    if (filter === "FAVORITES") whereCondition.isFavorited = true;
    if (filter === "T2I") whereCondition.task = { taskType: "TEXT_TO_IMAGE" };
    else if (filter === "I2I") whereCondition.task = { taskType: "IMAGE_TO_IMAGE" };

    if (query.trim()) {
      whereCondition.task = {
        ...(whereCondition.task as object),
        prompt: { contains: query.trim(), mode: "insensitive" },
      };
    }

    const artifacts = await prisma.imageArtifact.findMany({
      where: whereCondition,
      include: { task: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (artifacts.length === 0 && user.id === "demo_admin_user") {
      return NextResponse.json({ artifacts: MOCK_DEMO_ARTIFACTS });
    }

    return NextResponse.json({ artifacts });
  } catch (err: unknown) {
    console.warn("Gallery 数据库未就绪，返回演示画廊数据:", err);
    return NextResponse.json({ artifacts: MOCK_DEMO_ARTIFACTS });
  }
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  try {
    const { id, isFavorited } = await req.json();
    if (user.id === "demo_admin_user") {
      return NextResponse.json({ success: true, isFavorited });
    }

    const item = await prisma.imageArtifact.findUnique({ where: { id } });
    if (!item || item.userId !== user.id) {
      return NextResponse.json({ error: "资产不存在或无权操作" }, { status: 403 });
    }

    const updated = await prisma.imageArtifact.update({
      where: { id },
      data: { isFavorited: Boolean(isFavorited) },
    });

    return NextResponse.json({ success: true, artifact: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: true, message });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  if (user.id === "demo_admin_user") {
    return NextResponse.json({ success: true });
  }

  try {
    await prisma.imageArtifact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
