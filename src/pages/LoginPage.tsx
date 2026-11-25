import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SonarParticleField } from '../components/InteractiveCursorAndParticles';
import { SonarButton, SonarSpinner, Tilt3DCard } from '../components/MotionPrimitives';
import { SmartImage } from '../components/SmartImage';
import { useKailSpot } from '../context/KailSpotContext';
import { DESIGN_IMAGES } from '../data/spots';

type AuthMode = 'login' | 'register';

export function LoginPage() {
  const {
    navigate,
    user,
    backendHealth,
    loginWithCredentials,
    registerWithCredentials,
    claimInitialAdmin,
    logout,
    spots,
    spotsLoading,
  } = useKailSpot();
  const showcaseSpot = spots.find((s) => s.status === 'verified') ?? spots[0];

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claimingAdmin, setClaimingAdmin] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setFeedback(null);

    try {
      const signedUser =
        mode === 'register'
          ? await registerWithCredentials(name, email, password)
          : await loginWithCredentials(email, password);

      setPassword('');
      setFeedback(
        `Berhasil ${mode === 'register' ? 'mendaftar' : 'masuk'} sebagai ${signedUser.name} (${
          signedUser.role === 'admin' ? 'Admin Verifikator' : 'Pemancing'
        }).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses autentikasi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimAdmin = async () => {
    setClaimingAdmin(true);
    setErrorMsg(null);
    try {
      const updated = await claimInitialAdmin();
      setFeedback(`Akun ${updated.name} kini aktif sebagai Admin Verifikator.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengaktifkan akses admin.');
    } finally {
      setClaimingAdmin(false);
    }
  };

  const submitLabel = mode === 'register' ? 'Daftar & Mulai' : 'Masuk ke KailSpot';

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-dark-surface text-dark-on-surface">
      {/* Left Visual Sonar Showcase */}
      <aside className="lg:col-span-6 relative overflow-hidden bg-dark-surface-container-lowest sonar-grid border-b lg:border-b-0 lg:border-r border-dark-outline-variant p-gutter-xl flex flex-col justify-between min-h-[360px]">
        <SonarParticleField />
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-dark-primary-container/30 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-dark-secondary-container/30 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-gutter-md">
          <button
            type="button"
            onClick={() => navigate('landing')}
            className="flex items-center gap-gutter-sm text-left cursor-pointer group"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-dark-primary-container text-dark-on-primary-container border border-dark-primary/40 shrink-0 transition-transform duration-200 group-hover:scale-105">
              <span
                className="material-symbols-outlined text-headline-md transition-transform duration-500 group-hover:rotate-45"
                aria-hidden="true"
              >
                radar
              </span>
            </span>
            <div className="flex flex-col">
              <span className="font-headline text-title-lg text-dark-primary leading-none">
                KailSpot
              </span>
              <span className="font-label text-label-sm text-dark-secondary">
                Midnight Sonar • Tegal
              </span>
            </div>
          </button>

          <SonarButton
            type="button"
            onClick={() => navigate('landing')}
            className="px-gutter-md py-gutter-xs rounded-full bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface-variant hover:text-dark-on-surface hover:border-dark-primary/50 font-label text-label-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            Kembali ke Beranda
          </SonarButton>
        </div>

        <div className="relative z-10 my-gutter-xl flex flex-col gap-gutter-lg">
          {spotsLoading && !showcaseSpot ? (
            <div className="rounded-xl overflow-hidden border border-dark-outline-variant bg-dark-surface-container p-gutter-md flex flex-col gap-3">
              <div className="w-full h-56 rounded-lg sonar-skeleton" />
              <div className="h-5 w-1/2 rounded sonar-skeleton" />
            </div>
          ) : (
            <Tilt3DCard className="rounded-xl group" intensity={6}>
              <div className="rounded-xl overflow-hidden border border-dark-outline-variant bg-dark-surface-container group-hover:border-dark-primary/60 transition-colors">
                <SmartImage
                  src={showcaseSpot?.spotImage || DESIGN_IMAGES.heroMancing}
                  alt={showcaseSpot?.name || 'Spot mancing wilayah Tegal'}
                  className="w-full h-64"
                  fallbackIcon="sailing"
                  zoomOnHover
                />
                <div className="p-gutter-md flex items-center justify-between gap-gutter-md bg-dark-surface-container-low border-t border-dark-outline-variant">
                  <div className="min-w-0">
                    <span className="font-title text-title-md text-dark-on-surface block truncate">
                      {showcaseSpot ? showcaseSpot.name : 'Peta Spot Mancing Tegal'}
                    </span>
                    <span className="font-mono text-mono-sm text-dark-primary block truncate tabular-nums">
                      {showcaseSpot
                        ? `${showcaseSpot.coords} • ${showcaseSpot.catches[0]?.fish || showcaseSpot.categoryLabel}`
                        : 'Kota & Kabupaten Tegal'}
                    </span>
                  </div>
                  <span className="px-gutter-md py-gutter-xs rounded-full bg-dark-secondary-container text-dark-on-secondary-container font-label text-label-sm whitespace-nowrap shrink-0">
                    Pin Terverifikasi
                  </span>
                </div>
              </div>
            </Tilt3DCard>
          )}

          <div className="flex flex-col gap-gutter-xs">
            <h1 className="font-headline text-headline-lg text-dark-on-surface text-balance">
              Tandai Spot Rahasia di Tegal, Simpan Foto &amp; Tangkapan.
            </h1>
            <p className="text-body-md text-dark-on-surface-variant text-balance">
              Akun pemancing, foto hasil tangkapan, dan status verifikasi admin kini tersinkronisasi
              langsung ke database dan penyimpanan cloud Supabase.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-body-sm text-dark-on-surface-variant border-t border-dark-outline-variant pt-gutter-md">
          <span className="tabular-nums">
            {spots.length > 0 ? `${spots.length} Spot Tegal Aktif` : 'Wilayah Tegal'}
          </span>
          <span className="font-mono text-mono-sm text-dark-secondary">
            {backendHealth?.dbReady ? 'SUPABASE: TERHUBUNG' : 'SUPABASE: MENUNGGU SETUP'}
          </span>
        </div>
      </aside>

      {/* Right Auth Form */}
      <main className="lg:col-span-6 flex items-center justify-center p-gutter-xl bg-dark-surface">
        <div className="w-full max-w-md flex flex-col gap-gutter-lg">
          {backendHealth && (!backendHealth.configured || !backendHealth.dbReady) && (
            <div className="p-gutter-md rounded-xl bg-dark-tertiary-container/40 border border-dark-tertiary/50 text-dark-on-surface flex flex-col gap-1.5 text-body-sm">
              <span className="font-label text-label-md text-dark-tertiary">
                Perlu Penyelesaian Koneksi Supabase
              </span>
              <p className="text-dark-on-surface-variant">
                {backendHealth.dbError}
              </p>
            </div>
          )}

          {user ? (
            <div className="rounded-xl bg-dark-surface-container border border-dark-outline-variant p-gutter-lg flex flex-col gap-gutter-md">
              <div className="flex items-center justify-between gap-gutter-sm">
                <div className="flex items-center gap-gutter-sm min-w-0">
                  <span className="w-11 h-11 rounded-full bg-dark-secondary-container text-dark-on-secondary-container flex items-center justify-center font-headline text-title-md shrink-0">
                    {user.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-headline text-title-lg text-dark-on-surface truncate">
                      {user.name}
                    </h2>
                    <span className="block text-body-sm text-dark-on-surface-variant truncate">
                      {user.email}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-gutter-md py-gutter-xs rounded-full font-label text-label-sm whitespace-nowrap shrink-0 ${
                    user.role === 'admin'
                      ? 'bg-dark-tertiary-container text-dark-on-tertiary-container'
                      : 'bg-dark-secondary-container text-dark-on-secondary-container'
                  }`}
                >
                  {user.role === 'admin' ? 'Admin Verifikator' : 'Pemancing'}
                </span>
              </div>

              {feedback && (
                <div className="p-gutter-sm rounded-lg bg-dark-secondary-container text-dark-on-secondary-container text-body-sm">
                  {feedback}
                </div>
              )}
              {errorMsg && (
                <div className="p-gutter-sm rounded-lg bg-dark-error-container text-dark-on-error-container text-body-sm">
                  {errorMsg}
                </div>
              )}

              {user.role !== 'admin' && backendHealth?.dbReady && !backendHealth.hasAdmin && (
                <div className="p-gutter-md rounded-lg bg-dark-primary-container/25 border border-dark-primary/40 flex flex-col gap-gutter-sm">
                  <span className="font-label text-label-md text-dark-primary">
                    Belum Ada Admin Verifikator
                  </span>
                  <p className="text-body-sm text-dark-on-surface-variant">
                    Karena belum ada akun admin di database, Anda dapat mengaktifkan akun ini
                    sebagai Admin Verifikator pertama.
                  </p>
                  <SonarButton
                    type="button"
                    disabled={claimingAdmin}
                    onClick={handleClaimAdmin}
                    className="py-gutter-xs px-gutter-md rounded-full bg-dark-primary text-dark-on-primary font-label text-label-md cursor-pointer self-start"
                  >
                    {claimingAdmin ? (
                      <SonarSpinner label="Mengaktifkan..." />
                    ) : (
                      'Aktifkan Akses Admin Pertama'
                    )}
                  </SonarButton>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter-sm pt-1">
                <SonarButton
                  type="button"
                  onClick={() => navigate('map')}
                  className="py-gutter-sm px-gutter-md rounded-full bg-dark-primary text-dark-on-primary font-label text-label-md cursor-pointer"
                >
                  Buka Peta Tegal
                </SonarButton>
                {user.role === 'admin' ? (
                  <SonarButton
                    type="button"
                    onClick={() => navigate('admin')}
                    className="py-gutter-sm px-gutter-md rounded-full bg-dark-secondary text-dark-on-secondary font-label text-label-md cursor-pointer"
                  >
                    Buka Panel Admin
                  </SonarButton>
                ) : (
                  <SonarButton
                    type="button"
                    onClick={logout}
                    className="py-gutter-sm px-gutter-md rounded-full bg-dark-surface-container-high border border-dark-outline-variant text-dark-on-surface font-label text-label-md cursor-pointer"
                  >
                    Keluar Akun
                  </SonarButton>
                )}
              </div>

              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={logout}
                  className="text-label-md font-label text-dark-error hover:underline self-start cursor-pointer"
                >
                  Keluar dari Sesi
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Auth Mode Toggle with spring layoutId */}
              <div className="grid grid-cols-2 p-1 rounded-full bg-dark-surface-container border border-dark-outline-variant relative">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setFeedback(null);
                    setErrorMsg(null);
                  }}
                  className={`relative z-10 py-gutter-xs rounded-full font-label text-label-lg transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'text-dark-on-primary'
                      : 'text-dark-on-surface-variant hover:text-dark-on-surface'
                  }`}
                >
                  {mode === 'login' && (
                    <motion.span
                      layoutId="login-mode-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-dark-primary -z-10"
                    />
                  )}
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setFeedback(null);
                    setErrorMsg(null);
                  }}
                  className={`relative z-10 py-gutter-xs rounded-full font-label text-label-lg transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'text-dark-on-primary'
                      : 'text-dark-on-surface-variant hover:text-dark-on-surface'
                  }`}
                >
                  {mode === 'register' && (
                    <motion.span
                      layoutId="login-mode-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-dark-primary -z-10"
                    />
                  )}
                  Daftar Akun
                </button>
              </div>

              <div className="flex flex-col gap-gutter-xs">
                <h2 className="font-headline text-headline-md text-dark-on-surface">
                  {mode === 'login'
                    ? 'Masuk ke Akun Pemancing'
                    : 'Buat Akun Pemancing Baru'}
                </h2>
                <p className="text-body-md text-dark-on-surface-variant">
                  {mode === 'login'
                    ? 'Masuk menggunakan email dan kata sandi akun Supabase Anda.'
                    : 'Daftar gratis untuk menandai spot dan mengunggah foto hasil tangkapan.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-gutter-md">
                <AnimatePresence initial={false}>
                  {mode === 'register' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col gap-gutter-xs"
                    >
                      <label htmlFor="auth-name" className="font-label text-label-md text-dark-on-surface">
                        Nama Lengkap
                      </label>
                      <input
                        id="auth-name"
                        required
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contoh: Rizal Pratama"
                        className="rounded-lg bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col gap-gutter-xs">
                  <label htmlFor="auth-email" className="font-label text-label-md text-dark-on-surface">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="rounded-lg bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-gutter-xs">
                  <label
                    htmlFor="auth-password"
                    className="font-label text-label-md text-dark-on-surface"
                  >
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      required
                      minLength={6}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full rounded-lg bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm pr-11 text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label="Lihat kata sandi"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-on-surface-variant hover:text-dark-on-surface cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-title-md" aria-hidden="true">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className="p-gutter-sm rounded-lg bg-dark-error-container text-dark-on-error-container text-body-sm"
                    >
                      {errorMsg}
                    </motion.div>
                  )}
                </AnimatePresence>

                <SonarButton
                  type="submit"
                  disabled={submitting}
                  className="w-full py-gutter-sm px-gutter-lg rounded-full bg-dark-primary text-dark-on-primary font-label text-label-lg cursor-pointer inline-flex items-center justify-center"
                >
                  {submitting ? <SonarSpinner label="Memproses..." /> : submitLabel}
                </SonarButton>
              </form>
            </>
          )}

          <div className="flex items-center justify-center gap-gutter-md pt-gutter-xs text-body-sm text-dark-on-surface-variant">
            <button
              type="button"
              onClick={() => navigate('map')}
              className="nav-underline text-dark-primary py-1 px-1 cursor-pointer"
            >
              Lihat Peta &amp; Tambah Pin
            </button>
            <span aria-hidden="true">•</span>
            <button
              type="button"
              onClick={() => navigate('admin')}
              className="nav-underline text-dark-tertiary py-1 px-1 cursor-pointer"
            >
              Masuk Dashboard Admin
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
