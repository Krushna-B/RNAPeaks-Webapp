PACKAGE := Krushna-B/RNAPeaks

# ── Full rebuild (use after Dockerfile changes) ────────────────────────────────
build:
	docker compose build backend

rebuild:
	docker compose build --no-cache backend

# ── Start / stop ───────────────────────────────────────────────────────────────
up:
	docker compose up -d

down:
	docker compose down

restart: down up

# ── Reinstall RNAPeaks from GitHub inside the running container ────────────────
# Faster than a full rebuild — push your changes to GitHub first, then run this.
install-pkg:
	docker compose exec backend R -e \
	  "remotes::install_github('$(PACKAGE)', force=TRUE, upgrade='never', quiet=FALSE)"

# Reinstall + bounce workers so the new code is picked up.
# Uses `docker compose restart` (not `down up`) so the container is NOT recreated
# from the old image — the in-place install is preserved on the running filesystem.
update-pkg:
	$(MAKE) install-pkg
	docker compose restart backend

# ── Logs ───────────────────────────────────────────────────────────────────────
logs:
	docker compose logs -f backend

# ── Load testing ───────────────────────────────────────────────────────────────
# Install k6 (one-time): brew install k6
#
# Smoke test — 2 users, 1 minute, confirms the server is alive
# Usage: make smoke-test FRONTEND_URL=https://rna-peaks-webapp.vercel.app VERCEL_BYPASS_SECRET=your-secret
# Get the bypass secret from: Vercel Dashboard → Project → Settings → Security → Protection Bypass for Automation
smoke-test:
	k6 run --vus 2 --duration 1m \
	  -e FRONTEND_URL=$(FRONTEND_URL) \
	  -e VERCEL_BYPASS_SECRET=$(VERCEL_BYPASS_SECRET) \
	  load-test/stress-test.js

# Full ramp test — simulates 2→5→10 concurrent users
load-test:
	k6 run \
	  -e FRONTEND_URL=$(FRONTEND_URL) \
	  -e VERCEL_BYPASS_SECRET=$(VERCEL_BYPASS_SECRET) \
	  load-test/stress-test.js

# Full flow test: file upload + plot + cleanup
load-test-upload:
	k6 run \
	  -e FRONTEND_URL=$(FRONTEND_URL) \
	  -e VERCEL_BYPASS_SECRET=$(VERCEL_BYPASS_SECRET) \
	  -e SCENARIO=upload \
	  load-test/stress-test.js

# Save results to JSON for analysis
load-test-report:
	k6 run \
	  --out json=load-test/results.json \
	  -e FRONTEND_URL=$(FRONTEND_URL) \
	  -e VERCEL_BYPASS_SECRET=$(VERCEL_BYPASS_SECRET) \
	  load-test/stress-test.js
	@echo "Results saved to load-test/results.json"

.PHONY: build rebuild up down restart install-pkg update-pkg logs \
        smoke-test load-test load-test-upload load-test-report
