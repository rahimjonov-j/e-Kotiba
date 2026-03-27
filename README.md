# Online Kotiba (Fullstack AI Secretary)

Production-ready foundation for a mobile-first online secretary system with React + Express + Supabase + AI pipeline.

## Stack
- Frontend: React (Vite), JavaScript (JSX), Tailwind, shadcn-style UI, Zustand, TanStack Query
- Backend: Node.js + Express
- Database/Auth/Storage: Supabase PostgreSQL + Auth + Storage
- AI: UzbekVoice STT/TTS + OpenAI
- Deploy: Vercel (frontend) + Render/Railway (backend) + Supabase

## Monorepo structure
- `frontend/`: responsive admin web app
- `backend/`: secure API + scheduler jobs
- `supabase/schema.sql`: DB schema + RLS policies

## Quick start
1. Install dependencies:
```bash
npm install
```
2. Configure env files:
- Copy `backend/.env.example` -> `backend/.env`
- Copy `frontend/.env.example` -> `frontend/.env`
3. Apply Supabase SQL:
- Run `supabase/schema.sql` in Supabase SQL Editor
- Create storage bucket: `reminder-audio`
4. Start both apps:
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`

## Environment variables
### Backend (`backend/.env`)
- `PORT`
- `APP_ORIGIN`
- `CORS_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `UZBEKVOICE_STT_URL`
- `UZBEKVOICE_STT_API_KEY`
- `UZBEKVOICE_TTS_URL`
- `UZBEKVOICE_TTS_API_KEY`
- `TELEGRAM_BOT_TOKEN`

### Frontend (`frontend/.env`)
- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## API response contract
Every endpoint returns:
```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

## Implemented modules
- Auth/profile/settings
- Secretary pipeline (text + voice)
- Reminders (pre-generated TTS audio URL)
- Meetings (+auto-message job queue)
- Clients
- Expenses
- Dashboard analytics + AI recommendation text
- Admin overview
- Cron job processor (`system_jobs`)

## Deployment notes
- No hardcoded URLs. Use env vars only.
- Scheduler is backend-only (never frontend).
- Configure CORS allowlist via `CORS_ORIGINS`.
- Frontend can deploy to Vercel directly from `frontend/`.
- Backend can deploy to Render/Railway from `backend/` with start command:
```bash
npm start
```

## Important production hardening checklist
- Add Redis-backed queues (BullMQ) for high job volume
- Add retry dead-letter table for failed jobs
- Add Sentry/Logtail for central logging
- Add stricter zod schemas for settings/prompt management
- Add e2e tests for scheduler and reminder cadence correctness
- Add signed URL strategy if audio should not be public
