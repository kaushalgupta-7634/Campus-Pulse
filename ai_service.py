"""
AI Service module for Campus Pulse.
Integrates Google Gemini using the official google-genai SDK.
Extracts structured information from messy, unstructured campus notices.
"""

import os
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional
from dotenv import load_dotenv

import logging
import hashlib
import time

logger = logging.getLogger("campus_pulse.ai_service")

# Ensure environment variables are loaded
load_dotenv()

# Singleton cached client instance
_client_instance = None
_client_api_key = None

# In-memory digest cache with TTL
_digest_cache = {
    "hash": None,
    "timestamp": 0.0,
    "data": None
}
DIGEST_CACHE_TTL_SECONDS = 180.0  # 3 minutes


def get_gemini_client():
    """Initializes and returns the cached google-genai Client using GEMINI_API_KEY."""
    global _client_instance, _client_api_key
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    if _client_instance is None or _client_api_key != api_key:
        from google import genai
        _client_instance = genai.Client(api_key=api_key)
        _client_api_key = api_key
        logger.info("Initialized Google GenAI singleton client.")

    return _client_instance


def extract_notice_with_gemini(raw_text: str) -> Dict[str, Any]:
    """
    Uses Gemini to extract structured event fields from raw notice text.
    Returns a dictionary with title, event_date, event_time, venue, category, is_urgent, confidence_summary.
    """
    client = get_gemini_client()
    today_str = datetime.now().strftime("%Y-%m-%d")

    # If API key is not configured, return an informative fallback
    if not client:
        return fallback_local_extraction(
            raw_text,
            notice="GEMINI_API_KEY is not set in .env. Extracted using basic local pattern matching. Add your key to .env for AI extraction."
        )

    from google.genai import types

    prompt = f"""
You are an intelligent campus notice extraction assistant for "Campus Pulse".
Extract the core details from the following messy, unstructured campus notice into a clean JSON structure.

Current Reference Date: {today_str}

Notice Text:
\"\"\"
{raw_text}
\"\"\"

Return a valid JSON object matching this structure:
{{
    "title": "Concise, descriptive title (max 8-10 words)",
    "event_date": "YYYY-MM-DD format if mentioned, otherwise null",
    "event_time": "Event time or deadline (e.g. '10:00 AM' or '11:59 PM') or null",
    "venue": "Location, hall, classroom or 'Online' or null",
    "category": "One of: 'Exam/Deadline', 'Club/Cultural', 'Placement', 'Academic', 'Sports', 'General'",
    "is_urgent": true or false (true if deadline is imminent or contains urgent keywords like LAST DATE, MANDATORY, URGENT),
    "confidence_summary": "One sentence summary of the notice and student action required"
}}
"""

    models_to_try = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"]
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )

            response_text = response.text
            if response_text:
                data = json.loads(response_text)
                return {
                    "success": True,
                    "model_used": model_name,
                    "data": {
                        "title": data.get("title") or "Campus Announcement",
                        "event_date": data.get("event_date"),
                        "event_time": data.get("event_time"),
                        "venue": data.get("venue"),
                        "category": sanitize_category(data.get("category")),
                        "is_urgent": bool(data.get("is_urgent", False)),
                        "confidence_summary": data.get("confidence_summary", "")
                    }
                }
        except Exception as e:
            last_error = e
            continue

    # If all models failed or encountered quota/network errors, gracefully fall back
    return fallback_local_extraction(
        raw_text,
        notice=f"Gemini API request failed ({str(last_error)}). Extracted using local fallback."
    )


def sanitize_category(category: Optional[str]) -> str:
    """Ensures category is one of the supported standard categories."""
    valid_categories = [
        "Exam/Deadline",
        "Club/Cultural",
        "Placement",
        "Academic",
        "Sports",
        "General"
    ]
    if not category:
        return "General"
    for valid in valid_categories:
        if valid.lower() in category.lower():
            return valid
    return "General"


