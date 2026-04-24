from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import re
import html
from pathlib import Path
from datetime import datetime, timezone
from typing import List

from pydantic import BaseModel, Field, ConfigDict
import requests
from bs4 import BeautifulSoup
import feedparser
from googlenewsdecoder import gnewsdecoder

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ----------------- BERT MODEL (loaded lazily) -----------------
_model_state = {"pipe": None, "loading": False, "error": None}


def _load_model():
    """Load a pretrained BERT-based fake news classifier."""
    if _model_state["pipe"] is not None:
        return _model_state["pipe"]
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
    model_name = "hamzab/roberta-fake-news-classification"
    logger.info(f"Loading BERT model: {model_name}")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)
    pipe = pipeline("text-classification", model=model, tokenizer=tokenizer, truncation=True, max_length=512)
    _model_state["pipe"] = pipe
    logger.info("BERT model loaded.")
    return pipe


def classify_text_sync(title: str, text: str) -> dict:
    pipe = _load_model()
    # Model expects format: "<title> <content>"
    combined = f"<title> {title or ''} <content> {text[:2000]}"
    result = pipe(combined)[0]
    label = result["label"].upper()
    score = float(result["score"])
    # Normalize to REAL / FAKE
    verdict = label  # safe default
    if "FAKE" in label or label == "LABEL_0":
        verdict = "FAKE"
    elif "REAL" in label or "TRUE" in label or label == "LABEL_1":
        verdict = "REAL"
    return {"verdict": verdict, "confidence": score, "raw_label": result["label"]}


# ----------------- ARTICLE EXTRACTION -----------------
# ----------------- ARTICLE EXTRACTION -----------------
_url_cache: dict = {}


def resolve_google_news_url(url: str) -> str:
    """Decode news.google.com RSS links into the original publisher URL.
    Falls back to the input URL on failure. Cached to avoid repeated decoding."""
    if "news.google.com" not in url:
        return url
    cached = _url_cache.get(url)
    if cached:
        return cached
    try:
        res = gnewsdecoder(url, interval=1)
        if res and res.get("status") and res.get("decoded_url"):
            decoded = res["decoded_url"]
            _url_cache[url] = decoded
            return decoded
    except Exception as e:
        logger.warning(f"URL decode failed for {url[:80]}: {e}")
    return url


BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.2 Safari/605.1.15"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.google.com/",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}


def _parse_html_article(content: bytes) -> dict:
    soup = BeautifulSoup(content, "lxml")
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        title = og["content"].strip()
    description = ""
    desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", property="og:description")
    if desc_tag and desc_tag.get("content"):
        description = desc_tag["content"].strip()
    image = ""
    img_tag = soup.find("meta", property="og:image")
    if img_tag and img_tag.get("content"):
        image = img_tag["content"].strip()
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "aside"]):
        tag.decompose()
    article_tag = soup.find("article") or soup.find("main") or soup.body
    paragraphs = []
    if article_tag:
        for p in article_tag.find_all("p"):
            txt = p.get_text(strip=True)
            if len(txt) > 30:
                paragraphs.append(txt)
    body = "\n\n".join(paragraphs[:40]).strip()
    if not body:
        body = soup.get_text(" ", strip=True)[:5000]
    return {"title": title or "Untitled", "description": description, "image": image, "body": body}


def _fetch_via_jina_reader(url: str) -> dict:
    """Fallback extractor for bot-blocked/paywalled sites using the free
    Jina Reader service (https://r.jina.ai). Returns clean article markdown."""
    reader_url = f"https://r.jina.ai/{url}"
    resp = requests.get(
        reader_url,
        headers={"Accept": "text/plain", "User-Agent": BROWSER_HEADERS["User-Agent"]},
        timeout=30,
    )
    resp.raise_for_status()
    text = resp.text
    # Jina surfaces upstream errors as "Warning: Target URL returned error ..."
    if "Target URL returned error" in text or "requiring CAPTCHA" in text:
        raise RuntimeError("upstream site blocked content extraction (paywall/CAPTCHA)")
    title = ""
    body = text
    m_title = re.search(r"^Title:\s*(.+)$", text, flags=re.MULTILINE)
    if m_title:
        title = m_title.group(1).strip()
    m_content = re.search(r"Markdown Content:\s*\n", text)
    if m_content:
        body = text[m_content.end():].strip()
    body = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", body)
    body = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", body)
    body = body.strip()[:8000]
    if _looks_like_block_page({"title": title, "body": body}):
        raise RuntimeError("extracted content appears to be a bot-block page")
    return {"title": title or "Untitled", "description": "", "image": "", "body": body}


