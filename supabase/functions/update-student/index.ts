
import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(
  withSupabase({ auth: ["user"] }, async (req, ctx) => {
    try {
      const { data: authData, error: authError } =
        await ctx.supabase.auth.getUser();

      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: "Tidak memiliki akses." }),
          { status: 401 }
        );
      }

      // Periksa apakah pengguna adalah admin
      const { data: adminProfile, error: adminError } =
        await ctx.supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .single();

      if (adminError || adminProfile?.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Hanya admin yang boleh mengubah data." }),
          { status: 403 }
        );
      }

      const { id, nim, full_name } = await req.json();

      const cleanNim = String(nim || "").trim();
      const cleanName = String(full_name || "").trim();

      if (!id || !cleanNim || !cleanName) {
        return new Response(
          JSON.stringify({ error: "Semua data wajib diisi." }),
          { status: 400 }
        );
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data, error } = await adminClient
        .from("profiles")
        .update({
          nim: cleanNim,
          full_name: cleanName,
        })
        .eq("id", id)
        .eq("role", "mahasiswa")
        .select("id, nim, full_name")
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Data mahasiswa berhasil diperbarui.",
          student: data,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message || "Gagal memperbarui data mahasiswa.",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
  })
);
