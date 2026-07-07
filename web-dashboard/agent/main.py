"""
Civic Assistant agent (Community Hero) — LangChain edition, hardened.

Same external contract as before (POST /agent -> {configured, text|error}),
same system instruction / civic-issue-collection behaviour. What's new in
this pass, on top of the LangChain memory rewrite:

- Two-dimensional fallback: for each model in MODEL_FALLBACK_CHAIN, every
  configured Gemini key is tried before moving to the next model. This
  spreads load across each model's own RPM/RPD bucket instead of hammering
  a single model until it's exhausted.
- Output validation: since the LLM is asked for raw JSON, we verify it
  actually IS valid JSON (stripping accidental ```json fences) before
  returning it. If a (key, model) pair returns malformed JSON, that's
  treated as a failure and we rotate — instead of shipping broken JSON to
  the frontend, which would silently fail JSON.parse() client-side.
- Session memory hygiene: history is trimmed to the last N messages after
  every successful turn, and stale sessions (no activity for a while) are
  pruned lazily, so a long-running dev server doesn't accumulate unbounded
  memory across many session_ids.
- Guardrails: empty input and oversized input are rejected before ever
  calling Gemini, so they don't burn quota or trigger an unwanted call.
- Structured logging instead of bare prints, so failures are diagnosable
  without guessing which key/model/session was involved.

Run with:
    uvicorn main:app --reload --port 8000
"""
import json
import logging
import os
import time
from collections import deque
from threading import Lock
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from langchain_core.messages import SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("civic_assistant")

# ---------------------------------------------------------------------------
# Config / constants
# ---------------------------------------------------------------------------

PLACEHOLDER_KEYS = {
    "YOUR_GEMINI_KEY_1",
    "YOUR_GEMINI_KEY_2",
    "YOUR_GEMINI_KEY_3",
    "YOUR_GEMINI_KEY_4",
    "YOUR_GEMINI_KEY_5",
}

# Ordered fallback chain of text-out Gemini models (JSON-output capable).
# Tried in this order — for each model we exhaust every configured key
# before moving on. Only "Text-out models" category from the quota
# dashboard is included; Live API / TTS / Image / Embedding models don't
# fit this agent's response_mime_type="application/json" use-case.
MODEL_FALLBACK_CHAIN = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
]

# Keep only the last N messages per session so a long conversation doesn't
# quietly balloon token usage / memory forever.
MAX_HISTORY_MESSAGES = 20

# Sessions with no activity for this long get pruned on the next request.
SESSION_TTL_SECONDS = 2 * 60 * 60  # 2 hours

# Reject absurdly long single messages before ever calling Gemini.
MAX_INPUT_CHARS = 4000

# --- Abuse / flood protection (kicks in BEFORE any Gemini call is made) ---
# session_id is the one signal we actually control end-to-end (the frontend
# sets it), so it's the primary line of defense. IP is best-effort: since
# the Vite dev server proxies requests server-side, request.client.host will
# usually just be Vite's own host unless Vite is configured to forward the
# real client IP via X-Forwarded-For — treat it as a bonus layer, not the
# main one. The global ceiling is the backstop: it caps total Gemini spend
# even if someone rotates session_ids to dodge the per-session limit.
RATE_LIMIT_WINDOW_SECONDS = 60
MAX_REQUESTS_PER_SESSION = 10   # one session_id, per window
MAX_REQUESTS_PER_IP = 20        # one client IP, per window
MAX_REQUESTS_GLOBAL = 60        # every request, all sessions/IPs combined, per window


def load_keys() -> list[str]:
    raw = os.getenv("GEMINI_API_KEYS", "")
    keys = [k.strip() for k in raw.split(",") if k.strip() and k.strip() not in PLACEHOLDER_KEYS]
    return keys


