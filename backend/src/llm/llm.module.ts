import { Module } from '@nestjs/common';
import { LLM_PROVIDER } from './llm.types';
import { OllamaProvider } from './ollama.provider';

/**
 * Binds the `LLM_PROVIDER` token to a concrete implementation. P1 wires Ollama;
 * swapping in Claude/OpenAI later is a one-line change here (provider factory on
 * `llm.provider`) with no impact on the vocab layer.
 */
@Module({
  providers: [{ provide: LLM_PROVIDER, useClass: OllamaProvider }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
