.DEFAULT_GOAL := help
.PHONY: help setup up down restart status logs logs-backend logs-worker logs-frontend \
        build migrate seed shell db-shell ingest lint test \
        frontend-dev frontend-build frontend-lint clean nuke

# ─────────────────────────────────────────────────────────────────────────────
# ULTRA-NEWS V3 — Developer Commands
# ─────────────────────────────────────────────────────────────────────────────

# Configuration
COMPOSE        := docker compose
BACKEND_EXEC   := $(COMPOSE) exec backend
FRONTEND_DIR   := frontend
API_URL        := http://localhost:8000
ADMIN_KEY      ?= dev-admin-key-change-in-prod

help: ## Show this help
	@echo ""
	@echo "  ULTRA-NEWS V3 — Developer Commands"
	@echo "  ─────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─── Setup & Lifecycle ───────────────────────────────────────────────────────

setup: build up migrate seed ## Full first-time setup: build → start → migrate → seed
	@echo ""
	@echo "  ✅ ULTRA-NEWS V3 is ready!"
	@echo "  ─────────────────────────────────────"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  API Docs:  http://localhost:8000/api/v1/docs"
	@echo "  Health:    http://localhost:8000/api/v1/health"
	@echo ""

build: ## Build all Docker images
	$(COMPOSE) build

up: ## Start all services (detached)
	$(COMPOSE) up -d

down: ## Stop all services (preserves data)
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

status: ## Show status of all services
	$(COMPOSE) ps

logs: ## Tail logs for all services
	$(COMPOSE) logs -f

logs-backend: ## Tail backend API logs
	$(COMPOSE) logs -f backend

logs-worker: ## Tail Celery worker logs
	$(COMPOSE) logs -f worker-fetch worker-cluster

logs-frontend: ## Tail frontend logs
	$(COMPOSE) logs -f frontend

# ─── Database ────────────────────────────────────────────────────────────────

migrate: ## Run Django migrations
	$(BACKEND_EXEC) python manage.py migrate --noinput

seed: ## Seed categories + sources via admin API
	@echo "Seeding database via /api/v1/admin/seed-db..."
	@curl -s -X POST $(API_URL)/api/v1/admin/seed-db -H "X-Admin-Key: $(ADMIN_KEY)" -H "Content-Type: application/json"
	@echo ""

shell: ## Open Django interactive shell
	$(BACKEND_EXEC) python manage.py shell

db-shell: ## Open PostgreSQL shell (psql)
	$(COMPOSE) exec db psql -U postgres -d ultranews

# ─── Development ─────────────────────────────────────────────────────────────

ingest: ## Trigger a news ingestion cycle (queues Celery task)
	$(BACKEND_EXEC) python manage.py ingest_news
	@echo "  ℹ️  Ingestion queued. Watch progress: make logs-worker"

lint: ## Run all linters (ruff + tsc + eslint)
	@echo "── Python (ruff) ──"
	$(BACKEND_EXEC) ruff check .
	@echo ""
	@echo "── TypeScript (tsc) ──"
	cd $(FRONTEND_DIR) && npx tsc --noEmit
	@echo ""
	@echo "── ESLint ──"
	cd $(FRONTEND_DIR) && npm run lint

frontend-lint: ## Run TypeScript type-check + ESLint
	cd $(FRONTEND_DIR) && npx tsc --noEmit && npm run lint

test: ## Run all tests (backend + frontend)
	@echo "── Backend (pytest) ──"
	$(BACKEND_EXEC) python -m pytest -q
	@echo ""
	@echo "── Frontend (tsc + eslint) ──"
	cd $(FRONTEND_DIR) && npx tsc --noEmit && npm run lint

# ─── Frontend (local, outside Docker) ────────────────────────────────────────

frontend-dev: ## Run Next.js dev server locally (outside Docker)
	cd $(FRONTEND_DIR) && npm run dev

frontend-build: ## Build Next.js production bundle locally
	cd $(FRONTEND_DIR) && npm run build

# ─── Cleanup ─────────────────────────────────────────────────────────────────

clean: ## Stop all services and remove containers
	$(COMPOSE) down --remove-orphans

nuke: ## ⚠️  Stop services, remove volumes + all data
	@echo "  ⚠️  This will DELETE all database data and volumes."
	$(COMPOSE) down -v --remove-orphans
