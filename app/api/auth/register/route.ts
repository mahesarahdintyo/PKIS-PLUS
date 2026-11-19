// app/api/auth/register/route.ts
// Endpoint pendaftaran akun baru

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getCurrentUserProfile } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, fullName, password, lineId, requestedRole } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username/Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter." },
        { status: 400 }
      );
    }

    const trimmedUsername = String(username).trim().toLowerCase();
    const emailValue = trimmedUsername.includes("@")
      ? trimmedUsername
      : trimmedUsername === "admin"
      ? "admin@pabrik.local"
      : trimmedUsername === "operator"
      ? "operator@pabrik.local"
      : `${trimmedUsername}@futaba.co.id`;

    // Cek apakah user sudah terdaftar
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailValue },
          { email: trimmedUsername },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username atau email sudah terdaftar. Silakan gunakan yang lain." },
        { status: 409 }
      );
    }

    // Role default adalah 'operator' untuk pendaftaran publik.
    // Hanya jika ada admin yang sedang login dan mengirim requestedRole, role tersebut bisa dipakai.
    let finalRole = "operator";
    if (requestedRole && ["admin", "operator", "leader"].includes(requestedRole)) {
      const currentUser = await getCurrentUserProfile();
      if (currentUser?.role === "admin") {
        finalRole = requestedRole;
      }
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Buat User dan Profile dalam satu transaksi
    const newUser = await prisma.user.create({
      data: {
        email: emailValue,
        password_hash: passwordHash,
        profile: {
          create: {
            email: emailValue,
            full_name: fullName ? String(fullName).trim() : trimmedUsername,
            role: finalRole,
            line_id: lineId || null,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    return NextResponse.json(
      {
        message: "Akun berhasil didaftarkan.",
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.profile?.full_name,
          role: newUser.profile?.role,
          lineId: newUser.profile?.line_id,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server saat mendaftarkan akun." },
      { status: 500 }
    );
  }
}
