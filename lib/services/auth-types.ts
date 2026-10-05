// lib/services/auth-types.ts
// Shared type definitions untuk auth

export interface UserProfile {
  user: any | null;
  role: "admin" | "operator" | "leader" | null;
  lineId: string | null;
}
