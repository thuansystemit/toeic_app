#!/usr/bin/env bash
# Build the vocabulary knowledge graph from library/600_TOEIC_words.txt by
# feeding each word through GET /api/vocab/:word (generates & caches >=10
# sentences). Runs detached inside the backend container, so it survives this
# shell — but NOT a backend rebuild. After any `docker compose ... backend`
# rebuild, just run this script again; it's resumable (cached words skip fast).
#
#   ./scripts/build-vocab-kg.sh
#   docker exec toeic_backend tail -f /tmp/build_kg.log    # monitor
#   docker exec toeic_backend pkill -f build_kg.js         # stop
set -euo pipefail
cd "$(dirname "$0")/.."

# Parse the single-word entries (NNN. word) into a clean lowercase list.
grep -oE '^[0-9]+\.[[:space:]]+[A-Za-z]+' library/600_TOEIC_words.txt \
  | sed -E 's/^[0-9]+\.[[:space:]]+//' | tr 'A-Z' 'a-z' > /tmp/toeic_words.txt
echo "words: $(wc -l < /tmp/toeic_words.txt)"

docker cp /tmp/toeic_words.txt toeic_backend:/tmp/toeic_words.txt
docker cp scripts/build_kg.js  toeic_backend:/tmp/build_kg.js
docker exec -d toeic_backend sh -c 'node /tmp/build_kg.js > /tmp/build_kg.log 2>&1'

echo "launched (detached). monitor: docker exec toeic_backend tail -f /tmp/build_kg.log"