def fallback_local_extraction(raw_text: str, notice: str = "") -> Dict[str, Any]:
    """
    Graceful fallback pattern-based parser when Gemini API key is missing or offline.
    Ensures the student can still test the input workflow.
    """
    text_lower = raw_text.lower()
    
    # Simple title extraction: first non-empty line or first 60 chars
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    first_line = lines[0] if lines else "New Campus Notice"
    # Clean emojis or forward tags from first line
    cleaned_title = re.sub(r'^[\[\(\*]+.*?[\)\]\*]+', '', first_line).strip()
    if len(cleaned_title) > 65 or not cleaned_title:
        cleaned_title = cleaned_title[:62] + "..." if len(cleaned_title) > 65 else "Campus Notice"

    # Detect category from keywords
    category = "General"
    if any(k in text_lower for k in ["exam", "test", "quiz", "submission", "deadline", "hall ticket", "fees"]):
        category = "Exam/Deadline"
    elif any(k in text_lower for k in ["fest", "club", "cultural", "hackathon", "workshop", "audition"]):
        category = "Club/Cultural"
    elif any(k in text_lower for k in ["placement", "interview", "resume", "internship", "package", "hiring"]):
        category = "Placement"
    elif any(k in text_lower for k in ["class", "lecture", "assignment", "syllabus", "prof", "hod"]):
        category = "Academic"
    elif any(k in text_lower for k in ["sports", "cricket", "football", "badminton", "tournament", "match"]):
        category = "Sports"

    # Detect urgency
    is_urgent = any(k in text_lower for k in ["urgent", "today", "tomorrow", "mandatory", "immediate", "last date", "deadline"])

    # Basic date matching (YYYY-MM-DD or DD/MM/YYYY)
    date_match = re.search(r'\b(202\d[-/]\d{1,2}[-/]\d{1,2})\b', raw_text)
    event_date = date_match.group(1).replace('/', '-') if date_match else None

    # Basic time matching
    time_match = re.search(r'\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))\b', raw_text)
    event_time = time_match.group(1) if time_match else None

    # Venue detection
    venue = None
    venue_match = re.search(r'(?:venue|at|in|location)\s*[:\-]?\s*([A-Za-z0-9\s,\-\(\)]+?)(?:\.|\n|$)', raw_text, re.IGNORECASE)
    if venue_match:
        venue = venue_match.group(1).strip()[:50]

    return {
        "success": True,
        "is_fallback": True,
        "notice": notice,
        "data": {
            "title": cleaned_title,
            "event_date": event_date,
            "event_time": event_time,
            "venue": venue,
            "category": category,
            "is_urgent": is_urgent,
            "confidence_summary": "Extracted via local pattern matching."
        }
    }


