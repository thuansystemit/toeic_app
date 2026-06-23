import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from './llm.types';

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
}
