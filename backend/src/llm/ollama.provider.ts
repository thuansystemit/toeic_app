import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatTurn, LlmProvider } from './llm.types';

/**
 * Local Ollama provider. Uses the `/api/chat` endpoint with `format: 'json'`
 * so the model is constrained to emit a single JSON object. Mirrors the worker's
 * Ollama settings (OLLAMA_BASE_URL / OLLAMA_MODEL) so both services stay aligned.
 */
@Injectable()
export class OllamaProvider implements LlmProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl: string;
  readonly model: string;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('llm.ollamaBaseUrl', 'http://localhost:11434')
      .replace(/\/+$/, '');
    this.model = config.get<string>('llm.ollamaModel', 'qwen2.5:3b');
  }

  async generateJson(system: string, user: string): Promise<string> {
    // Retry transient failures (network blips, host briefly busy) with backoff so
    // a single hiccup doesn't drop the request — important for the background
    // batch build, where one blip otherwise fails every remaining word fast.
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.call(system, user);
      } catch (e) {
        lastErr = e;
        this.logger.warn(`Ollama attempt ${attempt}/3 failed: ${(e as Error).message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    throw lastErr;
  }

  private async call(system: string, user: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: 'json',
        options: { temperature: 0.2 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`Ollama ${res.status}: ${body.slice(0, 200)}`);
      throw new Error(`Ollama request failed (${res.status})`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content;
    if (!content) throw new Error('Ollama returned an empty message');
    return content;
  }

  /** Stream a chat completion (Ollama `/api/chat`, stream:true → NDJSON). */
  async *streamChat(messages: ChatTurn[]): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        options: { temperature: 0.4, num_predict: 800 },
        messages,
      }),
    });
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`Ollama stream ${res.status}: ${body.slice(0, 200)}`);
      throw new Error(`Ollama stream failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Ollama streams newline-delimited JSON objects.
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
          };
          const delta = obj.message?.content;
          if (delta) yield delta;
          if (obj.done) return;
        } catch {
          /* ignore partial/non-JSON line */
        }
      }
    }
  }
}
