import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AdminQueueSkeleton,
  SonarButton,
  SonarSpinner,
  Tilt3DCard,
} from '../components/MotionPrimitives';
import { SmartImage } from '../components/SmartImage';
import { useKailSpot } from '../context/KailSpotContext';
import { DESIGN_IMAGES } from '../data/spots';

type QueueFilter = 'all' | 'pending' | 'verified';

export function AdminVerificationPage() {
  const {
    navigate,
    spots,
    spotsLoading,
    rejectedCount,
    verifySpot,
    revokeSpot,
    rejectSpot,
    claimInitialAdmin,
    backendHealth,
    logout,
    user,
  } = useKailSpot();

  const [filter, setFilter] = useState<QueueFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number>(() => {
    const firstPending = spots.find((s) => s.status === 'pending');
    return firstPending?.id ?? spots[0]?.id ?? 0;
  });

  const pendingCount = spots.filter((s) => s.status === 'pending').length;
  const verifiedCount = spots.filter((s) => s.status === 'verified').length;

  const filteredReports = spots.filter((spot) => {
    const matchesFilter = filter === 'all' ? true : spot.status === filter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      spot.name.toLowerCase().includes(q) ||
      spot.angler.toLowerCase().includes(q) ||
      spot.catches.some((c) => c.fish.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const selectedReport =
    spots.find((s) => s.id === selectedId) || filteredReports[0] || spots[0] || null;

  const runAdminAction = async (fn: () => Promise<void>) => {
    setActionBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status spot.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (id: number) => {
    const remaining = spots.filter((s) => s.id !== id);
    await runAdminAction(() => rejectSpot(id));
    if (selectedId === id) {
      setSelectedId(remaining[0]?.id ?? 0);
    }
  };

  const navButtons: { id: QueueFilter; icon: string; label: string }[] = [
    { id: 'all', icon: 'verified_user', label: 'Antrean Verifikasi' },
    { id: 'pending', icon: 'schedule', label: 'Menunggu Review' },
    { id: 'verified', icon: 'check_circle', label: 'Spot Terverifikasi' },
  ];

  const tabButtons: { id: QueueFilter; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'pending', label: 'Menunggu' },
    { id: 'verified', label: 'Terverifikasi' },
  ];

  return (
    <div className="min-h-screen flex bg-dark-surface text-dark-on-surface">
      {/* Left Admin Sidebar */}
      <aside className="w-64 shrink-0 bg-dark-surface-container-lowest border-r border-dark-outline-variant p-gutter-lg hidden lg:flex flex-col justify-between">
        <div className="flex flex-col gap-gutter-xl">
          <button
            type="button"
            onClick={() => navigate('landing')}
            className="flex items-center gap-gutter-sm text-left cursor-pointer group"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-dark-primary-container text-dark-on-primary-container border border-dark-primary/40 shrink-0 transition-transform duration-200 group-hover:scale-105">
              <span className="material-symbols-outlined text-headline-md transition-transform duration-500 group-hover:rotate-45" aria-hidden="true">
                radar
              </span>
            </span>
            <div className="flex flex-col">
              <span className="font-headline text-title-lg text-dark-primary leading-none">
                KailSpot
              </span>
              <span className="font-label text-label-sm text-dark-tertiary">
                Admin Verifikator Tegal
              </span>
            </div>
          </button>

          <nav aria-label="Navigasi Admin" className="flex flex-col gap-gutter-xs">
            {navButtons.map((item) => {
              const isActive = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`flex items-center gap-gutter-sm px-gutter-md py-gutter-sm rounded-lg font-label text-label-lg text-left transition-all duration-150 hover:translate-x-0.5 cursor-pointer ${
                    isActive
                      ? 'bg-dark-secondary-container text-dark-on-secondary-container'
                      : 'text-dark-on-surface-variant hover:bg-dark-surface-container hover:text-dark-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-title-md" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => navigate('map')}
              className="flex items-center gap-gutter-sm px-gutter-md py-gutter-sm rounded-lg text-dark-on-surface-variant hover:bg-dark-surface-container hover:text-dark-on-surface hover:translate-x-0.5 font-label text-label-lg text-left transition-all duration-150 cursor-pointer"
            >
              <span className="material-symbols-outlined text-title-md" aria-hidden="true">
                map
              </span>
              <span>Lihat Peta Tegal</span>
            </button>
          </nav>
        </div>

        <div className="pt-gutter-md border-t border-dark-outline-variant flex flex-col gap-gutter-sm">
          <div className="flex items-center gap-gutter-sm">
            <span className="w-9 h-9 rounded-full bg-dark-tertiary-container text-dark-on-tertiary-container flex items-center justify-center font-label text-label-md shrink-0">
              AD
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-label text-label-md text-dark-on-surface truncate">
                {user?.role === 'admin' ? user.name : 'Admin Tegal'}
              </span>
              <span className="text-body-sm text-dark-on-surface-variant truncate">
                {user?.role === 'admin' ? user.email : 'admin@kailspot.id'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-gutter-xs text-label-md font-label text-dark-error hover:underline cursor-pointer self-start"
          >
            <span className="material-symbols-outlined text-title-md" aria-hidden="true">
              logout
            </span>
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-dark-surface-container-lowest border-b border-dark-outline-variant px-gutter-lg py-gutter-md flex flex-wrap items-center justify-between gap-gutter-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-gutter-sm lg:hidden mb-1">
              <button
                type="button"
                onClick={() => navigate('landing')}
                className="font-headline text-title-md text-dark-primary cursor-pointer"
              >
                KailSpot
              </button>
              <span className="text-dark-outline">/</span>
              <button
                type="button"
                onClick={() => navigate('map')}
                className="font-label text-label-md text-dark-secondary cursor-pointer"
              >
                Peta Tegal
              </button>
            </div>
            <h1 className="font-headline text-headline-md text-dark-on-surface">
              Dashboard Verifikasi Spot Tegal &amp; Tangkapan
            </h1>
            <span className="text-body-sm text-dark-on-surface-variant">
              Periksa keakuratan koordinat GPS wilayah Tegal, kondisi air, dan bukti tangkapan
              sebelum pin tampil sebagai Terverifikasi.
            </span>
          </div>

          <div className="relative">
            <span
              className="material-symbols-outlined text-title-md text-dark-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari spot atau pelapor..."
              className="pl-10 pr-gutter-md py-gutter-xs rounded-full bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant text-body-md focus:border-dark-primary focus:outline-none transition-colors"
            />
          </div>
        </header>

        <main className="flex-1 p-gutter-lg flex flex-col gap-gutter-lg">
          {(!user || user.role !== 'admin') && (
            <div className="rounded-xl bg-dark-tertiary-container/30 border border-dark-tertiary/50 p-gutter-md flex flex-wrap items-center justify-between gap-gutter-md">
              <div className="flex flex-col gap-0.5">
                <span className="font-label text-label-md text-dark-tertiary">
                  {user
                    ? 'Akses Terbatas — Akun Pemancing'
                    : 'Masuk sebagai Admin Verifikator'}
                </span>
                <span className="text-body-sm text-dark-on-surface-variant">
                  {user
                    ? 'Perubahan status verifikasi di database hanya diizinkan untuk akun dengan peran Admin.'
                    : 'Masuk terlebih dahulu untuk memverifikasi atau menolak laporan spot di Supabase.'}
                </span>
              </div>
              <div className="flex items-center gap-gutter-sm">
                {user && backendHealth?.dbReady && !backendHealth.hasAdmin && (
                  <SonarButton
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void runAdminAction(async () => { await claimInitialAdmin(); })}
                    className="px-gutter-md py-gutter-xs rounded-full bg-dark-primary text-dark-on-primary font-label text-label-md cursor-pointer"
                  >
                    {actionBusy ? <SonarSpinner label="Memproses..." /> : 'Aktifkan Admin Pertama'}
                  </SonarButton>
                )}
                <SonarButton
                  type="button"
                  onClick={() => navigate('login')}
                  className="px-gutter-md py-gutter-xs rounded-full bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface font-label text-label-md cursor-pointer"
                >
                  {user ? 'Ganti Akun' : 'Halaman Masuk'}
                </SonarButton>
              </div>
            </div>
          )}

          {actionError && (
            <div className="p-gutter-sm rounded-lg bg-dark-error-container text-dark-on-error-container text-body-sm">
              {actionError}
            </div>
          )}

          {/* 4 KPI Summary Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter-md">
            <div className="rounded-xl bg-dark-surface-container border border-dark-outline-variant hover:border-dark-primary/40 transition-colors p-gutter-md flex flex-col gap-gutter-xs">
              <span className="font-label text-label-sm text-dark-on-surface-variant">
                Total Spot Masuk
              </span>
              <span className="font-mono text-headline-lg text-dark-primary tabular-nums">
                {spotsLoading && spots.length === 0 ? '...' : spots.length}
              </span>
            </div>
            <div className="rounded-xl bg-dark-surface-container border border-dark-outline-variant hover:border-dark-tertiary/40 transition-colors p-gutter-md flex flex-col gap-gutter-xs">
              <span className="font-label text-label-sm text-dark-on-surface-variant">
                Menunggu Verifikasi
              </span>
              <span className="font-mono text-headline-lg text-dark-tertiary tabular-nums">
                {spotsLoading && spots.length === 0 ? '...' : pendingCount}
              </span>
            </div>
            <div className="rounded-xl bg-dark-surface-container border border-dark-outline-variant hover:border-dark-secondary/40 transition-colors p-gutter-md flex flex-col gap-gutter-xs">
              <span className="font-label text-label-sm text-dark-on-surface-variant">
                Terverifikasi Aktif
              </span>
              <span className="font-mono text-headline-lg text-dark-secondary tabular-nums">
                {spotsLoading && spots.length === 0 ? '...' : verifiedCount}
              </span>
            </div>
            <div className="rounded-xl bg-dark-surface-container border border-dark-outline-variant hover:border-dark-error/40 transition-colors p-gutter-md flex flex-col gap-gutter-xs">
              <span className="font-label text-label-sm text-dark-on-surface-variant">
                Ditolak / Duplikat
              </span>
              <span className="font-mono text-headline-lg text-dark-error tabular-nums">
                {rejectedCount}
              </span>
            </div>
          </section>

          {/* Split Queue Table + Inspector Panel */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-lg items-start">
            {/* Left: Verification Queue */}
            <div className="xl:col-span-7 rounded-xl bg-dark-surface-container border border-dark-outline-variant overflow-hidden">
              <div className="p-gutter-md border-b border-dark-outline-variant flex flex-wrap items-center justify-between gap-gutter-sm">
                <span className="font-title text-title-md text-dark-on-surface">
                  Daftar Laporan Spot
                </span>
                <div className="flex items-center gap-gutter-xs">
                  {tabButtons.map((tab) => {
                    const isActive = filter === tab.id;
                    return (
                      <SonarButton
                        key={tab.id}
                        type="button"
                        onClick={() => setFilter(tab.id)}
                        className={`px-gutter-md py-gutter-xs rounded-full font-label text-label-sm whitespace-nowrap shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-dark-primary text-dark-on-primary'
                            : 'bg-dark-surface-container-high text-dark-on-surface-variant hover:text-dark-on-surface'
                        }`}
                      >
                        {tab.label}
                      </SonarButton>
                    );
                  })}
                </div>
              </div>

              {spotsLoading && spots.length === 0 ? (
                <AdminQueueSkeleton />
              ) : (
                <div className="divide-y divide-dark-outline-variant">
                  {filteredReports.length === 0 ? (
                    <div className="p-gutter-xl text-center flex flex-col items-center gap-gutter-sm">
                      <span
                        className="material-symbols-outlined text-headline-lg text-dark-on-surface-variant"
                        aria-hidden="true"
                      >
                        inbox
                      </span>
                      <p className="text-body-md text-dark-on-surface-variant">
                        Tidak ada laporan spot pada filter ini.
                      </p>
                    </div>
                  ) : (
                    filteredReports.map((r) => {
                      const isSelected = selectedReport?.id === r.id;
                      const primaryCatch = r.catches[0];
                      return (
                        <button
                          key={r.spotKey}
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className={`group w-full text-left p-gutter-md flex items-center justify-between gap-gutter-md transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-dark-surface-container-high'
                              : 'hover:bg-dark-surface-container-low'
                          }`}
                        >
                          <div className="flex items-center gap-gutter-md min-w-0">
                            <SmartImage
                              src={r.spotImage}
                              alt={r.name}
                              className="w-12 h-12 rounded-lg border border-dark-outline-variant shrink-0"
                              fallbackIcon="location_on"
                              zoomOnHover
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-gutter-sm">
                                <span className="font-title text-title-md text-dark-on-surface truncate group-hover:text-dark-primary transition-colors">
                                  {r.name}
                                </span>
                                {r.status === 'verified' ? (
                                  <span className="px-gutter-sm py-0.5 rounded-full bg-dark-secondary-container text-dark-on-secondary-container font-label text-label-sm whitespace-nowrap shrink-0">
                                    Terverifikasi
                                  </span>
                                ) : (
                                  <span className="px-gutter-sm py-0.5 rounded-full bg-dark-tertiary-container text-dark-on-tertiary-container font-label text-label-sm whitespace-nowrap shrink-0">
                                    Menunggu
                                  </span>
                                )}
                              </div>
                              <span className="block text-body-sm text-dark-on-surface-variant truncate">
                                {r.angler} •{' '}
                                {primaryCatch
                                  ? `${primaryCatch.fish} (${primaryCatch.weight})`
                                  : '-'}{' '}
                                • {r.time}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono text-mono-sm text-dark-primary hidden sm:inline tabular-nums shrink-0">
                            {r.coords}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Right: Spot Inspector Drawer */}
            <aside className="xl:col-span-5 rounded-xl bg-dark-surface-container border border-dark-outline-variant p-gutter-lg flex flex-col gap-gutter-md">
              <AnimatePresence mode="wait">
                {selectedReport ? (
                  <motion.div
                    key={selectedReport.spotKey}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col gap-gutter-md"
                  >
                    <div className="flex items-start justify-between gap-gutter-sm">
                      <div className="min-w-0">
                        <span className="font-label text-label-sm text-dark-primary uppercase">
                          {selectedReport.categoryLabel}
                        </span>
                        <h2 className="font-headline text-headline-md text-dark-on-surface leading-tight">
                          {selectedReport.name}
                        </h2>
                        <span className="font-mono text-mono-sm text-dark-on-surface-variant tabular-nums">
                          {selectedReport.coords}
                        </span>
                      </div>
                      {selectedReport.status === 'verified' ? (
                        <span className="px-gutter-md py-gutter-xs rounded-full bg-dark-secondary-container text-dark-on-secondary-container font-label text-label-sm whitespace-nowrap shrink-0">
                          Terverifikasi
                        </span>
                      ) : (
                        <span className="px-gutter-md py-gutter-xs rounded-full bg-dark-tertiary-container text-dark-on-tertiary-container font-label text-label-sm whitespace-nowrap shrink-0">
                          Menunggu Verifikasi
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-gutter-sm">
                      <Tilt3DCard className="rounded-lg group" intensity={6}>
                        <SmartImage
                          src={selectedReport.spotImage}
                          alt="Foto Lokasi"
                          className="w-full h-32 rounded-lg border border-dark-outline-variant"
                          fallbackIcon="water"
                          zoomOnHover
                        />
                      </Tilt3DCard>
                      <Tilt3DCard className="rounded-lg group" intensity={6}>
                        <SmartImage
                          src={
                            selectedReport.catches[0]?.img || DESIGN_IMAGES.catchKakapPutih
                          }
                          alt="Foto Tangkapan"
                          className="w-full h-32 rounded-lg border border-dark-outline-variant"
                          fallbackIcon="phishing"
                          zoomOnHover
                        />
                      </Tilt3DCard>
                    </div>

                    <div className="grid grid-cols-2 gap-gutter-sm">
                      <div className="p-gutter-sm rounded-lg bg-dark-surface-container-low border border-dark-outline-variant">
                        <span className="block font-label text-label-sm text-dark-on-surface-variant">
                          Pelapor
                        </span>
                        <span className="text-body-sm text-dark-on-surface">
                          {selectedReport.angler} ({selectedReport.time})
                        </span>
                      </div>
                      <div className="p-gutter-sm rounded-lg bg-dark-surface-container-low border border-dark-outline-variant">
                        <span className="block font-label text-label-sm text-dark-on-surface-variant">
                          Tangkapan
                        </span>
                        <span className="text-body-sm text-dark-secondary">
                          {selectedReport.catches[0]
                            ? `${selectedReport.catches[0].fish} • ${selectedReport.catches[0].weight}`
                            : '-'}
                        </span>
                      </div>
                      <div className="p-gutter-sm rounded-lg bg-dark-surface-container-low border border-dark-outline-variant">
                        <span className="block font-label text-label-sm text-dark-on-surface-variant">
                          Kondisi Air
                        </span>
                        <span className="text-body-sm text-dark-on-surface">
                          {selectedReport.waterCondition}
                        </span>
                      </div>
                      <div className="p-gutter-sm rounded-lg bg-dark-surface-container-low border border-dark-outline-variant">
                        <span className="block font-label text-label-sm text-dark-on-surface-variant">
                          Umpan
                        </span>
                        <span className="text-body-sm text-dark-on-surface">
                          {selectedReport.bestBait}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-gutter-sm pt-gutter-sm border-t border-dark-outline-variant">
                      {selectedReport.status === 'pending' ? (
                        <>
                          <SonarButton
                            type="button"
                            disabled={actionBusy || user?.role !== 'admin'}
                            onClick={() => void runAdminAction(() => verifySpot(selectedReport.id))}
                            className="flex-1 py-gutter-sm px-gutter-md rounded-full bg-dark-secondary text-dark-on-secondary font-label text-label-lg whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            {actionBusy ? <SonarSpinner label="Menyimpan..." /> : 'Verifikasi Spot'}
                          </SonarButton>
                          <SonarButton
                            type="button"
                            disabled={actionBusy || user?.role !== 'admin'}
                            onClick={() => void handleReject(selectedReport.id)}
                            className="py-gutter-sm px-gutter-lg rounded-full bg-dark-error-container text-dark-on-error-container font-label text-label-lg whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            Tolak
                          </SonarButton>
                        </>
                      ) : (
                        <>
                          <SonarButton
                            type="button"
                            disabled={actionBusy || user?.role !== 'admin'}
                            onClick={() => void runAdminAction(() => revokeSpot(selectedReport.id))}
                            className="flex-1 py-gutter-sm px-gutter-md rounded-full bg-dark-surface-container-high text-dark-on-surface border border-dark-outline-variant font-label text-label-lg hover:bg-dark-surface-bright whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            Kembalikan ke Antrean
                          </SonarButton>
                          <SonarButton
                            type="button"
                            onClick={() => navigate('map', selectedReport.id)}
                            className="py-gutter-sm px-gutter-lg rounded-full bg-dark-primary text-dark-on-primary font-label text-label-lg whitespace-nowrap cursor-pointer"
                          >
                            Lihat di Peta
                          </SonarButton>
                        </>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="inspector-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-gutter-lg text-center"
                  >
                    <span className="text-body-md text-dark-on-surface-variant">
                      {spotsLoading ? 'Memuat laporan spot Tegal...' : 'Tidak ada laporan dipilih.'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
