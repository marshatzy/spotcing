import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  CATEGORY_LABELS,
  formatCoords,
  formatRelativeTimeId,
  getDefaultCatchImageForCategory,
  getDefaultImageForCategory,
  hashStringToNumericId,
  parseCoordsString,
  type CatchReport,
  type FishingSpot,
  type SpotStatus,
  type WaterCategory,
} from '../data/spots';
import {
  apiClaimInitialAdmin,
  apiCreateCatch,
  apiCreateSpot,
  apiFetchSpots,
  apiLogin,
  apiMaterializeSpotStatus,
  apiRegister,
  apiUpdateSpotStatus,
  fetchBackendHealth,
  type HealthStatus,
  type SpotsApiPayload,
} from '../lib/supabaseApi';

export type AppRoute = 'landing' | 'map' | 'login' | 'admin';
export type UserRole = 'angler' | 'admin';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface NewSpotInput {
  name: string;
  category: WaterCategory;
  coords: string;
  fish: string;
  weight: string;
  baitAndCondition: string;
  lat?: number;
  lng?: number;
  address?: string;
  placeId?: string;
  spotImage?: string;
}

interface KailSpotContextValue {
  route: AppRoute;
  navigate: (nextRoute: AppRoute, spotId?: number) => void;
  spots: FishingSpot[];
  selectedSpotId: number;
  setSelectedSpotId: (id: number) => void;
  tegalCenter: google.maps.LatLngLiteral | null;
  tegalBounds: google.maps.LatLngBoundsLiteral | null;
  spotsLoading: boolean;
  placesError: string | null;
  setTegalViewport: (
    center: google.maps.LatLngLiteral,
    bounds: google.maps.LatLngBoundsLiteral | null
  ) => void;
  setDiscoveredPlaces: (places: FishingSpot[]) => void;
  setSpotsLoading: (loading: boolean) => void;
  setPlacesError: (message: string | null) => void;
  rejectedCount: number;
  user: UserSession | null;
  authToken: string | null;
  backendHealth: HealthStatus | null;
  loginWithCredentials: (email: string, password: string) => Promise<UserSession>;
  registerWithCredentials: (name: string, email: string, password: string) => Promise<UserSession>;
  claimInitialAdmin: () => Promise<UserSession>;
  logout: () => void;
  refreshSpots: () => Promise<void>;
  addSpot: (input: NewSpotInput) => Promise<FishingSpot>;
  addCatchToSpot: (spotId: number, fish: string, weight: string, photoUrl?: string) => Promise<void>;
  verifySpot: (spotId: number) => Promise<void>;
  revokeSpot: (spotId: number) => Promise<void>;
  rejectSpot: (spotId: number) => Promise<void>;
  likedCatchIds: string[];
  toggleLikeCatch: (catchId: string) => void;
}

const LIKES_STORAGE_KEY = 'kailspot_likes_v1';

function parseHashRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (hash === 'map' || hash === 'peta') return 'map';
  if (hash === 'login' || hash === 'masuk') return 'login';
  if (hash === 'admin') return 'admin';
  return 'landing';
}