def generate_weekly_digest(notices: list, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Synthesizes active campus notices into a concise, actionable weekly digest for students.
    Features in-memory fingerprint caching to avoid redundant API calls and optimize latency.
    """
    if not notices:
        return {
            "success": True,
            "headline": "Quiet Week Ahead on Campus 🍃",
            "overview": "There are currently no active notices or deadlines on the board. Enjoy the peaceful week!",
            "urgent_deadlines": [],
            "key_events": [],
            "pro_tip": "Stay tuned or use Smart Input when you receive new announcements on your WhatsApp groups."
        }

    # Compute fingerprint of current notices
    fingerprint_raw = json.dumps(
        sorted([(n.get("id"), n.get("is_urgent"), n.get("event_date"), n.get("title")) for n in notices], key=lambda x: str(x[0]))
    )
    current_hash = hashlib.md5(fingerprint_raw.encode()).hexdigest()
    now = time.time()

    # Return cached digest if notices haven't changed and TTL is valid
    if not force_refresh and _digest_cache["hash"] == current_hash and (now - _digest_cache["timestamp"]) < DIGEST_CACHE_TTL_SECONDS:
        if _digest_cache["data"]:
            logger.info("Serving weekly digest from in-memory cache (0ms latency).")
            return _digest_cache["data"]

    client = get_gemini_client()
    today_str = datetime.now().strftime("%Y-%m-%d")

    # If API key is not configured, generate a clean local summary
    if not client:
        result = fallback_weekly_digest(notices, is_fallback=True)
        _digest_cache["hash"] = current_hash
        _digest_cache["timestamp"] = now
        _digest_cache["data"] = result
        return result

    from google.genai import types

    # Prepare compact notice list for Gemini
    formatted_notices = []
    for n in notices:
        formatted_notices.append({
            "title": n.get("title"),
            "event_date": n.get("event_date") or "TBA",
            "event_time": n.get("event_time") or "",
            "venue": n.get("venue") or "",
            "category": n.get("category") or "General",
            "is_urgent": bool(n.get("is_urgent"))
        })

    prompt = f"""
You are the AI Campus Advisor for students using the "Campus Pulse" platform.
Review the following active campus notices and synthesize them into an executive, highly readable "What do I need to know this week?" briefing.

Reference Date: {today_str}

Active Campus Notices:
{json.dumps(formatted_notices, indent=2)}

Create an intelligent briefing with:
1. headline: A catchy, encouraging 1-sentence headline for this week.
2. overview: 2 sentences summarizing the overall tempo of the week (e.g. deadline heavy, fest preparation, exams).
3. urgent_deadlines: Array of items that need urgent action or are happening soon. Each item has:
   - title: Name of the event/deadline
   - date_time: Clean date & time string
   - action: 1 concise imperative instruction (e.g. "Submit before 11:59 PM online")
4. key_events: Array of notable campus events/talks/workshops. Each item has:
   - title: Event name
   - date_time: Clean date & time
   - venue: Location
   - category: Category tag
5. pro_tip: 1 practical, empathetic tip for college students this week.

Return valid JSON adhering to this exact schema:
{{
    "headline": "...",
    "overview": "...",
    "urgent_deadlines": [
        {{"title": "...", "date_time": "...", "action": "..."}}
    ],
    "key_events": [
        {{"title": "...", "date_time": "...", "venue": "...", "category": "..."}}
    ],
    "pro_tip": "..."
}}
"""

    models_to_try = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"]
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )

            if response.text:
                digest_data = json.loads(response.text)
                res_payload = {
                    "success": True,
                    "model_used": model_name,
                    "headline": digest_data.get("headline") or "Your Weekly Campus Briefing ⚡",
                    "overview": digest_data.get("overview") or "",
                    "urgent_deadlines": digest_data.get("urgent_deadlines") or [],
                    "key_events": digest_data.get("key_events") or [],
                    "pro_tip": digest_data.get("pro_tip") or ""
                }
                _digest_cache["hash"] = current_hash
                _digest_cache["timestamp"] = now
                _digest_cache["data"] = res_payload
                return res_payload
        except Exception as e:
            last_error = e
            continue

    # Fallback if API fails
    return fallback_weekly_digest(notices, error_note=str(last_error))


def fallback_weekly_digest(notices: list, is_fallback: bool = False, error_note: str = "") -> Dict[str, Any]:
    """Provides a coherent structured digest when Gemini API key is missing or offline."""
    urgent_items = [n for n in notices if n.get("is_urgent")]
    other_items = [n for n in notices if not n.get("is_urgent")]

    headline = f"Campus Briefing: {len(urgent_items)} Urgent Action{'s' if len(urgent_items) != 1 else ''} & {len(notices)} Total Events"
    overview = f"You have {len(notices)} active campus items tracked on the board. Make sure to prioritize the {len(urgent_items)} urgent deadlines highlighted below."

    formatted_urgent = []
    for u in urgent_items:
        date_str = u.get("event_date") or "Date TBA"
        if u.get("event_time"):
            date_str += f" ({u.get('event_time')})"
        formatted_urgent.append({
            "title": u.get("title"),
            "date_time": date_str,
            "action": f"Take note of venue: {u.get('venue') or 'Campus Portal'}"
        })

    formatted_events = []
    for o in other_items[:5]:
        date_str = o.get("event_date") or "Date TBA"
        if o.get("event_time"):
            date_str += f" ({o.get('event_time')})"
        formatted_events.append({
            "title": o.get("title"),
            "date_time": date_str,
            "venue": o.get("venue") or "Campus Location",
            "category": o.get("category") or "General"
        })

    return {
        "success": True,
        "is_fallback": is_fallback,
        "note": "Add your GEMINI_API_KEY in .env for full AI generative synthesis." if is_fallback else error_note,
        "headline": headline,
        "overview": overview,
        "urgent_deadlines": formatted_urgent,
        "key_events": formatted_events,
        "pro_tip": "Double-check submission links and venue timings at least 24 hours prior to scheduled deadlines."
    }
