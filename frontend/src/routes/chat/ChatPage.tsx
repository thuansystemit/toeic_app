import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import {
  deleteConversation,
  getConversation,
  listConversations,
  streamMessage,
  type ChatConversation,
  type ChatMessage,
} from '../../api/chat.api';

export function ChatPage() {
  const { t, i18n } = useTranslation(['chat', 'common']);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshList = () => listConversations().then(setConversations).catch(() => undefined);
  useEffect(() => {
    refreshList();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const openConversation = async (id: string) => {
    if (sending) return;
    const c = await getConversation(id);
    setConversationId(c.id);
    setMessages(c.messages);
    setStreaming(null);
  };

  const newChat = () => {
    if (sending) return;
    setConversationId(null);
    setMessages([]);
    setStreaming(null);
  };

  const removeConversation = async (id: string) => {
    await deleteConversation(id);
    if (id === conversationId) newChat();
    refreshList();
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setStreaming('');
    setSending(true);
    let acc = '';
    let isNew = !conversationId;
    await streamMessage(
      {
        conversationId: conversationId ?? undefined,
        message: text,
        locale: i18n.language === 'vi' ? 'vi' : 'en',
      },
      {
        onMeta: (cid) => {
          if (isNew) {
            setConversationId(cid);
            isNew = false;
          }
        },
        onDelta: (d) => {
          acc += d;
          setStreaming(acc);
        },
        onError: (msg) => {
          acc = acc || `⚠ ${msg}`;
        },
        onDone: () => {
          setMessages((m) => [...m, { role: 'assistant', content: acc || '…' }]);
          setStreaming(null);
          setSending(false);
          refreshList();
        },
      },
    );
  };

  return (
    <AppLayout>
      <div className="flex gap-4" style={{ minHeight: '70vh' }}>
        {/* conversation sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col gap-2 md:flex">
          <button className="btn-primary btn-sm" onClick={newChat}>
            <Icon name="chat" /> {t('newChat')}
          </button>
          <div className="flex flex-col gap-1 overflow-y-auto">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
                  c.id === conversationId ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50'
                }`}
              >
                <button
                  className="flex-1 truncate text-left"
                  onClick={() => openConversation(c.id)}
                  title={c.title ?? ''}
                >
                  {c.title || t('untitled')}
                </button>
                <button
                  className="text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
                  onClick={() => removeConversation(c.id)}
                  title={t('delete', { ns: 'common' }) ?? 'Delete'}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* chat area */}
        <div className="flex flex-1 flex-col">
          <div className="mb-3">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
              <Icon name="chat" className="text-brand-500" />
              {t('title')}
            </h1>
            <p className="text-sm text-slate-500">{t('subtitle')}</p>
          </div>

          <div className="card flex-1 overflow-y-auto p-4">
            {messages.length === 0 && streaming === null ? (
              <div className="grid h-full place-items-center gap-2 p-8 text-center text-slate-400">
                <Icon name="chat" className="text-3xl" />
                <p className="font-semibold text-slate-500">{t('emptyTitle')}</p>
                <p className="text-sm">{t('emptyBody')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <Bubble key={i} role={m.role} text={m.content} youLabel={t('you')} />
                ))}
                {streaming !== null && (
                  <Bubble
                    role="assistant"
                    text={streaming || t('thinking')}
                    youLabel={t('you')}
                  />
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <form onSubmit={send} className="mt-3 flex items-center gap-2">
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('placeholder')}
              maxLength={2000}
              autoFocus
            />
            <button type="submit" className="btn-primary shrink-0 px-6" disabled={sending || !input.trim()}>
              <Icon name={sending ? 'spinner' : 'send'} />
              <span className="hidden sm:inline">{t('send')}</span>
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

function Bubble({
  role,
  text,
  youLabel,
}: {
  role: 'user' | 'assistant';
  text: string;
  youLabel: string;
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
          isUser ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-800'
        }`}
      >
        {!isUser && (
          <span className="mb-0.5 block text-xs font-bold text-brand-500">AI</span>
        )}
        {isUser && <span className="sr-only">{youLabel}: </span>}
        {text}
      </div>
    </div>
  );
}
