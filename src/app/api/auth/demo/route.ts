import { NextResponse } from "next/server";
import { signSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const token = await signSessionToken({
    userId: "demo_admin_user",
    email: "admin@omniimage.local",
    role: "admin",
  });

  const res = NextResponse.json({
    success: true,
    message: "已进入免密演示体验模式",
    user: {
      id: "demo_admin_user",
      email: "admin@omniimage.local",
      name: "Demo Administrator",
      role: "admin",
    },
  });

  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return res;
}
