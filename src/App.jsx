import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  LayoutGrid, 
  Fingerprint, 
  GraduationCap, 
  Power, 
  Search, 
  ShieldCheck,
  RotateCw,
  Info,
  User,
  Eraser,
  CheckCircle,
  BookMarked,
  Filter,
  ArrowUpRight,
  Target
} from 'lucide-react';

const KC_URL = "https://id.tif.uin-suska.ac.id";
const BASE_URL = "https://api.tif.uin-suska.ac.id/setoran-dev/v1";

const api = {
  login: async (username, password) => {
    const response = await fetch(`${KC_URL}/realms/dev/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "setoran-mobile-dev",
        client_secret: "aqJp3xnXKudgC7RMOshEQP7ZoVKWzoSl",
        grant_type: "password",
        username,
        password,
      }),
    });
    if (!response.ok) throw new Error("Gagal login");
    return response.json();
  },
  getSetoran: async (nim, token) => {
    const response = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  },
  simpanSetoran: async (nim, token, data) => {
    const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  deleteSetoran: async (nim, token, data) => {
    const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getMahasiswaBimbingan: async (token) => {
    const response = await fetch(`${BASE_URL}/dosen/pa-saya`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  }
};

const App = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [data, setData] = useState(null);
  const [selectedSurah, setSelectedSurah] = useState([]);
  const [searchNim, setSearchNim] = useState("");
  const [activeNim, setActiveNim] = useState("");
  const [notif, setNotif] = useState(null);
  const [mahasiswaBimbingan, setMahasiswaBimbingan] = useState([]);
  const [loadingBimbingan, setLoadingBimbingan] = useState(false);
  const notifTimer = useRef(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [dosenInfo, setDosenInfo] = useState({ nama: "Dosen Verifikator", email: "" });
  const [progressCache, setProgressCache] = useState({});

  const calculateProgress = useCallback((detailArray) => {
    if (!detailArray || detailArray.length === 0) return 0;
    const completed = detailArray.filter(item => item.sudah_setor).length;
    return Math.round((completed / detailArray.length) * 100);
  }, []);

  const syncAllProgress = useCallback(async (list, currentToken) => {
    const updates = {};
    const promises = list.map(async (mhs) => {
      const mhsNim = String(mhs.nim || mhs.nim_mhs || mhs.id);
      try {
        const res = await api.getSetoran(mhsNim, currentToken);
        if (res.response && res.data?.setoran?.detail) {
          updates[mhsNim] = calculateProgress(res.data.setoran.detail);
        }
      } catch (e) { console.error("Gagal sync progres:", mhsNim); }
    });
    await Promise.all(promises);
    setProgressCache(prev => ({ ...prev, ...updates }));
  }, [calculateProgress]);

  const fetchMahasiswaBimbingan = useCallback(() => {
    if (!token) return;
    setLoadingBimbingan(true);
    api.getMahasiswaBimbingan(token)
      .then((res) => {
        if (res.response === true) {
          const list = res.data?.info_mahasiswa_pa?.daftar_mahasiswa || res.data || [];
          setMahasiswaBimbingan(list);
          if (res.data.nama) setDosenInfo({ nama: res.data.nama, email: res.data.email });
          syncAllProgress(list, token);
        }
      })
      .finally(() => setLoadingBimbingan(false));
  }, [token, syncAllProgress]);

  useEffect(() => {
    if (token) fetchMahasiswaBimbingan();
  }, [token, fetchMahasiswaBimbingan]);

  const showNotif = (type, message) => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotif({ type, message });
    notifTimer.current = setTimeout(() => setNotif(null), 3000);
  };

  const handleLogin = async () => {
    if (!username || !password) return showNotif("error", "Isi email dan password");
    setIsLoading(true);
    try {
      const res = await api.login(username, password);
      setToken(res.access_token);
      showNotif("success", "Login Berhasil");
      setActiveTab('dashboard');
    } catch { showNotif("error", "Kredensial salah"); }
    finally { setIsLoading(false); }
  };

  const handleGetData = async (targetNim) => {
    if (!token || !targetNim) return showNotif("error", "NIM tidak valid");
    setIsLoading(true);
    try {
      const res = await api.getSetoran(targetNim, token);
      if (res.response) {
        setData(res.data);
        setActiveNim(targetNim);
        const currentProg = calculateProgress(res.data.setoran.detail);
        setProgressCache(prev => ({ ...prev, [targetNim]: currentProg }));
        setActiveTab('input');
        showNotif("success", `Data ${res.data.info.nama} dimuat`);
      } else { showNotif("error", "Mahasiswa tidak ditemukan"); }
    } catch { showNotif("error", "Gagal mengambil data"); }
    finally { setIsLoading(false); }
  };

  const handleSelectSurah = (item) => {
    const exist = selectedSurah.find((s) => s.id_komponen_setoran === item.id);
    if (exist) {
      setSelectedSurah(selectedSurah.filter((s) => s.id_komponen_setoran !== item.id));
    } else {
      setSelectedSurah([...selectedSurah, { nama_komponen_setoran: item.nama, id_komponen_setoran: item.id }]);
    }
  };

  const handleSimpan = async () => {
    setIsLoading(true);
    const payload = { data_setoran: selectedSurah, tgl_setoran: new Date().toISOString().split("T")[0] };
    try {
      const res = await api.simpanSetoran(activeNim, token, payload);
      if (res.response) {
        setSelectedSurah([]);
        const freshData = await api.getSetoran(activeNim, token);
        if (freshData.response) {
            setData(freshData.data);
            const newProg = calculateProgress(freshData.data.setoran.detail);
            setProgressCache(prev => ({ ...prev, [activeNim]: newProg }));
        }
        showNotif("success", "Validasi disimpan");
      }
    } catch { showNotif("error", "Gagal menyimpan"); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm("Hapus verifikasi surah ini?")) return;
    const payload = { data_setoran: [{ id: item.info_setoran.id, id_komponen_setoran: item.id, nama_komponen_setoran: item.nama }] };
    try {
      const res = await api.deleteSetoran(activeNim, token, payload);
      if (res.response) {
        const freshData = await api.getSetoran(activeNim, token);
        if (freshData.response) {
            setData(freshData.data);
            const newProg = calculateProgress(freshData.data.setoran.detail);
            setProgressCache(prev => ({ ...prev, [activeNim]: newProg }));
        }
        showNotif("success", "Data dihapus");
      }
    } catch { showNotif("error", "Gagal menghapus"); }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#FDFCFE] flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="inline-flex w-24 h-24 rounded-[2.2rem] bg-violet-600 items-center justify-center text-white font-black text-6xl shadow-2xl shadow-violet-200 mb-8 border-b-8 border-violet-800">
              V
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Login</h1>
            <p className="text-slate-400 mt-2 font-bold uppercase text-[10px] tracking-[0.3em]">monitoring hafalan mahasiswa</p>
          </div>

          <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-violet-100 border border-violet-50 space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 ml-1">Email</label>
              <input
                type="text"
                placeholder="email@uin-suska.ac.id"
                className="w-full px-7 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white focus:ring-0 transition-all font-bold text-slate-700"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 ml-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-7 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white focus:ring-0 transition-all font-bold text-slate-700"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-violet-200 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-3 text-lg"
            >
              {isLoading ? <RotateCw className="animate-spin" /> : "MASUK"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F8F7FF] flex flex-col lg:flex-row font-sans overflow-hidden">
      {notif && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-300">
          <div className={`px-8 py-4 rounded-full shadow-2xl text-white font-black flex items-center gap-3 ${notif.type === 'success' ? 'bg-violet-600' : 'bg-rose-500'}`}>
            {notif.type === 'success' ? <CheckCircle size={20} /> : <Info size={20} />}
            {notif.message}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="lg:w-80 p-6 h-full">
        <div className="bg-white h-full rounded-[3rem] shadow-sm border border-violet-50 flex flex-col p-8">
          <div className="flex items-center gap-4 mb-14 shrink-0">
            <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-violet-100">V</div>
            <div>
              <span className="font-black text-xl tracking-tighter italic text-slate-800 block leading-none">V-SETORAN</span>
              {/* REVISI: Sub-teks Virtual Setoran */}
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 block">VIRTUAL SETORAN</span>
            </div>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            <NavBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutGrid />} label="Overview" />
            <NavBtn active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<Fingerprint />} label="Verifikasi" />
            <NavBtn active={activeTab === 'data'} onClick={() => setActiveTab('data')} icon={<GraduationCap />} label="Students" />
          </nav>

          <div className="mt-auto pt-6 shrink-0">
            <button onClick={() => setToken("")} className="flex items-center gap-4 w-full p-5 text-slate-400 hover:text-rose-500 transition-all font-black text-sm border-t border-slate-50">
              <Power size={20} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 flex flex-col gap-6 overflow-hidden h-full">
        <header className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-[2.5rem] border border-violet-50 shadow-sm shrink-0">
          <div className="flex items-center bg-slate-50 rounded-2xl px-6 py-4 w-full max-lg border-2 border-transparent focus-within:border-violet-100 focus-within:bg-white transition-all">
            <Search size={20} className="text-violet-300" />
            <input 
              type="text" 
              placeholder="Cari NIM Mahasiswa..."
              value={searchNim}
              onChange={(e) => setSearchNim(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGetData(searchNim)}
              className="bg-transparent border-none focus:ring-0 text-sm w-full font-bold ml-4 text-slate-700"
            />
          </div>

          <div className="flex items-center gap-5 px-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-800">{dosenInfo.nama}</p>
              <p className="text-[10px] text-violet-400 font-black uppercase tracking-widest">Dosen Pembimbing</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-violet-100">
              {dosenInfo.nama.charAt(0)}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-[3.5rem] p-14 text-white relative overflow-hidden shadow-2xl">
                <BookMarked className="absolute -right-16 -bottom-16 opacity-10 rotate-12" size={400} />
                <h2 className="text-5xl font-black mb-6 leading-tight">Sistem Validasi<br/>Hafalan Quran</h2>
                {/* REVISI: Perubahan teks deskripsi */}
                <p className="text-violet-100 text-xl max-w-lg font-medium">Monitoring progres bimbingan mahasiswa UIN SUSKA secara real-time dan terukur.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <StatCard label="Total Bimbingan" value={mahasiswaBimbingan.length} icon={<GraduationCap />} />
                <StatCard label="Sistem Status" value="Online" icon={<ShieldCheck />} color="text-emerald-500" />
                <StatCard label="Target Prodi" value="Juz 30" icon={<Target />} />
              </div>
            </div>
          )}

          {activeTab === 'input' && data && (
            <div className="space-y-8 animate-in fade-in zoom-in-95">
              <div className="bg-white rounded-[3rem] p-10 border border-violet-50 shadow-sm">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-10">
                  <div className="flex items-center gap-8">
                    <div className="w-24 h-24 bg-violet-50 rounded-[2.5rem] flex items-center justify-center text-violet-600 font-black text-4xl border-4 border-white shadow-inner">
                      {data.info.nama.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-900">{data.info.nama}</h3>
                      <p className="text-slate-400 font-bold tracking-wider uppercase text-xs mt-1">NIM {data.info.nim} • Semester {data.info.semester}</p>
                      
                      <div className="mt-5 w-64">
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Current Progress</span>
                          <span className="text-xl font-black text-slate-800">{calculateProgress(data.setoran.detail)}%</span>
                        </div>
                        <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                          <div 
                            className="h-full bg-violet-500 rounded-full transition-all duration-700 shadow-sm" 
                            style={{ width: `${calculateProgress(data.setoran.detail)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 w-full xl:w-auto">
                    <button onClick={() => {setData(null); setActiveNim("");}} className="flex-1 xl:px-8 py-5 rounded-2xl font-black text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all uppercase text-xs tracking-widest">Reset</button>
                    <button 
                      onClick={handleSimpan}
                      disabled={selectedSurah.length === 0 || isLoading}
                      className="flex-[2] xl:px-12 py-5 rounded-2xl font-black text-white bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-100 disabled:opacity-20 transition-all uppercase text-xs tracking-widest flex items-center justify-center gap-3"
                    >
                      {isLoading ? <RotateCw className="animate-spin" /> : `Simpan ${selectedSurah.length} Surah`}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[3rem] border border-violet-50 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                  <h4 className="font-black text-slate-800 flex items-center gap-3"><Filter size={18} className="text-violet-500"/> Komponen Hafalan</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-px bg-slate-100">
                  {data.setoran.detail.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => !item.sudah_setor && handleSelectSurah(item)}
                      className={`p-7 bg-white flex items-center justify-between transition-all group ${item.sudah_setor ? 'cursor-default' : 'cursor-pointer hover:bg-violet-50/50'}`}
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                          item.sudah_setor ? 'bg-emerald-500 border-emerald-500 text-white' : 
                          selectedSurah.some(s => s.id_komponen_setoran === item.id) ? 'bg-violet-600 border-violet-600 text-white scale-110 shadow-lg shadow-violet-200' : 'border-slate-200'
                        }`}>
                          {(item.sudah_setor || selectedSurah.some(s => s.id_komponen_setoran === item.id)) && <CheckCircle size={16} />}
                        </div>
                        <div>
                          <p className={`font-bold text-sm transition-all ${item.sudah_setor ? 'text-slate-300 line-through' : 'text-slate-700'}`}>{item.nama}</p>
                          <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mt-0.5">{item.label}</p>
                        </div>
                      </div>
                      {item.sudah_setor && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                          <Eraser size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between px-6">
                <h3 className="text-2xl font-black text-slate-800">Daftar Mahasiswa PA</h3>
                <button onClick={fetchMahasiswaBimbingan} className="p-4 bg-white border border-violet-50 rounded-2xl text-violet-600 hover:shadow-lg transition-all">
                  <RotateCw size={20} className={loadingBimbingan ? 'animate-spin' : ''} />
                </button>
              </div>

              {loadingBimbingan && mahasiswaBimbingan.length === 0 ? (
                <div className="p-32 text-center text-slate-300 font-black uppercase text-xs">Syncing Database...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8 pb-10">
                  {mahasiswaBimbingan.map((mhs) => {
                    const nimMhs = String(mhs.nim || mhs.nim_mhs || mhs.id);
                    const nameMhs = mhs.nama || mhs.nm_mhs || "Mahasiswa";
                    const displayProgress = progressCache[nimMhs] || 0;

                    return (
                      <div 
                        key={nimMhs}
                        onClick={() => handleGetData(nimMhs)}
                        className="bg-white p-8 rounded-[3rem] border border-violet-50 hover:shadow-2xl hover:shadow-violet-100 transition-all group cursor-pointer relative"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-all duration-500">
                            {nameMhs.charAt(0)}
                          </div>
                          <ArrowUpRight size={22} className="text-slate-200 group-hover:text-violet-400 transition-all" />
                        </div>
                        <h5 className="font-black text-slate-800 text-lg line-clamp-1">{nameMhs}</h5>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">NIM {nimMhs}</p>
                        
                        <div className="mt-8 space-y-3">
                          <div className="flex justify-between items-end">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
                            <span className="text-lg font-black text-violet-600">
                                {progressCache[nimMhs] === undefined ? "..." : `${displayProgress}%`}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                            <div className="h-full bg-violet-500 rounded-full transition-all duration-1000" style={{ width: `${displayProgress}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-5 w-full p-5 rounded-2xl transition-all font-black text-sm shrink-0 ${active ? 'bg-violet-600 text-white shadow-xl shadow-violet-100' : 'text-slate-400 hover:bg-violet-50 hover:text-violet-600'}`}
  >
    {icon} {label}
  </button>
);

const StatCard = ({ label, value, icon, color = "text-slate-800" }) => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-violet-50 flex items-center gap-6 shadow-sm">
    <div className="w-16 h-16 bg-violet-50 rounded-[1.5rem] flex items-center justify-center text-violet-600">{icon}</div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  </div>
);

export default App;