"""Gemini conversational layer (E7-5).

The LLM is used ONLY to parse a free-text request into structured filters (or to
ask a clarifying question) — never as the recommender core. Our own pipeline does
the actual ranking; Gemini just turns natural language into intent + a friendly reply.
Key is read from backend/.env (gitignored).
"""

import json
import os
import time
import urllib.error
import urllib.request

from .tmdb import load_env

MODEL = "gemini-flash-lite-latest"   # fast + responsive for intent parsing
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

_GENRES = ("Action, Adventure, Animation, Children, Comedy, Crime, Documentary, Drama, "
           "Fantasy, Film-Noir, Horror, Musical, Mystery, Romance, Sci-Fi, Thriller, War, Western")

SYSTEM = (
    "You are CineMatch's movie concierge for a MovieLens-based recommender. "
    "The user tells you what they feel like watching. If the request is clear enough, set "
    "action='recommend' and extract structured filters. If it is too vague (e.g. 'recommend "
    "something'), set action='ask' and put ONE short, friendly clarifying question in 'reply'. "
    "When recommending, 'reply' is a short, warm one-sentence intro. Map mood/vibe to genres + "
    "keywords. 'explore' is 0 (safe/familiar) to 1 (adventurous/novel). "
    f"Only use these genres: {_GENRES}. Keywords are lowercase themes (e.g. heist, time travel, "
    "dystopia, coming of age). Respond ONLY as JSON."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ["recommend", "ask"]},
        "reply": {"type": "string"},
        "genres": {"type": "array", "items": {"type": "string"}},
        "exclude_genres": {"type": "array", "items": {"type": "string"}},
        "keywords": {"type": "array", "items": {"type": "string"}},
        "explore": {"type": "number"},
        "era": {"type": "string", "enum": ["any", "recent", "classic"]},
    },
    "required": ["action", "reply"],
}


def api_key():
    load_env()
    return os.environ.get("GEMINI_API_KEY")


def parse_intent(messages):
    """messages: [{role:'user'|'assistant', text}]. Returns parsed intent dict or None."""
    key = api_key()
    if not key:
        return None
    contents = [{"role": "user" if m["role"] == "user" else "model",
                 "parts": [{"text": m["text"]}]} for m in messages]
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM}]},
        "contents": contents,
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": SCHEMA,
            "temperature": 0.4,
        },
    }
    data = json.dumps(body).encode()
    for attempt in range(3):                      # retry transient 429/500/503
        req = urllib.request.Request(
            URL, data=data,
            headers={"Content-Type": "application/json", "X-goog-api-key": key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                d = json.load(r)
            text = d["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 2:
                time.sleep(1.0 * (attempt + 1))
                continue
            return None
        except Exception:
            if attempt < 2:
                time.sleep(0.8)
                continue
            return None
    return None
