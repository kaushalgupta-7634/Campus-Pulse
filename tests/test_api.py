"""
Tests for Campus Pulse API validation and endpoints.
Uses pytest with Flask's test client.
"""

import pytest
import app
import database


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    """Ensures test database tables and seed notices are ready."""
    database.init_db()
    database.seed_sample_data_if_empty()


@pytest.fixture
def client():
    """Provides Flask test client."""
    app.app.config["TESTING"] = True
    with app.app.test_client() as client:
        yield client


# ==============================================================
# Requirement 1: API Validation Tests for /api/extract
# ==============================================================

def test_extract_missing_text_field(client):
    """Test POST /api/extract with missing 'text' field returns 400."""
    response = client.post("/api/extract", json={"wrong_key": "some content"})
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "Missing 'text' field" in data["error"]


def test_extract_empty_text(client):
    """Test POST /api/extract with empty or whitespace-only text returns 400."""
    # Completely empty string
    res_empty = client.post("/api/extract", json={"text": ""})
    assert res_empty.status_code == 400
    assert res_empty.get_json()["success"] is False
    assert "Notice text cannot be empty" in res_empty.get_json()["error"]

    # Whitespace only
    res_whitespace = client.post("/api/extract", json={"text": "    \n\t  "})
    assert res_whitespace.status_code == 400
    assert res_whitespace.get_json()["success"] is False
    assert "Notice text cannot be empty" in res_whitespace.get_json()["error"]


def test_extract_text_over_5000_characters(client):
    """Test POST /api/extract with text over 5000 characters returns 400."""
    giant_text = "Notice: " + ("important announcement " * 350)  # > 5000 chars
    assert len(giant_text) > 5000

    response = client.post("/api/extract", json={"text": giant_text})
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "exceeds maximum length of 5000 characters" in data["error"]


def test_extract_invalid_json_body(client):
    """Test POST /api/extract with invalid or malformed JSON body returns 400."""
    # Raw non-JSON payload
    response_raw = client.post(
        "/api/extract",
        data="This is not JSON at all",
        content_type="text/plain"
    )
    assert response_raw.status_code == 400
    data_raw = response_raw.get_json()
    assert data_raw["success"] is False
    assert "Invalid JSON body" in data_raw["error"]

    # Malformed JSON with application/json header
    response_malformed = client.post(
        "/api/extract",
        data="{ malformed json: true, ",
        content_type="application/json"
    )
    assert response_malformed.status_code == 400
    data_malformed = response_malformed.get_json()
    assert data_malformed["success"] is False
    assert "Invalid JSON body" in data_malformed["error"]

    # JSON that is not an object (e.g. array)
    response_array = client.post("/api/extract", json=["just", "an", "array"])
    assert response_array.status_code == 400
    assert response_array.get_json()["success"] is False


def test_extract_valid_text(client):
    """Test POST /api/extract with valid notice text returns 200 and extracted card."""
    sample = "Exam reminder: Physics test on 2026-11-10 at 10:00 AM in Hall 202. Mandatory attendance."
    response = client.post("/api/extract", json={"text": sample})
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "data" in data
    assert "title" in data["data"]
    assert "category" in data["data"]


# ==============================================================
# Endpoint & Lifecycle Tests
# ==============================================================

def test_get_notices(client):
    """Test GET /api/notices returns 200 and a list of notices."""
    response = client.get("/api/notices")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert isinstance(data["notices"], list)


def test_create_notice_validation(client):
    """Test POST /api/notices input validation."""
    # Missing title
    res_no_title = client.post("/api/notices", json={"title": "   "})
    assert res_no_title.status_code == 400
    assert res_no_title.get_json()["success"] is False

    # Invalid JSON body
    res_bad_json = client.post("/api/notices", data="raw data", content_type="text/plain")
    assert res_bad_json.status_code == 400


def test_notice_lifecycle(client):
    """Test complete lifecycle: Create -> Toggle Urgency -> Delete."""
    # 1. Create notice
    create_res = client.post("/api/notices", json={
        "title": "Test Lifecycle Event",
        "event_date": "2026-11-20",
        "category": "Academic",
        "is_urgent": 0
    })
    assert create_res.status_code == 201
    notice_id = create_res.get_json()["notice_id"]

    # 2. Toggle urgency (0 -> 1)
    urgency_res = client.patch(f"/api/notices/{notice_id}/urgency")
    assert urgency_res.status_code == 200
    assert urgency_res.get_json()["is_urgent"] == 1

    # 3. Delete notice
    del_res = client.delete(f"/api/notices/{notice_id}")
    assert del_res.status_code == 200
    assert del_res.get_json()["success"] is True

    # 4. Verify notice is gone
    del_again = client.delete(f"/api/notices/{notice_id}")
    assert del_again.status_code == 404


def test_get_digest(client):
    """Test GET /api/digest returns 200 and structured briefing."""
    response = client.get("/api/digest")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "headline" in data
    assert "overview" in data


def test_get_status(client):
    """Test GET /api/status returns 200 and server status."""
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "online"
    assert "has_gemini_key" in data


def test_api_404_json_error(client):
    """Test that requesting an unknown API route returns JSON 404."""
    response = client.get("/api/nonexistent_route")
    assert response.status_code == 404
    data = response.get_json()
    assert data["success"] is False
    assert "Endpoint not found" in data["error"]


def test_api_405_json_error(client):
    """Test that using an invalid HTTP method on an API route returns JSON 405."""
    response = client.post("/api/digest", json={"data": "test"})
    assert response.status_code == 405
    data = response.get_json()
    assert data["success"] is False
    assert "Method not allowed" in data["error"]
