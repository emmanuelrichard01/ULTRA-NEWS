.PHONY: help build up down restart logs logs-frontend logs-all migrate makemigrations shell seed ingest assign-categories test clean

# Default target
help:
	@echo "======================================================================"
	@echo "                   ULTRA-NEWS V2 - Make Commands"
	@echo "======================================================================"
	@echo ""
	@echo "  Development:"
	@echo "    make up              Build and start all services (detached)"
	@echo "    make down            Stop and remove all containers"
	@echo "    make restart         Restart backend service"
	@echo "    make logs            Stream backend logs"
	@echo "    make logs-frontend   Stream frontend logs"
	@echo "    make logs-all        Stream all service logs"
	@echo ""
	@echo "  Database:"
	@echo "    make migrate         Run Django migrations"
	@echo "    make makemigrations  Create new migration files"
	@echo "    make seed            Seed categories (Tech, Politics, etc.)"
	@echo "    make shell           Open Django shell"
	@echo ""
	@echo "  Content:"
	@echo "    make ingest             Trigger news ingestion task"
	@echo "    make assign-categories  Assign categories to existing articles"
	@echo ""
	@echo "  Maintenance:"
	@echo "    make build           Rebuild all Docker images"
	@echo "    make test            Run backend tests"
	@echo "    make clean           Stop and remove everything (incl. volumes)"
	@echo ""
	@echo "======================================================================"

build:
	docker compose build

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart backend

logs:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

logs-all:
	docker compose logs -f

migrate:
	docker compose exec backend python manage.py migrate

makemigrations:
	docker compose exec backend python manage.py makemigrations

shell:
	docker compose exec backend python manage.py shell

seed:
	docker compose exec -T backend python manage.py shell < backend/seed_categories.py

ingest:
	docker compose exec backend python manage.py ingest_news

assign-categories:
	docker compose exec -T backend python manage.py shell < backend/assign_categories.py

test:
	docker compose exec backend pytest

clean:
	docker compose down -v
	@echo "⚠️  All volumes removed. Run 'make migrate && make seed' after restart."
