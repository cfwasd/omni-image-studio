import { NextResponse } from "next/server";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "当前密码和新密码均不能为空" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "新密码长度不能少于 6 位" }, { status: 400 });
    }

    // 查询该用户的原密码哈希
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 校验原密码
    const isMatch = await verifyPassword(oldPassword, dbUser.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "当前原密码输入错误" }, { status: 400 });
    }

    // 加密新密码并更新入库
    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    return NextResponse.json({ success: true, message: "密码修改成功，请妥善保存新密码！" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Change password error:", err);
    return NextResponse.json({ error: `修改密码失败: ${message}` }, { status: 500 });
  }
}
