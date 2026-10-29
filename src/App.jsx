
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import "./App.css";

function App() {
  const [nim, setNim] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [history, setHistory] = useState([]);

  const loadAttendance = useCallback(async () => {
    if (!user) return;

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", user.id)
      .order("attendance_date", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Load attendance error:", error);
      setErrorMessage("Gagal memuat data absensi.");
      return;
    }

    setHistory(data || []);
    setTodayAttendance(
      (data || []).find((item) => item.attendance_date === today) || null
    );
  }, [user]);

  useEffect(() => {
    if (user) loadAttendance();
  }, [user, loadAttendance]);

  async function handleLogin(event) {
    event.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("login-nim", {
        body: { nim: nim.trim(), password },
      });

      if (error) {
        throw new Error("Tidak dapat menghubungi server login. Coba lagi.");
      }

      if (!data?.session || !data?.user) {
        throw new Error(data?.error || "NIM atau password salah.");
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) throw sessionError;

      setUser(data.user);
      setPassword("");
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage(error.message || "Login gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAttendance(action) {
    setAttendanceLoading(true);
    setErrorMessage("");
    setNotice("");

    try {
      const { data, error } = await supabase.functions.invoke("attendance", {
        body: { action },
      });

      if (error) {
        throw new Error(
          data?.error || error.message || "Gagal menghubungi server absensi."
        );
      }

      if (data?.error) throw new Error(data.error);

      setNotice(data?.message || "Absensi berhasil.");
      await loadAttendance();
    } catch (error) {
      console.error("Attendance error:", error);
      setErrorMessage(error.message || "Absensi gagal diproses.");
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage("Gagal keluar dari akun. Silakan coba lagi.");
      setLoading(false);
      return;
    }

    setUser(null);
    setTodayAttendance(null);
    setHistory([]);
    setNim("");
    setPassword("");
    setErrorMessage("");
    setNotice("");
    setLoading(false);
  }

  function formatTime(value) {
    if (!value) return "-";

    return new Date(value).toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(value) {
    return new Date(`${value}T00:00:00+07:00`).toLocaleDateString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  if (user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand">
            <div className="brand-logo">EA</div>
            <div>
              <h1>ELRAHMA</h1>
              <p>ATTENDANCE SYSTEM</p>
            </div>
          </div>

          <div className="login-heading">
            <span className="welcome-badge">DASHBOARD ABSENSI</span>
            <h2>Selamat Datang!</h2>
            <p>Halo, {user.full_name || user.nim}.</p>
          </div>

          <div className="register-notice">
            <div className="notice-icon">✓</div>
            <div>
              <strong>Akun berhasil diverifikasi</strong>
              <p>NIM: {user.nim}</p>
              <p>Role: {user.role}</p>
            </div>
          </div>

          <h3>Absensi Hari Ini</h3>

          <div className="register-notice">
            <div>
              <p>
                <strong>Status:</strong>{" "}
                {todayAttendance
                  ? todayAttendance.status
                  : "Belum melakukan check-in"}
              </p>
              <p>
                <strong>Check-in:</strong>{" "}
                {formatTime(todayAttendance?.check_in_at)}
              </p>
              <p>
                <strong>Check-out:</strong>{" "}
                {formatTime(todayAttendance?.check_out_at)}
              </p>
            </div>
          </div>

          {errorMessage && (
            <p role="alert" style={{ color: "#dc2626", fontSize: 14 }}>
              {errorMessage}
            </p>
          )}

          {notice && (
            <p role="status" style={{ color: "#15803d", fontSize: 14 }}>
              {notice}
            </p>
          )}

          <button
            className="login-button"
            type="button"
            onClick={() => handleAttendance("check-in")}
            disabled={
              attendanceLoading ||
              Boolean(todayAttendance?.check_in_at)
            }
          >
            {attendanceLoading
              ? "Memproses..."
              : todayAttendance?.check_in_at
                ? "Sudah Check-in"
                : "Check-in"}
          </button>

          <button
            className="login-button"
            type="button"
            style={{ marginTop: 8 }}
            onClick={() => handleAttendance("check-out")}
            disabled={
              attendanceLoading ||
              !todayAttendance?.check_in_at ||
              Boolean(todayAttendance?.check_out_at)
            }
          >
            {attendanceLoading
              ? "Memproses..."
              : todayAttendance?.check_out_at
                ? "Sudah Check-out"
                : "Check-out"}
          </button>

          <h3 style={{ marginTop: 24 }}>Riwayat Absensi</h3>

          {history.length === 0 ? (
            <p>Belum ada riwayat absensi.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Masuk</th>
                    <th>Pulang</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.attendance_date)}</td>
                      <td>{formatTime(item.check_in_at)}</td>
                      <td>{formatTime(item.check_out_at)}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            className="login-button"
            type="button"
            style={{ marginTop: 20 }}
            onClick={handleLogout}
            disabled={loading || attendanceLoading}
          >
            {loading ? "Memproses..." : "Keluar"}
          </button>

          <div className="login-footer">
            <p>Absensi Digital Mahasiswa</p>
            <p>© 2026 STIKOM EL RAHMA</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand">
          <div className="brand-logo">EA</div>
          <div>
            <h1>ELRAHMA</h1>
            <p>ATTENDANCE SYSTEM</p>
          </div>
        </div>

        <div className="login-heading">
          <span className="welcome-badge">STIKOM EL RAHMA</span>
          <h2>Selamat Datang!</h2>
          <p>
            Masuk menggunakan NIM dan password akun yang telah didaftarkan
            oleh admin.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="nim">Nomor Induk Mahasiswa (NIM)</label>
            <input
              id="nim"
              type="text"
              placeholder="Masukkan NIM Anda"
              value={nim}
              onChange={(event) => setNim(event.target.value)}
              autoComplete="username"
              maxLength={50}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Masukkan password Anda"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              maxLength={128}
              required
              disabled={loading}
            />
          </div>

          {errorMessage && (
            <p role="alert" style={{ color: "#dc2626", fontSize: 14 }}>
              {errorMessage}
            </p>
          )}

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Memverifikasi..." : "Masuk ke Sistem"}
            {!loading && <span aria-hidden="true"> →</span>}
          </button>
        </form>

        <div className="register-notice">
          <div className="notice-icon">i</div>
          <div>
            <strong>Belum memiliki akun?</strong>
            <p>Silakan hubungi admin kampus untuk pembuatan akun absensi.</p>
          </div>
        </div>

        <div className="login-footer">
          <p>Absensi Digital Mahasiswa</p>
          <p>© 2026 STIKOM EL RAHMA</p>
        </div>
      </section>

      <aside className="login-info">
        <div className="info-content">
          <span className="info-label">SMART CAMPUS SOLUTION</span>
          <h2>Absensi Lebih Mudah, Cepat, dan Terintegrasi.</h2>
          <p>
            Sistem absensi digital menggunakan pengenalan wajah dan lokasi
            untuk membantu pencatatan kehadiran mahasiswa.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Face Recognition</strong>
                <p>Verifikasi wajah mahasiswa</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⌖</span>
              <div>
                <strong>Location Verification</strong>
                <p>Validasi lokasi melalui GPS</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">◷</span>
              <div>
                <strong>Real-time Attendance</strong>
                <p>Pencatatan kehadiran digital</p>
              </div>
            </div>
          </div>
        </div>

        <p className="info-copyright">
          DIGITAL ATTENDANCE MANAGEMENT SYSTEM
        </p>
      </aside>
    </main>
  );
}

export default App;
