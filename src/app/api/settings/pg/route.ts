import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Client } from "pg";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const startTime = Date.now();
  try {
    // 运行一条轻量的 select 1
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;

    // 获取当前连接的数据库名
    const dbUrl = process.env.DATABASE_URL || "";
    // 掩码脱敏连接串
    let maskedUrl = "未配置";
    if (dbUrl) {
      maskedUrl = dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:******@");
    }

    const tableCounts = {
      users: await prisma.user.count().catch(() => 0),
      tasks: await prisma.generationTask.count().catch(() => 0),
      artifacts: await prisma.imageArtifact.count().catch(() => 0),
    };

    return NextResponse.json({
      connected: true,
      latencyMs: latency,
      maskedUrl,
      tableCounts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      connected: false,
      error: message,
    });
  }
}

// 供用户在线测试自定义 PG 连接串
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可测试与修改全局数据库配置" }, { status: 403 });
  }

  try {
    const { databaseUrl } = await req.json();
    if (!databaseUrl) {
      return NextResponse.json({ error: "请输入数据库连接串" }, { status: 400 });
    }

    const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
    const start = Date.now();
    await client.connect();
    await client.query("SELECT 1;");
    await client.end();
    const latency = Date.now() - start;

    return NextResponse.json({
      success: true,
      latencyMs: latency,
      message: `PostgreSQL 连接测试成功！延迟 ${latency}ms`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `连接失败: ${message}` }, { status: 400 });
  }
}