BLOCK_PAGE_SIGNATURES = (
    "are you a robot",
    "access denied",
    "forbidden",
    "enable javascript",
    "please enable cookies",
    "just a moment",
    "attention required",
    "cloudflare",
    "captcha",
    "bot detection",
    "checking your browser",
)

# Established news outlets — Gemini cannot fact-check claims it has not seen
# in training. For these sources, default the verdict to REAL unless the writing
# itself is satirical or an opinion piece pretending to be reporting.
TRUSTED_NEWS_DOMAINS = {
    "apnews.com", "reuters.com", "bbc.com", "bbc.co.uk", "nytimes.com",
    "washingtonpost.com", "wsj.com", "ft.com", "bloomberg.com", "npr.org",
    "theguardian.com", "afp.com", "aljazeera.com", "cnn.com", "abcnews.go.com",
    "nbcnews.com", "cbsnews.com", "pbs.org", "economist.com", "time.com",
    "politico.com", "axios.com", "thehill.com", "usatoday.com", "latimes.com",
    "dw.com", "france24.com", "euronews.com", "cnbc.com", "forbes.com",
    "techcrunch.com", "theverge.com", "wired.com", "arstechnica.com",
    "nature.com", "science.org", "scientificamerican.com", "newscientist.com",
    "nasa.gov", "noaa.gov", "who.int", "cdc.gov", "un.org",
}

# Known satire / parody outlets — always flag as FAKE for a news-detector context
SATIRE_DOMAINS = {
    "theonion.com", "babylonbee.com", "clickhole.com", "reductress.com",
    "thehardtimes.net", "dailymash.co.uk", "thebeaverton.com",
}


def _domain_of(url: str) -> str:
    try:
        from urllib.parse import urlparse
        host = urlparse(url).netloc.lower().lstrip("www.")
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""


def _looks_like_block_page(parsed: dict) -> bool:
    blob = f"{parsed.get('title','')} {parsed.get('body','')[:600]}".lower()
    return any(sig in blob for sig in BLOCK_PAGE_SIGNATURES)


def fetch_article(url: str) -> dict:
    """Fetch + parse article. Tries a direct browser-like request first and
    falls back to Jina Reader on 403/blocked/short-content/bot-block pages."""
    try:
        resp = requests.get(url, headers=BROWSER_HEADERS, timeout=20, allow_redirects=True)
        if resp.status_code == 200:
            parsed = _parse_html_article(resp.content)
            if (
                parsed["body"]
                and len(parsed["body"]) >= 200
                and not _looks_like_block_page(parsed)
            ):
                return parsed
            logger.info(
                f"Direct fetch unusable (blocked/short: "
                f"{len(parsed['body'])} chars, title='{parsed['title'][:60]}'), trying Jina"
            )
        else:
            logger.info(f"Direct fetch status {resp.status_code}, trying Jina")
    except Exception as e:
        logger.info(f"Direct fetch failed ({e}), trying Jina")

    # Fallback: Jina Reader
    try:
        return _fetch_via_jina_reader(url)
    except Exception as e:
        logger.info(f"Jina fallback failed: {e}")
        raise RuntimeError(
            "This site blocks automated access (paywall or anti-bot protection). "
            "Try a different article URL or paste the text directly."
        )


