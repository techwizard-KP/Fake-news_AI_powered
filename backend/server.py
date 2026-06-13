from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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
import certifi

from pydantic import BaseModel, Field, ConfigDict
import requests
from bs4 import BeautifulSoup
import feedparser
from googlenewsdecoder import gnewsdecoder
import google.generativeai as genai
from newspaper import Article
import asyncio
# ---------- Environment and MongoDB ----------
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

mongo_url = os.getenv("MONGO_URL")
db_name = os.getenv("DB_NAME")
gemini_api_key = os.getenv("GEMINI_API_KEY")

if not mongo_url:
    raise Exception("MONGO_URL not found in environment variables")
if not db_name:
    raise Exception("DB_NAME not found in environment variables")
if not gemini_api_key:
    raise Exception("GEMINI_API_KEY not found in environment variables")

client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[db_name]

# ---------- FastAPI app ----------
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Serve React static files (if built) ----------
#frontend_build_path = Path(__file__).parent.parent / "frontend" / "build"
#if frontend_build_path.exists():
    #app.mount("/static", StaticFiles(directory=frontend_build_path / "static"), name="static")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- BERT fake news classifier ----------
_model_state = {"pipe": None, "loading": False, "error": None}

def _load_model():
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
    combined = f"<title> {title or ''} <content> {text[:2000]}"
    result = pipe(combined)[0]
    label = result["label"]
    score = float(result["score"])
    
    # Map the labels correctly
    if label == "TRUE":
        verdict = "REAL"
        confidence = score
    elif label == "FAKE":
        verdict = "FAKE"
        confidence = score
    else:
        verdict = "UNKNOWN"
        confidence = score
    
    logger.info(f"BERT classification: {verdict} with confidence {confidence:.4f} (raw: {label})")
    
    return {"verdict": verdict, "confidence": confidence, "raw_label": label}

# ---------- Article extraction (unchanged) ----------
_url_cache: dict = {}

def resolve_google_news_url(url: str) -> str:
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
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.google.com/",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Cache-Control": "no-cache",
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
    reader_url = f"https://r.jina.ai/{url}"
    resp = requests.get(reader_url, headers={"Accept": "text/plain", "User-Agent": BROWSER_HEADERS["User-Agent"]}, timeout=45)
    resp.raise_for_status()
    text = resp.text
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
    "are you a robot", "access denied", "forbidden", "enable javascript",
    "please enable cookies", "just a moment", "attention required",
    "cloudflare", "captcha", "bot detection", "checking your browser",
)

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
    # Try direct fetch first
    try:
        resp = requests.get(url, headers=BROWSER_HEADERS, timeout=20, allow_redirects=True)
        if resp.status_code == 200:
            parsed = _parse_html_article(resp.content)
            if parsed["body"] and len(parsed["body"]) >= 200 and not _looks_like_block_page(parsed):
                return parsed
            logger.info(f"Direct fetch unusable, trying Jina")
        else:
            logger.info(f"Direct fetch status {resp.status_code}, trying Jina")
    except Exception as e:
        logger.info(f"Direct fetch failed ({e}), trying Jina")
    
    # Try Jina Reader
    try:
        return _fetch_via_jina_reader(url)
    except Exception as e:
        logger.info(f"Jina fallback failed: {e}")
        
    # Try newspaper3k as final fallback
    try:
        logger.info(f"Trying newspaper3k for {url}")
        article = Article(url)
        article.download()
        article.parse()
        if article.text and len(article.text) >= 200:
            return {
                "title": article.title or "",
                "body": article.text[:5000],
                "source": url
            }
    except Exception as e:
        logger.info(f"newspaper3k failed: {e}")
        
    raise RuntimeError("This site blocks automated access. Try a different article URL.")

