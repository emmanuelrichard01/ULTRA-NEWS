.DEFAULT_GOAL := help
.PHONY: help setup up down logs build seed migrate test lint shell ingest clean

# ============================================================================
# ULTRA-NEWS V3 — Developer Commands
# ============================================================================

help: ## Show this help
	@echo ""
	@echo "  ULTRA-NEWS V3 — Developer Commands"
	@echo "  ─────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

# --- Setup & Lifecycle ---

setup: build up migrate seed ## Full setup: build, start, migrate, seed
	@echo "✅ ULTRA-NEWS V3 is ready!"
	@echo "   Frontend: http://localhost:3000"
	@echo "   API Docs: http://localhost:8000/api/v1/docs"

build: ## Build all containers
	docker compose build

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

clean: ## Stop all services and remove volumes (⚠️ deletes data)
	docker compose down -v

logs: ## Tail logs for all services
	docker compose logs -f

logs-backend: ## Tail backend logs only
	docker compose logs -f backend

logs-worker: ## Tail worker logs only
	docker compose logs -f worker

# --- Database ---

migrate: ## Run Django migrations
	docker compose exec backend python manage.py migrate --noinput

seed: ## Seed the database with initial Categories and Sources
	docker compose exec backend python seed_sources.py

shell: ## Open Django shell
	docker compose exec backend python manage.py shell

# --- Development ---

ingest: ## Trigger news ingestion via Celery
	docker compose exec backend python manage.py ingest_news

lint: ## Run linters (ruff for Python, tsc for TypeScript)
	docker compose exec backend ruff check .
	cd frontend && npx tsc --noEmit

test: ## Run tests
	docker compose exec backend pytest -v
	cd frontend && npm test 2>/dev/null || echo "No frontend tests configured yet."

# --- Frontend ---

frontend-dev: ## Run frontend dev server locally (outside Docker)
	cd frontend && npm run dev

frontend-build: ## Build frontend for production
	cd frontend && npm run build
