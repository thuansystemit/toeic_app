import { api } from './client';

export type Accent = 'us' | 'uk' | 'au';

/**
 * Fetch sentence audio (Azure Neural TTS) as a Blob, authenticated via the shared
 * client. The backend caches per sentence+accent, so repeat plays are instant.
 * Throws if TTS isn't configured (503) — callers fall back to the browser voice.
 */
export async function getSentenceAudio(
  text: string,
  accent: Accent,
): Promise<Blob> {
  const res = await api.get('/tts', {
    params: { text, accent },
    responseType: 'blob',
  });
  return res.data as Blob;
}
