
import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Koordinat pusat kampus STIKOM EL RAHMA
const CAMPUS_LATITUDE = -6.5902089;
const CAMPUS_LONGITUDE = 106.7856329;
const MAX_DISTANCE = 300;

// Menghitung jarak antara dua koordinat GPS menggunakan rumus Haversine
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadius = 6371000;

  const toRadians = (degree: number) => (degree * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}
// Menghitung tingkat kemiripan dua embedding wajah
function calculateFaceSimilarity(
  embedding1: number[],
  embedding2: number[],
): number {
  if (
    embedding1.length !== embedding2.length ||
    embedding1.length === 0
  ) {
    return 0;
  }

  let sum = 0;

  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }

  const distance = Math.round(100 * 25 * sum) / 100;

  if (distance === 0) return 1;

  const root = Math.sqrt(distance);
  const similarity = (1 - (root / 100) - 0.2) / (0.8 - 0.2);

  return Math.round(
    100 * Math.max(Math.min(similarity, 1), 0)
  ) / 100;
}

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
      const { action, latitude, longitude, face_embedding } = await req.json();

      if (!["check-in", "check-out"].includes(action)) {
        return new Response(
          JSON.stringify({ error: "Aksi absensi tidak valid" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
// Validasi embedding wajah dari kamera
if (
  !Array.isArray(face_embedding) ||
  face_embedding.length < 64 ||
  face_embedding.length > 2048 ||
  !face_embedding.every(
    (value: unknown) =>
      typeof value === "number" && Number.isFinite(value)
  )
) {
  return new Response(
    JSON.stringify({ error: "Data wajah tidak valid. Silakan ulangi verifikasi." }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}
      // Validasi koordinat GPS
      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return new Response(
          JSON.stringify({ error: "Koordinat GPS tidak valid. Aktifkan lokasi perangkat." }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // Hitung jarak pengguna dari kampus
      const distance = calculateDistance(
        latitude,
        longitude,
        CAMPUS_LATITUDE,
        CAMPUS_LONGITUDE,
      );

      if (distance > MAX_DISTANCE) {
        return new Response(
          JSON.stringify({
            error: `Kamu berada di luar area kampus. Jarak dari kampus sekitar ${Math.round(distance)} meter. Maksimal 300 meter.`,
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
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

      // Ambil data wajah mahasiswa yang sudah terdaftar
const { data: faceProfile, error: faceError } = await ctx.supabase
  .from("face_profiles")
  .select("face_embedding")
  .eq("student_id", profile.id)
  .maybeSingle();

if (faceError) {
  throw faceError;
}

if (!faceProfile?.face_embedding) {
  return new Response(
    JSON.stringify({ error: "Wajah belum terdaftar. Silakan hubungi admin." }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

const savedEmbedding = faceProfile.face_embedding;

if (
  !Array.isArray(savedEmbedding) ||
  savedEmbedding.length !== face_embedding.length ||
  !savedEmbedding.every(
    (value: unknown) =>
      typeof value === "number" && Number.isFinite(value)
  )
) {
  return new Response(
    JSON.stringify({ error: "Data wajah terdaftar tidak valid. Hubungi admin." }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );
}

// Bandingkan wajah dari kamera dengan wajah yang terdaftar
const similarity = calculateFaceSimilarity(
  face_embedding,
  savedEmbedding as number[],
);

// Ambang awal kemiripan 50%
if (similarity < 0.5) {
  return new Response(
    JSON.stringify({
      error: "Wajah tidak cocok dengan data yang terdaftar. Silakan coba lagi.",
    }),
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
          check_in_latitude: latitude,
          check_in_longitude: longitude,
          face_verified: true,
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
          check_out_latitude: latitude,
          check_out_longitude: longitude,
          face_verified: true,
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
