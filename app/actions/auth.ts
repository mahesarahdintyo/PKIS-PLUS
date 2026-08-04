"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(state: any, formData: FormData) {
  const usernameOrEmail = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!usernameOrEmail || !password) {
    return { error: "Username dan password wajib diisi." };
  }

  // Internally format username to email if it does not contain '@'
  const email = usernameOrEmail.includes("@")
    ? usernameOrEmail.trim().toLowerCase()
    : `${usernameOrEmail.trim().toLowerCase()}@futaba.co.id`;

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    let errorMsg = authError.message;
    if (errorMsg === "Invalid login credentials") {
      errorMsg = "Username atau password salah.";
    }
    return { error: errorMsg };
  }

  const user = authData.user;
  if (!user) {
    return { error: "User tidak ditemukan." };
  }

  // Ambil role dan land_id dari tabel profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, land_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { success: true, redirectUrl: "/operator", role: "operator", landId: null };
  }

  const role = profile.role;
  const landId = profile.land_id ?? null;
  const redirectUrl = role === "admin" ? "/admin" : "/operator";

  return { success: true, redirectUrl, role, landId };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
