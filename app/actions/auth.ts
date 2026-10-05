"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createSession,
  destroySession,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth";

export async function login(state: any, formData: FormData) {
  const usernameOrEmail = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!usernameOrEmail || !password) {
    return { error: "Username dan password wajib diisi." };
  }

  // Internally format username to email if it does not contain '@'
  const email = usernameOrEmail.includes("@")
    ? usernameOrEmail.trim().toLowerCase()
    : `${usernameOrEmail.trim().toLowerCase()}@futaba.co.id`;

  try {
    // Cari user di database lokal
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      return { error: "Username atau password salah." };
    }

    // Verifikasi password
    const expectedHash = hashPassword(password);
    if (user.password_hash !== expectedHash) {
      return { error: "Username atau password salah." };
    }

    // Buat session dan set cookie
    const token = await createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName(), token, getSessionCookieOptions());

    const profile = user.profile;
    const rawRole = (profile?.role ?? "operator") as string;
    const role = rawRole.trim().toLowerCase();
    const lineId = profile?.line_id ?? null;

    return { success: true, redirectUrl: "/", role, lineId, landId: lineId };
  } catch (err) {
    console.error("Login error:", err);
    return { error: "Terjadi kesalahan server. Coba lagi." };
  }
}

export async function logout() {
  await destroySession();
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
  redirect("/");
}
