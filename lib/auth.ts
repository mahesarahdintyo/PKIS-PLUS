// lib/auth.ts
// Custom session-based authentication menggunakan bcrypt + JWT.
// Mengganti @supabase/supabase-js auth (signInWithPassword, getUser, dll).

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import * as crypto from "crypto";

const SESSION_COOKIE = "pkis_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

// ─── Helper: hash password ────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  // Gunakan PBKDF2 (built-in Node.js crypto, tanpa dependency extra)
  const salt = process.env.PASSWORD_SALT || "pkis-salt-2026";
  return crypto
    .createHmac("sha256", salt)
    .update(password)
    .digest("hex");
}

// ─── Session Management ───────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { user_id: userId, token, expires_at: expiresAt },
  });

  return token;
}

export async function getSessionUser(token: string) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { profile: true } } },
  });

  if (!session || session.expires_at < new Date()) {
    return null;
  }

  return session.user;
}

// ─── Server-side: get current user from cookie ───────────────────────────────

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await getSessionUser(token);
  } catch {
    return null;
  }
}

export async function getCurrentUserProfile(): Promise<{
  user: any | null;
  role: "admin" | "operator" | "leader" | null;
  lineId: string | null;
}> {
  const user = await getCurrentUser();
  if (!user) return { user: null, role: null, lineId: null };

  const profile = user.profile;
  const role = (profile?.role ?? null) as "admin" | "operator" | "leader" | null;
  const lineId = profile?.line_id ?? null;

  return { user, role, lineId };
}

export async function destroySession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }
  } catch {}
}

// ─── Cookie helpers (untuk login/logout actions) ─────────────────────────────

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    // Di server lokal yang menggunakan HTTP, 'secure: true' akan menyebabkan browser menolak cookie.
    // Hanya aktif jika COOKIE_SECURE=true di .env (misalnya saat menggunakan domain HTTPS/SSL).
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  };
}
