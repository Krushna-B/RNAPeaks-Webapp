#!/bin/bash
set -e

WORKERS=${NUM_WORKERS:-2}
WORKER_PIDS=()
NGINX_PID=""

# Graceful shutdown 
# Called on SIGTERM (Docker stop) or SIGINT (Ctrl-C).
# 1. Tell nginx to finish in-flight requests then exit (SIGQUIT / nginx -s quit).
# 2. Wait up to 30 s for nginx to drain.
# 3. Send SIGTERM to each plumber worker and wait for them to exit cleanly.
shutdown() {
  echo "[start.sh] Received shutdown signal — graceful drain starting..."

  if [[ -n "$NGINX_PID" ]] && kill -0 "$NGINX_PID" 2>/dev/null; then
    echo "[start.sh] Asking nginx to finish active connections..."
    nginx -s quit || true
    # Wait up to 30 s for nginx to exit
    local waited=0
    while kill -0 "$NGINX_PID" 2>/dev/null && (( waited < 30 )); do
      sleep 1
      (( waited++ )) || true
    done
  fi

  echo "[start.sh] Stopping R workers..."
  for pid in "${WORKER_PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in "${WORKER_PIDS[@]}"; do
    wait "$pid" 2>/dev/null || true
  done

  echo "[start.sh] Shutdown complete."
  exit 0
}

trap shutdown SIGTERM SIGINT

# Clear any corrupted AnnotationHub sqlite from a previous unclean shutdown.
rm -f /root/.cache/R/AnnotationHub/annotationhub.sqlite3

#Start plumber workers
echo "[start.sh] Starting $WORKERS plumber worker(s)..."

for i in $(seq 1 "$WORKERS"); do
  PORT=$((7860 + i))
  R -e "pr <- plumber::plumb('/app/plumber.R'); pr\$run(host='127.0.0.1', port=$PORT)" &
  WORKER_PIDS+=($!)
  echo "[start.sh] Worker $i started on port $PORT (pid ${WORKER_PIDS[-1]})"
done

# Poll workers until they respond to /health (GTF is pre-cached so this should be ~10-15s)
echo "[start.sh] Waiting for workers to become ready..."
for PORT in $(seq 7861 $((7860 + WORKERS))); do
  attempts=0
  until curl -sf "http://127.0.0.1:$PORT/health" | grep -q '"status":"ok"' 2>/dev/null; do
    (( ++attempts ))
    if (( attempts >= 90 )); then
      echo "[start.sh] ERROR: worker on port $PORT did not become ready after 90s — nginx will start but requests will fail"
      break
    fi
    sleep 1
  done
  if (( attempts < 90 )); then
    echo "[start.sh] Worker on port $PORT is ready (${attempts}s)"
  fi
done

# Render the nginx config template with the allowed frontend origin.
# Fall back to "__disabled__" (a string that never matches a real Origin header)
# instead of an empty string — an empty key in the nginx map block is a parse
# error that prevents nginx from starting at all.
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-__disabled__}" \
  envsubst '${ALLOWED_ORIGIN}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/nginx.conf

#Start nginx in the background so the shell can handle signals
echo "[start.sh] Starting nginx on port 7860"
nginx -g "daemon off;" &
NGINX_PID=$!
echo "[start.sh] nginx started (pid $NGINX_PID)"

# Block until nginx exits (or a signal fires the trap above)
wait $NGINX_PID
