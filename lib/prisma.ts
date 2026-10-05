// lib/prisma.ts
// Singleton PrismaClient — mengganti @supabase/supabase-js untuk semua operasi database.
// Gunakan pola global variable agar tidak membuat koneksi baru di setiap hot-reload dev.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
