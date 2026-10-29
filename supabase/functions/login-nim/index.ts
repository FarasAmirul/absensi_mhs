
import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase(
    { auth: ["publishable"] },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Metode tidak diizinkan." },
          { status: 405 },
        );
      }

      try {
        const body = await req.json();
        const nim =
          typeof body.nim === "string" ? body.nim.trim() : "";
        const password =
          typeof body.password === "string" ? body.password : "";

        if (!nim || !password || nim.length > 50 || password.length > 128) {
          return Response.json(
            { error: "NIM atau password tidak valid." },
            { status: 400 },
          );
        }

        // Cari profil berdasarkan NIM di sisi server.
        const { data: profile, error: profileError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .select("id, nim, full_name, role")
            .eq("nim", nim)
            .maybeSingle();

        if (profileError || !profile) {
          return Response.json(
            { error: "NIM atau password salah." },
            { status: 401 },
          );
        }

        // Ambil email autentikasi berdasarkan ID profil.
        const { data: userData, error: userError } =
          await ctx.supabaseAdmin.auth.admin.getUserById(profile.id);

        const email = userData.user?.email;

        if (userError || !email) {
          console.error("Akun Auth tidak ditemukan untuk profil.");
          return Response.json(
            { error: "Akun belum dikonfigurasi dengan benar." },
            { status: 500 },
          );
        }

        // Verifikasi password melalui Supabase Auth.
        const { data: authData, error: authError } =
          await ctx.supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (authError || !authData.user || !authData.session) {
          return Response.json(
            { error: "NIM atau password salah." },
            { status: 401 },
          );
        }

        // Pastikan pengguna yang berhasil login cocok dengan profilnya.
        if (authData.user.id !== profile.id) {
          return Response.json(
            { error: "Autentikasi gagal." },
            { status: 401 },
          );
        }

        return Response.json({
          message: "Login berhasil.",
          user: {
            id: profile.id,
            nim: profile.nim,
            full_name: profile.full_name,
            role: profile.role,
          },
          session: authData.session,
        });
      } catch (error) {
        console.error("Login function error:", error);

        return Response.json(
          { error: "Terjadi kesalahan pada server." },
          { status: 500 },
        );
      }
    },
  ),
};
