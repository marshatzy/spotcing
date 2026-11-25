import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useKailSpot } from '../context/KailSpotContext';
import {
  CATEGORY_LABELS,
  TEGAL_REGION_QUERY,
  createSpotMetadataFromCategory,
  formatCoords,
  getDefaultImageForCategory,
  hashStringToNumericId,
  inferWaterCategory,
  type FishingSpot,
  type WaterCategory,
} from '../data/spots';
import { isGoogleMapsQuotaError, triggerQuotaExceededNotice } from '../lib/mapsConfig';

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

export function TegalPlacesBootstrap() {
  const placesLib = useMapsLibrary('places');
  const {
    setTegalViewport,
    setDiscoveredPlaces,
    setSpotsLoading,
    setPlacesError,
  } = useKailSpot();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!placesLib || initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;

    async function loadTegalData() {
      if (!placesLib) return;
      setSpotsLoading(true);
      setPlacesError(null);

      try {
        const { places: regionPlaces } = await placesLib.Place.searchByText({
          textQuery: TEGAL_REGION_QUERY,
          fields: ['displayName', 'location', 'viewport'],
          language: 'id',
          region: 'id',
          maxResultCount: 1,
          internalUsageAttributionIds: ATTRIBUTION_IDS,
        });

        const tegalRegion = regionPlaces?.[0];
        if (!tegalRegion?.location) {
          if (!cancelled) {
            setPlacesError('Lokasi Tegal tidak ditemukan dari layanan peta.');
            setSpotsLoading(false);
          }
          return;
        }

        const center: google.maps.LatLngLiteral = {
          lat: tegalRegion.location.lat(),
          lng: tegalRegion.location.lng(),
        };
        const viewportBounds: google.maps.LatLngBoundsLiteral | null = tegalRegion.viewport
          ? tegalRegion.viewport.toJSON()
          : null;

        if (!cancelled) {
          setTegalViewport(center, viewportBounds);
        }

        const queries: Array<{ query: string; fallbackCategory: WaterCategory }> = [
          { query: 'pantai pelabuhan muara di Tegal', fallbackCategory: 'laut' },
          { query: 'tempat pemancingan kolam di Tegal', fallbackCategory: 'danau' },
          { query: 'waduk bendungan sungai di Tegal', fallbackCategory: 'sungai' },
        ];

        const responses = await Promise.all(
          queries.map(async ({ query, fallbackCategory }) => {
            try {
              const res = await placesLib.Place.searchByText({
                textQuery: query,
                fields: ['id', 'displayName', 'formattedAddress', 'location', 'types', 'photos'],
                locationBias: viewportBounds ?? center,
                language: 'id',
                region: 'id',
                maxResultCount: 5,
                internalUsageAttributionIds: ATTRIBUTION_IDS,
              });
              return { places: res.places ?? [], fallbackCategory };
            } catch (err) {
              if (isGoogleMapsQuotaError(err)) {
                triggerQuotaExceededNotice();
              }
              return { places: [], fallbackCategory };
            }
          })
        );

        const seenIds: Record<string, boolean> = {};
        const discovered: FishingSpot[] = [];
        let spotIndex = 0;

        for (const group of responses) {
          for (const place of group.places) {
            if (!place.id || !place.location || seenIds[place.id]) continue;
            seenIds[place.id] = true;

            const name = place.displayName || 'Spot Tegal';
            const lat = place.location.lat();
            const lng = place.location.lng();
            const category = inferWaterCategory(name, place.types ?? [], group.fallbackCategory);
            const numericId = hashStringToNumericId(place.id);
            const photoUrl = place.photos?.[0]?.getURI({ maxWidth: 800 });
            const meta = createSpotMetadataFromCategory(category, spotIndex, numericId);

            discovered.push({
              id: numericId,
              spotKey: `place:${place.id}`,
              placeId: place.id,
              name,
              address: place.formattedAddress || 'Tegal, Jawa Tengah',
              category,
              categoryLabel: CATEGORY_LABELS[category],
              lat,
              lng,
              coords: formatCoords(lat, lng),
              spotImage: photoUrl || getDefaultImageForCategory(category),
              source: 'places',
              ...meta,
            });
            spotIndex += 1;
          }
        }

        if (!cancelled) {
          setDiscoveredPlaces(discovered);
          setSpotsLoading(false);
        }
      } catch (err) {
        if (isGoogleMapsQuotaError(err)) {
          triggerQuotaExceededNotice();
        }
        if (!cancelled) {
          setPlacesError('Gagal memuat titik lokasi Tegal dari Google Maps Platform.');
          setSpotsLoading(false);
        }
      }
    }

    void loadTegalData();

    return () => {
      cancelled = true;
    };
  }, [placesLib, setDiscoveredPlaces, setPlacesError, setSpotsLoading, setTegalViewport]);

  return null;
}
