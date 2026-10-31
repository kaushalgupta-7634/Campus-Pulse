"""
Campus Pulse - Main Flask Application
Centralizes scattered campus notices and events into an intelligent dashboard.
"""

import os
from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv

import database
import ai_service

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)


@app.route("/")
def index():
    """Renders the main Campus Pulse dashboard."""
    return render_template("index.html")


@app.route("/api/notices", methods=["GET"])
def get_notices():
    """API endpoint to retrieve all notices."""
    try:
        notices = database.get_all_notices()
        return jsonify({"success": True, "notices": notices})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/notices", methods=["POST"])
def create_notice():
    """API endpoint to add a notice."""
    if not request.is_json:
        return jsonify({"success": False, "error": "Invalid JSON body"}), 400

    try:
        data = request.get_json(silent=True)
    except Exception:
        data = None

    if data is None or not isinstance(data, dict):
        return jsonify({"success": False, "error": "Invalid JSON body"}), 400

    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        return jsonify({"success": False, "error": "Title is required"}), 400

    try:
        notice_id = database.insert_notice(
            title=title.strip(),
            event_date=data.get("event_date"),
            event_time=data.get("event_time"),
            venue=data.get("venue"),
            category=data.get("category", "General"),
            is_urgent=1 if data.get("is_urgent") else 0,
            raw_text=data.get("raw_text", "")
        )
        return jsonify({"success": True, "notice_id": notice_id}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/notices/<int:notice_id>", methods=["DELETE"])
def delete_notice(notice_id: int):
    """API endpoint to delete a notice by ID."""
    try:
        deleted = database.delete_notice_by_id(notice_id)
        if deleted:
            return jsonify({"success": True, "message": "Notice deleted successfully"})
        return jsonify({"success": False, "error": "Notice not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/notices/<int:notice_id>/urgency", methods=["PATCH"])
def toggle_urgency(notice_id: int):
    """API endpoint to toggle the urgent priority status of a notice."""
    try:
        new_urgent = database.toggle_notice_urgency(notice_id)
        if new_urgent is not None:
            return jsonify({
                "success": True,
                "notice_id": notice_id,
                "is_urgent": new_urgent,
                "message": f"Notice marked as {'Urgent' if new_urgent else 'Standard'}"
            })
        return jsonify({"success": False, "error": "Notice not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/extract", methods=["POST"])
def extract_notice():
    """API endpoint to extract structured notice details from messy text using Gemini."""
    if not request.is_json:
        return jsonify({"success": False, "error": "Invalid JSON body"}), 400

    try:
        data = request.get_json(silent=True)
    except Exception:
        data = None

    if data is None or not isinstance(data, dict):
        return jsonify({"success": False, "error": "Invalid JSON body"}), 400

    if "text" not in data:
        return jsonify({"success": False, "error": "Missing 'text' field"}), 400

    raw_text = data.get("text")
    if not isinstance(raw_text, str) or not raw_text.strip():
        return jsonify({"success": False, "error": "Notice text cannot be empty"}), 400

    if len(raw_text) > 5000:
        return jsonify({"success": False, "error": "Notice text exceeds maximum length of 5000 characters"}), 400

    try:
        result = ai_service.extract_notice_with_gemini(raw_text.strip())
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/digest", methods=["GET"])
def get_weekly_digest():
    """API endpoint to generate an intelligent AI weekly briefing of active notices."""
    try:
        notices = database.get_all_notices()
        digest = ai_service.generate_weekly_digest(notices)
        return jsonify(digest)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/status", methods=["GET"])
def get_status():
    """Health check endpoint indicating whether GEMINI_API_KEY is configured in .env."""
    # Check if the key exists without printing or exposing the secret
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    return jsonify({
        "status": "online",
        "has_gemini_key": bool(api_key)
    })


@app.errorhandler(400)
def handle_400(e):
    """Returns JSON 400 for bad requests on API endpoints."""
    if request.path.startswith("/api/"):
        return jsonify({"success": False, "error": "Bad request or malformed payload"}), 400
    return e


@app.errorhandler(404)
def handle_404(e):
    """Returns JSON 404 for API requests."""
    if request.path.startswith("/api/"):
        return jsonify({"success": False, "error": "Endpoint not found"}), 404
    return e


@app.errorhandler(405)
def handle_405(e):
    """Returns JSON 405 for method not allowed on API requests."""
    if request.path.startswith("/api/"):
        return jsonify({"success": False, "error": "Method not allowed"}), 405
    return e


@app.errorhandler(500)
def handle_500(e):
    """Returns JSON 500 for internal server errors on API requests."""
    if request.path.startswith("/api/"):
        return jsonify({"success": False, "error": "Internal server error"}), 500
    return e


# Ensure database tables exist and sample data is seeded on startup (works with both Flask and Gunicorn)
database.init_db()
database.seed_sample_data_if_empty()


if __name__ == "__main__":
    # Read PORT from environment (default 5000 for local runs)
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Campus Pulse on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
