// lib/services/auth-server.ts
// Server-side auth helper — Prisma-based (mengganti Supabase auth)

import { getCurrentUserProfile } from "@/lib/auth";

export type { UserProfile } from "@/lib/services/auth-types";
export { getCurrentUserProfile };
