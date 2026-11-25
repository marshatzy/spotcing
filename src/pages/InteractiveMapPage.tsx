import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  ColorScheme,
  InfoWindow,
  Map as GoogleMapView,
  type MapMouseEvent,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { AnimatePresence, motion } from 'motion/react';
import {
  LikeCatchButton,
  SonarButton,
  SonarRadarLoader,
  SonarSpinner,
  Tilt3DCard,
} from '../components/MotionPrimitives';
import { PhotoUploadField } from '../components/PhotoUploadField';
import { SmartImage } from '../components/SmartImage';
import { useKailSpot } from '../context/KailSpotContext';
import {
  formatCoords,
  getDefaultImageForCategory,
  inferWaterCategory,
  type FishingSpot,
  type WaterCategory,
} from '../data/spots';
import {
  getGoogleMapsApiKey,
  isGoogleMapsQuotaError,
  triggerQuotaExceededNotice,
} from '../lib/mapsConfig';

type MapFilter = 'all' | 'laut' | 'sungai' | 'danau' | 'verified';
type PanelMode = 'detail' | 'add';
type MapVisualType = 'roadmap' | 'hybrid';

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

interface TegalSearchCandidate {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: WaterCategory;
  photoUrl: string;
}

function TegalCameraController({
  tegalBounds,
  selectedSpot,
  focusTrigger,
  resetTrigger,
}: {
  tegalBounds: google.maps.LatLngBoundsLiteral | null;
  selectedSpot: FishingSpot | undefined;
  focusTrigger: number;
  resetTrigger: number;
}) {
  const map = useMap('kailspot-tegal-map');
  const fittedOnceRef = useRef(false);

  useEffect(() => {
    if (!map || !tegalBounds || fittedOnceRef.current) return;
    fittedOnceRef.current = true;
    map.fitBounds(tegalBounds, 32);
  }, [map, tegalBounds]);

  useEffect(() => {
    if (!map || focusTrigger === 0 || !selectedSpot) return;
    map.panTo({ lat: selectedSpot.lat, lng: selectedSpot.lng });
    const currentZoom = map.getZoom() ?? 12;
    if (currentZoom < 14) {
      map.setZoom(14);
    }
  }, [map, focusTrigger, selectedSpot]);

  useEffect(() => {
    if (!map || resetTrigger === 0 || !tegalBounds) return;
    map.fitBounds(tegalBounds, 32);
  }, [map, resetTrigger, tegalBounds]);

  return null;
}

