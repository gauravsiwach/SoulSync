# SoulSync Project Setup Guide

This guide will help you set up the SoulSync development environment from scratch.

## Architecture Overview

**🗄️ Database Services (Podman Containers):**
- PostgreSQL (port 5433)
- Redis (port 6380) 
- Qdrant Vector DB (port 6334)

**💻 Local Development:**
- Backend API (FastAPI) - runs locally on port 8000
- Mobile App (Expo) - runs with Metro bundler

## Prerequisites

### Required Software
- **Python 3.11.15** or higher
- **Node.js Current LTS** or higher
- **Podman** (Docker alternative)
- **Podman Compose** (`pip install podman-compose`)
- **Xcode** (for iOS simulator - macOS only)
- **Git**

### System Requirements
- **macOS** (recommended) or Linux
- **8GB+ RAM**
- **10GB+ free disk space**

---

## 🚀 Quick Start

### 1. Clone and Setup Repository

```bash
# Clone the repository
git clone <repository-url>
cd SoulSync

# Verify repository structure
ls -la
# Should show: apps/, docs/, .gitignore, Makefile, README.md, docker-compose.yml
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd apps/backend

# Create Python virtual environment
python3.11 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Verify installation
python -c "import fastapi, alembic, celery; print('✅ Backend dependencies installed')"
```

### 3. Database Setup (Podman Containers)

```bash
# Navigate to project root
cd ../../

# Start database services only
podman-compose up -d postgres redis qdrant

# Wait for services to be ready (30 seconds)
sleep 30

# Run database migrations
cd apps/backend
source venv/bin/activate
alembic upgrade head

# Verify database connection
curl -s http://localhost:5433 && echo "✅ PostgreSQL is running"
```

### 4. Backend API Setup (Local Development)

```bash
# Navigate to backend directory
cd apps/backend

# Activate virtual environment
source venv/bin/activate

# Start backend API server locally
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In a separate terminal, start Celery worker
cd apps/backend
source venv/bin/activate
celery -A app.celery_worker:app worker --loglevel=info

# Test backend health (in new terminal)
curl -s http://localhost:8000/health
# Expected: {"status":"ok"}

curl -s http://localhost:8000/health/detailed
# Expected: {"status":"ok","services":{"postgres":"unknown","redis":"unknown","qdrant":"unknown"}}
```

### 5. Mobile App Setup (Local Development)

```bash
# Navigate to mobile directory
cd apps/mobile

# Install Node.js dependencies
npm install

# Create App.js entry point (if missing)
echo 'import "expo-router/entry";' > App.js

# Verify package.json has correct entry point
# Should have: "main": "App.js"

# Verify installation
npx expo --version
```

### 6. Run Mobile App (Local Development)

```bash
# Start Expo development server on port 8082 (avoids pgadmin conflict)
cd apps/mobile
npx expo start --web --port 8082 --clear

# For iOS simulator (requires Xcode):
npx expo start --ios

# For Android (requires Android Studio):
npx expo start --android

# For web browser (default port 8081 - may conflict with pgadmin):
npx expo start --web

# Alternative ports if needed:
npx expo start --web --port 3000 --clear
npx expo start --web --port 8083 --clear
```

---

## 📋 Detailed Commands Reference

### Backend Commands (Local Development)

```bash
# Virtual Environment Setup
cd apps/backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Database Operations (requires database containers running)
alembic revision --autogenerate -m "Migration description"
alembic upgrade head
alembic downgrade -1

# Start Backend API Server (local)
cd apps/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start Celery Worker (local - separate terminal)
cd apps/backend
source venv/bin/activate
celery -A app.celery_worker:app worker --loglevel=info
```

### Database Container Commands (Podman)

```bash
# Start database services only
podman-compose up -d postgres redis qdrant

# View database logs
podman-compose logs -f postgres
podman-compose logs -f redis
podman-compose logs -f qdrant

# Stop database services
podman-compose down

# Restart database services
podman-compose restart postgres redis qdrant
```

### Mobile Commands

```bash
cd apps/mobile

# Development (recommended port 8082)
npx expo start --port 8082
npx expo start --web --port 8082 --clear

# Default command (uses port 8081 - may conflict with pgadmin)
npx expo start

# Platform-specific development
npx expo start --ios          # iOS simulator
npx expo start --android      # Android emulator
npx expo start --web          # Web browser (port 8081)

# Build for production
npx expo build:ios
npx expo build:android

# Clear cache and restart
npx expo start --clear
npx expo start --web --clear --port 8082

# Install specific package
npm install @expo/vector-icons
```

---

## 🔧 Configuration Files

### Environment Variables

Create `.env` file in project root:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/soulsync_dev

# Redis Configuration
REDIS_URL=redis://localhost:6380/0

# Qdrant Configuration
QDRANT_URL=http://localhost:6334

# OpenAI Configuration (for later phases)
OPENAI_API_KEY=your_openai_api_key_here

# Firebase Configuration (for later phases)
FIREBASE_SERVICE_ACCOUNT_JSON=path/to/service-account.json

# Twilio Configuration (for later phases)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=your_twilio_number
```

### Port Configuration

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5433 | Database server |
| Redis | 6380 | Cache and message broker |
| Qdrant | 6334 | Vector database |
| Backend API | 8000 | FastAPI server |
| Expo Metro | 8081 | Development server |

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Podman Services Won't Start
```bash
# Restart Podman machine
podman machine stop
podman machine start

# Clear containers and restart
podman-compose down
podman-compose up -d
```

#### 2. Backend Health Check Fails
```bash
# Check if backend container is running
podman-compose ps

