// app/api/admin/users/route.ts
// Endpoint manajemen user oleh Admin (List dan Buat Akun Baru)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile, hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    const currentAdmin = await getCurrentUserProfile();
    if (!currentAdmin.user || currentAdmin.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya admin yang diizinkan." },
        { status: 403 }
      );
    }

    const [users, lines] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          created_at: true,
          updated_at: true,
          profile: {
            select: {
              id: true,
              email: true,
              full_name: true,
              role: true,
              line_id: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      }),
      prisma.line.findMany({
        where: {
          OR: [{ is_active: true }, { is_active: null }],
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    const linesMap = new Map<string, string>();
    lines.forEach((l) => linesMap.set(l.id, l.name));

    const formattedUsers = users.map((u) => {
      const lineId = u.profile?.line_id;
      return {
        id: u.id,
        email: u.email,
        fullName: u.profile?.full_name || u.email.split("@")[0],
        role: u.profile?.role || "operator",
        lineId: lineId || null,
        lineName: lineId ? linesMap.get(lineId) || "Line Tidak Ditemukan" : null,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
        isSelf: u.id === currentAdmin.user.id,
      };
    });

    return NextResponse.json({
      users: formattedUsers,
      lines,
    });
  } catch (error: any) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar pengguna." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentAdmin = await getCurrentUserProfile();
    if (!currentAdmin.user || currentAdmin.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya admin yang diizinkan." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username, fullName, password, role, lineId } = body;

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

    const validRoles = ["admin", "operator", "leader"];
    const targetRole = validRoles.includes(role) ? role : "operator";

    const trimmedUsername = String(username).trim().toLowerCase();
    const emailValue = trimmedUsername.includes("@")
      ? trimmedUsername
      : trimmedUsername === "admin"
      ? "admin@pabrik.local"
      : trimmedUsername === "operator"
      ? "operator@pabrik.local"
      : `${trimmedUsername}@futaba.co.id`;

    // Cek duplikasi
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailValue },
          { email: trimmedUsername },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Username atau email sudah digunakan." },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        email: emailValue,
        password_hash: passwordHash,
        profile: {
          create: {
            email: emailValue,
            full_name: fullName ? String(fullName).trim() : trimmedUsername,
            role: targetRole,
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
        message: "Pengguna berhasil dibuat.",
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
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Gagal membuat pengguna baru." },
      { status: 500 }
    );
  }
}