# ----------------- GEMINI EXPLANATION -----------------
async def get_explanation(title: str, body: str, verdict: str, confidence: float) -> str:
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        key = os.environ.get("EMERGENT_LLM_KEY")
        if not key:
            return "Explanation unavailable (missing LLM key)."
        chat = LlmChat(
            api_key=key,
            session_id=f"fnd-{uuid.uuid4()}",
            system_message=(
                "You are a media-literacy analyst. You are given a news article and the combined "
                "verdict (FAKE or REAL with confidence) from an ensemble of a BERT classifier and "
                "a Gemini reviewer. Produce a short, analytical explanation (4-6 bullet points) "
                "covering: source credibility signals, tone & language, factual verifiability, "
                "sensationalism/bias, and a final takeaway. Be objective. Do NOT say you are an AI. "
                "Output markdown bullets only."
            ),
        ).with_model("gemini", "gemini-2.5-flash")
        prompt = (
            f"Ensemble verdict: {verdict} (confidence {confidence*100:.1f}%)\n\n"
            f"Title: {title}\n\n"
            f"Article excerpt:\n{body[:3500]}"
        )
        reply = await chat.send_message(UserMessage(text=prompt))
        return str(reply).strip()
    except Exception as e:
        logger.exception("Explanation failed")
        return f"Explanation unavailable: {e}"


# ----------------- GEMINI SECOND-OPINION CLASSIFIER -----------------
async def gemini_classify(title: str, body: str, source_domain: str = "") -> dict:
    """Independent verdict from Gemini. Returns {verdict, confidence, reason}."""
    fallback = {"verdict": "UNKNOWN", "confidence": 0.0, "reason": "Unavailable"}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        key = os.environ.get("EMERGENT_LLM_KEY")
        if not key:
            return fallback
        today = datetime.now(timezone.utc).strftime("%B %Y")
        is_trusted = source_domain in TRUSTED_NEWS_DOMAINS
        is_satire = source_domain in SATIRE_DOMAINS
        source_note = ""
        if is_satire:
            source_note = (
                f"\n\nIMPORTANT: This article is from {source_domain}, a known "
                "satire / parody outlet. For a fake-news detector, satire counts "
                "as FAKE. Classify FAKE.\n"
            )
        elif is_trusted:
            source_note = (
                f"\n\nIMPORTANT: This article is from {source_domain}, an established "
                "newswire / mainstream outlet. Such outlets have editorial standards "
                "and corrections processes. Do NOT classify it FAKE because you "
                "cannot personally verify the facts; you have no live web access. "
                "Classify FAKE only if the writing itself is clearly satirical, "
                "opinion presented as news, or shows obvious fabrication patterns. "
                "Otherwise, classify REAL.\n"
            )
        chat = LlmChat(
            api_key=key,
            session_id=f"cls-{uuid.uuid4()}",
            system_message=(
                f"Today's date is {today}. Your training data may end earlier than "
                f"this — you MUST NOT flag an article as FAKE simply because it "
                f"reports recent events, names recent officials, or cites dates "
                f"after your knowledge cutoff. Treat news from {today} as current."
                + source_note
                + "\n\nYou are a senior fact-checker classifying news articles. "
                "Use a REAL-leaning prior: if the article reads like genuine "
                "reporting from a recognizable outlet, has plausible "
                "names/dates/quotes, attributes claims to sources, and lacks "
                "obvious red flags, classify it REAL. Classify it FAKE only when "
                "there are CLEAR signs of misinformation: fabricated facts "
                "presented without sourcing, conspiracy claims, satire posing as "
                "news, manipulated statistics, physically impossible events, or "
                "articles from known-fake outlets. Recency, unfamiliar names, or "
                "events you do not recognise are NOT grounds for FAKE.\n\n"
                "When uncertain between the two, choose REAL.\n\n"
                "Return STRICT JSON only, no prose, no markdown fences:\n"
                '{"verdict": "REAL" | "FAKE", "confidence": <float 0..1>, '
                '"reason": "<one short sentence>"}'
            ),
        ).with_model("gemini", "gemini-2.5-flash")
        prompt = (
            f"Source: {source_domain or 'unknown'}\nTitle: {title}\n\nArticle:\n{body[:3500]}"
        )
        reply = await chat.send_message(UserMessage(text=prompt))
        raw = str(reply).strip()
        # Strip code fences if present
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE).strip()
        # Extract first {...}
        m = re.search(r"\{.*\}", raw, flags=re.DOTALL)
        if not m:
            return fallback
        import json as _json
        data = _json.loads(m.group(0))
        v = str(data.get("verdict", "")).strip().upper()
        if v not in ("REAL", "FAKE"):
            return fallback
        try:
            c = float(data.get("confidence", 0.5))
        except (TypeError, ValueError):
            c = 0.5
        c = max(0.0, min(1.0, c))
        return {"verdict": v, "confidence": c, "reason": str(data.get("reason", ""))[:240]}
    except Exception as e:
        logger.exception("Gemini classification failed")
        return {**fallback, "reason": f"error: {e}"}


