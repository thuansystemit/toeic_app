import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChatTurn, LLM_PROVIDER, LlmProvider } from '../llm/llm.types';
import { chatSystemPrompt } from './chat.prompts';

/** Streaming event yielded while answering. */
export type ChatStreamEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'delta'; text: string };

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}
export interface ConversationDetail {
  id: string;
  title: string | null;
  messages: { role: 'user' | 'assistant'; content: string; createdAt: string }[];
}

const DAILY_MESSAGE_LIMIT = 100; // per user
const CONTEXT_TURNS = 20; // last N user/assistant turns sent to the LLM

/**
 * Chatbot service (P1): conversation CRUD + streaming answers. Persistence is raw
 * SQL over chat_* tables (same style as VocabService). The LLM call streams via
 * the provider's streamChat(); the full answer is saved once the stream ends.
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async listConversations(userId: string): Promise<ConversationSummary[]> {
    const rows: { id: string; title: string | null; updated_at: string }[] =
      await this.db.query(
        `SELECT id, title, updated_at FROM chat_conversations
         WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`,
        [userId],
      );
    return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
  }

  async getConversation(userId: string, id: string): Promise<ConversationDetail> {
    const [conv]: { id: string; title: string | null }[] = await this.db.query(
      `SELECT id, title FROM chat_conversations WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (!conv) throw new NotFoundException('Conversation not found');
    const msgs: { role: 'user' | 'assistant'; content: string; created_at: string }[] =
      await this.db.query(
        `SELECT role, content, created_at FROM chat_messages
         WHERE conversation_id = $1 AND role IN ('user','assistant')
         ORDER BY created_at ASC`,
        [id],
      );
    return {
      id: conv.id,
      title: conv.title,
      messages: msgs.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    };
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    await this.db.query(
      `DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
  }

  /**
   * Stream an answer. Yields a `meta` event (the conversation id) first, then
   * `delta` text events. Persists the user message up front and the full
   * assistant reply once the stream completes.
   */
  async *streamMessage(
    userId: string,
    conversationId: string | null,
    message: string,
    locale: 'en' | 'vi',
  ): AsyncGenerator<ChatStreamEvent> {
    await this.assertWithinDailyLimit(userId);

    let convId = conversationId;
    if (convId) {
      const owns = await this.ownsConversation(userId, convId);
      if (!owns) throw new NotFoundException('Conversation not found');
    } else {
      convId = await this.createConversation(userId, message);
    }
    yield { type: 'meta', conversationId: convId };

    await this.addMessage(convId, 'user', message);

    const history = await this.recentTurns(convId);
    const llmMessages: ChatTurn[] = [
      { role: 'system', content: chatSystemPrompt(locale) },
      ...history,
    ];

    let full = '';
    for await (const delta of this.llm.streamChat(llmMessages)) {
      full += delta;
      yield { type: 'delta', text: delta };
    }

    await this.addMessage(convId, 'assistant', full || '…', this.llm.model);
    await this.db.query(
      `UPDATE chat_conversations SET updated_at = now() WHERE id = $1`,
      [convId],
    );
  }

  // --- helpers ---

  private async assertWithinDailyLimit(userId: string): Promise<void> {
    const [{ count }]: { count: string }[] = await this.db.query(
      `SELECT count(*) FROM chat_messages m
       JOIN chat_conversations c ON c.id = m.conversation_id
       WHERE c.user_id = $1 AND m.role = 'user'
         AND m.created_at::date = CURRENT_DATE`,
      [userId],
    );
    if (Number(count) >= DAILY_MESSAGE_LIMIT) {
      throw new ForbiddenException('Daily chat limit reached. Try again tomorrow.');
    }
  }

  private async ownsConversation(userId: string, id: string): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT 1 FROM chat_conversations WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows.length > 0;
  }

  private async createConversation(userId: string, firstMessage: string): Promise<string> {
    const title = firstMessage.trim().slice(0, 60) || 'New chat';
    const [{ id }]: { id: string }[] = await this.db.query(
      `INSERT INTO chat_conversations (user_id, title) VALUES ($1, $2) RETURNING id`,
      [userId, title],
    );
    return id;
  }

  private async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    model?: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO chat_messages (conversation_id, role, content, model)
       VALUES ($1, $2, $3, $4)`,
      [conversationId, role, content, model ?? null],
    );
  }

  /** Last N turns (chronological) for LLM context. */
  private async recentTurns(conversationId: string): Promise<ChatTurn[]> {
    const rows: { role: 'user' | 'assistant'; content: string }[] = await this.db.query(
      `SELECT role, content FROM (
         SELECT role, content, created_at FROM chat_messages
         WHERE conversation_id = $1 AND role IN ('user','assistant')
         ORDER BY created_at DESC LIMIT $2
       ) t ORDER BY created_at ASC`,
      [conversationId, CONTEXT_TURNS],
    );
    return rows.map((r) => ({ role: r.role, content: r.content }));
  }
}
