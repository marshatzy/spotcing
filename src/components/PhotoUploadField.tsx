import { useRef, useState, type ChangeEvent } from 'react';
import { SonarSpinner } from './MotionPrimitives';
import { apiUploadPhoto } from '../lib/supabaseApi';

interface PhotoUploadFieldProps {
  id: string;
  label: string;
  token: string | null;
  valueUrl: string;
  onChangeUrl: (url: string) => void;
  compact?: boolean;
}

export function PhotoUploadField({
  id,
  label,
  token,
  valueUrl,
  onChangeUrl,
  compact = false,
}: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!token) {
      setErrorMsg('Masuk terlebih dahulu untuk mengunggah foto.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg('Format harus JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran foto maksimal 5 MB.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    try {
      const uploadedUrl = await apiUploadPhoto(token, file);
      onChangeUrl(uploadedUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengunggah foto.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="font-label text-label-sm text-dark-on-surface">
          {label}
        </label>
        {valueUrl && (
          <button
            type="button"
            onClick={() => {
              onChangeUrl('');
              setErrorMsg(null);
            }}
            className="font-label text-label-sm text-dark-error hover:underline cursor-pointer"
          >
            Hapus foto
          </button>
        )}
      </div>

      <div className="flex items-center gap-gutter-sm">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-dark-outline-variant bg-dark-surface-container-lowest hover:border-dark-primary/60 hover:bg-dark-surface-container-low text-dark-on-surface-variant hover:text-dark-primary transition-colors cursor-pointer ${
            compact ? 'px-gutter-sm py-2 text-body-sm' : 'px-gutter-md py-gutter-sm text-body-sm'
          }`}
        >
          {uploading ? (
            <SonarSpinner label="Mengunggah ke Supabase..." />
          ) : (
            <>
              <span className="material-symbols-outlined text-title-md text-dark-primary" aria-hidden="true">
                add_a_photo
              </span>
              <span className="truncate">
                {valueUrl ? 'Ganti Foto (Tersimpan)' : 'Pilih Foto JPG/PNG/WebP (Maks 5 MB)'}
              </span>
            </>
          )}
        </button>

        {valueUrl && (
          <img
            src={valueUrl}
            alt="Pratinjau foto unggahan"
            className="w-11 h-11 rounded-lg object-cover border border-dark-secondary/60 shrink-0"
          />
        )}
      </div>

      {errorMsg && <span className="text-body-sm text-dark-error">{errorMsg}</span>}
    </div>
  );
}
