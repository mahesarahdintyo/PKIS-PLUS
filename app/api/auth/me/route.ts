import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ user: null, session: null }, { status: 200 });
    }

    // Sanitize user object (remove password hash)
    const { password_hash, ...safeUser } = user as any;

    return NextResponse.json({
      user: {
        id: safeUser.id,
        email: safeUser.email,
        created_at: safeUser.created_at,
        app_metadata: {},
        user_metadata: {
          username: safeUser.username,
        },
        profile: safeUser.profile,
      },
      session: {
        user: {
          id: safeUser.id,
          email: safeUser.email,
        },
      },
    });
  } catch (error: any) {
    console.error("[Auth ME API Error]:", error);
    return NextResponse.json({ user: null, session: null, error: error.message }, { status: 500 });
  }
}
