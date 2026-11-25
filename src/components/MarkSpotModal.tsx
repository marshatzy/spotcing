import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SonarButton, SonarSpinner } from './MotionPrimitives';
import { PhotoUploadField } from './PhotoUploadField';
import { formatCoords, type WaterCategory } from '../data/spots';
import { useKailSpot } from '../context/KailSpotContext';

interface MarkSpotModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MarkSpotModal({ open, onClose, onSuccess }: MarkSpotModalProps) {
  const { addSpot, tegalCenter, user, authToken, navigate } = useKailSpot();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WaterCategory>('laut');
  const [coords, setCoords] = useState('');
  const [fish, setFish] = useState('');
  const [weight, setWeight] = useState('');
  const [baitAndCondition, setBaitAndCondition] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (tegalCenter && !coords) {
      setCoords(formatCoords(tegalCenter.lat, tegalCenter.lng));
    }
  }, [tegalCenter, coords]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !authToken) {
      setErrorMsg('Masuk terlebih dahulu untuk menyimpan spot ke database.');
      return;
    }
    if (!name.trim() || !coords.trim() || !fish.trim() || !weight.trim() || !baitAndCondition.trim()) {
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await addSpot({
        name,
        category,
        coords,
        fish,
        weight,
        baitAndCondition,
        spotImage: photoUrl || undefined,
      });
      setName('');
      setCategory('laut');
      setCoords(tegalCenter ? formatCoords(tegalCenter.lat, tegalCenter.lng) : '');
      setFish('');
      setWeight('');
      setBaitAndCondition('');
      setPhotoUrl('');
      onClose();
      onSuccess?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan spot.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mark-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 bg-dark-surface-container-lowest/80 backdrop-blur-sm flex items-center justify-center p-gutter-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg rounded-xl bg-dark-surface-container border border-dark-outline-variant p-gutter-lg flex flex-col gap-gutter-md shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 id="mark-modal-title" className="font-headline text-title-lg text-dark-on-surface">
                Tandai Spot Tegal &amp; Tangkapan
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup formulir"
                className="p-gutter-xs rounded-full text-dark-on-surface-variant hover:bg-dark-surface-container-high hover:text-dark-on-surface hover:rotate-90 transition-all duration-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-title-lg" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            {!user && (
              <div className="p-gutter-sm rounded-lg bg-dark-primary-container/30 border border-dark-primary/40 flex items-center justify-between gap-2 text-body-sm">
                <span className="text-dark-on-surface">
                  Masuk akun dulu untuk menyimpan pin &amp; upload foto.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('login');
                  }}
                  className="font-label text-label-md text-dark-primary underline shrink-0 cursor-pointer"
                >
                  Masuk / Daftar
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-gutter-md">
              <div className="flex flex-col gap-gutter-xs">
                <label htmlFor="modal-spot-name" className="font-label text-label-md text-dark-on-surface">
                  Nama Spot (Tegal)
                </label>
                <input
                  id="modal-spot-name"
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Muara Sungai / Pantai Tegal"
                  className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter-md">
                <div className="flex flex-col gap-gutter-xs">
                  <label htmlFor="modal-water-type" className="font-label text-label-md text-dark-on-surface">
                    Jenis Perairan
                  </label>
                  <select
                    id="modal-water-type"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as WaterCategory)}
                    className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                  >
                    <option value="laut">Laut &amp; Muara</option>
                    <option value="sungai">Sungai</option>
                    <option value="danau">Danau &amp; Waduk</option>
                  </select>
                </div>
                <div className="flex flex-col gap-gutter-xs">
                  <label htmlFor="modal-coords" className="font-label text-label-md text-dark-on-surface">
                    Koordinat GPS
                  </label>
                  <input
                    id="modal-coords"
                    required
                    type="text"
                    value={coords}
                    onChange={(e) => setCoords(e.target.value)}
                    className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-primary font-mono px-gutter-md py-gutter-sm text-mono-md focus:border-dark-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter-md">
                <div className="flex flex-col gap-gutter-xs">
                  <label htmlFor="modal-fish" className="font-label text-label-md text-dark-on-surface">
                    Ikan Tangkapan
                  </label>
                  <input
                    id="modal-fish"
                    required
                    type="text"
                    value={fish}
                    onChange={(e) => setFish(e.target.value)}
                    placeholder="Contoh: Barramundi"
                    className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-gutter-xs">
                  <label htmlFor="modal-weight" className="font-label text-label-md text-dark-on-surface">
                    Berat (kg)
                  </label>
                  <input
                    id="modal-weight"
                    required
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="Contoh: 3,4 kg"
                    className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-gutter-xs">
                <label htmlFor="modal-bait" className="font-label text-label-md text-dark-on-surface">
                  Umpan &amp; Kondisi Air
                </label>
                <input
                  id="modal-bait"
                  required
                  type="text"
                  value={baitAndCondition}
                  onChange={(e) => setBaitAndCondition(e.target.value)}
                  placeholder="Contoh: Udang hidup • Air agak keruh"
                  className="rounded-lg bg-dark-surface-container-lowest border border-dark-outline-variant text-dark-on-surface placeholder-dark-on-surface-variant px-gutter-md py-gutter-sm text-body-md focus:border-dark-primary focus:outline-none transition-colors"
                />
              </div>

              <PhotoUploadField
                id="modal-photo-upload"
                label="Foto Lokasi / Hasil Tangkapan (Opsional)"
                token={authToken}
                valueUrl={photoUrl}
                onChangeUrl={setPhotoUrl}
              />

              {errorMsg && (
                <div className="p-gutter-sm rounded-lg bg-dark-error-container text-dark-on-error-container text-body-sm">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-gutter-sm pt-gutter-sm">
                <SonarButton
                  type="button"
                  onClick={onClose}
                  className="px-gutter-lg py-gutter-sm rounded-full bg-dark-surface-container-high text-dark-on-surface font-label text-label-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Batal
                </SonarButton>
                <SonarButton
                  type="submit"
                  disabled={submitting}
                  className="px-gutter-lg py-gutter-sm rounded-full bg-dark-primary text-dark-on-primary font-label text-label-lg whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center justify-center"
                >
                  {submitting ? <SonarSpinner label="Menyimpan..." /> : 'Kirim ke Peta & Admin'}
                </SonarButton>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
