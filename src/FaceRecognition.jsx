import { useEffect, useRef, useState } from "react";
import Human from "@vladmandic/human";
import { supabase } from "./supabase";

const human = new Human({
  backend: "webgl",
  modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human/models/",
  face: {
    enabled: true,
    detector: {
      maxDetected: 1,
      minConfidence: 0.5,
    },
    mesh: { enabled: true },
    iris: { enabled: false },
    emotion: { enabled: false },
    description: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
});

function FaceRecognition({ user, mode = "register", onVerify }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const runningRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);
  const [currentEmbedding, setCurrentEmbedding] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(
    "Klik tombol untuk membuka kamera."
  );

  async function startCamera() {
    try {
      setLoading(true);
      setMessage("Meminta izin kamera...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: 640,
          height: 480,
        },
        audio: false,
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      await videoRef.current.play();

      setMessage("Memuat model pengenalan wajah...");

      await human.load();

      runningRef.current = true;
      setActive(true);
      setMessage("Kamera aktif. Sedang mendeteksi wajah...");

      detectFace();
    } catch (error) {
      console.error("Face recognition error:", error);

      stopCamera();

      setMessage(
        "Gagal membuka kamera atau memuat model. Periksa izin kamera dan koneksi internet."
      );
    } finally {
      setLoading(false);
    }
  }

  async function detectFace() {
    if (!runningRef.current || !videoRef.current) return;

    try {
      const result = await human.detect(videoRef.current);

      if (!runningRef.current) return;

      if (
  result.face &&
  result.face.length > 0 &&
  result.face[0].embedding
) {
  setCurrentEmbedding(Array.from(result.face[0].embedding));
  setMessage("Wajah berhasil terdeteksi!");
} else {
  setCurrentEmbedding(null);
  setMessage("Wajah belum terdeteksi. Arahkan wajah ke kamera.");
}
    } catch (error) {
      console.error("Detection error:", error);
      setMessage("Terjadi kesalahan saat mendeteksi wajah.");
      return;
    }

    if (runningRef.current) {
      frameRef.current = requestAnimationFrame(detectFace);
    }
  }
  async function registerFace() {
  if (!user?.id) {
    setMessage("Data pengguna tidak ditemukan.");
    return;
  }

  if (!currentEmbedding) {
    setMessage("Wajah belum terdeteksi. Arahkan wajah ke kamera.");
    return;
  }

  try {
    setSaving(true);
    setMessage("Menyimpan data wajah...");

    const { error } = await supabase
      .from("face_profiles")
      .upsert(
        {
          student_id: user.id,
          face_embedding: currentEmbedding,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id" }
      );

    if (error) throw error;

    setMessage("Pendaftaran wajah berhasil disimpan!");
  } catch (error) {
    console.error("Gagal mendaftarkan wajah:", error);
    setMessage("Gagal menyimpan wajah. Periksa izin akses database.");
  } finally {
    setSaving(false);
  }
}

  function stopCamera() {
    runningRef.current = false;

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setActive(false);
  }

  useEffect(() => {
    return () => {
      runningRef.current = false;

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ marginTop: 24, marginBottom: 24 }}>
      <h3>Face Recognition</h3>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          maxWidth: "480px",
          borderRadius: "12px",
          background: "#18243b",
          display: "block",
          marginBottom: 12,
        }}
      />

      <p>{message}</p>
      {mode === "register" ? (
  <button
    className="login-button"
    type="button"
    onClick={registerFace}
    disabled={!active || !currentEmbedding || saving}
    style={{ marginBottom: 12 }}
  >
    {saving ? "Menyimpan..." : "Daftarkan Wajah"}
  </button>
) : (
  <button
    className="login-button"
    type="button"
    onClick={async () => {
      if (!currentEmbedding || !onVerify) return;

      try {
        setSaving(true);
        setMessage("Mengirim wajah untuk diverifikasi...");
        await onVerify(currentEmbedding);
      } catch (error) {
        setMessage(error.message || "Verifikasi wajah gagal.");
      } finally {
        setSaving(false);
      }
    }}
    disabled={!active || !currentEmbedding || saving}
    style={{ marginBottom: 12 }}
  >
    {saving ? "Memverifikasi..." : "Verifikasi Wajah"}
  </button>
)}
      {!active ? (
        <button
          className="login-button"
          type="button"
          onClick={startCamera}
          disabled={loading}
        >
          {loading ? "Memuat..." : "Buka Kamera"}
        </button>
      ) : (
        <button
          className="login-button"
          type="button"
          onClick={stopCamera}
        >
          Matikan Kamera
        </button>
      )}
    </div>
  );
}

export default FaceRecognition;