# ---------- Gemini classification and explanation ----------
async def get_explanation(title: str, body: str, verdict: str, confidence: float) -> str:
    try:
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""You are a media-literacy analyst. You are given a news article and the combined 
        verdict ({verdict} with confidence {confidence*100:.1f}%) from a BERT classifier.
        Produce a short, analytical explanation (4-6 bullet points) 
        covering: source credibility signals, tone & language, factual verifiability, 
        sensationalism/bias, and a final takeaway. Be objective. Do NOT say you are an AI. 
        Output markdown bullets only.
        
        Title: {title}
        
        Article excerpt:
        {body[:3500]}"""
        response = await run_in_threadpool(model.generate_content, prompt)
        return response.text.strip()
    except Exception as e:
        logger.exception("Explanation failed")
        return f"Explanation unavailable: {e}"

async def gemini_classify(title: str, body: str, source_domain: str = "") -> dict:
    fallback = {"verdict": "UNKNOWN", "confidence": 0.0, "reason": "Unavailable"}
    try:
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        today = datetime.now(timezone.utc).strftime("%B %Y")
        is_trusted = source_domain in TRUSTED_NEWS_DOMAINS
        is_satire = source_domain in SATIRE_DOMAINS
        source_note = ""
        if is_satire:
            source_note = f"\n\nIMPORTANT: This article is from {source_domain}, a known satire/parody outlet. Classify FAKE.\n"
        elif is_trusted:
            source_note = f"\n\nIMPORTANT: This article is from {source_domain}, an established news outlet. Classify REAL unless clearly satirical.\n"
        prompt = f"""Today's date is {today}. You are a senior fact-checker classifying news articles.

{source_note}

Article Source: {source_domain or 'unknown'}
Title: {title}

Article Content:
{body[:3500]}

Return STRICT JSON only, no prose, no markdown fences:
{{"verdict": "REAL" or "FAKE", "confidence": <float 0..1>, "reason": "<one short sentence>"}}"""
        response = await run_in_threadpool(model.generate_content, prompt)
        raw = response.text.strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE).strip()
        import json
        data = json.loads(raw)
        return {
            "verdict": data.get("verdict", "UNKNOWN"),
            "confidence": float(data.get("confidence", 0.5)),
            "reason": data.get("reason", "")[:240]
        }
    except Exception as e:
        logger.exception("Gemini classification failed")
        return {**fallback, "reason": f"error: {e}"}

def combine_verdicts(bert: dict, gemini: dict) -> dict:
    g_v = gemini.get("verdict", "UNKNOWN")
    b_v = bert.get("verdict", "UNKNOWN")
    g_c = float(gemini.get("confidence", 0.0))
    if g_v in ("REAL", "FAKE"):
        return {"verdict": g_v, "confidence": g_c, "agreement": (g_v == b_v)}
    return {"verdict": b_v, "confidence": float(bert.get("confidence", 0.0)), "agreement": False}

# ---------- Pydantic models ----------
class AnalyzeRequest(BaseModel):
    url: str

class AnalysisItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    title: str
    description: str = ""
    image: str = ""
    body: str = ""
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

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    analysis_id: str
    question: str
    history: List[ChatMessage] = Field(default_factory=list)

class ChatResponse(BaseModel):
    answer: str

# ---------- API routes ----------
@api_router.get("/")
async def root():
    return {"message": "Fake News Detector API", "model": "hamzab/roberta-fake-news-classification"}

@api_router.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "model_loaded": _model_state["pipe"] is not None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/model/status")
async def model_status():
    return {"loaded": _model_state["pipe"] is not None, "model": "hamzab/roberta-fake-news-classification"}

@api_router.post("/analyze", response_model=AnalysisItem)
async def analyze(req: AnalyzeRequest):
    url = req.url.strip()
    if not re.match(r"^https?://", url):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http(s)://")
    if "news.google.com" in url:
        url = await run_in_threadpool(resolve_google_news_url, url)
    try:
        article = await run_in_threadpool(fetch_article, url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch article: {e}")
    if not article["body"] or len(article["body"]) < 50:
        raise HTTPException(status_code=400, detail="Could not extract enough article content.")
    try:
        bert_cls = await run_in_threadpool(classify_text_sync, article["title"], article["body"])
    except Exception as e:
        logger.exception("Classification failed")
        raise HTTPException(status_code=500, detail=f"Classification failed: {e}")
    gemini_cls = await gemini_classify(article["title"], article["body"], _domain_of(url))
    final = combine_verdicts(bert_cls, gemini_cls)
    explanation = await get_explanation(article["title"], article["body"], final["verdict"], final["confidence"])
    item = AnalysisItem(
        url=url, title=article["title"], description=article["description"], image=article["image"],
        body=article["body"][:8000], verdict=final["verdict"], confidence=final["confidence"],
        explanation=explanation, bert_verdict=bert_cls.get("verdict", ""),
        bert_confidence=float(bert_cls.get("confidence", 0.0)),
        gemini_verdict=gemini_cls.get("verdict", ""),
        gemini_confidence=float(gemini_cls.get("confidence", 0.0)),
        gemini_reason=gemini_cls.get("reason", ""), agreement=bool(final.get("agreement", True))
    )
    doc = item.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.analyses.insert_one(doc)
    return item

@api_router.post("/chat", response_model=ChatResponse)
async def chat_about_article(req: ChatRequest):
    doc = await db.analyses.find_one({"id": req.analysis_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    question = (req.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty")
    try:
        genai.configure(api_key=gemini_api_key)
        today = datetime.now(timezone.utc).strftime("%B %Y")
        verdict = doc.get("verdict", "UNKNOWN")
        body = (doc.get("body") or "")[:5000]
        title = doc.get("title", "")
        url = doc.get("url", "")
        domain = _domain_of(url)

        system_msg = f"""Today is {today}. You are a thoughtful research assistant helping a user understand a news article. 
