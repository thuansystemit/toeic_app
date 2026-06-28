# Chatbot Feature — Business Analysis & Requirements

> Analysis-only deliverable (no code). Produced by the BA pass before building.
> Grounded in the codebase at `/Users/pvthuan/work/toeic_app` (branch `master`).
> Related: [adr-knowledge-graph.md](./adr-knowledge-graph.md),
> [adr-english-learning-kg.md](./adr-english-learning-kg.md),
> [../SYSTEM_OVERVIEW.md](../SYSTEM_OVERVIEW.md).

## 1. Problem statement & goals

The platform today is **transactional** — take a test, get a score; click a word,
get a result. There is no conversational, adaptive channel. A chatbot fills three
gaps:

1. **Explanation gap** — no way to ask "why is B correct?" after a question.
2. **Navigation/discovery gap** — a unified conversational entry point that routes
   intent to existing capabilities (recommendations, vocab lookup, word groups).
3. **Active-practice gap** — open-ended practice ("give me 5 sentences using
   *despite*", "quiz me on Part 5 grammar") grounded in the knowledge graph.

### Success metrics
| Metric | Target | Source |
|---|---|---|
| Weekly adoption | 30%+ of active learners use chat ≥1×/week within 4 weeks | `chat_sessions` |
| Engagement depth | avg ≥4 messages/session | messages/session |
| Learning impact | ≥10% faster mastery gain on weak skills vs control | `learner_skill_mastery` delta |
| Containment | ≥80% sessions not abandoned mid-conversation | session end reason |
| Perceived latency | first token < 2s | SSE time-to-first-token |

## 2. Scope options

**Option A — MVP Chat: explain + recommend + lookup (RECOMMENDED).** Streaming
chat panel/page for authenticated users; explain grammar/vocab, recommend weak-skill
practice (`MasteryService`), look up words (`VocabService`), answer general TOEIC
questions; persisted history; TOEIC-grounded system prompt; EN/VI; per-user rate
limit. *Out:* RAG, in-chat graded quizzing, teacher/admin roles, voice, doc analysis.

**Option B — Smart Tutor.** A + inline generate/grade cloze exercises, LLM
tool/function-calling (`lookup_word`, `get_weak_skills`, `generate_exercise`,
`explain_question`), mastery-aware context, references to specific questions.
*Needs a model with reliable tool calling (qwen2.5:3b does not) → larger/cloud model.*

**Option C — Full AI Tutor.** B + RAG over the question/passage corpus (embeddings +
vector store, e.g. qdrant), voice in/out (reuse `TtsService` + add STT), teacher
chatbot, admin analytics.

**Recommendation: ship Option A first** (~2 sprints). It establishes the streaming
infra + chat data model that B/C build on; tool calling can be layered in later.

## 3. Personas & primary user stories (learner)
- **US-CHAT-001** Explain why an answer is correct (with the TOEIC skill it tests; streamed; EN/VI).
- **US-CHAT-002** "What should I practice next?" → calls `MasteryService.getRecommendations()`, returns top-3 weak skills with deep links.
- **US-CHAT-003** "What does *compensate* mean?" → calls `VocabService.lookup()`, shows meaning/pattern/sentence/exercise inline (generates if new).
- **US-CHAT-004** General study Q&A ("affect vs effect?"), grounded + guardrailed to English/TOEIC.
- **US-CHAT-005** View/continue past conversations (last 20, auto-archive >90 days).
- Teacher (US-CHAT-006) and Admin (US-CHAT-007) stories deferred to B/C.

## 4. Functional requirements
- **FR-001** Streaming chat endpoint `POST /api/chat/message` → SSE text chunks + completion event.
- **FR-002** Conversation CRUD (`/api/chat/conversations` …).
- **FR-003** System prompt: TOEIC assistant identity, on-topic constraint, user-locale response, inject mastery summary when available.
- **FR-004** (Option B) Tool calls: `lookup_word`, `get_weak_skills`, `get_recommendations`, `explain_skill`.
- **FR-005** Persist all messages (role, content, timestamps); system prompt stored, not displayed.
- **FR-006** Guardrails: on-topic steering, content safety (explicit in the prompt for small models), no PII/system leakage, input cap 2000 chars, ≤100 messages/conversation.
- **FR-007** Chat UI for all authenticated roles (dedicated `/chat` route; floating slide-over panel as fast-follow).

## 5. Non-functional requirements
- **NFR-001 Latency / streaming (CRITICAL).** Existing `OllamaProvider` uses
  `stream:false`; vocab gen takes 60–90s. A chat must **stream** (Ollama
  `/api/chat` `stream:true` → SSE → frontend). The current `LlmProvider` is
  synchronous (`generateJson → Promise<string>`); a new `streamChat()` is a **new
  capability** that does not exist today.
- **NFR-002 Model suitability.** qwen2.5:3b is tuned for JSON extraction; OK for
  short chat, weaker for rich explanation, unreliable tool calling. Decide:
  qwen2.5:3b (free) vs larger/cloud (better, costs).
- **NFR-003 Cost controls.** Chat is the first *per-interaction* cost (vocab is
  one-time per word): rate limit, sliding context window (last K messages),
  `max_tokens` budget, admin-configurable model.
- **NFR-004 Privacy.** Chat is personal data → include in export/delete; owner-only
  visibility; no training-data usage on cloud APIs.
- **NFR-005 Auth/roles.** JWT-guarded; MVP all authenticated roles; no guests.
- **NFR-006 i18n.** `chat` namespace (EN/VI); respond in `preferred_locale`; per-message override.
- **NFR-007 Accessibility.** Keyboard nav, `role="log"`/`aria-live="polite"`, no full re-read on stream.
- **NFR-008 Mobile.** Full-width panel / full-screen `/chat`.

## 6. Integration points & reuse
**Reuse:** `LlmModule`/`OllamaProvider` (extend with `streamChat()`),
`LlmProvider` interface, `VocabService.lookup()`, `MasteryService.getSummary()`/
`getRecommendations()`, `TtsService` (read-aloud, later), `JwtAuthGuard`/`RolesGuard`,
`CurrentUser`, `users.preferred_locale`, `skills` taxonomy, `lex_*` vocab graph,
pluggable Claude/OpenAI provider pattern (`extraction-service/app/llm/`), `api`
axios client, `AppLayout`, i18n, `toeicWordGroups.ts`.

**New:** `ChatModule` (controller/service/entities), `chat_conversations` +
`chat_messages` tables, SSE streaming endpoint, `streamChat()` on the provider
interface + Ollama impl, frontend `ChatPage` + `chat.api.ts` (SSE consumer) + `chat`
i18n namespace + nav entry.

**Critical gap — streaming.** Verified: no `@WebSocketGateway`, no
`text/event-stream`, `stream:false` hardcoded, `LlmProvider` returns buffered
`Promise<string>`. Building Ollama→backend(SSE)→frontend streaming is the
critical-path item; it is not a bolt-on.

## 7. Key decisions (product owner must answer)
1. **LLM model (critical):** qwen2.5:3b (free, weaker, unreliable tools) vs
   qwen2.5:14b (free, more VRAM) vs Claude Sonnet / GPT-4o (high quality, API cost,
   real tool calling). *Rec: start qwen2.5:3b, keep cloud as a config swap.*
2. **Scope/guardrails:** TOEIC-only vs general English; gentle steer vs hard refuse.
   *Rec: TOEIC + general English, gentle steer, prompt-level guardrails for MVP.*
3. **Persistence:** retention (rec 90 days), exportable (defer), max conversations (rec 100).
4. **UI placement:** dedicated `/chat` (rec for MVP) vs floating panel vs both.
5. **RAG over questions:** defer to Phase 3 until demand is proven.
6. **Rate limiting:** rec 50 msgs/user/day, 1024-token responses, configurable.
7. **Roles:** rec all authenticated (no guests).

## 8. Risks & assumptions
**Risks:** low chat quality from qwen2.5:3b (mitigate: prompt engineering,
upgrade path); streaming effort underestimated (NestJS `@Sse()` + documented Ollama
streaming; prototype early); users treat it as general AI (guardrails + framing);
Ollama contention with vocab/extraction on the same host (rate limit, Ollama
queues); context overflow (sliding window); hallucinated grammar (UI disclaimer,
ground in skill taxonomy, tool calls in B).
**Assumptions:** shared Ollama handles concurrent short chats; "good enough" MVP
quality acceptable; mostly on-topic usage; NestJS SSE sufficient (no WS server);
JWT works for SSE (token via header/query).

## 9. Proposed architecture (high level)
```
Frontend                         Backend (ChatModule)            External
[Chat Page/Panel]                ChatController ── ChatService    [Ollama]
  POST /chat/message  ───────►   build prompt (mastery, locale)
  ◄─── SSE text chunks ──────    streamChat(stream:true) ──────►  ◄── chunks
  GET /chat/conversations        persist to chat_messages
                                 reuse VocabService / MasteryService
```
New tables: `chat_conversations(id,user_id,title,created_at,updated_at)`,
`chat_messages(id,conversation_id,role,content,tokens_used,model,created_at)`.

New files: `backend/src/chat/*` (module/controller/service/prompts/entities/dto),
extend `backend/src/llm/{llm.types,ollama.provider}.ts` with `streamChat()`;
`frontend/src/routes/chat/ChatPage.tsx`, `frontend/src/api/chat.api.ts`, `chat`
i18n namespace, `/chat` route + nav.

### Phased rollout
- **P1 (MVP, ~2 sprints):** streaming infra (`streamChat()` + SSE), `ChatModule` +
  conversation persistence, TOEIC/locale system prompt, `/chat` UI with streaming,
  rate limit, i18n, prompt guardrails, nav.
- **P2:** inject mastery context, tool calls (`lookup_word`/recommendations),
  floating panel, auto-titles, TTS read-aloud.
- **P3:** RAG over questions, "explain this question" deep-link from attempt review,
  in-chat graded quizzing, cloud providers, admin analytics, export.

## 10. Summary & recommendation
The chatbot is best framed as an **AI study assistant** layered over the existing
LLM, vocab graph, and mastery systems — most ingredients already exist. The single
biggest new capability is **streaming** (none exists today). **Recommend Option A
MVP** with **qwen2.5:3b** behind a strong TOEIC system prompt, streaming via SSE,
and conversation persistence; phase in tool calling (P2) and RAG (P3). The two
decisions needed before building are **model selection** and **scope/guardrail
strictness**; everything else has a sensible default.
