import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";

const JWT_SECRET_RAW = process.env.JWT_SECRET || "omni-image-studio-super-secret-key-2026-fallback";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
export const AUTH_COOKIE_NAME = "omni_session_token";

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: (payload.role as string) || "user",
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload?.userId) return null;

  if (payload.userId === "demo_admin_user") {
    return {
      id: "demo_admin_user",
      email: "admin@omniimage.local",
      name: "体验管理员",
      avatarUrl: null,
      role: "admin",
      createdAt: new Date(),
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });
    return (
      user || {
        id: payload.userId,
        email: payload.email,
        name: payload.email.split("@")[0],
        avatarUrl: null,
        role: payload.role,
        createdAt: new Date(),
      }
    );
  } catch (error) {
    console.warn("getCurrentUser 数据库查询失败，使用 Token 凭证回退:", error);
    return {
      id: payload.userId,
      email: payload.email,
      name: payload.email.split("@")[0],
      avatarUrl: null,
      role: payload.role,
      createdAt: new Date(),
    };
  }
}