function SpotMarkerItem({
  spot,
  isSelected,
  isInfoOpen,
  onSelect,
  onCloseInfo,
}: {
  spot: FishingSpot;
  isSelected: boolean;
  isInfoOpen: boolean;
  onSelect: (spot: FishingSpot) => void;
  onCloseInfo: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isVerified = spot.status === 'verified';
  const primaryCatch = spot.catches[0];

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: spot.lat, lng: spot.lng }}
        title={spot.name}
        zIndex={isSelected ? 40 : 10}
        onClick={() => onSelect(spot)}
      >
        <div className="flex flex-col items-center gap-1 cursor-pointer group">
          <span
            className={`px-2.5 py-0.5 rounded-full text-label-sm font-label whitespace-nowrap shadow-md border transition-colors ${
              isSelected
                ? 'bg-dark-primary text-dark-on-primary border-dark-primary'
                : 'bg-dark-surface-container-lowest/95 text-dark-on-surface border-dark-outline-variant group-hover:border-dark-primary/70'
            }`}
          >
            {spot.name}
          </span>
          <span
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-transform ${
              isVerified
                ? 'bg-dark-secondary text-dark-on-secondary'
                : 'bg-dark-tertiary text-dark-on-tertiary'
            } ${isSelected ? 'ring-4 ring-dark-primary scale-110' : 'group-hover:scale-105'}`}
          >
            <span className="material-symbols-outlined text-title-md" aria-hidden="true">
              {isVerified ? 'verified' : 'schedule'}
            </span>
          </span>
        </div>
      </AdvancedMarker>

      {isInfoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={onCloseInfo} maxWidth={260}>
          <div className="text-slate-900 p-0.5 flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              {spot.categoryLabel} • {isVerified ? 'Terverifikasi' : 'Menunggu Admin'}
            </span>
            <strong className="text-sm font-bold leading-snug text-slate-950">
              {spot.name}
            </strong>
            {spot.address && (
              <span className="text-xs text-slate-600 line-clamp-2">{spot.address}</span>
            )}
            {primaryCatch && (
              <span className="text-xs font-medium text-teal-700">
                Tangkapan: {primaryCatch.fish} ({primaryCatch.weight})
              </span>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function InteractiveMapPage() {
  const {
    navigate,
    spots,
    selectedSpotId,
    setSelectedSpotId,
    tegalCenter,
    tegalBounds,
    spotsLoading,
    placesError,
    addSpot,
    addCatchToSpot,
    user,
    authToken,
    likedCatchIds,
    toggleLikeCatch,
  } = useKailSpot();

  const placesLib = useMapsLibrary('places');
  const apiStatus = useApiLoadingStatus();
  const hasApiKey = Boolean(getGoogleMapsApiKey());

  const [filter, setFilter] = useState<MapFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [panelMode, setPanelMode] = useState<PanelMode>('detail');
  const [mapType, setMapType] = useState<MapVisualType>('roadmap');
  const [draftPosition, setDraftPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [showDraftPin, setShowDraftPin] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<string>('Menunggu GPS Tegal...');
  const [infoSpotId, setInfoSpotId] = useState<number | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);

  // Places text search state (within Tegal)
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [searchResults, setSearchResults] = useState<TegalSearchCandidate[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  // Add pin form fields
  const [spotName, setSpotName] = useState('');
  const [waterType, setWaterType] = useState<WaterCategory>('laut');
  const [coordsInput, setCoordsInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [placeIdInput, setPlaceIdInput] = useState<string | undefined>(undefined);
  const [spotPhotoInput, setSpotPhotoInput] = useState<string | undefined>(undefined);
  const [fishInput, setFishInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [baitInput, setBaitInput] = useState('');
  const [submittingPin, setSubmittingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Quick catch form fields
  const [quickFish, setQuickFish] = useState('');
  const [quickWeight, setQuickWeight] = useState('');
  const [quickPhotoUrl, setQuickPhotoUrl] = useState('');
  const [submittingCatch, setSubmittingCatch] = useState(false);
  const [catchError, setCatchError] = useState<string | null>(null);
  const [catchSavedFlash, setCatchSavedFlash] = useState(false);

  useEffect(() => {
    if (tegalCenter && !coordsInput) {
      const formatted = formatCoords(tegalCenter.lat, tegalCenter.lng);
      setCoordsInput(formatted);
      setCursorCoords(formatted);
    }
  }, [tegalCenter, coordsInput]);

  const filteredSpots = spots.filter((s) => {
    const matchesCat =
      filter === 'all'
        ? true
        : filter === 'verified'
          ? s.status === 'verified'
          : s.category === filter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      s.catches.some((c) => c.fish.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const selectedSpot = spots.find((s) => s.id === selectedSpotId) || spots[0];

  const switchMode = (nextMode: PanelMode) => {
    setPanelMode(nextMode);
    if (nextMode === 'add') {
      const fallbackPos = draftPosition || tegalCenter;
      if (fallbackPos) {
        setDraftPosition(fallbackPos);
        setCoordsInput(formatCoords(fallbackPos.lat, fallbackPos.lng));
      }
      setShowDraftPin(true);
      setInfoSpotId(null);
    } else {
      setShowDraftPin(false);
    }
  };

  const handleGoogleMapClick = useCallback((ev: MapMouseEvent) => {
    const latLng = ev.detail.latLng;
    if (!latLng) return;
    const formatted = formatCoords(latLng.lat, latLng.lng);
    setDraftPosition(latLng);
    setCursorCoords(formatted);
    setCoordsInput(formatted);
    setAddressInput('Wilayah Tegal, Jawa Tengah');
    setPlaceIdInput(undefined);
    setSpotPhotoInput(undefined);
    setPanelMode('add');
    setShowDraftPin(true);
    setInfoSpotId(null);
  }, []);

  const handleGoogleMapMove = useCallback((ev: MapMouseEvent) => {
    const latLng = ev.detail.latLng;
    if (!latLng) return;
    setCursorCoords(formatCoords(latLng.lat, latLng.lng));
  }, []);

  const handleSelectSpot = (spot: FishingSpot) => {
    setSelectedSpotId(spot.id);
    setInfoSpotId(spot.id);
    setPanelMode('detail');
    setShowDraftPin(false);
    setFocusTrigger((n) => n + 1);
  };

  const handleTegalPlaceSearch = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q || !placesLib) return;

    setSearchingPlaces(true);
    setSearchMessage(null);

    try {
      const textQuery = q.toLowerCase().includes('tegal') ? q : `${q} di Tegal`;
      const { places } = await placesLib.Place.searchByText({
        textQuery,
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'types', 'photos'],
        locationBias: tegalBounds ?? tegalCenter ?? undefined,
        language: 'id',
        region: 'id',
        maxResultCount: 5,
        internalUsageAttributionIds: ATTRIBUTION_IDS,
      });

      const mapped: TegalSearchCandidate[] = (places ?? [])
        .filter((p) => Boolean(p.id && p.location))
        .map((p) => {
          const name = p.displayName || 'Lokasi di Tegal';
          const category = inferWaterCategory(name, p.types ?? [], 'laut');
          return {
            placeId: p.id!,
            name,
            address: p.formattedAddress || 'Tegal, Jawa Tengah',
            lat: p.location!.lat(),
            lng: p.location!.lng(),
            category,
            photoUrl: p.photos?.[0]?.getURI({ maxWidth: 800 }) || getDefaultImageForCategory(category),
          };
        });

      setSearchResults(mapped);
      if (mapped.length === 0) {
        setSearchMessage(`Tidak ditemukan lokasi "${q}" di wilayah Tegal.`);
      }
    } catch (err) {
      if (isGoogleMapsQuotaError(err)) {
        triggerQuotaExceededNotice();
      }
      setSearchMessage('Gagal mencari lokasi di Google Maps Tegal.');
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handlePickSearchCandidate = (candidate: TegalSearchCandidate) => {
    const existing = spots.find((s) => s.placeId === candidate.placeId);
    if (existing) {
      handleSelectSpot(existing);
      setSearchResults([]);
      return;
    }

    const formatted = formatCoords(candidate.lat, candidate.lng);
    setDraftPosition({ lat: candidate.lat, lng: candidate.lng });
    setCursorCoords(formatted);
    setSpotName(candidate.name);
    setWaterType(candidate.category);
    setCoordsInput(formatted);
    setAddressInput(candidate.address);
    setPlaceIdInput(candidate.placeId);
    setSpotPhotoInput(candidate.photoUrl);
    setPanelMode('add');
    setShowDraftPin(true);
    setSearchResults([]);
  };

  const handleAddPinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !authToken) {
      setPinError('Masuk terlebih dahulu untuk menyimpan pin ke Supabase.');
      return;
    }
    if (
      !spotName.trim() ||
      !coordsInput.trim() ||
      !fishInput.trim() ||
      !weightInput.trim() ||
      !baitInput.trim()
    ) {
      return;
    }
    setSubmittingPin(true);
    setPinError(null);
    try {
      const created = await addSpot({
        name: spotName,
        category: waterType,
        coords: coordsInput,
        fish: fishInput,
        weight: weightInput,
        baitAndCondition: baitInput,
        lat: draftPosition?.lat,
        lng: draftPosition?.lng,
        address: addressInput || 'Tegal, Jawa Tengah',
        placeId: placeIdInput,
        spotImage: spotPhotoInput,
      });
      setSpotName('');
      setWaterType('laut');
      setFishInput('');
      setWeightInput('');
      setBaitInput('');
      setAddressInput('');
      setPlaceIdInput(undefined);
      setSpotPhotoInput(undefined);
      setDraftPosition(null);
      setShowDraftPin(false);
      setPanelMode('detail');
      setInfoSpotId(created.id);
      setFocusTrigger((n) => n + 1);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Gagal menyimpan spot baru.');
    } finally {
      setSubmittingPin(false);
    }
  };

  const handleQuickCatchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !authToken) {
      setCatchError('Masuk terlebih dahulu untuk mengirim laporan tangkapan.');
      return;
    }
    if (!selectedSpot || !quickFish.trim() || !quickWeight.trim()) return;
    setSubmittingCatch(true);
    setCatchError(null);
    try {
      await addCatchToSpot(selectedSpot.id, quickFish, quickWeight, quickPhotoUrl || undefined);
      setQuickFish('');
      setQuickWeight('');
      setQuickPhotoUrl('');
      setCatchSavedFlash(true);
      window.setTimeout(() => setCatchSavedFlash(false), 1800);
    } catch (err) {
      setCatchError(err instanceof Error ? err.message : 'Gagal menyimpan laporan tangkapan.');
    } finally {
      setSubmittingCatch(false);
    }
  };

  const filterButtons: { id: MapFilter; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'laut', label: 'Laut & Muara' },
    { id: 'sungai', label: 'Sungai' },
    { id: 'danau', label: 'Danau & Waduk' },
    { id: 'verified', label: 'Terverifikasi' },
  ];

  const isMapFailed =
    !hasApiKey ||
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE;

  return (
    <div className="min-h-screen flex flex-col bg-dark-surface text-dark-on-surface">
      {/* Top App Shell Header */}
      <header className="bg-dark-surface-container-lowest border-b border-dark-outline-variant px-gutter-lg py-gutter-sm">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-gutter-md">
          <div className="flex items-center gap-gutter-xl">
            <button
              type="button"
              onClick={() => navigate('landing')}
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
                  Peta Sonar Tegal &amp; Tambah Pin
                </span>
              </div>
            </button>

            <nav aria-label="Navigasi Aplikasi" className="hidden md:flex items-center gap-gutter-xs">
              <button
                type="button"
                onClick={() => navigate('landing')}
                className="nav-underline px-gutter-md py-gutter-xs rounded-full text-dark-on-surface-variant hover:text-dark-primary font-label text-label-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Beranda
              </button>
              <button
                type="button"
                onClick={() => navigate('map')}
                className="nav-underline nav-underline-active px-gutter-md py-gutter-xs rounded-full bg-dark-secondary-container text-dark-on-secondary-container font-label text-label-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Peta Tegal
              </button>
              <button
                type="button"
                onClick={() => navigate('admin')}
                className="nav-underline px-gutter-md py-gutter-xs rounded-full text-dark-on-surface-variant hover:text-dark-primary font-label text-label-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Admin Verifikasi
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-gutter-sm shrink-0">
            <SonarButton
              type="button"
              onClick={() => switchMode(panelMode === 'add' ? 'detail' : 'add')}
              className="inline-flex items-center gap-gutter-sm px-gutter-lg py-gutter-xs rounded-full bg-dark-primary text-dark-on-primary font-label text-label-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-title-md" aria-hidden="true">
                add_location_alt
              </span>
              <span>{panelMode === 'add' ? 'Kembali ke Detail' : 'Tambah Pin di Tegal'}</span>
            </SonarButton>
            <SonarButton
              type="button"
              onClick={() => navigate('login')}
              className="px-gutter-md py-gutter-xs rounded-full bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface font-label text-label-md hover:bg-dark-surface-container-high hover:border-dark-primary/50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user ? user.name.split(' ')[0] : 'Akun'}
            </SonarButton>
          </div>
        </div>
      </header>

      {/* Search & Filter Bar */}
      <div className="bg-dark-surface-container-low border-b border-dark-outline-variant px-gutter-lg py-gutter-sm">
        <div className="max-w-screen-2xl mx-auto flex flex-col gap-gutter-sm">
          <div className="flex flex-wrap items-center justify-between gap-gutter-md">
            <div className="flex flex-wrap items-center gap-gutter-sm">
              <form onSubmit={handleTegalPlaceSearch} className="flex items-center gap-gutter-xs">
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
                    placeholder="Cari spot, ikan, atau lokasi di Tegal..."
                    className="pl-10 pr-gutter-md py-gutter-xs w-64 sm:w-72 rounded-full bg-dark-surface-container border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                  />
                </div>
                <SonarButton
                  type="submit"
                  disabled={searchingPlaces || !searchQuery.trim() || !placesLib}
                  className="inline-flex items-center gap-1.5 px-gutter-md py-gutter-xs rounded-full bg-dark-surface-container-high border border-dark-outline-variant text-dark-primary font-label text-label-md hover:bg-dark-surface-bright hover:border-dark-primary/50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {searchingPlaces ? <SonarSpinner label="Mencari..." /> : <span>Cari di Tegal</span>}
                </SonarButton>
              </form>

              <div className="flex flex-wrap items-center gap-gutter-xs">
                {filterButtons.map((btn) => {
                  const isActive = filter === btn.id;
                  return (
                    <SonarButton
                      key={btn.id}
                      type="button"
                      onClick={() => setFilter(btn.id)}
                      className={`px-gutter-md py-gutter-xs rounded-full font-label text-label-md whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-dark-primary text-dark-on-primary shadow-[0_4px_14px_-4px_rgba(151,205,239,0.5)]'
                          : 'bg-dark-surface-container text-dark-on-surface-variant border border-dark-outline-variant hover:text-dark-on-surface hover:border-dark-primary/40'
                      }`}
                    >
                      {btn.label}
                    </SonarButton>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-gutter-md text-label-sm font-label">
              <span className="inline-flex items-center gap-1.5 text-dark-on-surface">
                <span className="w-2.5 h-2.5 rounded-full bg-dark-secondary" aria-hidden="true" />
                <span>Terverifikasi</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-dark-on-surface">
                <span className="w-2.5 h-2.5 rounded-full bg-dark-tertiary" aria-hidden="true" />
                <span>Menunggu Admin</span>
              </span>
            </div>
          </div>

          {/* Search Candidates Strip from Google Places in Tegal */}
          <AnimatePresence>
            {(searchResults.length > 0 || searchMessage) && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="flex flex-wrap items-center gap-gutter-xs pt-1"
              >
                {searchMessage && (
                  <span className="text-body-sm text-dark-on-surface-variant">{searchMessage}</span>
                )}
                {searchResults.map((candidate) => (
                  <SonarButton
                    key={candidate.placeId}
                    type="button"
                    onClick={() => handlePickSearchCandidate(candidate)}
                    className="inline-flex items-center gap-1.5 px-gutter-md py-1 rounded-full bg-dark-surface-container border border-dark-primary/40 text-dark-on-surface hover:bg-dark-primary-container/40 font-label text-label-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-title-sm text-dark-primary" aria-hidden="true">
                      add_location
                    </span>
                    <span className="truncate max-w-[220px]">{candidate.name}</span>
                  </SonarButton>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSearchResults([]);
                    setSearchMessage(null);
                  }}
                  className="text-label-sm font-label text-dark-on-surface-variant hover:text-dark-on-surface px-2 cursor-pointer"
                >
                  Tutup
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Full-Viewport Split Map & Drawer */}
      <main
        id="peta-interaktif"
        className="flex-1 max-w-screen-2xl w-full mx-auto p-gutter-lg grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-stretch"
      >
        {/* Left: Real Interactive Google Map Focused on Tegal */}
        <section className="lg:col-span-7 relative rounded-xl overflow-hidden border border-dark-outline-variant bg-dark-surface-container-lowest h-[560px] lg:h-[650px] flex flex-col">
          {/* Map Top Controls Overlay */}
          <div className="absolute top-3 left-3 right-14 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="px-gutter-md py-1.5 rounded-full bg-dark-surface-container-lowest/90 backdrop-blur-sm border border-dark-outline-variant flex items-center gap-gutter-xs pointer-events-auto shadow-md">
              <span
                className="material-symbols-outlined text-title-md text-dark-secondary"
                aria-hidden="true"
              >
                location_searching
              </span>
              <span className="font-label text-label-sm text-dark-on-surface">
                Fokus Wilayah Tegal • Klik peta untuk pasang pin baru
              </span>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              <SonarButton
                type="button"
                onClick={() => setMapType((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))}
                className="px-gutter-md py-1.5 rounded-full bg-dark-surface-container-lowest/90 backdrop-blur-sm border border-dark-outline-variant font-label text-label-sm text-dark-primary hover:bg-dark-surface-container shadow-md cursor-pointer"
              >
                {mapType === 'roadmap' ? 'Mode Satelit' : 'Mode Sonar Gelap'}
              </SonarButton>
              <SonarButton
                type="button"
                onClick={() => setResetTrigger((n) => n + 1)}
                className="px-gutter-md py-1.5 rounded-full bg-dark-surface-container-lowest/90 backdrop-blur-sm border border-dark-outline-variant font-label text-label-sm text-dark-secondary hover:bg-dark-surface-container shadow-md cursor-pointer"
              >
                Pusat Tegal
              </SonarButton>
            </div>
          </div>

          {/* Real Google Maps Canvas */}
          <div className="relative flex-1 w-full h-full">
            {isMapFailed ? (
              <div className="w-full h-full sonar-grid flex flex-col items-center justify-center p-gutter-xl text-center gap-gutter-sm">
                <span className="material-symbols-outlined text-headline-lg text-dark-tertiary" aria-hidden="true">
                  map
                </span>
                <p className="font-title text-title-md text-dark-on-surface">
                  Peta Google Maps tidak dapat dimuat
                </p>
                <p className="text-body-sm text-dark-on-surface-variant max-w-md">
                  Pastikan kunci Google Maps Platform tersedia dan aktif untuk menampilkan peta interaktif wilayah Tegal.
                </p>
              </div>
            ) : !tegalCenter ? (
              <div className="w-full h-full sonar-grid flex items-center justify-center">
                <SonarRadarLoader
                  title={
                    spotsLoading
                      ? 'Memindai Peta Wilayah Tegal...'
                      : placesError || 'Menyiapkan peta Tegal...'
                  }
                  subtitle="Mengambil titik perairan, pantai, muara, dan spot mancing di sekitar Kota & Kabupaten Tegal."
                />
              </div>
            ) : (
              <GoogleMapView
                id="kailspot-tegal-map"
                mapId="DEMO_MAP_ID"
                colorScheme={ColorScheme.DARK}
                defaultCenter={tegalCenter}
                defaultZoom={12}
                mapTypeId={mapType}
                gestureHandling="greedy"
                mapTypeControl={false}
                streetViewControl={false}
                clickableIcons={false}
                internalUsageAttributionIds={ATTRIBUTION_IDS}
                onClick={handleGoogleMapClick}
                onMousemove={handleGoogleMapMove}
                style={{ width: '100%', height: '100%' }}
              >
                <TegalCameraController
                  tegalBounds={tegalBounds}
                  selectedSpot={selectedSpot}
                  focusTrigger={focusTrigger}
                  resetTrigger={resetTrigger}
                />

                {filteredSpots.map((spot) => (
                  <SpotMarkerItem
                    key={spot.spotKey}
                    spot={spot}
                    isSelected={spot.id === selectedSpot?.id && panelMode === 'detail'}
                    isInfoOpen={infoSpotId === spot.id}
                    onSelect={handleSelectSpot}
                    onCloseInfo={() => setInfoSpotId(null)}
                  />
                ))}

                {showDraftPin && draftPosition && (
                  <AdvancedMarker
                    position={draftPosition}
                    draggable={true}
                    zIndex={60}
                    title="Titik Pin Baru"
                    onDragEnd={(ev) => {
                      const lat = ev.latLng?.lat();
                      const lng = ev.latLng?.lng();
                      if (typeof lat === 'number' && typeof lng === 'number') {
                        const nextPos = { lat, lng };
                        const formatted = formatCoords(lat, lng);
                        setDraftPosition(nextPos);
                        setCursorCoords(formatted);
                        setCoordsInput(formatted);
                      }
                    }}
                  >
                    <div className="flex flex-col items-center gap-1 cursor-grab">
                      <span className="px-2.5 py-0.5 rounded-full bg-dark-primary text-dark-on-primary text-label-sm font-label whitespace-nowrap shadow-md">
                        Titik Baru (Geser)
                      </span>
                      <span className="w-9 h-9 rounded-full bg-dark-primary text-dark-on-primary ring-4 ring-dark-secondary flex items-center justify-center shadow-lg">
                        <span className="material-symbols-outlined text-title-md" aria-hidden="true">
                          add_location
                        </span>
                      </span>
                    </div>
                  </AdvancedMarker>
                )}
              </GoogleMapView>
            )}
          </div>

          {/* Bottom Coordinates & Spot Count Readout */}
          <div className="absolute bottom-3 left-3 right-14 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <span className="px-gutter-md py-1.5 rounded-lg bg-dark-surface-container-lowest/90 backdrop-blur-sm border border-dark-outline-variant font-mono text-mono-sm text-dark-primary tabular-nums shadow-md">
              GPS: {cursorCoords}
            </span>
            <span className="px-gutter-md py-1.5 rounded-lg bg-dark-surface-container-lowest/90 backdrop-blur-sm border border-dark-outline-variant font-label text-label-sm text-dark-on-surface shadow-md tabular-nums">
              {filteredSpots.length} Spot di Wilayah Tegal
            </span>
          </div>
        </section>

        {/* Right: Dual-Mode Panel (Add Pin Form OR Selected Pin Detail) */}
        <aside className="lg:col-span-5 rounded-xl border border-dark-outline-variant bg-dark-surface-container p-gutter-lg flex flex-col gap-gutter-md">
          {/* Panel Mode Tabs with layoutId spring indicator */}
          <div className="grid grid-cols-2 p-1 rounded-full bg-dark-surface-container-low border border-dark-outline-variant relative">
            <button
              type="button"
              onClick={() => switchMode('detail')}
              className={`relative z-10 py-gutter-xs rounded-full font-label text-label-md transition-colors whitespace-nowrap cursor-pointer ${
                panelMode === 'detail'
                  ? 'text-dark-on-secondary-container'
                  : 'text-dark-on-surface-variant hover:text-dark-on-surface'
              }`}
            >
              {panelMode === 'detail' && (
                <motion.span
                  layoutId="map-panel-tab"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-dark-secondary-container -z-10"
                />
              )}
              Detail Pin Terpilih
            </button>
            <button
              type="button"
              onClick={() => switchMode('add')}
              className={`relative z-10 py-gutter-xs rounded-full font-label text-label-md transition-colors whitespace-nowrap cursor-pointer ${
                panelMode === 'add'
                  ? 'text-dark-on-primary'
                  : 'text-dark-on-surface-variant hover:text-dark-on-surface'
              }`}
            >
              {panelMode === 'add' && (
                <motion.span
                  layoutId="map-panel-tab"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-dark-primary -z-10"
                />
              )}
              + Tambah Pin Baru
            </button>
          </div>

          {/* Quick Horizontal Tegal Spot Strip */}
          {filteredSpots.length > 0 && panelMode === 'detail' && (
            <div className="flex items-center gap-gutter-xs overflow-x-auto pb-1">
              {filteredSpots.map((spot) => {
                const active = spot.id === selectedSpot?.id;
                return (
                  <button
                    key={spot.spotKey}
                    type="button"
                    onClick={() => handleSelectSpot(spot)}
                    className={`px-gutter-sm py-1 rounded-full font-label text-label-sm whitespace-nowrap shrink-0 border transition-all duration-150 hover:-translate-y-0.5 cursor-pointer ${
                      active
                        ? 'bg-dark-primary-container text-dark-on-primary-container border-dark-primary'
                        : 'bg-dark-surface-container-low text-dark-on-surface-variant border-dark-outline-variant hover:text-dark-on-surface hover:border-dark-primary/40'
                    }`}
                  >
                    {spot.name}
                  </button>
                );
              })}
            </div>
          )}

          <AnimatePresence mode="wait">
            {panelMode === 'detail' && selectedSpot ? (
              <motion.div
                key={`detail-${selectedSpot.spotKey}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-gutter-md"
              >
                <div className="flex items-start justify-between gap-gutter-sm">
                  <div className="min-w-0">
                    <span className="font-label text-label-sm text-dark-primary uppercase">
                      {selectedSpot.categoryLabel}
                    </span>
                    <h2 className="font-headline text-headline-md text-dark-on-surface leading-tight">
                      {selectedSpot.name}
                    </h2>
                    {selectedSpot.address && (
                      <span className="block text-body-sm text-dark-on-surface-variant truncate mt-0.5">
                        {selectedSpot.address}
                      </span>
                    )}
                    <span className="font-mono text-mono-sm text-dark-on-surface-variant tabular-nums">
                      {selectedSpot.coords}
                    </span>
                  </div>
                  {selectedSpot.status === 'verified' ? (
                    <span className="px-gutter-md py-gutter-xs rounded-full bg-dark-secondary-container text-dark-on-secondary-container font-label text-label-sm whitespace-nowrap shrink-0">
                      Terverifikasi Admin
                    </span>
                  ) : (
                    <span className="px-gutter-md py-gutter-xs rounded-full bg-dark-tertiary-container text-dark-on-tertiary-container font-label text-label-sm whitespace-nowrap shrink-0">
                      Menunggu Verifikasi
                    </span>
                  )}
                </div>

                <Tilt3DCard className="rounded-lg group" intensity={5}>
                  <SmartImage
                    src={selectedSpot.spotImage}
                    alt={selectedSpot.name}
                    className="w-full h-44 rounded-lg border border-dark-outline-variant"
                    fallbackIcon="water"
                    zoomOnHover
                  />
                </Tilt3DCard>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter-sm">
                  <div className="p-gutter-sm rounded-lg bg-dark-surface-container-low border border-dark-outline-variant">
                    <span className="block font-label text-label-sm text-dark-on-surface-variant">
                      Kondisi Air
                    </span>
                    <span className="text-body-sm text-dark-on-surface">
                      {selectedSpot.waterCondition}
                    </span>
                  </div>
                  <div className="p-gutter-sm rounded-lg bg-dark-surface-container-low border border-dark-outline-variant">
                    <span className="block font-label text-label-sm text-dark-on-surface-variant">
                      Umpan Andalan
                    </span>
                    <span className="text-body-sm text-dark-on-surface">
                      {selectedSpot.bestBait}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-gutter-sm">
                  <span className="font-label text-label-md text-dark-on-surface">
                    Tangkapan di Pin Ini ({selectedSpot.catches.length})
                  </span>
                  <div className="flex flex-col gap-gutter-sm max-h-48 overflow-y-auto pr-1">
                    {selectedSpot.catches.map((c) => {
                      const liked = likedCatchIds.includes(c.id);
                      return (
                        <motion.div
                          key={c.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="group flex items-center gap-gutter-md p-gutter-sm rounded-lg bg-dark-surface-container-low border border-dark-outline-variant hover:border-dark-primary/40 transition-colors"
                        >
                          <SmartImage
                            src={c.img}
                            alt={c.fish}
                            className="w-14 h-14 rounded-md shrink-0"
                            fallbackIcon="phishing"
                            zoomOnHover
                          />
                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex items-center justify-between gap-gutter-xs">
                              <span className="font-title text-title-md text-dark-on-surface truncate">
                                {c.fish}
                              </span>
                              <span className="font-mono text-mono-md text-dark-secondary tabular-nums whitespace-nowrap shrink-0">
                                {c.weight}
                              </span>
                            </div>
                            <span className="text-body-sm text-dark-on-surface-variant truncate">
                              Pemancing: {c.angler} • {c.time}
                            </span>
                          </div>
                          <LikeCatchButton
                            liked={liked}
                            count={6 + (liked ? 1 : 0)}
                            onToggle={() => toggleLikeCatch(c.id)}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <form
                  onSubmit={handleQuickCatchSubmit}
                  className="pt-gutter-sm border-t border-dark-outline-variant flex flex-col gap-gutter-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-label text-label-sm text-dark-primary">
                      + Bagikan Tangkapan di Pin Ini
                    </span>
                    <AnimatePresence>
                      {catchSavedFlash && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="font-label text-label-sm text-dark-secondary"
                        >
                          Tersimpan!
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="grid grid-cols-2 gap-gutter-xs">
                    <input
                      required
                      type="text"
                      value={quickFish}
                      onChange={(e) => setQuickFish(e.target.value)}
                      placeholder="Jenis ikan"
                      className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-sm py-gutter-xs text-body-sm focus:border-dark-primary focus:outline-none transition-colors"
                    />
                    <input
                      required
                      type="text"
                      value={quickWeight}
                      onChange={(e) => setQuickWeight(e.target.value)}
                      placeholder="Berat (kg)"
                      className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-sm py-gutter-xs text-body-sm focus:border-dark-primary focus:outline-none transition-colors"
                    />
                  </div>
                  <PhotoUploadField
                    id="quick-catch-photo"
                    label="Foto Tangkapan (Opsional)"
                    token={authToken}
                    valueUrl={quickPhotoUrl}
                    onChangeUrl={setQuickPhotoUrl}
                    compact
                  />
                  {catchError && (
                    <div className="p-2 rounded-lg bg-dark-error-container text-dark-on-error-container text-body-sm flex items-center justify-between gap-2">
                      <span>{catchError}</span>
                      {!user && (
                        <button
                          type="button"
                          onClick={() => navigate('login')}
                          className="font-label text-label-sm underline shrink-0 cursor-pointer"
                        >
                          Masuk
                        </button>
                      )}
                    </div>
                  )}
                  <SonarButton
                    type="submit"
                    disabled={submittingCatch}
                    className="py-gutter-xs px-gutter-md rounded-full bg-dark-secondary text-dark-on-secondary font-label text-label-md cursor-pointer inline-flex items-center justify-center"
                  >
                    {submittingCatch ? <SonarSpinner label="Menyimpan..." /> : 'Simpan Tangkapan'}
                  </SonarButton>
                </form>
              </motion.div>
            ) : panelMode === 'detail' ? (
              <motion.div
                key="detail-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-gutter-xl text-center flex flex-col items-center gap-gutter-sm"
              >
                {spotsLoading ? (
                  <div className="w-full flex flex-col gap-3">
                    <div className="h-6 w-2/3 rounded sonar-skeleton mx-auto" />
                    <div className="h-40 w-full rounded-lg sonar-skeleton" />
                    <div className="h-14 w-full rounded-lg sonar-skeleton" />
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-headline-lg text-dark-primary" aria-hidden="true">
                      explore
                    </span>
                    <p className="text-body-md text-dark-on-surface-variant">
                      Belum ada spot terpilih. Klik peta Tegal untuk menambahkan pin baru.
                    </p>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.form
                key="add-pin-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={handleAddPinSubmit}
                className="flex flex-col gap-gutter-md"
              >
                <div className="p-gutter-sm rounded-lg bg-dark-primary-container/30 border border-dark-primary/40 flex items-center gap-gutter-sm">
                  <span
                    className="material-symbols-outlined text-title-md text-dark-primary shrink-0"
                    aria-hidden="true"
                  >
                    my_location
                  </span>
                  <span className="text-body-sm text-dark-on-surface">
                    Klik di mana saja pada peta Tegal atau geser pin biru untuk mengisi koordinat otomatis.
                  </span>
                </div>

                <div className="flex flex-col gap-gutter-xs">
                  <label
                    htmlFor="add-spot-name"
                    className="font-label text-label-md text-dark-on-surface"
                  >
                    Nama Spot Mancing (Tegal)
                  </label>
                  <input
                    id="add-spot-name"
                    required
                    type="text"
                    value={spotName}
                    onChange={(e) => setSpotName(e.target.value)}
                    placeholder="Contoh: Muara Sungai / Pantai Tegal"
                    className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter-md">
                  <div className="flex flex-col gap-gutter-xs">
                    <label
                      htmlFor="add-water-type"
                      className="font-label text-label-md text-dark-on-surface"
                    >
                      Jenis Perairan
                    </label>
                    <select
                      id="add-water-type"
                      value={waterType}
                      onChange={(e) => setWaterType(e.target.value as WaterCategory)}
                      className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                    >
                      <option value="laut">Laut &amp; Muara</option>
                      <option value="sungai">Sungai</option>
                      <option value="danau">Danau &amp; Waduk</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-gutter-xs">
                    <label
                      htmlFor="add-coords"
                      className="font-label text-label-md text-dark-on-surface"
                    >
                      Koordinat GPS
                    </label>
                    <input
                      id="add-coords"
                      required
                      type="text"
                      value={coordsInput}
                      onChange={(e) => setCoordsInput(e.target.value)}
                      placeholder="Klik peta Tegal"
                      className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-primary font-mono px-gutter-md py-gutter-sm text-mono-md focus:border-dark-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter-md">
                  <div className="flex flex-col gap-gutter-xs">
                    <label
                      htmlFor="add-fish"
                      className="font-label text-label-md text-dark-on-surface"
                    >
                      Ikan Tangkapan
                    </label>
                    <input
                      id="add-fish"
                      required
                      type="text"
                      value={fishInput}
                      onChange={(e) => setFishInput(e.target.value)}
                      placeholder="Contoh: Kakap Putih"
                      className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-gutter-xs">
                    <label
                      htmlFor="add-weight"
                      className="font-label text-label-md text-dark-on-surface"
                    >
                      Berat Ikan
                    </label>
                    <input
                      id="add-weight"
                      required
                      type="text"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      placeholder="Contoh: 2,8 kg"
                      className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {!user && (
                  <div className="p-gutter-sm rounded-lg bg-dark-tertiary-container/30 border border-dark-tertiary/40 flex items-center justify-between gap-2 text-body-sm">
                    <span className="text-dark-on-surface">
                      Masuk dulu agar spot &amp; foto tersimpan ke Supabase.
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('login')}
                      className="font-label text-label-sm text-dark-primary underline shrink-0 cursor-pointer"
                    >
                      Masuk / Daftar
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-gutter-xs">
                  <label
                    htmlFor="add-bait"
                    className="font-label text-label-md text-dark-on-surface"
                  >
                    Umpan &amp; Kondisi Air
                  </label>
                  <input
                    id="add-bait"
                    required
                    type="text"
                    value={baitInput}
                    onChange={(e) => setBaitInput(e.target.value)}
                    placeholder="Contoh: Udang hidup • Air pasang tenang"
                    className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                  />
                </div>

                <PhotoUploadField
                  id="add-pin-photo"
                  label="Foto Lokasi / Tangkapan (Opsional)"
                  token={authToken}
                  valueUrl={spotPhotoInput || ''}
                  onChangeUrl={(url) => setSpotPhotoInput(url || undefined)}
                />

                {pinError && (
                  <div className="p-gutter-sm rounded-lg bg-dark-error-container text-dark-on-error-container text-body-sm">
                    {pinError}
                  </div>
                )}

                <SonarButton
                  type="submit"
                  disabled={submittingPin}
                  className="w-full py-gutter-sm px-gutter-lg rounded-full bg-dark-primary text-dark-on-primary font-label text-label-lg cursor-pointer inline-flex items-center justify-center"
                >
                  {submittingPin ? (
                    <SonarSpinner label="Menyimpan ke Supabase..." />
                  ) : (
                    'Pasang Pin & Kirim ke Admin'
                  )}
                </SonarButton>
              </motion.form>
            )}
          </AnimatePresence>
        </aside>
      </main>
    </div>
  );
}
