
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import FaceRecognition from "./FaceRecognition";
function AdminDashboard({ user, onLogout }) {
  const [activePage, setActivePage] = useState("dashboard");

  const [stats, setStats] = useState({
    totalMahasiswa: 0,
    hadir: 0,
    terlambat: 0,
    belumAbsen: 0,
  });

  const [recentAttendance, setRecentAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
const [loadingAttendance, setLoadingAttendance] = useState(false);
const [faceRegistrations, setFaceRegistrations] = useState([]);
const [loadingFaceRegistrations, setLoadingFaceRegistrations] = useState(false);
const [selectedFaceStudent, setSelectedFaceStudent] = useState(null);
  const [showStudentForm, setShowStudentForm] = useState(false);
const [studentNim, setStudentNim] = useState("");
const [studentName, setStudentName] = useState("");
const [savingStudent, setSavingStudent] = useState(false);
const [successMessage, setSuccessMessage] = useState("");

const [editingStudent, setEditingStudent] = useState(null);
const [editStudentNim, setEditStudentNim] = useState("");
const [editStudentName, setEditStudentName] = useState("");
const [updatingStudent, setUpdatingStudent] = useState(false);

const [deletingStudent, setDeletingStudent] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage("");

    try {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const { count: totalMahasiswa, error: mahasiswaError } =
        await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "mahasiswa");

      if (mahasiswaError) throw mahasiswaError;

      const { data: attendance, error: attendanceError } =
        await supabase
          .from("attendance")
          .select("*")
          .eq("attendance_date", today)
          .order("check_in_at", { ascending: false });

      if (attendanceError) throw attendanceError;

      const data = attendance || [];

      setStats({
        totalMahasiswa: totalMahasiswa || 0,
        hadir: data.filter((item) => item.status === "hadir").length,
        terlambat: data.filter((item) => item.status === "terlambat").length,
        belumAbsen: Math.max(0, (totalMahasiswa || 0) - data.length),
      });

      const { data: recent, error: recentError } = await supabase
        .from("attendance")
        .select("*")
        .order("attendance_date", { ascending: false })
        .order("check_in_at", { ascending: false })
        .limit(10);

      if (recentError) throw recentError;

      setRecentAttendance(recent || []);
    } catch (error) {
      console.error("Dashboard admin error:", error);
      setErrorMessage("Gagal memuat statistik dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents() {
    setLoadingStudents(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nim, full_name, created_at")
        .eq("role", "mahasiswa")
        .order("full_name", { ascending: true });

      if (error) throw error;

      setStudents(data || []);
    } catch (error) {
      console.error("Gagal memuat mahasiswa:", error);
      setErrorMessage("Gagal memuat data mahasiswa.");
    } finally {
      setLoadingStudents(false);
    }
  }

  async function loadAttendance() {
    setLoadingAttendance(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          attendance_date,
          check_in_at,
          check_out_at,
          face_verified,
          status,
          profiles (
            nim,
            full_name
          )
        `)
        .order("attendance_date", { ascending: false });

      if (error) throw error;

      setAttendance(data || []);
    } catch (error) {
      console.error("Gagal memuat data absensi:", error);
      setErrorMessage("Gagal memuat data absensi.");
    } finally {
      setLoadingAttendance(false);
    }
  }

  async function loadFaceRegistrations() {
  setLoadingFaceRegistrations(true);
  setErrorMessage("");

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        nim,
        full_name,
        face_profiles (
          id
        )
      `)
      .eq("role", "mahasiswa")
      .order("full_name", { ascending: true });

    if (error) throw error;

    setFaceRegistrations(data || []);
  } catch (error) {
    console.error("Gagal memuat pendaftaran wajah:", error);
    setErrorMessage("Gagal memuat data pendaftaran wajah.");
  } finally {
    setLoadingFaceRegistrations(false);
  }
}

function openFacePage() {
  setActivePage("wajah");
  loadFaceRegistrations();
}
  function openAttendancePage() {
    setActivePage("absensi");
    loadAttendance();
  }

  function openStudentsPage() {
    setActivePage("mahasiswa");
    loadStudents();
  }

  async function handleCreateStudent(e) {
  e.preventDefault();

  setSavingStudent(true);
  setErrorMessage("");
  setSuccessMessage("");

  try {
    const { data, error } = await supabase.functions.invoke(
      "create-student",
      {
        body: {
          nim: studentNim,
          full_name: studentName,
        },
      }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    setSuccessMessage("Mahasiswa berhasil ditambahkan.");

    setStudentNim("");
    setStudentName("");
    setShowStudentForm(false);

    await loadStudents();
    await loadDashboard();
  } catch (error) {
    console.error("Tambah mahasiswa error:", error);
    setErrorMessage(
      error.message || "Gagal menambahkan mahasiswa."
    );
  } finally {
    setSavingStudent(false);
  }
}
async function handleUpdateStudent(e) {
  e.preventDefault();

  if (!editingStudent) return;

  setUpdatingStudent(true);
  setErrorMessage("");
  setSuccessMessage("");

  try {
    const { data, error } = await supabase.functions.invoke(
      "update-student",
      {
        body: {
          id: editingStudent.id,
          nim: editStudentNim,
          full_name: editStudentName,
        },
      }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    setSuccessMessage("Data mahasiswa berhasil diperbarui.");
    setEditingStudent(null);
    setEditStudentNim("");
    setEditStudentName("");

    await loadStudents();
    await loadDashboard();
  } catch (error) {
    console.error("Edit mahasiswa error:", error);
    setErrorMessage(error.message || "Gagal memperbarui mahasiswa.");
  } finally {
    setUpdatingStudent(false);
  }
}

async function handleDeleteStudent(student) {
  const confirmDelete = window.confirm(
    `Yakin ingin menghapus mahasiswa ${student.full_name}? Data absensi dan wajahnya juga akan dihapus permanen.`
  );

  if (!confirmDelete) return;

  setDeletingStudent(true);
  setErrorMessage("");
  setSuccessMessage("");

  try {
    const { data, error } = await supabase.functions.invoke(
      "delete-student",
      {
        body: {
          id: student.id,
        },
      }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    setSuccessMessage("Mahasiswa berhasil dihapus.");

    await loadStudents();
    await loadDashboard();
  } catch (error) {
    console.error("Hapus mahasiswa error:", error);
    setErrorMessage(error.message || "Gagal menghapus mahasiswa.");
  } finally {
    setDeletingStudent(false);
  }
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
    if (!value) return "-";

    return new Date(`${value}T00:00:00+07:00`).toLocaleDateString(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="brand">
          <div className="brand-logo">EA</div>
          <div>
            <h1>ELRAHMA</h1>
            <p>ADMIN PANEL</p>
          </div>
        </div>

        <nav className="admin-menu">
          <button
            className={activePage === "dashboard" ? "active" : ""}
            type="button"
            onClick={() => setActivePage("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={activePage === "mahasiswa" ? "active" : ""}
            type="button"
            onClick={openStudentsPage}
          >
            Data Mahasiswa
          </button>

          <button
  className={activePage === "absensi" ? "active" : ""}
  type="button"
  onClick={openAttendancePage}
>
  Data Absensi
</button>

          <button
  className={activePage === "wajah" ? "active" : ""}
  type="button"
  onClick={openFacePage}
>
  Pendaftaran Wajah
</button>
        </nav>

        <button
          className="admin-logout"
          type="button"
          onClick={onLogout}
        >
          Keluar
        </button>
      </aside>

      <main className="admin-main">
        {errorMessage && (
          <p role="alert" style={{ color: "#dc2626" }}>
            {errorMessage}
          </p>
        )}

        {activePage === "dashboard" && (
          <>
            <header className="admin-header">
              <div>
                <h2>Dashboard Admin</h2>
                <p>
                  Selamat datang, {user.full_name || user.nim}
                </p>
              </div>
            </header>

            <div className="admin-stats">
              <div className="admin-stat-card">
                <p>Total Mahasiswa</p>
                <h3>{loading ? "..." : stats.totalMahasiswa}</h3>
              </div>

              <div className="admin-stat-card">
                <p>Hadir Hari Ini</p>
                <h3>{loading ? "..." : stats.hadir}</h3>
              </div>

              <div className="admin-stat-card">
                <p>Terlambat Hari Ini</p>
                <h3>{loading ? "..." : stats.terlambat}</h3>
              </div>

              <div className="admin-stat-card">
                <p>Belum Absen</p>
                <h3>{loading ? "..." : stats.belumAbsen}</h3>
              </div>
            </div>

            <section className="admin-section">
              <h3>Absensi Terbaru</h3>

              {loading ? (
                <p>Memuat data...</p>
              ) : recentAttendance.length === 0 ? (
                <p>Belum ada data absensi.</p>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>ID Mahasiswa</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentAttendance.map((item) => (
                        <tr key={item.id}>
                          <td>{formatDate(item.attendance_date)}</td>
                          <td>{item.student_id}</td>
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
                style={{ maxWidth: 180, marginTop: 20 }}
                onClick={loadDashboard}
                disabled={loading}
              >
                Muat Ulang Data
              </button>
            </section>
          </>
        )}

        {activePage === "mahasiswa" && (
          <>
            <header className="admin-header">
              <div>
                <h2>Data Mahasiswa</h2>
                <p>Daftar mahasiswa STIKOM EL RAHMA</p>
              </div>
            </header>

            
<section className="admin-section">
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 20
  }}>
    <h3 style={{ margin: 0 }}>Daftar Mahasiswa</h3>

    <button
      className="login-button"
      type="button"
      style={{ maxWidth: 180 }}
      onClick={() => {
        setShowStudentForm(!showStudentForm);
        setErrorMessage("");
        setSuccessMessage("");
      }}
    >
      {showStudentForm ? "Batal" : "+ Tambah Mahasiswa"}
    </button>
  </div>

  {showStudentForm && (
    <form onSubmit={handleCreateStudent} style={{ marginBottom: 25 }}>
      <div style={{ marginBottom: 15 }}>
        <label>NIM Mahasiswa</label>
        <input
          type="text"
          value={studentNim}
          onChange={(e) => setStudentNim(e.target.value)}
          placeholder="Masukkan NIM"
          required
        />
      </div>

      <div style={{ marginBottom: 15 }}>
        <label>Nama Lengkap</label>
        <input
          type="text"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="Masukkan nama lengkap"
          required
        />
      </div>

      <p style={{ fontSize: 13, color: "#64748b" }}>
        Password awal mahasiswa akan menggunakan NIM.
      </p>

      <button
        className="login-button"
        type="submit"
        disabled={savingStudent}
      >
        {savingStudent ? "Menyimpan..." : "Simpan Mahasiswa"}
      </button>
    </form>
  )}
{editingStudent && (
  <form onSubmit={handleUpdateStudent} style={{ marginBottom: 25 }}>
    <h3>Edit Data Mahasiswa</h3>

    <div style={{ marginBottom: 15 }}>
      <label>NIM Mahasiswa</label>
      <input
        type="text"
        value={editStudentNim}
        onChange={(e) => setEditStudentNim(e.target.value)}
        placeholder="Masukkan NIM"
        required
      />
    </div>

    <div style={{ marginBottom: 15 }}>
      <label>Nama Lengkap</label>
      <input
        type="text"
        value={editStudentName}
        onChange={(e) => setEditStudentName(e.target.value)}
        placeholder="Masukkan nama lengkap"
        required
      />
    </div>

    <button
      className="login-button"
      type="submit"
      disabled={updatingStudent}
    >
      {updatingStudent ? "Menyimpan..." : "Simpan Perubahan"}
    </button>
<button
  className="login-button"
  type="button"
  onClick={() => {
    setEditingStudent(null);
    setEditStudentNim("");
    setEditStudentName("");
    setErrorMessage("");
    setSuccessMessage("");
  }}
  style={{ marginLeft: 10, maxWidth: 180 }}
>
  Batal
</button>
  </form>
)}
  {successMessage && (
    <p style={{ color: "green" }}>{successMessage}</p>
  )}

  {loadingStudents ? (
    <p>Memuat data mahasiswa...</p>
  ) : students.length === 0 ? (
    <p>Belum ada data mahasiswa.</p>
  ) : (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>NIM</th>
            <th>Nama Lengkap</th>
            <th>Tanggal Terdaftar</th>
            <th>Aksi</th>
          </tr>
        </thead>

        <tbody>
          {students.map((student, index) => (
            <tr key={student.id}>
              <td>{index + 1}</td>
              <td>{student.nim}</td>
              <td>{student.full_name}</td>
              <td>{formatDate(student.created_at?.slice(0, 10))}</td>
              <td>
  <button
    type="button"
    onClick={() => {
      setEditingStudent(student);
      setEditStudentNim(student.nim);
      setEditStudentName(student.full_name);
      setShowStudentForm(false);
      setErrorMessage("");
      setSuccessMessage("");
    }}
  >
    Edit
  </button>
  <button
    type="button"
    onClick={() => handleDeleteStudent(student)}
    disabled={deletingStudent}
    style={{ marginLeft: 10 }}
  >
    Hapus
  </button>
  
</td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}

  <button
    className="login-button"
    type="button"
    style={{ maxWidth: 180, marginTop: 20 }}
    onClick={loadStudents}
    disabled={loadingStudents}
  >
    Muat Ulang Data
  </button>
</section>

          </>
        )}

        {activePage === "absensi" && (
          <>
            <header className="admin-header">
              <div>
                <h2>Data Absensi</h2>
                <p>Riwayat absensi mahasiswa STIKOM EL RAHMA</p>
              </div>
            </header>

            <section className="admin-section">
              <h3>Daftar Absensi Mahasiswa</h3>

              {loadingAttendance ? (
                <p>Memuat data absensi...</p>
              ) : attendance.length === 0 ? (
                <p>Belum ada data absensi.</p>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>NIM</th>
                        <th>Nama Mahasiswa</th>
                        <th>Tanggal</th>
                        <th>Jam Masuk</th>
                        <th>Jam Keluar</th>
                        <th>Status</th>
                        <th>Verifikasi Wajah</th>
                      </tr>
                    </thead>

                    <tbody>
                      {attendance.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.profiles?.nim || "-"}</td>
                          <td>{item.profiles?.full_name || "-"}</td>
                          <td>{formatDate(item.attendance_date)}</td>
                          <td>{formatTime(item.check_in_at)}</td>
                          <td>{formatTime(item.check_out_at)}</td>
                          <td>{item.status}</td>
                          <td>
                            {item.face_verified ? "Terverifikasi" : "Tidak"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                className="login-button"
                type="button"
                style={{ maxWidth: 180, marginTop: 20 }}
                onClick={loadAttendance}
                disabled={loadingAttendance}
              >
                Muat Ulang Data
              </button>
            </section>
          </>
        )}

        {activePage === "wajah" && (
          <>
            <header className="admin-header">
              <div>
                <h2>Pendaftaran Wajah</h2>
                <p>Status pendaftaran wajah mahasiswa STIKOM EL RAHMA</p>
              </div>
            </header>

            <section className="admin-section">
              <h3>Daftar Pendaftaran Wajah</h3>

              {loadingFaceRegistrations ? (
                <p>Memuat data pendaftaran wajah...</p>
              ) : faceRegistrations.length === 0 ? (
                <p>Belum ada data mahasiswa.</p>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>NIM</th>
                        <th>Nama Mahasiswa</th>
                        <th>Status Wajah</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>

                    <tbody>
                      {faceRegistrations.map((student, index) => (
                        <tr key={student.id}>
                          <td>{index + 1}</td>
                          <td>{student.nim}</td>
                          <td>{student.full_name}</td>
                          <td>
                           {(
  Array.isArray(student.face_profiles)
    ? student.face_profiles.length > 0
    : Boolean(student.face_profiles?.id)
)
                              ? "Sudah Terdaftar"
                              : "Belum Terdaftar"}
                          </td>
                          <td>
  <button
    type="button"
    onClick={() => setSelectedFaceStudent(student)}
  >
    Pilih
  </button>
</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
  {selectedFaceStudent && (
                <div style={{ marginTop: 30 }}>
                  <h3>Daftarkan Wajah Mahasiswa</h3>

                  <p>
                    NIM: {selectedFaceStudent.nim}
                    <br />
                    Nama: {selectedFaceStudent.full_name}
                  </p>

                  <FaceRecognition
                    user={{ id: selectedFaceStudent.id }}
                  />

                  <button
                    className="login-button"
                    type="button"
                    style={{ marginTop: 10, maxWidth: 180 }}
                    onClick={() => setSelectedFaceStudent(null)}
                  >
                    Tutup Kamera
                  </button>
                </div>
              )}
              <button
                className="login-button"
                type="button"
                style={{ maxWidth: 180, marginTop: 20 }}
                onClick={loadFaceRegistrations}
                disabled={loadingFaceRegistrations}
              >
                Muat Ulang Data
              </button>
            </section>
          </>
        )}

      </main>
    </div>
  );
}

export default AdminDashboard;
