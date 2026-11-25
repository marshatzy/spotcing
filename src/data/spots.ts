export type WaterCategory = 'laut' | 'sungai' | 'danau';
export type SpotStatus = 'verified' | 'pending';

export interface CatchReport {
  id: string;
  fish: string;
  weight: string;
  angler: string;
  time: string;
  img: string;
}

export interface FishingSpot {
  id: number;
  dbId?: string;
  spotKey: string;
  placeId?: string;
  name: string;
  address?: string;
  category: WaterCategory;
  categoryLabel: string;
  lat: number;
  lng: number;
  coords: string;
  status: SpotStatus;
  waterCondition: string;
  bestBait: string;
  spotImage: string;
  angler: string;
  time: string;
  source: 'places' | 'user' | 'supabase';
  catches: CatchReport[];
}

export function formatRelativeTimeId(isoString?: string | null): string {
  if (!isoString) return 'Baru saja';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Baru saja';
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export const DESIGN_IMAGES = {
  heroMancing:
    'https://lh3.googleusercontent.com/aida/ALJJyrClblVUQ7WgontEpXkOVd9RjU1hZ_IzVGeVcZFRvN3Wc7wdWHMDZkMC_mxSMYc8a29i3Y_E0zcaYjgVTAXmFJPsbprl6qdmeXTd_jJmuECwMmSJ261dBnTb_iIcg40Xwxs5wr9u996IqNhOvYV4RccFDRyyMR3R8xlluDYd10oET3FKIXo6mkrcbU0SV2lhvDjFLEmQmkvzAglrZfvJK36Mn9jICA4PorT5N6-cLRwtEaBQmMh4yO2yPQeVSpQnMA',
  spotLaut:
    'https://lh3.googleusercontent.com/aida/ALJJyrDaAtz6Id_sNgWiJCdIOGg0ZWCdZGUIzTXRxSoq_mxkhmf8yYGGpB8J3SxZ8KUM9aD4bko_fAGdoSkjVOO1sDZYWcbIb-Tmgp7zeMN-8IGT9x-IqYoO8-na-thaObS98AWLuVyweCVqwHg0jQUZnOIa3xatJtj9S9HrRxa1IFZ1bmJINmsQCotuifUXlrgi34Ihx1yDbwrLd8WYTdFGRYQO7LtrG2U6-Yn57AIdPn_c_YWweKrIqtVhwEk4',
  catchKakapPutih:
    'https://lh3.googleusercontent.com/aida/ALJJyrBtNo5Z5bNsP4LFJI8fKVjfr5cyiO1sUaXQuj41z72G4Lbb2K0lSqGGFgu6S5cFUW98saemXN0N3ZXBpBdPVWIsrrJW2ZpdbJWUV08mUh7k5t-s5uH-kjr-vkK5e1HIOwauZ7ncfT9J96hWQEcWyYxroxjWapW5RH_JT9avbh__b9FCZEbRtHXeEuFtDQ9ROaVP6oKilKxJF5ipqjRe6YTOT-zZpcTHhjU56aPIMt1wXB_o-GqwSiDq2ETu8w',
  spotSungai:
    'https://lh3.googleusercontent.com/aida/ALJJyrDZvQystVx1Y4vZfqw2FyOSzHwz3z0DNUYiTyYGcdKJRStINHteAQuM6AGhADXCM4qvq1WO2BmkmjPbx1LOPeGl06UxGMlxg-c87rIlsvmDOFnKjH9nEOBR6AiD9gheKCjr5Fm8oDPpLdkATeS8ol6ppdX1Rrj8N_9OGlZ7IZAr5jrFp-AdZx5yqUmsy_tp46Zkv_m8moCZINVXd_qvAmZnl9g-x51yDKgiNmKWzMcVVJmmC_38-xqszGKICn1lYg',
  catchBaungSungai:
    'https://lh3.googleusercontent.com/aida/ALJJyrCFPe40btFUBGzW9PqGOPGTTK3pY09PXT9H6SuxGoiIenmXXkT9NjWYN9bZnTP5xk6F7L04rIqo24Gpt-7iWAh5U3y_hg21Ly6ptT6EcB3i3cI9iTCr4haxm0wwZeyPHRduiW921fjRz59SL_tDXC5UGY9GPpSZdPGrQ182jShjtaBfjsYxOo1ToqI_8s9iE0fH-dmi8NtrPajfT7MQPO_jfrFK3AEqyjN423HSlFrSnooSq2Gsl8MxpRt4oQ',
  spotDanau:
    'https://lh3.googleusercontent.com/aida/ALJJyrAGZ0qW14ZkdN1xaC7CVV0jVY07_vA_3Mz1oCHjiHcHEyIHeQ1aLfwovMc-MgUkVHLEXxp2SZ_WZG8dVPmfhjTuQC9TS_WBIRFmX5hBmEST5Mv1kWuQbRTde0wkgIT3Rq4wrAvqXHqrSnlLP3pgzsUvDYMr7x48QOIt3jWRtQaWb371wGDdPO7Qvm9RWTJscM6LfPKGmFiAg5PQ0vBksclCvkSXvxt77EXEhMrfA2fSkPDaz4OB2rC3NU9affpcyg',
};

export const TEGAL_REGION_QUERY = 'Kota Tegal, Jawa Tengah, Indonesia';

export const CATEGORY_LABELS: Record<WaterCategory, string> = {
  laut: 'Laut & Muara',
  sungai: 'Sungai',
  danau: 'Danau & Waduk',
};

export function getDefaultImageForCategory(category: WaterCategory): string {
  if (category === 'sungai') return DESIGN_IMAGES.spotSungai;
  if (category === 'danau') return DESIGN_IMAGES.spotDanau;
  return DESIGN_IMAGES.spotLaut;
}

export function getDefaultCatchImageForCategory(category: WaterCategory): string {
  return category === 'laut' ? DESIGN_IMAGES.catchKakapPutih : DESIGN_IMAGES.catchBaungSungai;
}

export function hashStringToNumericId(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash) + 1000;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function parseCoordsString(coords: string): { lat: number; lng: number } | null {
  const parts = coords.split(',').map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }
  const [lat, lng] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

export function inferWaterCategory(
  name: string,
  types: string[] = [],
  fallback: WaterCategory = 'laut'
): WaterCategory {
  const haystack = `${name} ${types.join(' ')}`.toLowerCase();
  if (
    /pantai|pelabuhan|dermaga|muara|laut|marina|pesisir|tpi|tambak|beach|harbor|pier/.test(
      haystack
    )
  ) {
    return 'laut';
  }
  if (/sungai|kali|kaligung|muara kali|river|bridge|jembatan|bendung/.test(haystack)) {
    return 'sungai';
  }
  if (/waduk|danau|kolam|pemancingan|embung|situ|telaga|lake|reservoir/.test(haystack)) {
    return 'danau';
  }
  return fallback;
}

const ANGLER_PROFILES = ['Rizal P.', 'Hendra W.', 'Dimas A.', 'Bagas S.', 'Yusuf K.', 'Wahyu T.'];

const CATEGORY_PRESETS: Record<
  WaterCategory,
  Array<{ waterCondition: string; bestBait: string; fish: string; weight: string }>
> = {
  laut: [
    {
      waterCondition: 'Pasang Naik +1,2 m • Air Hijau Kebiruan',
      bestBait: 'Udang putih hidup & minnow 9 cm',
      fish: 'Kakap Putih',
      weight: '3,8 kg',
    },
    {
      waterCondition: 'Arus Pesisir Tenang • Angin 7 knot',
      bestBait: 'Belanak hidup & udang kupas',
      fish: 'Kerapu Lumpur',
      weight: '2,4 kg',
    },
  ],
  sungai: [
    {
      waterCondition: 'Arus Sedang • Kedalaman 2,8 m',
      bestBait: 'Cacing kalung & umpan lumut',
      fish: 'Ikan Baung',
      weight: '1,9 kg',
    },
    {
      waterCondition: 'Aliran Tenang • Teduh Tepi Tanggul',
      bestBait: 'Pelet racikan & roti tawar',
      fish: 'Patin Sungai',
      weight: '3,1 kg',
    },
  ],
  danau: [
    {
      waterCondition: 'Permukaan Tenang • Jernih Kehijauan',
      bestBait: 'Pelet bom & lumut halus',
      fish: 'Nila Babon',
      weight: '1,4 kg',
    },
    {
      waterCondition: 'Tenang • Sore Hari Berangin Ringan',
      bestBait: 'Soft lure & pelet amis',
      fish: 'Bawal Air Tawar',
      weight: '2,2 kg',
    },
  ],
};

export function createSpotMetadataFromCategory(
  category: WaterCategory,
  index: number,
  spotId: number
): Pick<FishingSpot, 'waterCondition' | 'bestBait' | 'angler' | 'time' | 'status' | 'catches'> {
  const presets = CATEGORY_PRESETS[category];
  const preset = presets[index % presets.length];
  const angler = ANGLER_PROFILES[index % ANGLER_PROFILES.length];
  const times = ['2 jam lalu', 'Hari ini, 06:15', 'Kemarin, 16:40', '45 menit lalu', '1 jam lalu'];
  const time = times[index % times.length];
  const status: SpotStatus = index % 3 === 2 ? 'pending' : 'verified';

  return {
    waterCondition: preset.waterCondition,
    bestBait: preset.bestBait,
    angler,
    time,
    status,
    catches: [
      {
        id: `c-${spotId}-init`,
        fish: preset.fish,
        weight: preset.weight,
        angler,
        time,
        img: getDefaultCatchImageForCategory(category),
      },
    ],
  };
}
