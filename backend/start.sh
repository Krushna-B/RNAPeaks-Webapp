#!/bin/bash
set -e

WORKERS=${NUM_WORKERS:-2}

echo "[start.sh] Starting $WORKERS plumber worker(s)..."

# Start plumber instances on sequential ports beginning at 7861
for i in $(seq 1 "$WORKERS"); do
  PORT=$((7860 + i))
  R -e "pr <- plumber::plumb('/app/plumber.R'); pr\$run(host='127.0.0.1', port=$PORT)" &
  echo "[start.sh] Worker $i started on port $PORT (pid $!)"
done

# Give workers time to load GTF before nginx starts accepting traffic
echo "[start.sh] Waiting for workers to finish loading GTF (~2 min)..."
sleep 130

echo "[start.sh] Starting nginx on port 7860"
exec nginx -g "daemon off;"
