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

.PHONY: build rebuild up down restart install-pkg update-pkg logs
