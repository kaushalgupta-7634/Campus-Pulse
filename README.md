# Campus Pulse ⚡

> Intelligent Central Notice Board for Campus Life  
> Built for PromptWars x CSSS — Build with AI (Google for Developers).

---

## 📌 Problem Statement
College students are bombarded daily with scattered notices across dozens of unofficial WhatsApp groups, telegram channels, notice boards, and buried emails. Critical deadlines are missed, event details get lost in message clutter, and there is no single place to see what actually needs attention today.

---

## 💡 Solution
**Campus Pulse** serves as the single source of truth for campus life by using Google Gemini AI to transform messy, unstructured text forwards into clean, actionable event cards. The platform automatically extracts key metadata (title, dates, venue, category, and urgency), organizes notices into timeline and grid views, highlights immediate priorities, and generates a one-click executive weekly briefing for students on the go.

---

## ✨ Features

- **Smart Input (Gemini AI Extraction):**  
  Paste any raw forwarded WhatsApp message, email excerpt, or event poster caption. Gemini AI parses the title, date, time, venue, category, and urgency into structured cards in seconds, with automatic local fallback parsing.
- **Organised View (Dual Layouts & Filtering):**  
  Switch seamlessly between a modern **Cards Grid View** and an intuitive **Timeline & Calendar View** grouped chronologically (*Happening Today*, *Tomorrow*, *This Week*, *Later This Month*, and *Past Events*). Features real-time keyword search, category filtering (Academic, Exams, Clubs, Placement, Sports, General), and multi-criteria sorting.
- **Priority & Reminders:**  
  Flags items as urgent, upcoming, or expired with dynamic countdown badges (*⚡ TODAY!*, *⏰ Tomorrow*, *In X days*, *⌛ Expired*). A dedicated "Needs Attention Today" spotlight highlights immediate deadlines, accompanied by a 1-click urgency toggle (`⭐ Standard` ↔ `🚨 Urgent`).
- **Weekly AI Digest ("What do I need to know this week?"):**  
  A single click triggers Gemini to synthesize all active campus notices into an executive student briefing featuring headline highlights, critical deadlines, key events with venues, a campus pro-tip, and a one-click clipboard export.
- **Accessible & Responsive UI:**  
  Designed with a sleek dark glassmorphic aesthetic built with Vanilla CSS and HTML5. Fully responsive across mobile, tablet, and desktop viewports, zero third-party UI framework bloat, strict heading hierarchy, visible keyboard focus styles, and polite ARIA live regions.

---

## 🛠️ Tech Stack
- **Backend:** Python 3.11+, Flask
- **Database:** SQLite (built-in `sqlite3`)
- **AI Integration:** Google Gemini API via official Google GenAI SDK (`google-genai`)
- **Frontend:** Vanilla HTML5, Vanilla CSS3 (modern responsive dark design system), Vanilla JavaScript (zero external JS frameworks)
- **Production Server:** Gunicorn (WSGI)
- **Testing:** Pytest

---

## 💻 How to Run Locally

### 1. Clone the Repository
```bash
git clone https://github.com/kaushalgupta-7634/Campus-Pulse.git
cd Campus-Pulse
```

### 2. Create and Activate Virtual Environment
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Required: Google Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: SQLite Database path (defaults to campus.db)
DB_PATH=campus.db

# Optional: Server Port (defaults to 5000)
PORT=5000
```
*(Note: Never commit your `.env` file or hardcode your API key).*

### 5. Run the Application
```bash
python app.py
```
Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser.

### 6. Run Automated Tests
```bash
python -m pytest -v
```

---

## ⚙️ Environment Variables

| Variable | Requirement | Default | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Required** | None | Google Gemini API key used by `google-genai` for extraction and weekly digest synthesis. |
| `DB_PATH` | Optional | `campus.db` | File path for SQLite database. Automatically initializes and seeds sample notices if empty. |
| `PORT` | Optional | `5000` | Port for local runs and web server binding. |

---

## 🚀 Render Deployment Guide

- **Build Command:**
  ```bash
  pip install -r requirements.txt
  ```
- **Start Command:**
  ```bash
  gunicorn app:app --bind 0.0.0.0:$PORT
  ```
- **Environment Variables on Render:**
  - Add `GEMINI_API_KEY` with your secret key.
  - Set `PYTHON_VERSION` to `3.11.0` or higher.

---

## 🌐 Live Link
*Live Demo URL:* [https://campus-pulse.onrender.com](https://campus-pulse.onrender.com) *(Placeholder - update with your deployed Render URL)*

---

## 📸 Screenshots

### 1. Main Dashboard & Needs Attention Today Spotlight
![Campus Pulse Dashboard](https://via.placeholder.com/1200x675.png?text=Campus+Pulse+-+Main+Dashboard+%26+Spotlight)

### 2. Smart Input with Gemini AI Extraction Preview
![Smart Input Modal](https://via.placeholder.com/1200x675.png?text=Campus+Pulse+-+Smart+Input+Gemini+Extraction)

### 3. Chronological Calendar & Timeline View
![Timeline View](https://via.placeholder.com/1200x675.png?text=Campus+Pulse+-+Timeline+%26+Calendar+View)

### 4. AI Weekly Executive Digest Modal
![Weekly Digest Modal](https://via.placeholder.com/1200x675.png?text=Campus+Pulse+-+AI+Weekly+Digest+Briefing)

---

## 📄 License
MIT License. Developed for the PromptWars x CSSS — Build with AI Hackathon.