def combine_verdicts(bert: dict, gemini: dict) -> dict:
    """Gemini is the primary classifier (much more accurate on modern news).
    BERT is kept as a secondary informational signal. Final verdict = Gemini's
    verdict whenever Gemini is available; BERT is only used if Gemini fails."""
    g_v = gemini.get("verdict", "UNKNOWN")
    b_v = bert.get("verdict", "UNKNOWN")
    b_c = float(bert.get("confidence", 0.0))
    g_c = float(gemini.get("confidence", 0.0))
    if g_v in ("REAL", "FAKE"):
        return {"verdict": g_v, "confidence": g_c, "agreement": (g_v == b_v)}
    # Gemini unavailable -> fall back to BERT
    return {"verdict": b_v, "confidence": b_c, "agreement": False}


# ----------------- MODELS -----------------
class AnalyzeRequest(BaseModel):
    url: str


class AnalysisItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    title: str
    description: str = ""
    image: str = ""
    verdict: str
    confidence: float
    explanation: str = ""
    bert_verdict: str = ""
    bert_confidence: float = 0.0
    gemini_verdict: str = ""
    gemini_confidence: float = 0.0
    gemini_reason: str = ""
    agreement: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TrendingItem(BaseModel):
    title: str
    link: str
    source: str = ""
    published: str = ""
    description: str = ""


# ----------------- ROUTES -----------------
@api_router.get("/")
async def root():
    return {"message": "Fake News Detector API", "model": "hamzab/roberta-fake-news-classification"}


@api_router.get("/model/status")
async def model_status():
    return {
        "loaded": _model_state["pipe"] is not None,
        "model": "hamzab/roberta-fake-news-classification",
    }


