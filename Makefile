.PHONY: help install dev docker-up docker-down docker-build test test-backend test-frontend test-integration test-env-up test-env-down lint format migrate clean

help:
	@echo "Talk-With-Me Monorepo Commands:"
	@echo "  make install           Install all dependencies (frontend & backend)"
	@echo "  make dev               Run development services (requires docker for DB/Redis)"
	@echo "  make docker-up         Start full stack in Docker Compose"
	@echo "  make docker-down       Stop and clean Docker Compose containers"
	@echo "  make docker-build      Build all Docker containers"
	@echo "  make test              Run backend and frontend unit tests"
	@echo "  make test-backend      Run backend unit tests with coverage (100%)"
	@echo "  make test-frontend     Run frontend unit & integration tests"
	@echo "  make test-integration  Run integration tests in Docker and auto-cleanup containers"
	@echo "  make test-env-up       Start isolated test Postgres & Redis containers in background"
	@echo "  make test-env-down     Stop and clean isolated test Postgres & Redis containers"
	@echo "  make lint              Lint and typecheck frontend and backend"
	@echo "  make format            Format code (Ruff, ESLint/Prettier)"
	@echo "  make migrate           Run database migrations (Alembic)"
	@echo "  make clean             Clean caches and build artifacts"

install:
	pip install -r backend/requirements-dev.txt
	cd frontend && npm install

dev:
	docker compose up -d postgres redis

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down -v --remove-orphans

docker-build:
	docker compose build

test: test-backend test-frontend

test-backend:
	cd backend && pytest tests/unit -v --cov=app --cov-report=term-missing

test-frontend:
	cd frontend && npm run test

test-env-up:
	docker compose -f docker-compose.test.yml up -d postgres-test redis-test

test-env-down:
	docker compose -f docker-compose.test.yml down -v --remove-orphans

test-integration:
	-docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test-runner
	docker compose -f docker-compose.test.yml down -v --remove-orphans

lint:
	ruff check backend
	ruff format --check backend
	mypy backend/app --config-file=backend/pyproject.toml
	cd frontend && npm run lint

format:
	ruff check backend --fix
	ruff format backend

migrate:
	cd backend && alembic upgrade head

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	rm -rf frontend/dist frontend/.angular
