import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

/** accent code -> Azure Neural voice. */
const VOICES: Record<string, string> = {
  us: 'en-US-AriaNeural',
  uk: 'en-GB-SoniaNeural',
  au: 'en-AU-NatashaNeural',
};
const DEFAULT_ACCENT = 'us';
const MAX_CHARS = 400;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Azure Neural Text-to-Speech with a per-(voice,text) file cache. Sentences are
 * fixed, so each one is synthesized once and reused for every user/replay —
 * bounding cost to a single call per unique sentence ever. Falls back is handled
 * client-side (browser voice) when the service is not configured.
 */
@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly key: string;
  private readonly region: string;
  private readonly cacheDir: string;

  constructor(config: ConfigService) {
    this.key = config.get<string>('azureSpeech.key', '');
    this.region = config.get<string>('azureSpeech.region', 'eastus');
    this.cacheDir = join(config.get<string>('uploadsDir', 'uploads'), 'tts-cache');
  }

  get enabled(): boolean {
    return !!this.key && !!this.region;
  }

  /** Return MP3 bytes for a sentence in the given accent (cached). */
  async synthesize(text: string, accent: string): Promise<Buffer> {
    const voice = VOICES[accent] ?? VOICES[DEFAULT_ACCENT];
    const clean = text.trim().slice(0, MAX_CHARS);
    const hash = createHash('sha256').update(`${voice}|${clean}`).digest('hex');
    const file = join(this.cacheDir, `${hash}.mp3`);

    try {
      return await fs.readFile(file); // cache hit — no Azure call
    } catch {
      /* miss -> synthesize below */
    }
    if (!this.enabled) {
      throw new ServiceUnavailableException('TTS is not configured');
    }

    const lang = voice.slice(0, 5); // e.g. en-US
    const ssml =
      `<speak version='1.0' xml:lang='${lang}'>` +
      `<voice xml:lang='${lang}' name='${voice}'>${escapeXml(clean)}</voice>` +
      `</speak>`;

    const res = await fetch(
      `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'toeic-app',
        },
        body: ssml,
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`Azure TTS ${res.status}: ${body.slice(0, 200)}`);
      throw new ServiceUnavailableException(`TTS request failed (${res.status})`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(file, buf);
    return buf;
  }
}
