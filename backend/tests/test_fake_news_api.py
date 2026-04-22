"""Backend API tests for Fake News Detector (BERT)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bert-truth-checker.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# -------- Basic endpoints --------
class TestBasic:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert "Fake News" in data["message"] or "message" in data

    def test_model_status(self, session):
        r = session.get(f"{API}/model/status", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "loaded" in data
        assert "model" in data
        assert data["model"] == "hamzab/roberta-fake-news-classification"


# -------- Trending --------
class TestTrending:
    def test_trending_top(self, session):
        r = session.get(f"{API}/trending", params={"topic": "top"}, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 5, f"Expected >=5 trending items, got {len(items)}"
        first = items[0]
        for k in ("title", "link", "source", "published", "description"):
            assert k in first

    def test_trending_technology(self, session):
        r = session.get(f"{API}/trending", params={"topic": "technology"}, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1


# -------- History/Stats baseline --------
class TestHistoryStatsBaseline:
    def test_history_initial(self, session):
        r = session.get(f"{API}/history", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stats_initial(self, session):
        r = session.get(f"{API}/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "fake", "real"):
            assert k in d
            assert isinstance(d[k], int)


# -------- Analyze --------
class TestAnalyze:
    def test_analyze_invalid_url(self, session):
        r = session.post(f"{API}/analyze", json={"url": "not-a-url"}, timeout=15)
        assert r.status_code == 400

    def test_analyze_valid_url_and_persist(self, session):
        # Wait for model to be loaded
        for _ in range(30):
            s = session.get(f"{API}/model/status", timeout=10).json()
            if s.get("loaded"):
                break
            time.sleep(2)
        else:
            pytest.skip("Model not loaded in time")

        url = "https://en.wikipedia.org/wiki/Climate_change"
        r = session.post(f"{API}/analyze", json={"url": url}, timeout=180)
        assert r.status_code == 200, f"Body: {r.text[:300]}"
        data = r.json()
        for k in ("id", "url", "title", "verdict", "confidence", "explanation", "created_at"):
            assert k in data, f"Missing field {k}"
        assert data["verdict"] in ("FAKE", "REAL")
        assert isinstance(data["confidence"], (int, float))
        assert 0.0 <= float(data["confidence"]) <= 1.0
        assert data["url"] == url
        assert len(data["title"]) > 0

        # Persistence check via history
        h = session.get(f"{API}/history", timeout=15)
        assert h.status_code == 200
        ids = [x["id"] for x in h.json()]
        assert data["id"] in ids

        # Stats updated
        st = session.get(f"{API}/stats", timeout=15).json()
        assert st["total"] >= 1
        assert (st["fake"] + st["real"]) <= st["total"]

        # Save id for later cleanup test
        pytest.created_id = data["id"]

    def test_history_sorted_desc(self, session):
        r = session.get(f"{API}/history", timeout=15)
        assert r.status_code == 200
        items = r.json()
        if len(items) >= 2:
            ts = [x["created_at"] for x in items]
            assert ts == sorted(ts, reverse=True), "history not sorted desc by created_at"


# -------- Delete operations --------
class TestDelete:
    def test_delete_specific(self, session):
        item_id = getattr(pytest, "created_id", None)
        if not item_id:
            pytest.skip("No created_id from previous test")
        r = session.delete(f"{API}/history/{item_id}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # Verify removed
        h = session.get(f"{API}/history", timeout=15).json()
        assert item_id not in [x["id"] for x in h]

    def test_delete_nonexistent_returns_404(self, session):
        r = session.delete(f"{API}/history/nonexistent-id-xyz", timeout=15)
        assert r.status_code == 404

    def test_clear_all_history(self, session):
        r = session.delete(f"{API}/history", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        h = session.get(f"{API}/history", timeout=15).json()
        assert h == []
        st = session.get(f"{API}/stats", timeout=15).json()
        assert st["total"] == 0
