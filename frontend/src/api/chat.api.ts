import { api } from './client';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface ChatConversation {
  id: string;
  title: string | null;
  updatedAt: string;
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export async function listConversations(): Promise<ChatConversation[]> {
  return (await api.get<ChatConversation[]>('/chat/conversations')).data;
}

export async function getConversation(
  id: string,
): Promise<{ id: string; title: string | null; messages: ChatMessage[] }> {
  return (await api.get(`/chat/conversations/${id}`)).data;
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/chat/conversations/${id}`);
}

export interface StreamHandlers {
  onMeta?: (conversationId: string) => void;
  onDelta: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/**
 * Send a message and consume the SSE stream via fetch (so the JWT can be sent as
 * a header — EventSource can't). Calls handlers as events arrive.
 */
export async function streamMessage(
  body: { conversationId?: string; message: string; locale?: 'en' | 'vi' },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    handlers.onError?.((e as Error).message);
    handlers.onDone?.();
    return;
  }
  if (!res.ok || !res.body) {
    handlers.onError?.(`Request failed (${res.status})`);
    handlers.onDone?.();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, sep).trim();
        buf = buf.slice(sep + 2);
        if (!frame.startsWith('data:')) continue;
        try {
          const ev = JSON.parse(frame.slice(5).trim());
          if (ev.type === 'meta') handlers.onMeta?.(ev.conversationId);
          else if (ev.type === 'delta') handlers.onDelta(ev.text);
          else if (ev.type === 'error') handlers.onError?.(ev.message);
        } catch {
          /* ignore partial frame */
        }
      }
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') handlers.onError?.((e as Error).message);
  } finally {
    handlers.onDone?.();
  }
}
