// app/api/admin/users/[id]/route.ts
// Endpoint update & delete pengguna oleh Admin

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile, hashPassword } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentAdmin = await getCurrentUserProfile();
    if (!currentAdmin.user || currentAdmin.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya admin yang diizinkan." },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "User ID diperlukan." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const body = await request.json();
    const { role, fullName, lineId, password } = body;

    // Proteksi: Admin tidak boleh mendowngrade role dirinya sendiri
    if (targetUser.id === currentAdmin.user.id && role && role !== "admin") {
      return NextResponse.json(
        { error: "Anda tidak dapat mengubah role akun admin Anda sendiri." },
        { status: 400 }
      );
    }

    const validRoles = ["admin", "operator", "leader"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Role tidak valid. Harus salah satu dari: admin, operator, leader." },
        { status: 400 }
      );
    }

    // Update password jika disertakan
    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password baru minimal 6 karakter." },
          { status: 400 }
        );
      }
      await prisma.user.update({
        where: { id },
        data: {
          password_hash: hashPassword(password),
        },
      });
    }

    // Update profil
    const profileUpdateData: any = {};
    if (fullName !== undefined) profileUpdateData.full_name = String(fullName).trim();
    if (role !== undefined) profileUpdateData.role = role;
    if (lineId !== undefined) profileUpdateData.line_id = lineId || null;

    if (Object.keys(profileUpdateData).length > 0) {
      await prisma.profile.upsert({
        where: { id },
        create: {
          id,
          email: targetUser.email,
          full_name: profileUpdateData.full_name || targetUser.email.split("@")[0],
          role: profileUpdateData.role || "operator",
          line_id: profileUpdateData.line_id || null,
        },
        update: profileUpdateData,
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    return NextResponse.json({
      message: "Data pengguna berhasil diperbarui.",
      user: {
        id: updatedUser?.id,
        email: updatedUser?.email,
        fullName: updatedUser?.profile?.full_name,
        role: updatedUser?.profile?.role,
        lineId: updatedUser?.profile?.line_id,
      },
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/users/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui data pengguna." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentAdmin = await getCurrentUserProfile();
    if (!currentAdmin.user || currentAdmin.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya admin yang diizinkan." },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "User ID diperlukan." }, { status: 400 });
    }

    // Proteksi: Admin tidak boleh menghapus akun dirinya sendiri
    if (id === currentAdmin.user.id) {
      return NextResponse.json(
        { error: "Anda tidak dapat menghapus akun admin Anda sendiri." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    // Menghapus user (profile dan sessions terhapus otomatis karena CASCADE)
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Pengguna berhasil dihapus.",
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/users/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus pengguna." },
      { status: 500 }
    );
  }
}