@api_router.post("/analyze", response_model=AnalysisItem)
async def analyze(req: AnalyzeRequest):
    url = req.url.strip()
    if not re.match(r"^https?://", url):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http(s)://")
    # Decode Google News redirect URLs into publisher URLs
    if "news.google.com" in url:
        url = await run_in_threadpool(resolve_google_news_url, url)
    try:
        article = await run_in_threadpool(fetch_article, url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch article: {e}")

    if not article["body"] or len(article["body"]) < 50:
        raise HTTPException(status_code=400, detail="Could not extract enough article content from this URL.")

    try:
        bert_cls = await run_in_threadpool(classify_text_sync, article["title"], article["body"])
    except Exception as e:
        logger.exception("Classification failed")
        raise HTTPException(status_code=500, detail=f"Classification failed: {e}")

    gemini_cls = await gemini_classify(article["title"], article["body"], _domain_of(url))
    final = combine_verdicts(bert_cls, gemini_cls)
    explanation = await get_explanation(article["title"], article["body"], final["verdict"], final["confidence"])

    item = AnalysisItem(
        url=url,
        title=article["title"],
        description=article["description"],
        image=article["image"],
        verdict=final["verdict"],
        confidence=final["confidence"],
        explanation=explanation,
        bert_verdict=bert_cls.get("verdict", ""),
        bert_confidence=float(bert_cls.get("confidence", 0.0)),
        gemini_verdict=gemini_cls.get("verdict", ""),
        gemini_confidence=float(gemini_cls.get("confidence", 0.0)),
        gemini_reason=gemini_cls.get("reason", ""),
        agreement=bool(final.get("agreement", True)),
    )
    doc = item.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.analyses.insert_one(doc)
    return item


@api_router.get("/history", response_model=List[AnalysisItem])
async def history(limit: int = 50):
    cursor = db.analyses.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            try:
                d["created_at"] = datetime.fromisoformat(d["created_at"])
            except Exception:
                d["created_at"] = datetime.now(timezone.utc)
    return docs


@api_router.delete("/history/{item_id}")
async def delete_history(item_id: str):
    res = await db.analyses.delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api_router.delete("/history")
async def clear_history():
    await db.analyses.delete_many({})
    return {"ok": True}


@api_router.get("/stats")
async def stats():
    total = await db.analyses.count_documents({})
    fake = await db.analyses.count_documents({"verdict": "FAKE"})
    real = await db.analyses.count_documents({"verdict": "REAL"})
    uncertain = await db.analyses.count_documents({"verdict": "UNCERTAIN"})
    return {"total": total, "fake": fake, "real": real, "uncertain": uncertain}


@api_router.get("/trending", response_model=List[TrendingItem])
async def trending(topic: str = "top", country: str = "US", lang: str = "en"):
    """Fetch trending news from Google News RSS (RESTful, no key required)."""
    topic_map = {
        "top": f"https://news.google.com/rss?hl={lang}-{country}&gl={country}&ceid={country}:{lang}",
        "world": f"https://news.google.com/rss/headlines/section/topic/WORLD?hl={lang}-{country}&gl={country}&ceid={country}:{lang}",
        "business": f"https://news.google.com/rss/headlines/section/topic/BUSINESS?hl={lang}-{country}&gl={country}&ceid={country}:{lang}",
        "technology": f"https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl={lang}-{country}&gl={country}&ceid={country}:{lang}",
        "science": f"https://news.google.com/rss/headlines/section/topic/SCIENCE?hl={lang}-{country}&gl={country}&ceid={country}:{lang}",
        "health": f"https://news.google.com/rss/headlines/section/topic/HEALTH?hl={lang}-{country}&gl={country}&ceid={country}:{lang}",
        "sports": f"https://news.google.com/rss/headlines/section/topic/SPORTS?hl={lang}-{country}&gl={country}&ceid={country}:{lang}",
        "entertainment": f"https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl={lang}-{country}&gl={country}&ceid={country}:{lang}",
    }
    url = topic_map.get(topic, topic_map["top"])
    try:
        feed = await run_in_threadpool(feedparser.parse, url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feed error: {e}")

    items: List[TrendingItem] = []
    entries = feed.entries[:15]
    # Decode Google News encoded links to real publisher URLs in parallel
    import asyncio
    raw_links = [e.get("link", "") for e in entries]
    decoded_links = await asyncio.gather(
        *[run_in_threadpool(resolve_google_news_url, u) for u in raw_links]
    )
    for entry, link in zip(entries, decoded_links):
        raw_desc = entry.get("summary", "")
        clean_desc = re.sub(r"<[^>]+>", "", raw_desc)
        clean_desc = html.unescape(clean_desc).strip()
        source = ""
        if entry.get("source"):
            source = getattr(entry.source, "title", "") or entry.source.get("title", "") if hasattr(entry.source, "get") else getattr(entry.source, "title", "")
        items.append(TrendingItem(
            title=entry.get("title", ""),
            link=link or entry.get("link", ""),
            source=source or "",
            published=entry.get("published", ""),
            description=clean_desc[:250],
        ))
    return items


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    # Pre-load model in background so first request is fast-ish
    import threading
    def _warm():
        try:
            _load_model()
        except Exception as e:
            logger.exception(f"Model warm load failed: {e}")
    threading.Thread(target=_warm, daemon=True).start()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
