'use client';

import { Upload } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { uploadImages, type UploadResult } from '../actions';

/** Uploads several photos at once into the library (listed first afterwards). */
export function MediaUpload() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<UploadResult['failed']>([]);

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const body = new FormData();
    for (const file of files) body.append('files', file);
    start(async () => {
      const result = await uploadImages(body);
      setFailed(result.failed);
      const n = result.uploaded.length;
      if (n) toast.success(n === 1 ? 'Image uploaded.' : `${String(n)} images uploaded.`);
      if (input.current) input.current.value = '';
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => upload(event.target.files)}
        data-testid="library-upload-input"
      />
      <Button onClick={() => input.current?.click()} disabled={pending}>
        <Upload aria-hidden size={16} />
        {pending ? 'Uploading…' : 'Upload images'}
      </Button>
      {failed.length ? (
        <Alert tone="error" className="w-full max-w-md">
          <ul className="list-disc pl-4">
            {failed.map((f, i) => (
              <li key={`${f.name}-${String(i)}`}>
                {f.name}: {f.error}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}