# ---------------------------------------------------------------------------
# Memory system: one LangChain message history per session_id, kept in
# process memory. Swap InMemoryChatMessageHistory for a Redis/DB-backed
# history later if the agent ever needs to survive a restart.
#
# NOTE: this is intentionally simple (no per-session lock around read+append
# during RunnableWithMessageHistory's internal writes). Fine for a solo/demo
# setup with one browser tab per session_id; if this agent is ever exposed
# to real concurrent multi-tab traffic on the SAME session_id, add a
# per-session lock around the invoke call.
# ---------------------------------------------------------------------------
_HISTORY_STORE: dict[str, InMemoryChatMessageHistory] = {}
_LAST_ACCESS: dict[str, float] = {}
_STORE_LOCK = Lock()

# Sliding-window hit counters for flood protection. Each deque holds the
# timestamps of recent requests for that key; entries older than the window
# are dropped lazily whenever that key is touched again.
_SESSION_HITS: dict[str, deque] = {}
_IP_HITS: dict[str, deque] = {}
_GLOBAL_HITS: deque = deque()
_RATE_LOCK = Lock()


def _prune_stale_sessions() -> None:
    now = time.time()
    stale = [sid for sid, last in _LAST_ACCESS.items() if now - last > SESSION_TTL_SECONDS]
    for sid in stale:
        _HISTORY_STORE.pop(sid, None)
        _LAST_ACCESS.pop(sid, None)
    if stale:
        logger.info(f"Pruned {len(stale)} stale session(s): {stale}")


def get_session_history(session_id: str) -> BaseChatMessageHistory:
    with _STORE_LOCK:
        _prune_stale_sessions()
        _LAST_ACCESS[session_id] = time.time()
        if session_id not in _HISTORY_STORE:
            _HISTORY_STORE[session_id] = InMemoryChatMessageHistory()
        return _HISTORY_STORE[session_id]


def _trim_session_history(session_id: str) -> None:
    with _STORE_LOCK:
        history = _HISTORY_STORE.get(session_id)
        if history and len(history.messages) > MAX_HISTORY_MESSAGES:
            history.messages = history.messages[-MAX_HISTORY_MESSAGES:]


def _within_limit(bucket: dict[str, deque], key: str, limit: int, now: float) -> bool:
    """Prunes old timestamps for `key` and checks whether one more request
    would still fit under `limit` in the current window. If it fits, the
    hit is recorded immediately (so the check itself is the increment)."""
    dq = bucket.setdefault(key, deque())
    while dq and now - dq[0] > RATE_LIMIT_WINDOW_SECONDS:
        dq.popleft()
    if len(dq) >= limit:
        return False
    dq.append(now)
    return True


def _check_rate_limits(session_id: str, client_ip: str) -> Optional[str]:
    """Returns a short reason string ("global" / "session" / "ip") if this
    request should be rejected, or None if it's allowed. Checked BEFORE any
    Gemini call, so a flood never touches quota at all."""
    now = time.time()
    with _RATE_LOCK:
        while _GLOBAL_HITS and now - _GLOBAL_HITS[0] > RATE_LIMIT_WINDOW_SECONDS:
            _GLOBAL_HITS.popleft()
        if len(_GLOBAL_HITS) >= MAX_REQUESTS_GLOBAL:
            return "global"

        if not _within_limit(_SESSION_HITS, session_id, MAX_REQUESTS_PER_SESSION, now):
            return "session"

        if not _within_limit(_IP_HITS, client_ip, MAX_REQUESTS_PER_IP, now):
            return "ip"

        _GLOBAL_HITS.append(now)
    return None


app = FastAPI(title="Community Hero - Civic Assistant Agent")

# Only the local Vite dev server calls this; kept permissive for local dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class ChatPart(BaseModel):
    text: str


class ChatMessage(BaseModel):
    role: str
    parts: list[ChatPart]