# View backend logs
podman-compose logs backend

# Restart backend service
podman-compose restart backend
```

#### 3. Database Connection Issues
```bash
# Check PostgreSQL container
podman-compose logs postgres

# Test database connection
cd apps/backend
source venv/bin/activate
python -c "
from app.db.database import engine
try:
    with engine.connect() as conn:
        print('✅ Database connection successful')
except Exception as e:
    print(f'❌ Database connection failed: {e}')
"
```

#### 4. Mobile App Issues

**MIME Type Error / AppEntry.bundle Issues:**
```bash
# Fix babel configuration (remove expo-router/babel plugin)
# Ensure package.json has "main": "expo-router/entry"
# Ensure app.json has "web": {"bundler": "metro"}
cd apps/mobile
npx expo start --web --port 8082 --clear
```

**File Watcher Error (EMFILE):**
```bash
# Clear cache and restart
npx expo start --clear --port 8082

# Alternative: Use physical device with Expo Go
npx expo start
# Scan QR code with Expo Go app
```

**Port Conflicts:**
```bash
# Use port 8082 to avoid pgadmin conflict
npx expo start --web --port 8082 --clear

# Alternative ports
npx expo start --web --port 3000 --clear
npx expo start --web --port 8083 --clear
```

**Package Version Conflicts:**
```bash
# Install correct versions
cd apps/mobile
npm install react-native@0.73.6 react-native-safe-area-context@4.8.2
npx expo start --web --port 8082 --clear
```

**Entry Point Issues (Unable to resolve "../../App"):**
```bash
# Ensure App.js exists with expo-router/entry import
# Ensure package.json has "main": "App.js"
cd apps/mobile
npx expo start --port 8082
```

#### 5. iOS Simulator Issues
```bash
# Check Xcode installation
xcode-select --print-path

# Install Xcode command line tools
xcode-select --install

# Reset iOS Simulator
# Use iOS Simulator app > Device > Erase All Content and Settings
```

### Verification Commands

```bash
# Verify all services are running
podman-compose ps

# Test backend endpoints
curl -s http://localhost:8000/health | jq
curl -s http://localhost:5433 && echo "✅ PostgreSQL reachable"
curl -s http://localhost:6380 && echo "✅ Redis reachable"
curl -s http://localhost:6334/collections && echo "✅ Qdrant reachable"

# Test mobile app structure
cd apps/mobile
ls -la app/ components/ stores/ services/ hooks/ types/ assets/
```

---

## 📁 Project Structure

```
SoulSync/
├── apps/
│   ├── backend/           # FastAPI backend
│   │   ├── app/
│   │   │   ├── api/       # API endpoints
│   │   │   ├── core/      # Core configuration
│   │   │   ├── db/        # Database setup
│   │   │   ├── models/    # SQLAlchemy models
│   │   │   ├── services/  # Business logic
│   │   │   └── agents/    # AI agents
│   │   ├── alembic/       # Database migrations
│   │   ├── venv/          # Python virtual environment
│   │   └── requirements.txt
│   └── mobile/            # Expo React Native app
│       ├── app/           # Expo Router screens
│       ├── components/    # React Native components
│       ├── stores/        # State management (Zustand)
│       ├── services/      # API services
│       ├── hooks/         # Custom React hooks
│       ├── types/         # TypeScript types
│       └── assets/        # Images, fonts, etc.
├── docs/                  # Project documentation
├── docker-compose.yml     # Container orchestration
├── .gitignore            # Git ignore rules
├── Makefile              # Development commands
├── README.md             # Project overview
└── SETUP.md              # This setup guide
```

---

## 🎯 Complete Development Workflow

### First Time Setup (One-time)

```bash
# Clone and setup everything
make dev-setup
```

### Daily Development Workflow

```bash
# 1. Start database containers
make db-up

# 2. Run migrations (if database schema changed)
make migrate

# 3. Open 3 separate terminals:

# Terminal 1: Start Backend API
make backend

# Terminal 2: Start Celery Worker  
make celery

# Terminal 3: Start Mobile App
make mobile

# OR for specific platforms:
make mobile-ios    # iOS simulator
make mobile-android # Android
```

### Quick Commands Reference

```bash
# Database operations
make db-up          # Start database containers
make db-down        # Stop database containers
make migrate        # Run migrations
make health         # Check all services

# Development services
make backend        # Start FastAPI server
make celery         # Start background worker
make mobile         # Start Expo dev server (port 8082)

# Status and logs
make status         # Check container status
make health         # Health check all services
```

### Port Summary

| Service | Type | Port | How to Access |
|---------|------|------|---------------|
| PostgreSQL | Container | 5433 | Database client |
| Redis | Container | 6380 | Redis client |
| Qdrant | Container | 6334 | HTTP API |
| Backend API | Local | 8000 | http://localhost:8000 |
| Mobile App | Local | 8082 | http://localhost:8082 |
| PgAdmin | Local | 8081 | Web admin interface |

## 🎯 Next Steps

After completing the setup:

1. **Explore the codebase** - Read through the existing files
2. **Run tests** - Check if any tests exist and run them
3. **Start development** - Begin with Phase 1: Auth & User Profile
4. **Review documentation** - Read through the `docs/` folder

---

## 📞 Support

If you encounter issues:

1. Check this troubleshooting section
2. Review the logs using `podman-compose logs <service>`
3. Consult the documentation in `docs/`
4. Check the GitHub issues (if available)

**Happy coding! 🚀**
