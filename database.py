import os
import sqlite3
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("campus_pulse.database")

DB_NAME = os.getenv("DB_PATH", "campus.db")


def get_db_connection() -> sqlite3.Connection:
    """Creates an optimized connection to the SQLite database."""
    conn = sqlite3.connect(DB_NAME, timeout=10.0)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode and normal synchronous for high-throughput reads/writes
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
    except Exception as e:
        logger.debug(f"SQLite PRAGMA setup note: {e}")
    return conn


def init_db() -> None:
    """Initializes the database schema and indexes if tables do not exist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Create the notices table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                event_date TEXT,
                event_time TEXT,
                venue TEXT,
                category TEXT,
                is_urgent INTEGER DEFAULT 0,
                raw_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Add performance indexes for rapid sorting and filtering
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notices_date ON notices(event_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notices_urgent ON notices(is_urgent);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notices_category ON notices(category);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notices_created ON notices(created_at DESC);")
        conn.commit()


def get_all_notices() -> List[Dict[str, Any]]:
    """Fetches all notices from the database ordered by event_date and creation time."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, event_date, event_time, venue, category, is_urgent, raw_text, created_at
            FROM notices
            ORDER BY 
                CASE 
                    WHEN event_date IS NULL OR event_date = '' THEN 1 
                    ELSE 0 
                END,
                event_date ASC,
                id DESC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def insert_notice(
    title: str,
    event_date: Optional[str] = None,
    event_time: Optional[str] = None,
    venue: Optional[str] = None,
    category: Optional[str] = "General",
    is_urgent: int = 0,
    raw_text: Optional[str] = ""
) -> int:
    """Inserts a new notice into the database and returns the inserted row ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO notices (title, event_date, event_time, venue, category, is_urgent, raw_text)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (title, event_date, event_time, venue, category or "General", 1 if is_urgent else 0, raw_text or ""))
        conn.commit()
        return cursor.lastrowid


def delete_notice_by_id(notice_id: int) -> bool:
    """Deletes a notice by its ID. Returns True if a record was deleted, else False."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notices WHERE id = ?", (notice_id,))
        conn.commit()
        return cursor.rowcount > 0


def toggle_notice_urgency(notice_id: int) -> Optional[int]:
    """Toggles the is_urgent flag (0 <-> 1) for a notice. Returns the new value or None if not found."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT is_urgent FROM notices WHERE id = ?", (notice_id,))
        row = cursor.fetchone()
        if not row:
            return None

        new_urgent = 0 if row["is_urgent"] else 1
        cursor.execute("UPDATE notices SET is_urgent = ? WHERE id = ?", (new_urgent, notice_id))
        conn.commit()
        return new_urgent


def seed_sample_data_if_empty() -> None:
    """Seeds sample notices if the table is currently empty for easy initial testing."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM notices")
        count = cursor.fetchone()[0]

    if count == 0:
        insert_notice(
            title="Hackathon Registration Deadline",
            event_date="2026-11-02",
            event_time="11:59 PM",
            venue="Online Portal (campus.edu/portal)",
            category="Exam/Deadline",
            is_urgent=1,
            raw_text="URGENT: Reminder all 3rd and 4th year students, hackathon registrations close this Monday Nov 2 at 11:59 PM sharp! Don't miss out."
        )
        insert_notice(
            title="CSSS Annual Tech Symposium 2026",
            event_date="2026-11-05",
            event_time="10:00 AM - 4:00 PM",
            venue="Auditorium Hall B",
            category="Club/Cultural",
            is_urgent=0,
            raw_text="Hey guys! CSSS is hosting the Annual Tech Symposium on Nov 5 in Audi B. Keynotes on AI & Cloud. Refreshments will be provided."
        )
        insert_notice(
            title="Campus Placement Talk: TechCorp",
            event_date="2026-11-08",
            event_time="02:00 PM",
            venue="Seminar Hall 1",
            category="Placement",
            is_urgent=0,
            raw_text="TechCorp pre-placement talk for CS/IT batch on 8th Nov at 2 PM in Seminar Hall 1. Formal dress code mandatory."
        )
