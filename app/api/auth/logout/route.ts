// app/api/auth/logout/route.ts
// Logout endpoint — mengganti Supabase signOut

import { NextResponse } from "next/server";
import { destroySession, getSessionCookieName } from "@/lib/auth";

export async function POST() {
  try {
    await destroySession();

    const response = NextResponse.json({ success: true });
    response.cookies.delete(getSessionCookieName());

    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
