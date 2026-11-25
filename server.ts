import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const BUCKET_NAME = 'catch-photos';
const ALLOWED_CATEGORIES = new Set(['laut', 'sungai', 'danau']);
const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() || '';
const supabaseJwksUrl =
  process.env.SUPABASE_JWKS_URL?.trim() ||
  (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json` : '');

const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey && supabaseSecretKey
);

let supabaseAdmin: SupabaseClient | null = null;
let supabaseAuthClient: SupabaseClient | null = null;
let jwksSet: ReturnType<typeof createRemoteJWKSet> | null = null;

if (isSupabaseConfigured) {
  supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  supabaseAuthClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

if (supabaseJwksUrl) {
  try {
    jwksSet = createRemoteJWKSet(new URL(supabaseJwksUrl));
  } catch {
    jwksSet = null;
  }
}

interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: 'angler' | 'admin';
}

interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseWeightKg(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Number(raw.toFixed(2));
  }
  if (typeof raw !== 'string') return null;
  const normalized = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num) || num < 0 || num > 10000) return null;
  return Number(num.toFixed(2));
}

function formatDbErrorMessage(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return 'Terjadi kesalahan pada database Supabase.';
  if (err.code === '42501') {
    return 'Izin akses tabel Supabase belum diberikan (GRANT public tables ke anon, authenticated, service_role).';
  }
  return err.message || 'Terjadi kesalahan pada database Supabase.';
}

async function resolveProfile(
  admin: SupabaseClient,
  userId: string,
  fallbackName: string
): Promise<{ username: string; role: 'angler' | 'admin' }> {
  const { data: existing, error } = await admin
    .from('profiles')
    .select('id, username, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (existing) {
    return {
      username: existing.username || fallbackName,
      role: existing.role === 'admin' ? 'admin' : 'angler',
    };
  }

  const cleanName = fallbackName.trim().slice(0, 80) || 'Pemancing';
  const { data: created, error: insertError } = await admin
    .from('profiles')
    .insert({
      id: userId,
      username: cleanName,
      role: 'user',
    })
    .select('id, username, role')
    .single();

  if (insertError) {
    throw insertError;
  }

  return {
    username: created.username || cleanName,
    role: created.role === 'admin' ? 'admin' : 'angler',
  };
}

async function verifyBearerToken(token: string): Promise<AuthenticatedUser | null> {
  if (!supabaseAdmin || !token) return null;

  let userId: string | null = null;
  let email = '';
  let fallbackName = 'Pemancing';

  // Primary cryptographic verification via SUPABASE_JWKS_URL
  if (jwksSet && supabaseUrl) {
    try {
      const issuer = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
      const { payload } = await jwtVerify(token, jwksSet, { issuer });
      if (typeof payload.sub === 'string' && payload.sub) {
        userId = payload.sub;
        email = typeof payload.email === 'string' ? payload.email : '';
        const meta = payload.user_metadata as Record<string, unknown> | undefined;
        if (meta && typeof meta.username === 'string') {
          fallbackName = meta.username;
        } else if (email) {
          fallbackName = email.split('@')[0];
        }
      }
    } catch {
      userId = null;
    }
  }

  // Fallback check via Supabase Auth Admin/User endpoint (handles HS256 or revoked sessions)
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  userId = data.user.id;
  email = data.user.email || email;
  const metaName =
    typeof data.user.user_metadata?.username === 'string'
      ? data.user.user_metadata.username
      : '';
  fallbackName = metaName || (email ? email.split('@')[0] : 'Pemancing');

  const profile = await resolveProfile(supabaseAdmin, userId, fallbackName);
  return {
    id: userId,
    email,
    username: profile.username,
    role: profile.role,
  };
}

async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    res.status(503).json({
      error: 'Konfigurasi Supabase di server belum lengkap. Tambahkan Secrets terlebih dahulu.',
    });
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const authUser = await verifyBearerToken(token);
    if (!authUser) {
      res.status(401).json({ error: 'Sesi login tidak valid atau telah kedaluwarsa.' });
      return;
    }
    req.authUser = authUser;
    next();
  } catch (err) {
    res.status(500).json({
      error: formatDbErrorMessage(err as { code?: string; message?: string }),
    });
  }
}

async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.authUser?.role !== 'admin') {
      res.status(403).json({ error: 'Akses khusus Admin Verifikator.' });
      return;
    }
    next();
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      res.json({
        configured: false,
        dbReady: false,
        hasAdmin: false,
        dbError: 'Variabel Supabase belum disetel di Settings -> Secrets.',
      });
      return;
    }

    try {
      const { data: admins, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (error) {
        res.json({
          configured: true,
          dbReady: false,
          hasAdmin: false,
          dbError: formatDbErrorMessage(error),
          dbCode: error.code,
        });
        return;
      }

      res.json({
        configured: true,
        dbReady: true,
        hasAdmin: Array.isArray(admins) && admins.length > 0,
      });
    } catch (err) {
      res.json({
        configured: true,
        dbReady: false,
        hasAdmin: false,
        dbError: formatDbErrorMessage(err as { code?: string; message?: string }),
      });
    }
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    if (!isSupabaseConfigured || !supabaseAdmin || !supabaseAuthClient) {
      res.status(503).json({
        error: 'Supabase belum dikonfigurasi di server.',
      });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!name || name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Nama lengkap harus 2-80 karakter.' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Format email tidak valid.' });
      return;
    }
    if (!password || password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    try {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: name },
      });

      if (createErr || !created.user) {
        res.status(400).json({
          error: createErr?.message || 'Gagal membuat akun baru.',
        });
        return;
      }

      const profile = await resolveProfile(supabaseAdmin, created.user.id, name);

      const { data: signedIn, error: signInErr } =
        await supabaseAuthClient.auth.signInWithPassword({
          email,
          password,
        });

      if (signInErr || !signedIn.session) {
        res.status(500).json({ error: 'Akun dibuat, tetapi gagal memulai sesi login.' });
        return;
      }

      res.status(201).json({
        token: signedIn.session.access_token,
        user: {
          id: created.user.id,
          name: profile.username,
          email,
          role: profile.role,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: formatDbErrorMessage(err as { code?: string; message?: string }),
      });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    if (!isSupabaseConfigured || !supabaseAdmin || !supabaseAuthClient) {
      res.status(503).json({
        error: 'Supabase belum dikonfigurasi di server.',
      });
      return;
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    try {
      const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session || !data.user) {
        res.status(401).json({ error: 'Email atau kata sandi salah.' });
        return;
      }

      const metaName =
        typeof data.user.user_metadata?.username === 'string'
          ? data.user.user_metadata.username
          : email.split('@')[0];
      const profile = await resolveProfile(supabaseAdmin, data.user.id, metaName);

      res.json({
        token: data.session.access_token,
        user: {
          id: data.user.id,
          name: profile.username,
          email: data.user.email || email,
          role: profile.role,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: formatDbErrorMessage(err as { code?: string; message?: string }),
      });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      user: {
        id: req.authUser!.id,
        name: req.authUser!.username,
        email: req.authUser!.email,
        role: req.authUser!.role,
      },
    });
  });

  // One-time bootstrap claim: promotes the currently signed-in user to Admin ONLY when zero admins exist.
  app.post('/api/auth/claim-admin', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Supabase belum siap.' });
      return;
    }
    try {
      const { data: existingAdmins, error: checkErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (checkErr) {
        res.status(500).json({ error: formatDbErrorMessage(checkErr) });
        return;
      }

      if (Array.isArray(existingAdmins) && existingAdmins.length > 0) {
        if (existingAdmins[0].id === req.authUser!.id) {
          res.json({
            user: {
              id: req.authUser!.id,
              name: req.authUser!.username,
              email: req.authUser!.email,
              role: 'admin',
            },
          });
          return;
        }
        res.status(403).json({
          error: 'Admin verifikator sudah ditetapkan sebelumnya.',
        });
        return;
      }

      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', req.authUser!.id);

      if (updateErr) {
        res.status(500).json({ error: formatDbErrorMessage(updateErr) });
        return;
      }

      res.json({
        user: {
          id: req.authUser!.id,
          name: req.authUser!.username,
          email: req.authUser!.email,
          role: 'admin',
        },
      });
    } catch (err) {
      res.status(500).json({
        error: formatDbErrorMessage(err as { code?: string; message?: string }),
      });
    }
  });

  app.post(
    '/api/uploads/photo',
    requireAuth,
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      upload.single('photo')(req, res, (err) => {
        if (err) {
          res.status(400).json({ error: err.message || 'Gagal memproses file foto.' });
          return;
        }
        next();
      });
    },
    async (req: AuthenticatedRequest, res: Response) => {
      if (!supabaseAdmin) {
        res.status(503).json({ error: 'Supabase Storage belum dikonfigurasi.' });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'File foto wajib dipilih.' });
        return;
      }

      const ext = ALLOWED_MIME_EXT[file.mimetype];
      if (!ext) {
        res.status(400).json({
          error: 'Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.',
        });
        return;
      }

      const objectPath = `${req.authUser!.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(objectPath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadErr) {
        res.status(500).json({ error: `Gagal mengunggah foto: ${uploadErr.message}` });
        return;
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(objectPath);

      res.status(201).json({ photoUrl: publicUrlData.publicUrl, path: objectPath });
    }
  );

  app.get('/api/spots', async (_req: Request, res: Response) => {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      res.json({ locations: [], catches: [], profiles: [], dbReady: false });
      return;
    }

    try {
      const [locRes, catchRes, profRes] = await Promise.all([
        supabaseAdmin
          .from('locations')
          .select(
            'id, user_id, name, category, water_type, target_fish, recommended_bait, road_access, latitude, longitude, status, rejection_reason, created_at'
          )
          .neq('status', 'rejected')
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('catch_reports')
          .select(
            'id, location_id, user_id, fish_species, weight_kg, bait_used, notes, photo_url, status, created_at'
          )
          .neq('status', 'rejected')
          .order('created_at', { ascending: false }),
        supabaseAdmin.from('profiles').select('id, username, role'),
      ]);

      if (locRes.error) {
        res.status(500).json({ error: formatDbErrorMessage(locRes.error), dbReady: false });
        return;
      }

      res.json({
        dbReady: true,
        locations: locRes.data ?? [],
        catches: catchRes.error ? [] : (catchRes.data ?? []),
        profiles: profRes.error ? [] : (profRes.data ?? []),
      });
    } catch (err) {
      res.status(500).json({
        error: formatDbErrorMessage(err as { code?: string; message?: string }),
        dbReady: false,
      });
    }
  });

  app.post('/api/spots', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Supabase belum siap.' });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const fish = typeof req.body?.fish === 'string' ? req.body.fish.trim() : '';
    const weight = typeof req.body?.weight === 'string' ? req.body.weight.trim() : '';
    const baitAndCondition =
      typeof req.body?.baitAndCondition === 'string' ? req.body.baitAndCondition.trim() : '';
    const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
    const photoUrl = req.body?.photoUrl;

    if (!name || name.length > 120) {
      res.status(400).json({ error: 'Nama spot wajib diisi (maks 120 karakter).' });
      return;
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
      res.status(400).json({ error: 'Kategori perairan tidak valid.' });
      return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Koordinat GPS tidak valid.' });
      return;
    }
    if (!fish) {
      res.status(400).json({ error: 'Jenis ikan tangkapan wajib diisi.' });
      return;
    }
    if (!isSafeHttpUrl(photoUrl)) {
      res.status(400).json({ error: 'URL foto tidak valid.' });
      return;
    }

    try {
      const { data: loc, error: locErr } = await supabaseAdmin
        .from('locations')
        .insert({
          user_id: req.authUser!.id,
          name,
          category,
          water_type: baitAndCondition || 'Perairan Tegal',
          target_fish: fish,
          recommended_bait: baitAndCondition || 'Umpan alami',
          road_access: address || 'Kota/Kabupaten Tegal, Jawa Tengah',
          latitude: lat,
          longitude: lng,
          status: 'pending',
        })
        .select('*')
        .single();

      if (locErr || !loc) {
        res.status(500).json({ error: formatDbErrorMessage(locErr) });
        return;
      }

      const { data: catchRow, error: catchErr } = await supabaseAdmin
        .from('catch_reports')
        .insert({
          location_id: loc.id,
          user_id: req.authUser!.id,
          fish_species: fish,
          weight_kg: parseWeightKg(weight),
          bait_used: baitAndCondition || null,
          notes: weight ? `Berat tercatat: ${weight}` : null,
          photo_url: photoUrl,
          status: 'pending',
        })
        .select('*')
        .single();

      if (catchErr) {
        res.status(500).json({ error: formatDbErrorMessage(catchErr) });
        return;
      }

      res.status(201).json({ location: loc, catchReport: catchRow });
    } catch (err) {
      res.status(500).json({
        error: formatDbErrorMessage(err as { code?: string; message?: string }),
      });
    }
  });

  app.post('/api/catches', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Supabase belum siap.' });
      return;
    }

    let locationId = typeof req.body?.locationId === 'string' ? req.body.locationId.trim() : '';
    const fish = typeof req.body?.fish === 'string' ? req.body.fish.trim() : '';
    const weight = typeof req.body?.weight === 'string' ? req.body.weight.trim() : '';
    const photoUrl = req.body?.photoUrl;
    const spotSeed = req.body?.spotSeed as
      | {
          name?: string;
          category?: string;
          lat?: number;
          lng?: number;
          address?: string;
          waterCondition?: string;
          bestBait?: string;
          status?: string;
        }
      | undefined;

    if (!fish || fish.length > 100) {
      res.status(400).json({ error: 'Jenis ikan wajib diisi.' });
      return;
    }
    if (!isSafeHttpUrl(photoUrl)) {
      res.status(400).json({ error: 'URL foto tangkapan tidak valid.' });
      return;
    }

    try {
      // If adding a catch to a Google Places spot not yet stored in Supabase locations, materialize it first.
      if (!locationId && spotSeed && typeof spotSeed.name === 'string') {
        const category =
          typeof spotSeed.category === 'string' && ALLOWED_CATEGORIES.has(spotSeed.category)
            ? spotSeed.category
            : 'laut';
        const lat = Number(spotSeed.lat);
        const lng = Number(spotSeed.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          res.status(400).json({ error: 'Koordinat lokasi tidak valid.' });
          return;
        }
        const { data: createdLoc, error: locErr } = await supabaseAdmin
          .from('locations')
          .insert({
            user_id: req.authUser!.id,
            name: spotSeed.name.trim().slice(0, 120),
            category,
            water_type: spotSeed.waterCondition || 'Perairan Tegal',
            target_fish: fish,
            recommended_bait: spotSeed.bestBait || 'Umpan alami',
            road_access: spotSeed.address || 'Wilayah Tegal',
            latitude: lat,
            longitude: lng,
            status: spotSeed.status === 'verified' ? 'verified' : 'pending',
          })
          .select('id')
          .single();

        if (locErr || !createdLoc) {
          res.status(500).json({ error: formatDbErrorMessage(locErr) });
          return;
        }
        locationId = createdLoc.id;
      }

      if (!locationId) {
        res.status(400).json({ error: 'Lokasi tidak ditemukan.' });
        return;
      }

      const { data: catchRow, error: catchErr } = await supabaseAdmin
        .from('catch_reports')
        .insert({
          location_id: locationId,
          user_id: req.authUser!.id,
          fish_species: fish,
          weight_kg: parseWeightKg(weight),
          notes: weight ? `Berat tercatat: ${weight}` : null,
          photo_url: photoUrl,
          status: 'pending',
        })
        .select('*')
        .single();

      if (catchErr || !catchRow) {
        res.status(500).json({ error: formatDbErrorMessage(catchErr) });
        return;
      }

      res.status(201).json({ locationId, catchReport: catchRow });
    } catch (err) {
      res.status(500).json({
        error: formatDbErrorMessage(err as { code?: string; message?: string }),
      });
    }
  });

  app.patch(
    '/api/admin/spots/:id/status',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      if (!supabaseAdmin) {
        res.status(503).json({ error: 'Supabase belum siap.' });
        return;
      }
      const locationId = req.params.id;
      const nextStatus = req.body?.status;
      const rejectionReason =
        typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim() : null;

      if (
        typeof locationId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationId)
      ) {
        res.status(400).json({ error: 'ID lokasi tidak valid.' });
        return;
      }

      if (nextStatus !== 'verified' && nextStatus !== 'pending' && nextStatus !== 'rejected') {
        res.status(400).json({ error: 'Status verifikasi tidak valid.' });
        return;
      }

      try {
        const { data: updated, error } = await supabaseAdmin
          .from('locations')
          .update({
            status: nextStatus,
            rejection_reason: nextStatus === 'rejected' ? rejectionReason : null,
          })
          .eq('id', locationId)
          .select('*')
          .maybeSingle();

        if (error) {
          res.status(500).json({ error: formatDbErrorMessage(error) });
          return;
        }
        if (!updated) {
          res.status(404).json({ error: 'Lokasi tidak ditemukan.' });
          return;
        }

        await supabaseAdmin
          .from('catch_reports')
          .update({ status: nextStatus })
          .eq('location_id', locationId);

        res.json({ location: updated });
      } catch (err) {
        res.status(500).json({
          error: formatDbErrorMessage(err as { code?: string; message?: string }),
        });
      }
    }
  );

  app.post(
    '/api/admin/spots/materialize',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      if (!supabaseAdmin) {
        res.status(503).json({ error: 'Supabase belum siap.' });
        return;
      }
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const category = typeof req.body?.category === 'string' ? req.body.category : 'laut';
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      const status = req.body?.status;

      if (!name || !ALLOWED_CATEGORIES.has(category) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: 'Data lokasi tidak lengkap.' });
        return;
      }
      if (status !== 'verified' && status !== 'pending' && status !== 'rejected') {
        res.status(400).json({ error: 'Status tidak valid.' });
        return;
      }

      try {
        const { data: loc, error } = await supabaseAdmin
          .from('locations')
          .insert({
            user_id: req.authUser!.id,
            name: name.slice(0, 120),
            category,
            water_type: typeof req.body?.waterCondition === 'string' ? req.body.waterCondition : 'Perairan Tegal',
            target_fish: typeof req.body?.fish === 'string' ? req.body.fish : 'Ikan Lokal',
            recommended_bait: typeof req.body?.bestBait === 'string' ? req.body.bestBait : 'Umpan alami',
            road_access: typeof req.body?.address === 'string' ? req.body.address : 'Wilayah Tegal',
            latitude: lat,
            longitude: lng,
            status,
          })
          .select('*')
          .single();

        if (error || !loc) {
          res.status(500).json({ error: formatDbErrorMessage(error) });
          return;
        }
        res.status(201).json({ location: loc });
      } catch (err) {
        res.status(500).json({
          error: formatDbErrorMessage(err as { code?: string; message?: string }),
        });
      }
    }
  );

  const distDir = path.resolve(__dirname, 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KailSpot server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
