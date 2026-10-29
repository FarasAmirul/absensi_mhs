
import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

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
      const { action, latitude, longitude } = await req.json();

      if (!["check-in", "check-out"].includes(action)) {
        return new Response(
          JSON.stringify({ error: "Aksi absensi tidak valid" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const { data: { user }, error: userError } =
        await ctx.supabase.auth.getUser();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Silakan login kembali" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      const { data: profile, error: profileError } = await ctx.supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: "Profil pengguna tidak ditemukan" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      });

      const { data: attendance, error: attendanceError } =
        await ctx.supabase
          .from("attendance")
          .select("id, check_in_at, check_out_at")
          .eq("student_id", profile.id)
          .eq("attendance_date", today)
          .maybeSingle();

      if (attendanceError) {
        throw attendanceError;
      }

      if (action === "check-in") {
        if (attendance) {
          return new Response(
            JSON.stringify({ error: "Kamu sudah melakukan check-in hari ini" }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }

        const { error } = await ctx.supabase.from("attendance").insert({
          student_id: profile.id,
          attendance_date: today,
          check_in_at: new Date().toISOString(),
          check_in_latitude: latitude ?? null,
          check_in_longitude: longitude ?? null,
          face_verified: false,
          status: "hadir",
        });

        if (error) throw error;

        return new Response(
          JSON.stringify({ message: "Check-in berhasil!" }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      if (!attendance) {
        return new Response(
          JSON.stringify({ error: "Kamu belum melakukan check-in" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      if (attendance.check_out_at) {
        return new Response(
          JSON.stringify({ error: "Kamu sudah melakukan check-out hari ini" }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }

      const { error } = await ctx.supabase
        .from("attendance")
        .update({
          check_out_at: new Date().toISOString(),
          check_out_latitude: latitude ?? null,
          check_out_longitude: longitude ?? null,
        })
        .eq("id", attendance.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: "Check-out berhasil!" }),
        { headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("Attendance error:", error);

      return new Response(
        JSON.stringify({ error: "Absensi gagal diproses" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }),
);
