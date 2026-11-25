export interface SupabaseProfileRow {
  id: string;
  username: string | null;
  role: string;
}

export interface SupabaseLocationRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  water_type: string | null;
  target_fish: string | null;
  recommended_bait: string | null;
  road_access: string | null;
  latitude: number;
  longitude: number;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

export interface SupabaseCatchRow {
  id: string;
  location_id: string;
  user_id: string;
  fish_species: string;
  weight_kg: number | null;
  bait_used: string | null;
  notes: string | null;
  photo_url: string;
  status: string;
  created_at: string;
}

export interface HealthStatus {
  configured: boolean;
  dbReady: boolean;
  hasAdmin: boolean;
  dbError?: string;
  dbCode?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'angler' | 'admin';
  };
}

export interface SpotsApiPayload {
  dbReady: boolean;
  locations: SupabaseLocationRow[];
  catches: SupabaseCatchRow[];
  profiles: SupabaseProfileRow[];
  error?: string;
}

async function parseJsonSafe<T>(res: Response): Promise<T & { error?: string }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return { error: text || `HTTP ${res.status}` } as T & { error?: string };
  }
}

export async function fetchBackendHealth(): Promise<HealthStatus> {
  const res = await fetch('/api/health');
  return parseJsonSafe<HealthStatus>(res);
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonSafe<AuthResponse>(res);
  if (!res.ok) throw new Error(data.error || 'Gagal masuk.');
  return data;
}

export async function apiRegister(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await parseJsonSafe<AuthResponse>(res);
  if (!res.ok) throw new Error(data.error || 'Gagal mendaftar.');
  return data;
}

export async function apiClaimInitialAdmin(token: string): Promise<{ user: AuthResponse['user'] }> {
  const res = await fetch('/api/auth/claim-admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await parseJsonSafe<{ user: AuthResponse['user'] }>(res);
  if (!res.ok) throw new Error(data.error || 'Gagal mengaktifkan akses admin.');
  return data;
}

export async function apiFetchSpots(): Promise<SpotsApiPayload> {
  const res = await fetch('/api/spots');
  const data = await parseJsonSafe<SpotsApiPayload>(res);
  if (!res.ok && !data.locations) {
    throw new Error(data.error || 'Gagal memuat data spot dari Supabase.');
  }
  return data;
}

export async function apiUploadPhoto(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch('/api/uploads/photo', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const data = await parseJsonSafe<{ photoUrl: string }>(res);
  if (!res.ok || !data.photoUrl) {
    throw new Error(data.error || 'Gagal mengunggah foto ke Supabase Storage.');
  }
  return data.photoUrl;
}

export async function apiCreateSpot(
  token: string,
  payload: {
    name: string;
    category: string;
    lat: number;
    lng: number;
    fish: string;
    weight: string;
    baitAndCondition: string;
    address?: string;
    photoUrl: string;
  }
): Promise<{ location: SupabaseLocationRow; catchReport: SupabaseCatchRow }> {
  const res = await fetch('/api/spots', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe<{
    location: SupabaseLocationRow;
    catchReport: SupabaseCatchRow;
  }>(res);
  if (!res.ok) throw new Error(data.error || 'Gagal menyimpan spot baru ke Supabase.');
  return data;
}

export async function apiCreateCatch(
  token: string,
  payload: {
    locationId?: string;
    fish: string;
    weight: string;
    photoUrl: string;
    spotSeed?: {
      name: string;
      category: string;
      lat: number;
      lng: number;
      address?: string;
      waterCondition?: string;
      bestBait?: string;
      status?: string;
    };
  }
): Promise<{ locationId: string; catchReport: SupabaseCatchRow }> {
  const res = await fetch('/api/catches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe<{ locationId: string; catchReport: SupabaseCatchRow }>(res);
  if (!res.ok) throw new Error(data.error || 'Gagal menyimpan laporan tangkapan.');
  return data;
}

export async function apiUpdateSpotStatus(
  token: string,
  locationId: string,
  status: 'verified' | 'pending' | 'rejected',
  rejectionReason?: string
): Promise<void> {
  const res = await fetch(`/api/admin/spots/${encodeURIComponent(locationId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status, rejectionReason }),
  });
  const data = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status verifikasi.');
}

export async function apiMaterializeSpotStatus(
  token: string,
  payload: {
    name: string;
    category: string;
    lat: number;
    lng: number;
    address?: string;
    waterCondition?: string;
    bestBait?: string;
    fish?: string;
    status: 'verified' | 'pending' | 'rejected';
  }
): Promise<SupabaseLocationRow> {
  const res = await fetch('/api/admin/spots/materialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe<{ location: SupabaseLocationRow }>(res);
  if (!res.ok || !data.location) {
    throw new Error(data.error || 'Gagal menyimpan status lokasi.');
  }
  return data.location;
}
