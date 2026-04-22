# VERITAS.BERT — Fake News Detection

## Original Problem Statement
Fake News Detection Using BERT Algorithm to classify news articles as either genuine or fake. Use Google API RESTful services.

## Architecture
- **Backend**: FastAPI (Python) + MongoDB
- **ML Model**: HuggingFace `hamzab/roberta-fake-news-classification` (loaded once, cached)
- **Google API**: Google News RSS (RESTful) for trending news — `https://news.google.com/rss`
- **LLM Explainer**: Gemini 2.5 Flash via `emergentintegrations` + EMERGENT_LLM_KEY
- **Frontend**: React 19 + Tailwind + Shadcn/UI + Phosphor Icons + Chivo/IBM Plex Sans fonts
- **Design**: Swiss / High-contrast grid layout (light theme)

## User Persona
Journalists, students, media-literacy professionals, and curious readers who want to quickly verify whether an online news article is genuine or fake.

## Core Requirements (static)
1. Paste a news article URL → get verdict (FAKE / REAL) + confidence score
2. Get an AI-generated forensic explanation for the verdict
3. Browse trending Google News topics and verify with one click
4. History of previously analyzed articles with delete + clear
5. Aggregate stats (total analyzed, flagged fake, verified real)

## What's been implemented (2026-02)
- `POST /api/analyze` — fetch article from URL (BeautifulSoup), run RoBERTa classifier, call Gemini for explanation, persist to MongoDB
- `GET /api/trending?topic=<top|world|business|technology|science|health|sports|entertainment>` — Google News RSS (RESTful, no key required)
- `GET /api/history`, `DELETE /api/history/{id}`, `DELETE /api/history` (clear)
- `GET /api/stats` — counters for total/fake/real
- `GET /api/model/status` — model warm-load state
- Dashboard UI with: hero analyzer, live BERT inference skeleton, massive verdict card, animated confidence bar, Gemini forensic explanation, sticky trending panel with topic tabs + "Verify" button per item, history table with per-row delete + clear-all
- Backend fully tested (12/12 pytest cases passing)

## Prioritized Backlog
- **P1**: User authentication + per-user history
- **P1**: Export verdict as PDF / shareable card
- **P2**: Custom search — paste claim text instead of URL
- **P2**: Batch URL analysis (CSV upload)
- **P2**: Source credibility score aggregated over time
- **P2**: Webhook / browser extension to auto-verify articles
- **P3**: Rate limiting per IP, abuse protection
- **P3**: Multi-model ensemble (add BERT-base + DistilBERT)

## Known Behaviour
- Model is biased toward "FAKE" on non-news prose (e.g. Wikipedia); this is the published model's training distribution — not a bug. A fine-tuning on a modern news corpus would be a P2 follow-up.
