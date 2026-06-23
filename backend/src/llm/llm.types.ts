/** Minimal LLM abstraction for synchronous, JSON-constrained generation.
 *  P1 ships a single implementation (Ollama); Claude/OpenAI can be added behind
 *  this interface without touching callers. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmProvider {
  /** The model id in use (for provenance stamping). */
  readonly model: string;

  /**
   * Generate and return a single JSON object. The implementation must ask the
   * model for JSON-only output and return the raw JSON string (callers parse +
   * validate). Throws on transport failure.
   */
  generateJson(system: string, user: string): Promise<string>;
}
