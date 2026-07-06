# Civic Assistant Agent (Python)

This is the AI agent for the Community Hero chatbot — moved out of the
browser and rewritten in Python so the Gemini keys never sit in frontend
code or a bundle.

It is a small standalone FastAPI service. It is NOT the old NestJS
backend-core (that has been removed) — just this one agent, nothing else
(no Postgres/Redis/RabbitMQ/Docker needed to run it).

## Setup

```bash
cd agent
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # then put your real Gemini keys in .env
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

The `web-dashboard`'s `vite.config.ts` proxies `/api/gemini/agent` to
`http://localhost:8000/agent`, so run this alongside `npm run dev` in
`web-dashboard`. The browser never sees the Gemini URL or key — only the
local `/api/gemini/agent` path shows up in the Network tab.
