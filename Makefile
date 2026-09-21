.PHONY: up down logs test check

up:
	docker compose up -d --wait --build

down:
	docker compose down

logs:
	docker compose logs -f app ollama ollama-model-init mailhog

test:
	npm test

check:
	npm run lint
	npm run typecheck
	npm test
	npm run build