You have access to: (1) the article excerpt, (2) the source domain, (3) the system's fake-news verdict on it.
Answer the user's question clearly and honestly.
RULES:
- Give straight, balanced answers.
- Distinguish what is IN THE ARTICLE vs. your own knowledge.
- Use markdown. Keep answers concise (3-6 sentences)."""
        model = genai.GenerativeModel('gemini-1.5-flash', system_instruction=system_msg)
        
        # Build conversation history
        history_lines = []
        for msg in req.history[-8:]:
            tag = "User" if msg.role == "user" else "Assistant"
            history_lines.append(f"{tag}: {msg.content}")
        history_block = "\n".join(history_lines) if history_lines else ""
        
        # Create prompt
        prompt_parts = [
            "ARTICLE CONTEXT",
            f"Source domain: {domain}",
            f"Title: {title}",
            f"System verdict: {verdict} (confidence {float(doc.get('confidence',0))*100:.0f}%)",
            "Article excerpt:",
            body,
            ""
        ]
        if history_block:
            prompt_parts.append("PRIOR CONVERSATION:")
            prompt_parts.append(history_block)
            prompt_parts.append("")
        prompt_parts.append(f"USER QUESTION: {question}")
        prompt = "\n".join(prompt_parts)
        
        response = await run_in_threadpool(model.generate_content, prompt)
        answer = response.text.strip()
        now = datetime.now(timezone.utc)
        await db.chat_messages.insert_many([
            {"id": str(uuid.uuid4()), "analysis_id": req.analysis_id, "role": "user", "content": question, "created_at": now},
            {"id": str(uuid.uuid4()), "analysis_id": req.analysis_id, "role": "assistant", "content": answer, "created_at": now}
        ])
        return ChatResponse(answer=answer)
    except Exception as e:
        logger.exception("Chat failed")
        raise HTTPException(status_code=500, detail=f"Chat error: {e}")
@api_router.post("/analyze-fast")
async def analyze_fast(request: dict):
    """FAST endpoint - BERT only, no URL fetching, no Gemini"""
    try:
        # Get text from request body
        text = request.get("text", "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        # Get BERT prediction
        bert_result = await run_in_threadpool(classify_text_sync, "Test", text)
        
        # Create analysis item
        item = AnalysisItem(
            id=str(uuid.uuid4()),
            url="text-input",
            title="Text Analysis",
            description="",
            image="",
            body=text[:500],
            verdict=bert_result["verdict"],
            confidence=bert_result["confidence"],
            explanation=f"BERT classifier analyzed the text and found it to be {bert_result['verdict']} with {bert_result['confidence']*100:.1f}% confidence.\n\nNote: This is a fast analysis without Gemini fact-checking.",
            bert_verdict=bert_result["verdict"],
            bert_confidence=bert_result["confidence"],
            gemini_verdict="",
            gemini_confidence=0.0,
            gemini_reason="",
            agreement=True,
            created_at=datetime.now(timezone.utc)
        )
        
        # Save to database
        #doc = item.model_dump()
        #doc["created_at"] = doc["created_at"].isoformat()
        #await db.analyses.insert_one(doc)
        
        # Return the result
        return {
            "id": item.id,
            "url": item.url,
            "title": item.title,
            "description": item.description,
            "image": item.image,
            "body": item.body,
            "verdict": item.verdict,
            "confidence": item.confidence,
            "explanation": item.explanation,
            "bert_verdict": item.bert_verdict,
            "bert_confidence": item.bert_confidence,
            "gemini_verdict": item.gemini_verdict,
            "gemini_confidence": item.gemini_confidence,
            "gemini_reason": item.gemini_reason,
            "agreement": item.agreement,
            "created_at": item.created_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Fast analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@api_router.post("/analyze", response_model=AnalysisItem)
async def analyze(req: AnalyzeRequest):
    try:
        # Set overall timeout of 25 seconds
        result = await asyncio.wait_for(
            _analyze_with_timeout(req),
            timeout=25.0
        )
        return result
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Analysis taking too long. Please try a shorter article or try again later.")

async def _analyze_with_timeout(req: AnalyzeRequest):
    # Your existing analyze code here (copy everything from your current analyze function)
    url = req.url.strip()
    # ... rest of your existing analyze code ...

@api_router.get("/chat/{analysis_id}", response_model=List[ChatMessage])
async def get_chat_history(analysis_id: str):
    cursor = db.chat_messages.find({"analysis_id": analysis_id}, {"_id": 0, "role": 1, "content": 1, "created_at": 1}).sort("created_at", 1)
    docs = await cursor.to_list(length=200)
    return [ChatMessage(role=d["role"], content=d["content"]) for d in docs]

@api_router.delete("/chat/{analysis_id}")
async def clear_chat_history(analysis_id: str):
    res = await db.chat_messages.delete_many({"analysis_id": analysis_id})
    return {"ok": True, "deleted": res.deleted_count}

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
    await db.chat_messages.delete_many({"analysis_id": item_id})
    return {"ok": True}

@api_router.delete("/history")
async def clear_history():
    await db.analyses.delete_many({})
    await db.chat_messages.delete_many({})
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
    items = []
    entries = feed.entries[:15]
    import asyncio
    raw_links = [e.get("link", "") for e in entries]
    decoded_links = await asyncio.gather(*[run_in_threadpool(resolve_google_news_url, u) for u in raw_links])
    for entry, link in zip(entries, decoded_links):
        raw_desc = entry.get("summary", "")
        clean_desc = re.sub(r"<[^>]+>", "", raw_desc)
        clean_desc = html.unescape(clean_desc).strip()
        source = ""
        if entry.get("source"):
            source = getattr(entry.source, "title", "") or (entry.source.get("title", "") if hasattr(entry.source, "get") else "")
        items.append(TrendingItem(
            title=entry.get("title", ""),
            link=link or entry.get("link", ""),
            source=source or "",
            published=entry.get("published", ""),
            description=clean_desc[:250],
        ))
    return items

app.include_router(api_router)

# ---------- Serve React root and catch-all ----------
#if frontend_build_path.exists():
    #@app.get("/")
   # async def serve_react_root():
       # return FileResponse(frontend_build_path / "index.html")

   # @app.get("/{full_path:path}")
    #async def serve_react_spa(full_path: str):
        #if full_path.startswith("api/"):
         #   raise HTTPException(status_code=404, detail="Not found")
        #file_path = frontend_build_path / full_path
        #if file_path.exists() and file_path.is_file():
        #    return FileResponse(file_path)
        #return FileResponse(frontend_build_path / "index.html")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    logger.info("Starting up...")
    
    # Load BERT model in threadpool (non-blocking)
    try:
        await run_in_threadpool(_load_model)
        logger.info("BERT model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load BERT model: {e}")
    
    # Create MongoDB indexes
    try:
        await db.chat_messages.create_index("created_at", expireAfterSeconds=60*60*24*30)
        await db.chat_messages.create_index("analysis_id")
        logger.info("MongoDB indexes created/verified")
    except Exception as e:
        logger.warning(f"Index creation failed: {e}")
    
    logger.info("Startup complete")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    logger.info("Shutting down...")
    client.close()
    logger.info("MongoDB connection closed")
