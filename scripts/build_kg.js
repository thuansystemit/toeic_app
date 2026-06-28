// Bulk-build the vocabulary knowledge graph from the 600 TOEIC words.
// Calls GET /api/vocab/:word per word — the backend generates & caches each with
// >=10 sentences (MIN_SENTENCES rule). Resumable: cached words return instantly.
const fs = require('fs');
const B = 'http://localhost:3000/api';
const CONCURRENCY = 3;

const words = fs
  .readFileSync('/tmp/toeic_words.txt', 'utf8')
  .split('\n')
  .map((w) => w.trim().toLowerCase())
  .filter((w) => /^[a-z][a-z'-]*$/.test(w));

let token = null;
let tokenAt = 0;
async function login() {
  const r = await fetch(B + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@toeic.local', password: 'Admin12345' }),
  });
  token = (await r.json()).accessToken;
  tokenAt = Date.now();
}
async function ensureToken() {
  if (!token || Date.now() - tokenAt > 12 * 60 * 1000) await login();
}

let done = 0,
  ok = 0,
  fail = 0;
const t0 = Date.now();
function log(w, status, extra) {
  done++;
  const elapsedM = (Date.now() - t0) / 60000;
  const perHour = done / (elapsedM / 60);
  const etaH = (words.length - done) / Math.max(perHour, 1);
  console.log(
    `[${done}/${words.length}] ${status} ${w} ${extra || ''} | ` +
      `${elapsedM.toFixed(1)}m elapsed, ETA ~${etaH.toFixed(1)}h | ok=${ok} fail=${fail}`,
  );
}

async function processWord(w) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await ensureToken();
      const r = await fetch(B + '/vocab/' + encodeURIComponent(w), {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (r.status === 401) {
        await login();
        continue;
      }
      if (!r.ok) throw new Error('status ' + r.status);
      const j = await r.json();
      const sents = (j.senses || []).reduce((n, s) => n + (s.sentences || []).length, 0);
      ok++;
      log(w, 'ok', sents + ' sentences');
      return;
    } catch (e) {
      if (attempt === 2) {
        fail++;
        log(w, 'FAIL', e.message);
        return;
      }
    }
  }
}

async function run() {
  console.log(`=== build start: ${words.length} words, concurrency ${CONCURRENCY} ===`);
  await login();
  let idx = 0;
  const worker = async () => {
    while (idx < words.length) {
      const w = words[idx++];
      await processWord(w);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`=== DONE: ok=${ok} fail=${fail} in ${((Date.now() - t0) / 60000).toFixed(1)}m ===`);
}
run();
