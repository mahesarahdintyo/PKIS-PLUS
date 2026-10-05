// app/api/auth/login/route.ts
// Login endpoint — mengganti Supabase signInWithPassword

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createSession,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }

    // Cari user
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
    }

    // Verifikasi password
    const expectedHash = hashPassword(password);
    if (user.password_hash !== expectedHash) {
      return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
    }

    // Buat session
    const token = await createSession(user.id);

    const profile = user.profile;
    const role = profile?.role ?? "operator";
    const lineId = profile?.line_id ?? null;

    const responseData = {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { role, line_id: lineId },
        app_metadata: { role },
      },
      token,
      role,
      lineId,
    };

    const response = NextResponse.json(responseData);

    // Set HttpOnly cookie
    response.cookies.set(getSessionCookieName(), token, getSessionCookieOptions());

    return response;
  } catch (e: any) {
    console.error("[Auth] Login error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
