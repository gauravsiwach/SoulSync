# SoulSync - Development Guidelines

This document defines the implementation standards for SoulSync MVP.

## Runtime Versions
- Python 3.11.15
- Node.js Current LTS
- PostgreSQL 16
- Redis 7
- Qdrant Latest Stable

## Technology Stack
- React Native + Expo + TypeScript
- FastAPI + LangGraph + Celery
- PostgreSQL + Qdrant + Redis
- GPT-4o, GPT-4o-mini, text-embedding-3-small
- Firebase Cloud Messaging
- Twilio SMS
- Docker + Docker Compose

## Repository Structure
soulsync/
├── apps/
│   ├── mobile/
│   └── backend/
├── packages/
├── infra/
├── docs/
├── .github/
├── docker-compose.yml
├── Makefile
└── README.md

## Core Rules
- MVP First
- Simplicity Over Scalability
- Monolith First
- Follow existing architecture
- No unnecessary frameworks
- Build only current phase

## Backend Structure
app/
├── api/v1/
├── core/
├── db/
├── models/
├── schemas/
├── repositories/
├── services/
├── agents/
├── workers/
├── websocket/
└── main.py

## Frontend Structure
app/
├── screens/
├── components/
├── navigation/
├── services/
├── stores/
├── hooks/
├── types/
└── assets/

## Coding Standards
Python: Type Hints, Black, Ruff
TypeScript: Strict Mode, ESLint, Prettier

## Definition of Done
- Code complete
- Validation added
- Error handling added
- Tests pass
- Docker works
- Acceptance criteria satisfied
