
import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(
  withSupabase({ auth: ["user"] }, async (req, ctx) => {
    try {
      // Periksa pengguna yang sedang login
      const { data: authData, error: authError } =
        await ctx.supabase.auth.getUser();

      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: "Tidak memiliki akses." }),
          { status: 401 }
        );
      }

      // Pastikan pengguna adalah admin
      const { data: adminProfile, error: adminError } =
        await ctx.supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .single();

      if (adminError || adminProfile?.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Hanya admin yang boleh menghapus mahasiswa." }),
          { status: 403 }
        );
      }

      const { id } = await req.json();

      if (!id) {
        return new Response(
          JSON.stringify({ error: "ID mahasiswa wajib diisi." }),
          { status: 400 }
        );
      }

      // Membuat koneksi admin Supabase
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Pastikan data yang akan dihapus benar-benar mahasiswa
      const { data: student, error: studentError } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", id)
        .eq("role", "mahasiswa")
        .single();

      if (studentError || !student) {
        return new Response(
          JSON.stringify({ error: "Data mahasiswa tidak ditemukan." }),
          { status: 404 }
        );
      }

      // Hapus pendaftaran wajah
      const { error: faceError } = await adminClient
        .from("face_profiles")
        .delete()
        .eq("student_id", id);

      if (faceError) throw faceError;

      // Hapus seluruh riwayat absensi
      const { error: attendanceError } = await adminClient
        .from("attendance")
        .delete()
        .eq("student_id", id);

      if (attendanceError) throw attendanceError;

      // Hapus profil mahasiswa
      const { error: profileError } = await adminClient
        .from("profiles")
        .delete()
        .eq("id", id)
        .eq("role", "mahasiswa");

      if (profileError) throw profileError;

      // Hapus akun login dari Supabase Auth
      const { error: deleteAuthError } =
        await adminClient.auth.admin.deleteUser(id);

      if (deleteAuthError) throw deleteAuthError;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Mahasiswa berhasil dihapus."
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message || "Gagal menghapus mahasiswa."
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400
        }
      );
    }
  })
);
