import { api } from './client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export interface UploadedFile {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
}

export async function uploadFile(
  file: File,
  kind: 'audio' | 'image',
): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<UploadedFile>(`/files/upload?kind=${kind}`, form);
  return res.data;
}

/** Public URL for a stored file (served by the backend file controller). */
export function fileUrl(storageKey: string): string {
  return `${API_BASE}/files/${storageKey}`;
}
