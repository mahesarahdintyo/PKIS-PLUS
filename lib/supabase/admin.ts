// lib/supabase/admin.ts
// ============================================================
// COMPATIBILITY SHIM — Supabase Admin Client → Prisma
// Mengganti createAdminClient() dengan Prisma direct access.
// Admin client memiliki akses penuh tanpa RLS filter.
// ============================================================

import { prisma } from "@/lib/prisma";
import { SupabaseLikeQuery } from "@/lib/supabase/server";

// Re-export prisma sebagai admin client
export function createAdminClient() {
  return {
    from(table: string) {
      return new SupabaseLikeQuery(table);
    },
    storage: {
      from(bucket: string) {
        return {
          remove: async (paths: string[]) => {
            const fs = await import("fs/promises");
            const path = await import("path");
            const uploadDir = process.env.UPLOAD_DIR || "./public/uploads";
            for (const filePath of paths) {
              try {
                await fs.unlink(path.join(uploadDir, filePath));
              } catch {
                // Ignore missing files
              }
            }
            return { data: paths, error: null };
          },
        };
      },
    },
    auth: {
      async admin() {
        return {
          async listUsers() {
            const users = await prisma.user.findMany({
              include: { profile: true },
            });
            return { data: { users }, error: null };
          },
        };
      },
    },
  };
}
