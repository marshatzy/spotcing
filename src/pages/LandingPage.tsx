import { useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { SonarParticleField } from '../components/InteractiveCursorAndParticles';
import { MarkSpotModal } from '../components/MarkSpotModal';
import {
  LikeCatchButton,
  SonarButton,
  Tilt3DCard,
} from '../components/MotionPrimitives';
import { SmartImage } from '../components/SmartImage';
import { useKailSpot } from '../context/KailSpotContext';
import { DESIGN_IMAGES } from '../data/spots';

export function LandingPage() {
  const { navigate, spots, spotsLoading, user, likedCatchIds, toggleLikeCatch } = useKailSpot();
  const [modalOpen, setModalOpen] = useState(false);

  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 260, damping: 32, restDelta: 0.001 });

  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const orbParallaxY = useTransform(heroScroll, [0, 1], [0, 90]);
  const cardsParallaxY = useTransform(heroScroll, [0, 1], [0, -34]);

  const verifiedSpots = spots.filter((s) => s.status === 'verified');
  const heroPrimarySpot = verifiedSpots[0] ?? spots[0];
  const heroSecondarySpot = verifiedSpots[1] ?? spots[1] ?? heroPrimarySpot;
  const latestVerified = verifiedSpots[verifiedSpots.length - 1] ?? verifiedSpots[0] ?? spots[0];
  const totalCatches = spots.reduce((acc, s) => acc + s.catches.length, 0);
  const verifiedPct = spots.length > 0 ? Math.round((verifiedSpots.length / spots.length) * 100) : 100;

  const primaryCatchId = heroPrimarySpot?.catches[0]?.id ?? 'hero-catch-default';
  const isPrimaryLiked = likedCatchIds.includes(primaryCatchId);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const featureSteps = [
    {
      icon: 'add_location_alt',
      badgeClass: 'bg-dark-primary-container text-dark-on-primary-container',
      title: '1. Tandai Spot & Tangkapan',
      desc: 'Simpan koordinat GPS, jenis perairan, dan ikan yang berhasil dinaikkan hanya dalam satu form.',
    },
    {
      icon: 'touch_app',
      badgeClass: 'bg-dark-secondary-container text-dark-on-secondary-container',
      title: '2. Pencet Pin untuk Detail',
      desc: 'Klik pin di peta sonar untuk langsung melihat kondisi arus, pasang surut, serta riwayat strike.',
    },
    {
      icon: 'verified_user',
      badgeClass: 'bg-dark-tertiary-container text-dark-on-tertiary-container',
      title: '3. Verifikasi Admin',
      desc: 'Admin meninjau setiap titik baru sebelum memberi lencana Terverifikasi agar informasi tetap akurat.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-dark-surface text-dark-on-surface">
      {/* Scroll Reading Progress Bar */}
      <motion.div
        aria-hidden="true"
        style={{ scaleX }}
        className="fixed top-0 left-0 right-0 h-[3px] origin-left z-50 bg-gradient-to-r from-dark-secondary via-dark-primary to-dark-tertiary"
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-dark-surface-container-lowest/95 backdrop-blur-sm border-b border-dark-outline-variant px-gutter-lg py-gutter-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-gutter-md">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-gutter-sm rounded-md text-left cursor-pointer group"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-dark-primary-container text-dark-on-primary-container border border-dark-primary/40 shrink-0 transition-transform duration-200 group-hover:scale-105">
              <span className="material-symbols-outlined text-headline-md transition-transform duration-500 group-hover:rotate-45" aria-hidden="true">
                radar
              </span>
            </span>
            <div className="flex flex-col">
              <span className="font-headline text-title-lg text-dark-primary leading-none whitespace-nowrap">
                KailSpot
              </span>
              <span className="font-label text-label-sm text-dark-secondary whitespace-nowrap">
                Peta Pemancing Tegal
              </span>
            </div>
          </button>

          <nav aria-label="Navigasi Landing" className="hidden md:flex items-center gap-gutter-xs">
            <button
              type="button"
              onClick={() => scrollToSection('tentang')}
              className="nav-underline px-gutter-md py-gutter-xs rounded-full text-dark-on-surface-variant hover:text-dark-primary font-label text-label-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Tentang
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('cara-kerja')}
              className="nav-underline px-gutter-md py-gutter-xs rounded-full text-dark-on-surface-variant hover:text-dark-primary font-label text-label-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cara Kerja
            </button>
            <button
              type="button"
              onClick={() => navigate('map')}
              className="nav-underline px-gutter-md py-gutter-xs rounded-full text-dark-on-surface-variant hover:text-dark-primary font-label text-label-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Peta Tegal
            </button>
            <button
              type="button"
              onClick={() => navigate('admin')}
              className="nav-underline px-gutter-md py-gutter-xs rounded-full text-dark-on-surface-variant hover:text-dark-primary font-label text-label-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Admin
            </button>
          </nav>

          <div className="flex items-center gap-gutter-sm shrink-0">
            <SonarButton
              type="button"
              onClick={() => navigate('login')}
              className="px-gutter-lg py-gutter-xs rounded-full bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface font-label text-label-lg hover:bg-dark-surface-container-high hover:border-dark-primary/50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user ? user.name.split(' ')[0] : 'Masuk'}
            </SonarButton>
            <SonarButton
              type="button"
              onClick={() => navigate('map')}
              className="px-gutter-lg py-gutter-xs rounded-full bg-dark-primary text-dark-on-primary font-label text-label-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              Buka Peta Tegal
            </SonarButton>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Landing */}
        <section
          id="hero"
          ref={heroRef}
          className="relative overflow-hidden py-section px-gutter-lg bg-dark-surface-container-lowest sonar-grid border-b border-dark-outline-variant"
        >
          <SonarParticleField />

          <motion.div
            style={{ y: orbParallaxY }}
            aria-hidden="true"
            className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-dark-primary-container/30 blur-3xl pointer-events-none"
          />
          <motion.div
            style={{ y: orbParallaxY }}
            aria-hidden="true"
            className="absolute -bottom-24 right-0 w-96 h-96 rounded-full bg-dark-secondary-container/30 blur-3xl pointer-events-none"
          />

          <div className="relative z-10 max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-gutter-xl items-center">
            <div className="lg:col-span-6 flex flex-col gap-gutter-lg">
              <div className="inline-flex items-center gap-gutter-sm self-start px-gutter-md py-gutter-xs rounded-full bg-dark-surface-container border border-dark-outline-variant">
                <span className="w-2 h-2 rounded-full bg-dark-secondary" aria-hidden="true" />
                <span className="font-label text-label-md text-dark-secondary">
                  Komunitas Pemancing Tegal • Laut, Muara, Sungai &amp; Waduk
                </span>
              </div>

              <h1 className="font-display text-display-lg text-dark-on-surface text-balance">
                Temukan Spot Mancing Terbaik di Tegal, Catat Strike Langsung di Peta.
              </h1>

              <p className="font-body text-body-lg text-dark-on-surface-variant max-w-prose text-pretty">
                KailSpot menghubungkan pemancing di Kota dan Kabupaten Tegal lewat peta Google Maps
                bertema Midnight Sonar. Tandai koordinat asli pesisir Pantura, muara, sungai, dan
                waduk sekitar Tegal, lalu nikmati data terverifikasi admin.
              </p>

              <div className="flex flex-wrap items-center gap-gutter-md">
                <SonarButton
                  type="button"
                  onClick={() => navigate('map')}
                  className="inline-flex items-center gap-gutter-sm px-gutter-xl py-gutter-sm rounded-full bg-dark-secondary text-dark-on-secondary font-label text-label-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-title-md" aria-hidden="true">
                    explore
                  </span>
                  <span>Buka Peta Tegal &amp; Tambah Pin</span>
                </SonarButton>
                <SonarButton
                  type="button"
                  onClick={() => navigate('login')}
                  className="inline-flex items-center gap-gutter-sm px-gutter-lg py-gutter-sm rounded-full bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface font-label text-label-lg hover:bg-dark-surface-container-high hover:border-dark-primary/50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span
                    className="material-symbols-outlined text-title-md text-dark-primary"
                    aria-hidden="true"
                  >
                    login
                  </span>
                  <span>Masuk / Daftar Pemancing</span>
                </SonarButton>
              </div>

              <div className="grid grid-cols-3 gap-gutter-md pt-gutter-md border-t border-dark-outline-variant">
                <div>
                  <span className="font-mono text-headline-md text-dark-primary tabular-nums block">
                    {spotsLoading && spots.length === 0 ? (
                      <span className="inline-block w-12 h-7 rounded sonar-skeleton align-middle" />
                    ) : (
                      spots.length
                    )}
                  </span>
                  <span className="text-body-sm text-dark-on-surface-variant">
                    Spot Aktif Tegal
                  </span>
                </div>
                <div>
                  <span className="font-mono text-headline-md text-dark-secondary tabular-nums block">
                    {spotsLoading && spots.length === 0 ? (
                      <span className="inline-block w-14 h-7 rounded sonar-skeleton align-middle" />
                    ) : (
                      `${verifiedPct}%`
                    )}
                  </span>
                  <span className="text-body-sm text-dark-on-surface-variant">
                    Terverifikasi Admin
                  </span>
                </div>
                <div>
                  <span className="font-mono text-headline-md text-dark-tertiary tabular-nums block">
                    {spotsLoading && spots.length === 0 ? (
                      <span className="inline-block w-12 h-7 rounded sonar-skeleton align-middle" />
                    ) : (
                      totalCatches
                    )}
                  </span>
                  <span className="text-body-sm text-dark-on-surface-variant">
                    Catatan Tangkapan
                  </span>
                </div>
              </div>
            </div>

            <motion.div
              style={{ y: cardsParallaxY }}
              className="lg:col-span-6 grid grid-cols-12 gap-gutter-md"
            >
              <Tilt3DCard className="col-span-12 rounded-xl" intensity={6}>
                <button
                  type="button"
                  onClick={() => navigate('map', heroPrimarySpot?.id)}
                  className="group w-full rounded-xl overflow-hidden border border-dark-outline-variant bg-dark-surface-container text-left hover:border-dark-primary/70 hover:shadow-[0_14px_34px_-12px_rgba(111,214,224,0.3)] transition-all duration-200 cursor-pointer"
                >
                  <SmartImage
                    src={heroPrimarySpot?.spotImage || DESIGN_IMAGES.heroMancing}
                    alt={heroPrimarySpot?.name || 'Spot mancing wilayah Tegal'}
                    className="w-full h-72"
                    fallbackIcon="sailing"
                    zoomOnHover
                  />
                  <div className="p-gutter-md flex items-center justify-between gap-gutter-md bg-dark-surface-container-low border-t border-dark-outline-variant">
                    <div className="min-w-0">
                      <span className="font-title text-title-md text-dark-on-surface block truncate group-hover:text-dark-primary transition-colors">
                        {heroPrimarySpot ? heroPrimarySpot.name : 'Memuat Spot Pesisir Tegal...'}
                      </span>
                      <span className="font-mono text-mono-sm text-dark-primary block truncate tabular-nums">
                        {heroPrimarySpot
                          ? `${heroPrimarySpot.coords} • ${heroPrimarySpot.waterCondition}`
                          : 'Sinkronisasi koordinat Tegal'}
                      </span>
                    </div>
                    <span className="px-gutter-md py-gutter-xs rounded-full bg-dark-secondary-container text-dark-on-secondary-container font-label text-label-sm whitespace-nowrap shrink-0">
                      {heroPrimarySpot?.status === 'pending' ? 'Menunggu' : 'Terverifikasi'}
                    </span>
                  </div>
                </button>
              </Tilt3DCard>

              <Tilt3DCard className="col-span-6 rounded-xl" intensity={8}>
                <div className="group w-full rounded-xl overflow-hidden border border-dark-outline-variant bg-dark-surface-container hover:border-dark-primary/70 hover:shadow-[0_12px_28px_-12px_rgba(151,205,239,0.28)] transition-all duration-200">
                  <button
                    type="button"
                    onClick={() => navigate('map', heroPrimarySpot?.id)}
                    className="w-full text-left cursor-pointer block"
                  >
                    <SmartImage
                      src={heroPrimarySpot?.catches[0]?.img || DESIGN_IMAGES.catchKakapPutih}
                      alt={heroPrimarySpot?.catches[0]?.fish || 'Tangkapan terbaru'}
                      className="w-full h-36"
                      fallbackIcon="phishing"
                      zoomOnHover
                    />
                  </button>
                  <div className="p-gutter-sm flex items-center justify-between gap-gutter-xs">
                    <button
                      type="button"
                      onClick={() => navigate('map', heroPrimarySpot?.id)}
                      className="min-w-0 text-left cursor-pointer"
                    >
                      <span className="font-label text-label-md text-dark-on-surface truncate block">
                        {heroPrimarySpot?.catches[0]?.fish || 'Kakap Putih'}
                      </span>
                      <span className="font-mono text-mono-sm text-dark-secondary tabular-nums">
                        {heroPrimarySpot?.catches[0]?.weight || '3,8 kg'}
                      </span>
                    </button>
                    <LikeCatchButton
                      liked={isPrimaryLiked}
                      count={14 + (isPrimaryLiked ? 1 : 0)}
                      onToggle={() => toggleLikeCatch(primaryCatchId)}
                    />
                  </div>
                </div>
              </Tilt3DCard>

              <Tilt3DCard className="col-span-6 rounded-xl" intensity={8}>
                <button
                  type="button"
                  onClick={() => navigate('map', heroSecondarySpot?.id)}
                  className="group w-full h-full rounded-xl overflow-hidden border border-dark-outline-variant bg-dark-surface-container text-left hover:border-dark-primary/70 hover:shadow-[0_12px_28px_-12px_rgba(111,214,224,0.28)] transition-all duration-200 cursor-pointer flex flex-col justify-between"
                >
                  <SmartImage
                    src={heroSecondarySpot?.spotImage || DESIGN_IMAGES.spotDanau}
                    alt={heroSecondarySpot?.name || 'Perairan Tegal'}
                    className="w-full h-36"
                    fallbackIcon="water"
                    zoomOnHover
                  />
                  <div className="p-gutter-sm flex items-center justify-between gap-gutter-xs w-full">
                    <span className="font-label text-label-md text-dark-on-surface truncate group-hover:text-dark-primary transition-colors">
                      {heroSecondarySpot ? heroSecondarySpot.name : 'Perairan Tegal'}
                    </span>
                    <span className="font-mono text-mono-sm text-dark-primary whitespace-nowrap shrink-0">
                      {heroSecondarySpot ? heroSecondarySpot.categoryLabel.split(' ')[0] : 'Tegal'}
                    </span>
                  </div>
                </button>
              </Tilt3DCard>
            </motion.div>
          </div>
        </section>

        {/* Tentang & Keunggulan (Scroll-Driven Stagger) */}
        <section
          id="tentang"
          className="py-section px-gutter-lg bg-dark-surface border-b border-dark-outline-variant"
        >
          <div className="max-w-screen-xl mx-auto flex flex-col gap-gutter-xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
              className="text-center max-w-2xl mx-auto flex flex-col gap-gutter-sm"
            >
              <span className="font-label text-label-md text-dark-secondary uppercase tracking-wider">
                Kenapa KailSpot?
              </span>
              <h2 className="font-headline text-headline-lg text-dark-on-surface text-balance">
                Dirancang Khusus untuk Pemancing yang Butuh Info Cepat
              </h2>
              <p className="text-body-md text-dark-on-surface-variant text-balance">
                Tidak perlu menggulir feed panjang. Semua detail kondisi air, umpan jitu, dan foto
                tangkapan tersimpan rapi di balik setiap pin peta.
              </p>
            </motion.div>

            <div id="cara-kerja" className="grid grid-cols-1 md:grid-cols-3 gap-gutter-lg">
              {featureSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.08,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <Tilt3DCard className="h-full rounded-xl" intensity={5}>
                    <article className="h-full bg-dark-surface-container rounded-xl p-gutter-lg border border-dark-outline-variant hover:border-dark-primary/50 hover:shadow-[0_12px_28px_-14px_rgba(111,214,224,0.28)] transition-all duration-200 flex flex-col gap-gutter-md">
                      <span
                        className={`inline-flex items-center justify-center w-11 h-11 rounded-lg ${step.badgeClass}`}
                      >
                        <span className="material-symbols-outlined text-headline-md" aria-hidden="true">
                          {step.icon}
                        </span>
                      </span>
                      <h3 className="font-headline text-title-lg text-dark-on-surface">
                        {step.title}
                      </h3>
                      <p className="text-body-md text-dark-on-surface-variant text-balance">
                        {step.desc}
                      </p>
                    </article>
                  </Tilt3DCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pratinjau Peta Pin Interaktif */}
        <section id="preview-peta" className="py-section px-gutter-lg bg-dark-surface-container-low">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-screen-xl mx-auto rounded-xl border border-dark-outline-variant bg-dark-surface-container p-gutter-xl flex flex-col lg:flex-row items-center justify-between gap-gutter-xl"
          >
            <div className="flex flex-col gap-gutter-md max-w-xl">
              <span className="font-label text-label-md text-dark-primary uppercase">
                Siap Berangkat Mancing?
              </span>
              <h2 className="font-headline text-headline-lg text-dark-on-surface text-balance">
                Masuk untuk Menandai Spot Favoritmu Sekarang
              </h2>
              <p className="text-body-md text-dark-on-surface-variant text-balance">
                Bagikan titik mancing terbaikmu atau akses panel admin untuk memverifikasi laporan
                komunitas.
              </p>
              <div className="flex flex-wrap items-center gap-gutter-md pt-gutter-xs">
                <SonarButton
                  type="button"
                  onClick={() => navigate('login')}
                  className="px-gutter-xl py-gutter-sm rounded-full bg-dark-primary text-dark-on-primary font-label text-label-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Masuk ke Akun
                </SonarButton>
                <SonarButton
                  type="button"
                  onClick={() => navigate('admin')}
                  className="px-gutter-lg py-gutter-sm rounded-full bg-dark-surface-container-high border border-dark-outline-variant text-dark-on-surface font-label text-label-lg hover:bg-dark-surface-bright hover:border-dark-primary/40 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Buka Panel Admin
                </SonarButton>
                <SonarButton
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="px-gutter-lg py-gutter-sm rounded-full bg-dark-secondary-container text-dark-on-secondary-container font-label text-label-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  + Tandai Spot Cepat
                </SonarButton>
              </div>
            </div>

            {spotsLoading && !latestVerified ? (
              <div className="w-full lg:w-96 rounded-xl border border-dark-outline-variant bg-dark-surface-container-lowest p-gutter-md flex flex-col gap-gutter-sm">
                <div className="h-4 w-1/2 rounded sonar-skeleton" />
                <div className="w-full h-36 rounded-lg sonar-skeleton" />
                <div className="h-4 w-3/4 rounded sonar-skeleton" />
              </div>
            ) : (
              latestVerified && (
                <Tilt3DCard className="w-full lg:w-96 rounded-xl" intensity={7}>
                  <button
                    type="button"
                    onClick={() => navigate('map', latestVerified.id)}
                    className="group w-full rounded-xl overflow-hidden border border-dark-outline-variant bg-dark-surface-container-lowest p-gutter-md flex flex-col gap-gutter-sm text-left hover:border-dark-primary/70 hover:shadow-[0_12px_30px_-12px_rgba(111,214,224,0.3)] transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-gutter-sm">
                      <span className="font-label text-label-md text-dark-secondary">
                        Pin Terakhir Diverifikasi
                      </span>
                      <span className="font-mono text-mono-sm text-dark-primary tabular-nums">
                        {latestVerified.coords}
                      </span>
                    </div>
                    <SmartImage
                      src={latestVerified.catches[0]?.img || DESIGN_IMAGES.catchBaungSungai}
                      alt={latestVerified.catches[0]?.fish || latestVerified.name}
                      className="w-full h-36 rounded-lg"
                      fallbackIcon="phishing"
                      zoomOnHover
                    />
                    <div className="flex items-center justify-between gap-gutter-sm">
                      <span className="font-title text-title-md text-dark-on-surface truncate group-hover:text-dark-primary transition-colors">
                        {latestVerified.name}
                      </span>
                      <span className="font-mono text-mono-md text-dark-secondary whitespace-nowrap shrink-0">
                        {latestVerified.catches[0]
                          ? `${latestVerified.catches[0].fish.replace(/^Ikan\s+/i, '')} • ${latestVerified.catches[0].weight}`
                          : latestVerified.categoryLabel}
                      </span>
                    </div>
                  </button>
                </Tilt3DCard>
              )
            )}
          </motion.div>
        </section>
      </main>

      <footer className="bg-dark-surface-container-lowest border-t border-dark-outline-variant py-gutter-lg px-gutter-lg">
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-gutter-md">
          <span className="font-title text-title-md text-dark-on-surface">
            KailSpot — Midnight Sonar
          </span>
          <span className="text-body-sm text-dark-on-surface-variant">
            Peta Spot &amp; Tangkapan Komunitas Pemancing Tegal
          </span>
        </div>
      </footer>

      <MarkSpotModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => navigate('map')}
      />
    </div>
  );
}