function loadLikedIds(): string[] {
  try {
    const raw = localStorage.getItem(LIKES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeCategory(raw: string): WaterCategory {
  if (raw === 'sungai' || raw === 'danau' || raw === 'laut') return raw;
  return 'laut';
}

function mapSupabasePayloadToSpots(payload: SpotsApiPayload): FishingSpot[] {
  const profileMap: Record<string, string> = {};
  for (const prof of payload.profiles) {
    if (prof.id && prof.username) {
      profileMap[prof.id] = prof.username;
    }
  }

  const catchesByLoc: Record<string, CatchReport[]> = {};
  for (const c of payload.catches) {
    const list = catchesByLoc[c.location_id] || [];
    const weightLabel =
      typeof c.weight_kg === 'number' && Number.isFinite(c.weight_kg)
        ? `${c.weight_kg.toString().replace('.', ',')} kg`
        : 'Tercatat';
    list.push({
      id: c.id,
      fish: c.fish_species,
      weight: weightLabel,
      angler: profileMap[c.user_id] || 'Pemancing Tegal',
      time: formatRelativeTimeId(c.created_at),
      img: c.photo_url,
    });
    catchesByLoc[c.location_id] = list;
  }

  return payload.locations.map((loc) => {
    const category = normalizeCategory(loc.category);
    const catches = catchesByLoc[loc.id] || [];
    const primaryPhoto = catches[0]?.img || getDefaultImageForCategory(category);
    const status: SpotStatus = loc.status === 'verified' ? 'verified' : 'pending';

    return {
      id: hashStringToNumericId(loc.id),
      dbId: loc.id,
      spotKey: `db:${loc.id}`,
      name: loc.name,
      address: loc.road_access || 'Kota & Kabupaten Tegal, Jawa Tengah',
      category,
      categoryLabel: CATEGORY_LABELS[category],
      lat: loc.latitude,
      lng: loc.longitude,
      coords: formatCoords(loc.latitude, loc.longitude),
      status,
      waterCondition: loc.water_type || 'Perairan Wilayah Tegal',
      bestBait: loc.recommended_bait || 'Umpan alami',
      spotImage: primaryPhoto,
      angler: profileMap[loc.user_id] || 'Pemancing Tegal',
      time: formatRelativeTimeId(loc.created_at),
      source: 'supabase',
      catches:
        catches.length > 0
          ? catches
          : [
              {
                id: `c-${loc.id}-seed`,
                fish: loc.target_fish || 'Ikan Lokal Tegal',
                weight: 'Spot Baru',
                angler: profileMap[loc.user_id] || 'Pemancing Tegal',
                time: formatRelativeTimeId(loc.created_at),
                img: getDefaultCatchImageForCategory(category),
              },
            ],
    };
  });
}

const KailSpotContext = createContext<KailSpotContextValue | null>(null);

export function KailSpotProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<AppRoute>(() => parseHashRoute());
  const [supabaseSpots, setSupabaseSpots] = useState<FishingSpot[]>([]);
  const [placesSpots, setPlacesSpots] = useState<FishingSpot[]>([]);
  const [hiddenPlaceKeys, setHiddenPlaceKeys] = useState<string[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState<number>(0);
  const [tegalCenter, setTegalCenter] = useState<google.maps.LatLngLiteral | null>(null);
  const [tegalBounds, setTegalBounds] = useState<google.maps.LatLngBoundsLiteral | null>(null);
  const [spotsLoading, setSpotsLoading] = useState<boolean>(true);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [likedCatchIds, setLikedCatchIds] = useState<string[]>(() => loadLikedIds());
  const [rejectedCount, setRejectedCount] = useState<number>(0);
  // Session token & user kept strictly in React memory (never persisted in localStorage)
  const [user, setUser] = useState<UserSession | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<HealthStatus | null>(null);

  const refreshHealth = useCallback(async () => {
    try {
      const status = await fetchBackendHealth();
      setBackendHealth(status);
    } catch {
      setBackendHealth({
        configured: false,
        dbReady: false,
        hasAdmin: false,
        dbError: 'Server backend tidak terjangkau.',
      });
    }
  }, []);

  const refreshSpots = useCallback(async () => {
    try {
      const payload = await apiFetchSpots();
      if (payload.dbReady) {
        setSupabaseSpots(mapSupabasePayloadToSpots(payload));
      }
    } catch {
      // Keep Google Places spots active if Supabase tables aren't granted yet
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    void refreshSpots();
  }, [refreshHealth, refreshSpots]);

  const spots = useMemo(() => {
    const hiddenSet = new Set(hiddenPlaceKeys);
    const dbCoordSet = new Set(
      supabaseSpots.map((s) => `${s.name.toLowerCase()}|${s.lat.toFixed(4)}|${s.lng.toFixed(4)}`)
    );
    const filteredPlaces = placesSpots.filter((p) => {
      if (hiddenSet.has(p.spotKey)) return false;
      const sig = `${p.name.toLowerCase()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
      return !dbCoordSet.has(sig);
    });
    return [...supabaseSpots, ...filteredPlaces];
  }, [supabaseSpots, placesSpots, hiddenPlaceKeys]);

  useEffect(() => {
    if (spots.length > 0 && !spots.some((s) => s.id === selectedSpotId)) {
      setSelectedSpotId(spots[0].id);
    }
  }, [spots, selectedSpotId]);

  useEffect(() => {
    try {
      localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(likedCatchIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [likedCatchIds]);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHashRoute());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute, spotId?: number) => {
    if (typeof spotId === 'number') {
      setSelectedSpotId(spotId);
    }
    const hashMap: Record<AppRoute, string> = {
      landing: '#/',
      map: '#/map',
      login: '#/login',
      admin: '#/admin',
    };
    if (window.location.hash !== hashMap[nextRoute]) {
      window.location.hash = hashMap[nextRoute];
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const setTegalViewport = useCallback(
    (center: google.maps.LatLngLiteral, bounds: google.maps.LatLngBoundsLiteral | null) => {
      setTegalCenter(center);
      setTegalBounds(bounds);
    },
    []
  );

  const setDiscoveredPlaces = useCallback((places: FishingSpot[]) => {
    setPlacesSpots(places);
  }, []);

  const loginWithCredentials = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setAuthToken(res.token);
    setUser(res.user);
    void refreshHealth();
    return res.user;
  }, [refreshHealth]);

  const registerWithCredentials = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await apiRegister(name, email, password);
      setAuthToken(res.token);
      setUser(res.user);
      void refreshHealth();
      return res.user;
    },
    [refreshHealth]
  );

  const claimInitialAdmin = useCallback(async () => {
    if (!authToken) {
      throw new Error('Silakan masuk terlebih dahulu sebelum mengaktifkan admin.');
    }
    const res = await apiClaimInitialAdmin(authToken);
    setUser(res.user);
    await refreshHealth();
    return res.user;
  }, [authToken, refreshHealth]);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    navigate('login');
  }, [navigate]);

  const addSpot = useCallback(
    async (input: NewSpotInput): Promise<FishingSpot> => {
      if (!authToken) {
        throw new Error('Silakan masuk terlebih dahulu untuk menambahkan pin ke database.');
      }
      const parsed = parseCoordsString(input.coords);
      const lat = input.lat ?? parsed?.lat ?? tegalCenter?.lat ?? -6.8694;
      const lng = input.lng ?? parsed?.lng ?? tegalCenter?.lng ?? 109.1402;
      const photoUrl = input.spotImage || getDefaultCatchImageForCategory(input.category);

      const created = await apiCreateSpot(authToken, {
        name: input.name.trim(),
        category: input.category,
        lat,
        lng,
        fish: input.fish.trim(),
        weight: input.weight.trim(),
        baitAndCondition: input.baitAndCondition.trim(),
        address: input.address,
        photoUrl,
      });

      await refreshSpots();
      const newNumericId = hashStringToNumericId(created.location.id);
      setSelectedSpotId(newNumericId);

      return {
        id: newNumericId,
        dbId: created.location.id,
        spotKey: `db:${created.location.id}`,
        name: created.location.name,
        address: created.location.road_access || 'Wilayah Tegal',
        category: input.category,
        categoryLabel: CATEGORY_LABELS[input.category],
        lat,
        lng,
        coords: formatCoords(lat, lng),
        status: 'pending',
        waterCondition: input.baitAndCondition.trim(),
        bestBait: input.baitAndCondition.trim(),
        spotImage: photoUrl,
        angler: user?.name || 'Anda',
        time: 'Baru saja',
        source: 'supabase',
        catches: [
          {
            id: created.catchReport.id,
            fish: input.fish.trim(),
            weight: input.weight.trim(),
            angler: user?.name || 'Anda',
            time: 'Baru saja',
            img: photoUrl,
          },
        ],
      };
    },
    [authToken, refreshSpots, tegalCenter, user]
  );

  const addCatchToSpot = useCallback(
    async (spotId: number, fish: string, weight: string, photoUrl?: string) => {
      if (!authToken) {
        throw new Error('Silakan masuk terlebih dahulu untuk membagikan tangkapan.');
      }
      const target = spots.find((s) => s.id === spotId);
      if (!target) {
        throw new Error('Spot tidak ditemukan.');
      }
      const resolvedPhoto = photoUrl || getDefaultCatchImageForCategory(target.category);

      const res = await apiCreateCatch(authToken, {
        locationId: target.dbId,
        fish: fish.trim(),
        weight: weight.trim(),
        photoUrl: resolvedPhoto,
        spotSeed: target.dbId
          ? undefined
          : {
              name: target.name,
              category: target.category,
              lat: target.lat,
              lng: target.lng,
              address: target.address,
              waterCondition: target.waterCondition,
              bestBait: target.bestBait,
              status: target.status,
            },
      });

      await refreshSpots();
      if (!target.dbId && res.locationId) {
        setSelectedSpotId(hashStringToNumericId(res.locationId));
      }
    },
    [authToken, refreshSpots, spots]
  );

  const verifySpot = useCallback(
    async (spotId: number) => {
      if (!authToken) {
        throw new Error('Masuk sebagai Admin untuk memverifikasi spot.');
      }
      const target = spots.find((s) => s.id === spotId);
      if (!target) return;

      if (target.dbId) {
        await apiUpdateSpotStatus(authToken, target.dbId, 'verified');
      } else {
        await apiMaterializeSpotStatus(authToken, {
          name: target.name,
          category: target.category,
          lat: target.lat,
          lng: target.lng,
          address: target.address,
          waterCondition: target.waterCondition,
          bestBait: target.bestBait,
          fish: target.catches[0]?.fish,
          status: 'verified',
        });
      }
      await refreshSpots();
    },
    [authToken, refreshSpots, spots]
  );

  const revokeSpot = useCallback(
    async (spotId: number) => {
      if (!authToken) {
        throw new Error('Masuk sebagai Admin untuk mengubah status spot.');
      }
      const target = spots.find((s) => s.id === spotId);
      if (!target) return;

      if (target.dbId) {
        await apiUpdateSpotStatus(authToken, target.dbId, 'pending');
      } else {
        await apiMaterializeSpotStatus(authToken, {
          name: target.name,
          category: target.category,
          lat: target.lat,
          lng: target.lng,
          address: target.address,
          waterCondition: target.waterCondition,
          bestBait: target.bestBait,
          fish: target.catches[0]?.fish,
          status: 'pending',
        });
      }
      await refreshSpots();
    },
    [authToken, refreshSpots, spots]
  );

  const rejectSpot = useCallback(
    async (spotId: number) => {
      if (!authToken) {
        throw new Error('Masuk sebagai Admin untuk menolak spot.');
      }
      const target = spots.find((s) => s.id === spotId);
      if (!target) return;

      if (target.dbId) {
        await apiUpdateSpotStatus(authToken, target.dbId, 'rejected', 'Ditolak oleh Admin Verifikator');
        await refreshSpots();
      } else {
        setHiddenPlaceKeys((prev) => (prev.includes(target.spotKey) ? prev : [...prev, target.spotKey]));
      }
      setRejectedCount((c) => c + 1);
    },
    [authToken, refreshSpots, spots]
  );

  const toggleLikeCatch = useCallback((catchId: string) => {
    setLikedCatchIds((prev) =>
      prev.includes(catchId) ? prev.filter((id) => id !== catchId) : [...prev, catchId]
    );
  }, []);

  return (
    <KailSpotContext.Provider
      value={{
        route,
        navigate,
        spots,
        selectedSpotId,
        setSelectedSpotId,
        tegalCenter,
        tegalBounds,
        spotsLoading,
        placesError,
        setTegalViewport,
        setDiscoveredPlaces,
        setSpotsLoading,
        setPlacesError,
        rejectedCount,
        user,
        authToken,
        backendHealth,
        loginWithCredentials,
        registerWithCredentials,
        claimInitialAdmin,
        logout,
        refreshSpots,
        addSpot,
        addCatchToSpot,
        verifySpot,
        revokeSpot,
        rejectSpot,
        likedCatchIds,
        toggleLikeCatch,
      }}
    >
      {children}
    </KailSpotContext.Provider>
  );
}

export function useKailSpot() {
  const ctx = useContext(KailSpotContext);
  if (!ctx) {
    throw new Error('useKailSpot must be used inside KailSpotProvider');
  }
  return ctx;
}
