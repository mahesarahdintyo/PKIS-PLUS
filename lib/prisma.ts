// lib/prisma.ts
// Singleton PrismaClient — mengganti @supabase/supabase-js untuk semua operasi database.
// Gunakan pola global variable agar tidak membuat koneksi baru di setiap hot-reload dev.

import { PrismaClient } from "@prisma/client";

// Global BigInt JSON serialization polyfill agar NextResponse.json / JSON.stringify tidak throw error saat model Prisma memiliki field BigInt
if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    const num = Number(this);
    return Number.isSafeInteger(num) ? num : this.toString();
  };
}

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
