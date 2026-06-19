# 🧘‍♀️ SoulSync — AI Mental Health Companion

SoulSync is an AI-powered mental health companion that provides personalized emotional support, goal tracking, and intervention through intelligent conversation and insights.

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [🏗️ Architecture](#️-architecture)
- [📱 Features](#-features)
- [⚙️ Development Setup](#️-development-setup)
- [🔧 Configuration](#-configuration)
- [📚 Documentation](#-documentation)
- [🚦 API Endpoints](#-api-endpoints)
- [🧪 Testing](#-testing)
- [📊 Project Status](#-project-status)

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+** and **Node.js LTS+**
- **Podman** (Docker alternative) with `podman-compose`
- **Xcode** (for iOS simulator - optional)

### One-Command Setup
```bash
# Complete development environment setup
make dev-setup
```

### Manual Setup
```bash
# 1. Clone and setup
git clone <repository-url>
cd SoulSync

# 2. Start database services
make db-up

# 3. Start backend (Terminal 1)
make backend

# 4. Start mobile app (Terminal 2)
make mobile

# 5. Access applications
# Backend: http://localhost:8000
# Mobile: http://localhost:8082
```

## 🏗️ Architecture

### **🗄️ Database Services (Podman Containers)**
- **PostgreSQL** (port 5433) - Primary database
- **Redis** (port 6380) - Cache and message broker
- **Qdrant** (port 6334) - Vector database for AI

### **💻 Development Services**
- **Backend API** (FastAPI) - http://localhost:8000
- **Mobile App** (Expo React Native) - http://localhost:8082
- **Celery Worker** - Background task processing

### **📱 Mobile Technology Stack**
- **Expo SDK 50** with React Native
- **TypeScript** for type safety
- **Expo Router** for navigation
- **Zustand** for state management
- **React Query** for API calls

### **🖥️ Backend Technology Stack**
- **FastAPI** with Python 3.11
- **SQLAlchemy** with Alembic migrations
- **Celery** for background tasks
- **Pydantic** for data validation

## 📱 Features

### **Core MVP Features**
- 🤖 **AI Chat Companion** - Personalized emotional support
- 👤 **User Profiles** - Personalized AI understanding
- 🎯 **Goal Tracking** - Progress monitoring and insights
- 👥 **Trust Circle** - Emergency contact management
- 📊 **Risk Assessment** - Mental health risk scoring
- 🔔 **Smart Notifications** - Timely interventions

### **Technical Features**
- 🔐 **OAuth Authentication** (Google & Apple)
- 📱 **Cross-platform** (iOS, Android, Web)
- 🧠 **AI Memory System** - Contextual conversations
- 📈 **Progress Analytics** - User insights and trends
- 🚨 **Crisis Detection** - Automated risk monitoring

## ⚙️ Development Setup

### **Environment Setup**
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### **Database Setup**
```bash
# Start database containers
make db-up

# Run migrations
make migrate

# Verify database connection
make health
```

### **Backend Development**
```bash
cd apps/backend

# Start API server
make backend

# Start Celery worker (separate terminal)
make celery

# Run database migrations
make migrate

# Create new migration
make migrate-create MSG="migration description"
```

### **Mobile Development**
```bash
cd apps/mobile

# Start development server
make mobile

# Platform-specific
make mobile-ios      # iOS simulator
make mobile-android  # Android emulator

# Web version
npx expo start --web --port 8082 --clear
```

## 🔧 Configuration

### **Environment Variables**
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/soulsync_dev

# Services
REDIS_URL=redis://localhost:6380/0
QDRANT_URL=http://localhost:6334

# API Keys (Phase 1+)
OPENAI_API_KEY=your_openai_key
FIREBASE_SERVICE_ACCOUNT_JSON=path/to/service-account.json

# Mobile Development
EXPO_PUBLIC_API_URL=http://localhost:8000
```

### **Port Configuration**
| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5433 | Database |
| Redis | 6380 | Cache/Messages |
| Qdrant | 6334 | Vector DB |
| Backend API | 8000 | FastAPI |
| Mobile App | 8082 | Expo Web |
| PgAdmin | 8081 | Database Admin |

## 📚 Documentation

### **Core Documentation**
- [📖 Setup Guide](./SETUP.md) - Complete setup instructions
- [🏗️ Technical Architecture](./Docs/05_Technical_Architecture.md) - System design
- [📊 Database Design](./Docs/06_Database_Design.md) - Data model
- [🚀 MVP Implementation Plan](./Docs/08_MVP_Implementation_Plan.md) - Development roadmap

### **Development Documentation**
- [🎯 Foundation Context](./Docs/01_Foundation_Context.md) - Product vision
- [🤖 AI Intelligence Model](./Docs/02_AI_Intelligence_and_Memory_Model.md) - AI system
- [⚡ Feature Workflows](./Docs/03_Feature_and_Workflow_Context.md) - Feature design
- [📱 User Journey](./Docs/07_User_Journey_and_App_Flow.md) - User experience

### **API Documentation**
- **Health Check**: `GET /health` - Service status
- **Detailed Health**: `GET /health/detailed` - Service details
- **API Docs**: `http://localhost:8000/docs` - Interactive docs

## 🚦 API Endpoints

### **Health Endpoints**
```bash
# Basic health check
curl http://localhost:8000/health

# Detailed service status
curl http://localhost:8000/health/detailed
```

### **Authentication (Phase 1)**
```bash
# Google OAuth login
POST /auth/google

# Apple OAuth login
POST /auth/apple

# User profile
GET /auth/profile
```

### **User Management (Phase 1)**
```bash
# Create user profile
POST /users/profile

# Get user profile
GET /users/{user_id}/profile

# Update user profile
PUT /users/{user_id}/profile
```

## 🧪 Testing

### **Backend Testing**
```bash
cd apps/backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test
pytest tests/test_auth.py
```

### **Mobile Testing**
```bash
cd apps/mobile

# Run Jest tests
npm test

# Run with coverage
npm run test:coverage

# Type checking
npm run type-check
```

### **Integration Testing**
```bash
# Test all services
make health

# Test database connection
make test-db

# Test API endpoints
make test-api
```

## 📊 Project Status

### **✅ Phase 0 Complete** (Foundation)
- [x] Repository structure and configuration
- [x] Database services (PostgreSQL, Redis, Qdrant)
- [x] Backend API skeleton with health endpoints
- [x] Mobile app structure with Expo Router
- [x] Development environment and tooling
- [x] Documentation and setup guides

### **🔄 Phase 1 In Progress** (Auth & Profile)
- [ ] User authentication (Google & Apple OAuth)
- [ ] User profile management
- [ ] Onboarding flow
- [ ] Basic UI components
- [ ] API integration

### **📋 Upcoming Phases**
- **Phase 2**: Chat & AI Integration
- **Phase 3**: Goals & Progress Tracking
- **Phase 4**: Trust Circle & Notifications
- **Phase 5**: Risk Assessment & Interventions

## 🤝 Contributing

### **Development Workflow**
1. **Setup**: `make dev-setup`
2. **Create Feature Branch**: `git checkout -b feature/name`
3. **Develop**: Make changes with tests
4. **Test**: `make test`
5. **Commit**: `git commit -m "feat: add feature"`
6. **Push**: `git push origin feature/name`
7. **PR**: Create pull request

### **Code Standards**
- **Python**: Follow PEP 8, use Black formatting
- **TypeScript**: Strict mode, ESLint + Prettier
- **Commits**: Conventional commit format
- **Tests**: Minimum 80% coverage

### **Getting Help**
- 📖 **Setup Guide**: [SETUP.md](./SETUP.md)
- 🐛 **Issues**: Check troubleshooting section
- 💬 **Discussions**: GitHub Discussions
- 📧 **Support**: Create GitHub issue

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Expo Team** - React Native development platform
- **FastAPI** - Modern Python web framework
- **Podman** - Container runtime
- **OpenAI** - AI model integration

---

**🧘‍♀️ SoulSync** - Your AI Mental Health Companion

*Built with ❤️ for better mental health support*
