"""
Civic Assistant agent (Community Hero) — LangChain edition.

Same external contract as before (POST /agent -> {configured, text|error}),
same system instruction / civic-issue-collection behaviour, same Gemini key
rotation on failure. What's new:

- Built on LangChain (ChatGoogleGenerativeAI) instead of raw `requests` calls.
- Real server-side conversation memory: each session_id gets its own
  LangChain message history, so the agent remembers the conversation itself
  instead of only trusting whatever history the frontend resends.

Run with:
    uvicorn main:app --reload --port 8000
"""
import os
from threading import Lock
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from langchain_core.messages import SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

PLACEHOLDER_KEYS = {
    "YOUR_GEMINI_KEY_1",
    "YOUR_GEMINI_KEY_2",
    "YOUR_GEMINI_KEY_3",
    "YOUR_GEMINI_KEY_4",
    "YOUR_GEMINI_KEY_5",
}



def load_keys() -> list[str]:
    raw = os.getenv("GEMINI_API_KEYS", "")
    return [k.strip() for k in raw.split(",") if k.strip() and k.strip() not in PLACEHOLDER_KEYS]


# ---------------------------------------------------------------------------
# Memory system: one LangChain message history per session_id, kept in
# process memory. Swap InMemoryChatMessageHistory for a Redis/DB-backed
# history later if the agent ever needs to survive a restart.
# ---------------------------------------------------------------------------
_HISTORY_STORE: dict[str, InMemoryChatMessageHistory] = {}
_STORE_LOCK = Lock()


def get_session_history(session_id: str) -> BaseChatMessageHistory:
    with _STORE_LOCK:
        if session_id not in _HISTORY_STORE:
            _HISTORY_STORE[session_id] = InMemoryChatMessageHistory()
        return _HISTORY_STORE[session_id]


app = FastAPI(title="Community Hero - Civic Assistant Agent")

# Only the local Vite dev server calls this; kept permissive for local dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
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


def build_chain(system_text: str, api_key: str) -> RunnableWithMessageHistory:
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
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

    for i, active_key in enumerate(keys):
        try:
            chain = build_chain(system_instruction, active_key)
            result = chain.invoke(
                {"input": user_text},
                config={"configurable": {"session_id": session_id}},
            )
            text = getattr(result, "content", None)
            if text:
                return text
            print(f"Gemini key index {i} returned an empty response. Rotating key...")
        except Exception as err:  # noqa: BLE001
            print(f"Gemini key index {i} threw error: {err}")

    raise RuntimeError("All configured Gemini API keys failed or returned errors.")


@app.post("/agent")
def agent(req: AgentRequest):
    if not load_keys():
        return {"configured": False}

    user_text = req.messages[-1].parts[0].text if req.messages else ""
    try:
        text = fetch_agent_reply(user_text, req.draftReport, req.session_id)
        return {"configured": True, "text": text}
    except Exception as err:  # noqa: BLE001
        return {"configured": True, "error": str(err)}