class DraftReport(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    colony_area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AgentRequest(BaseModel):
    messages: list[ChatMessage] = []
    draftReport: DraftReport = DraftReport()
    # Lets a client isolate its own conversation memory. Optional — if the
    # frontend never sends one, everyone shares the "default" session, which
    # is fine for solo local testing/demos.
    session_id: str = "default"


def build_system_instruction(draft: DraftReport) -> str:
    colony_or_coords = draft.colony_area or (
        f"{draft.latitude}, {draft.longitude}" if draft.latitude else "Not specified"
    )
    return f"""
You are the Civic Assistant for the 'Community Hero' hyperlocal problem solver platform in India.
Your job is to act as an intelligent AI assistant.
You must ONLY discuss topics related to the Community Hero platform, civic issues, reporting problems (potholes, waste, water leak, infrastructure, etc.), urban improvements, and general engagement on this platform.
Reject off-topic questions (e.g. general knowledge, math, general programming, other websites, general advice) politely. Example: "I am a Civic Assistant for Community Hero. I can only assist you with reporting or discussing local civic issues."

Your goal is to converse with the user and collect the following fields to report a civic issue:
1. category: MUST be one of: "Pothole", "Waste", "Water Leak", "Broken Infrastructure", "Graffiti", "Other".
2. description: Details of the issue.
3. severity: MUST be one of: "Minor", "Medium", "Severe". Default to "Medium" if unspecified.
4. colony_area: Colony name or coordinates representation.

Currently collected details from prior turns (use these to avoid asking duplicates):
- Category: {draft.category or 'Not specified'}
- Description: {draft.description or 'Not specified'}
- Severity: {draft.severity or 'Not specified'}
- Colony/Location: {colony_or_coords}

Instructions:
1. Talk naturally. Be conversational. Respond to greetings and platform questions.
2. If they are reporting an issue, look at what is missing and ask for it.
3. If they shared location coords (e.g., '27.21793, 77.47152' or 'My location: 28.5, 77.2'), parse them.
4. You MUST format your entire response as a single valid JSON object containing exactly these keys:
{{
  "reply": "Your conversational message to the user",
  "extractedInfo": {{
    "category": "Pothole" | "Waste" | "Water Leak" | "Broken Infrastructure" | "Graffiti" | "Other" | null,
    "description": "description text" | null,
    "severity": "Minor" | "Medium" | "Severe" | null,
    "colony_area": "colony name" | null,
    "latitude": number | null,
    "longitude": number | null
  }},
  "readyToSubmit": boolean
}}
Do NOT wrap the response in markdown blocks. Return only raw JSON.
"""


def _canned_json_reply(reply: str) -> str:
    """Build a schema-shaped JSON string without calling the LLM at all —
    used for guardrail cases (empty / oversized input) so we don't burn
    quota or trigger a call for input that was never going to be useful."""
    return json.dumps(
        {
            "reply": reply,
            "extractedInfo": {
                "category": None,
                "description": None,
                "severity": None,
                "colony_area": None,
                "latitude": None,
                "longitude": None,
            },
            "readyToSubmit": False,
        }
    )


def _clean_json_or_none(raw_text: str) -> Optional[str]:
    """Strip accidental markdown fences and confirm the result really is
    valid JSON. Returns the cleaned JSON string, or None if it still isn't
    parseable (caller should treat that as a failed attempt and rotate)."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    return cleaned


def _describe_error(err: Exception) -> str:
    """Best-effort classification of a Gemini call failure, without adding
    a hard dependency on google.api_core's exception hierarchy (which may
    shift between library versions). Purely for clearer log lines."""
    name = type(err).__name__
    message = str(err)
    if "ResourceExhausted" in name or "429" in message:
        return "quota/rate-limit exceeded"
    if any(term in name for term in ("PermissionDenied", "Unauthenticated", "InvalidArgument")):
        return "invalid/unauthorized key"
    return "unexpected error"


def build_chain(system_text: str, api_key: str, model_name: str) -> RunnableWithMessageHistory:
    llm = ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key,
        response_mime_type="application/json",
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            SystemMessage(content=system_text),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ]
    )
    chain = prompt | llm
    return RunnableWithMessageHistory(
        chain,
        get_session_history,
        input_messages_key="input",
        history_messages_key="history",
    )


def fetch_agent_reply(user_text: str, draft: DraftReport, session_id: str) -> str:
    keys = load_keys()
    if not keys:
        raise RuntimeError("No configured Gemini API keys found.")

    system_instruction = build_system_instruction(draft)

    for model_name in MODEL_FALLBACK_CHAIN:
        for i, active_key in enumerate(keys):
            try:
                chain = build_chain(system_instruction, active_key, model_name)
                result = chain.invoke(
                    {"input": user_text},
                    config={"configurable": {"session_id": session_id}},
                )
                raw_text = getattr(result, "content", None)

                if not raw_text:
                    logger.warning(f"[{model_name}] key #{i} returned an empty response. Rotating key...")
                    continue

                cleaned = _clean_json_or_none(raw_text)
                if cleaned is None:
                    logger.warning(
                        f"[{model_name}] key #{i} returned non-JSON output despite "
                        f"response_mime_type=json. Treating as failure, rotating..."
                    )
                    continue

                _trim_session_history(session_id)
                logger.info(f"[{model_name}] key #{i} succeeded for session '{session_id}'.")
                return cleaned

            except Exception as err:  # noqa: BLE001
                logger.warning(f"[{model_name}] key #{i} failed ({_describe_error(err)}): {err}")

        logger.info(f"Model '{model_name}' exhausted across all {len(keys)} key(s). Falling back to next model...")

    raise RuntimeError("All configured Gemini models/keys failed or returned errors.")


@app.get("/health")
def health():
    keys = load_keys()
    with _STORE_LOCK:
        active_sessions = len(_HISTORY_STORE)
    return {
        "status": "ok",
        "configured": bool(keys),
        "num_keys": len(keys),
        "model_fallback_chain": MODEL_FALLBACK_CHAIN,
        "active_sessions": active_sessions,
        "rate_limits": {
            "window_seconds": RATE_LIMIT_WINDOW_SECONDS,
            "per_session": MAX_REQUESTS_PER_SESSION,
            "per_ip": MAX_REQUESTS_PER_IP,
            "global": MAX_REQUESTS_GLOBAL,
        },
    }


@app.post("/agent")
def agent(req: AgentRequest, request: Request):
    if not load_keys():
        return {"configured": False}

    client_ip = request.headers.get("x-forwarded-for", "")
    if not client_ip:
        client_ip = request.client.host if request.client else "unknown"
    client_ip = client_ip.split(",")[0].strip()

    rejected_by = _check_rate_limits(req.session_id, client_ip)
    if rejected_by:
        logger.warning(
            f"Rate limit hit ({rejected_by}) — session='{req.session_id}' ip='{client_ip}'. Blocked before any Gemini call."
        )
        return {
            "configured": True,
            "text": _canned_json_reply(
                "You're sending messages a little too quickly — please wait a moment "
                "and try again."
            ),
        }

    user_text = req.messages[-1].parts[0].text if req.messages else ""
    user_text = user_text.strip()

    if not user_text:
        logger.info(f"Empty input for session '{req.session_id}' — skipping Gemini call.")
        return {
            "configured": True,
            "text": _canned_json_reply(
                "Hi! I'm the Civic Assistant for Community Hero. Tell me about a civic "
                "issue you'd like to report — a pothole, waste, a water leak, or "
                "anything similar."
            ),
        }

    if len(user_text) > MAX_INPUT_CHARS:
        logger.info(f"Oversized input ({len(user_text)} chars) for session '{req.session_id}' — rejecting before LLM call.")
        return {
            "configured": True,
            "text": _canned_json_reply(
                "That message is a bit too long for me to process — could you shorten "
                "it and send it again?"
            ),
        }

    try:
        text = fetch_agent_reply(user_text, req.draftReport, req.session_id)
        return {"configured": True, "text": text}
    except Exception as err:  # noqa: BLE001
        logger.error(f"All fallbacks exhausted for session '{req.session_id}': {err}")
        return {"configured": True, "error": str(err)}
