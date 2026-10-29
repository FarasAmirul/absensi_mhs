
import { supabase } from "./supabase.js";

async function testConnection() {
  console.log("Memulai tes koneksi Supabase...");

  const { data, error } = await supabase
    .from("campus_locations")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Tes Supabase gagal:", error.message);
    return;
  }

  console.log("Koneksi Supabase berhasil!");
  console.log("Data lokasi kampus:", data);
}

testConnection();
