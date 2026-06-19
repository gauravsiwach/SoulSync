.PHONY: db-up db-down backend mobile celery setup health status

# Database container commands
db-up:
	@echo "🗄️ Starting database services..."
	podman-compose up -d postgres redis qdrant
	@echo "✅ Database services started"
	@echo "⏳ Waiting for services to be ready..."
	sleep 30
	@echo "✅ Services ready!"

db-down:
	@echo "🛑 Stopping database services..."
	podman-compose down
	@echo "✅ Database services stopped"

# Development commands
setup:
	@echo "Setting up SoulSync development environment..."
	cd apps/backend && python3.11 -m venv venv
	cd apps/backend && source venv/bin/activate && pip install -r requirements.txt
	cd apps/mobile && npm install
	@echo "✅ Setup complete! Run 'make db-up' then 'make backend' and 'make mobile'"

backend:
	@echo "🚀 Starting FastAPI backend..."
	cd apps/backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

celery:
	@echo "🔄 Starting Celery worker..."
	cd apps/backend && source venv/bin/activate && celery -A app.celery_worker:app worker --loglevel=info

mobile:
	@echo "📱 Starting Expo mobile app..."
	cd apps/mobile && npx expo start

mobile-ios:
	@echo "📱 Starting mobile app on iOS simulator..."
	cd apps/mobile && npx expo start --ios

mobile-android:
	@echo "📱 Starting mobile app on Android..."
	cd apps/mobile && npx expo start --android

# Database commands
migrate:
	@echo "🔄 Running database migrations..."
	cd apps/backend && source venv/bin/activate && alembic upgrade head

migrate-create:
	@echo "📝 Creating new migration..."
	cd apps/backend && source venv/bin/activate && alembic revision --autogenerate -m "$(MSG)"

# Health checks
health:
	@echo "🔍 Checking service health..."
	@curl -s http://localhost:8000/health | jq || echo "❌ Backend not responding"
	@curl -s http://localhost:5433 && echo "✅ PostgreSQL reachable" || echo "❌ PostgreSQL not responding"
	@curl -s http://localhost:6380 && echo "✅ Redis reachable" || echo "❌ Redis not responding"
	@curl -s http://localhost:6334/collections && echo "✅ Qdrant reachable" || echo "❌ Qdrant not responding"

# Status commands
status:
	@echo "📊 Service Status:"
	podman-compose ps

ps:
	podman-compose ps

# Development workflow
dev-setup: setup db-up
	@echo "🚀 Development environment ready!"
	@echo "Run these commands in separate terminals:"
	@echo "  make backend     # Start API server"
	@echo "  make celery      # Start background worker"
	@echo "  make mobile      # Start mobile app"

dev-start: db-up
	@echo "🚀 Starting all services..."
	@echo "Database: ✅ Running in containers"
	@echo "Backend: Run 'make backend' in terminal 1"
	@echo "Celery:  Run 'make celery' in terminal 2"
	@echo "Mobile:  Run 'make mobile' in terminal 3"
