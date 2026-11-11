
import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(
  withSupabase({ auth: ["user"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    try {
      // Pastikan pengguna sudah login
      const {
        data: { user },
        error: userError,
      } = await ctx.supabase.auth.getUser();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Silakan login kembali" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Pastikan pengguna memiliki role admin
      const { data: adminProfile, error: adminError } = await ctx.supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (adminError || adminProfile?.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Akses hanya untuk admin" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }

      const { nim, full_name } = await req.json();

      if (
        typeof nim !== "string" ||
        typeof full_name !== "string" ||
        !nim.trim() ||
        !full_name.trim()
      ) {
        return new Response(
          JSON.stringify({ error: "NIM dan nama lengkap wajib diisi" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const cleanNim = nim.trim();
      const cleanName = full_name.trim();

      // Client khusus untuk membuat akun menggunakan service role
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

      // Email internal dibuat dari NIM karena Supabase Auth memakai email
      const internalEmail = `${cleanNim}@mahasiswa.elrahma.local`;

      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email: internalEmail,
          password: cleanNim,
          email_confirm: true,
          user_metadata: {
            nim: cleanNim,
            full_name: cleanName,
          },
        });

      if (createError) {
        if (createError.message.toLowerCase().includes("already")) {
          return new Response(
            JSON.stringify({ error: "NIM atau akun mahasiswa sudah terdaftar" }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }

        throw createError;
      }

      // Simpan profil mahasiswa
      const { error: profileError } = await adminClient
        .from("profiles")
        .insert({
          id: newUser.user.id,
          nim: cleanNim,
          full_name: cleanName,
          role: "mahasiswa",
        });

      if (profileError) {
        // Hapus akun jika pembuatan profil gagal
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        throw profileError;
      }

      return new Response(
        JSON.stringify({
          message: "Mahasiswa berhasil ditambahkan",
          student: {
            id: newUser.user.id,
            nim: cleanNim,
            full_name: cleanName,
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("Create student error:", error);

      return new Response(
        JSON.stringify({ error: "Gagal membuat akun mahasiswa" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }),
);
