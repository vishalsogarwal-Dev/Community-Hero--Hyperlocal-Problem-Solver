# Civic Assistant Agent

Python/FastAPI + LangChain backend for the Community Hero chatbot. Keeps
Gemini API keys server-side (never shipped to the browser), rotates across
keys and models, rate-limits abuse, and validates that the LLM's JSON output
is actually valid JSON before returning it.

## Run locally (venv)

```bash
cd web-dashboard/agent
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then edit .env with real Gemini keys
uvicorn main:app --reload --port 8000
```

## Contract

`POST /agent`
```json
{
  "messages": [{"role": "user", "parts": [{"text": "..."}]}],
  "draftReport": {"category": null, "description": null, "severity": null, "colony_area": null, "latitude": null, "longitude": null},
  "session_id": "some-id"
}
```
Returns `{"configured": bool, "text": "<json string>"}` or `{"configured": true, "error": "..."}`.

`GET /health` — key count, model fallback chain, active sessions, rate-limit config.
