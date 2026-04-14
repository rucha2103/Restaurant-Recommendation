import hashlib
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

from backend.models import Preferences
from backend.phase2_recommender import DEFAULT_DB_PATH
from backend.phase3_recommender import recommend_phase3


def _prefs_cache_key(prefs: Preferences) -> str:
    # Do not include raw additional_preferences content in the key (can be sensitive / high-cardinality).
    payload = {
        "location": prefs.location.strip(),
        "budget": prefs.budget.value,
        "cuisine": prefs.cuisine.strip(),
        "minimum_rating": prefs.minimum_rating,
        "include_unrated": prefs.include_unrated,
        "top_n": prefs.top_n,
        "has_additional_preferences": bool((prefs.additional_preferences or "").strip()),
    }
    raw = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


class InMemoryTTLCache:
    def __init__(self, ttl_s: int = 30, max_items: int = 512):
        self.ttl_s = ttl_s
        self.max_items = max_items
        self._items: Dict[str, _CacheEntry] = {}

    def get(self, key: str) -> Optional[Any]:
        e = self._items.get(key)
        if not e:
            return None
        if time.time() >= e.expires_at:
            self._items.pop(key, None)
            return None
        return e.value

    def set(self, key: str, value: Any) -> None:
        if len(self._items) >= self.max_items:
            # Simple eviction: drop an arbitrary expired entry, else drop oldest-ish by expires_at.
            now = time.time()
            expired = [k for k, v in self._items.items() if v.expires_at <= now]
            if expired:
                for k in expired[: max(1, len(expired) // 2)]:
                    self._items.pop(k, None)
            else:
                oldest = min(self._items.items(), key=lambda kv: kv[1].expires_at)[0]
                self._items.pop(oldest, None)
        self._items[key] = _CacheEntry(value=value, expires_at=time.time() + self.ttl_s)


class RecommenderService:
    def __init__(self):
        ttl = int(os.environ.get("CACHE_TTL_S", "30"))
        max_items = int(os.environ.get("CACHE_MAX_ITEMS", "512"))
        self.cache = InMemoryTTLCache(ttl_s=ttl, max_items=max_items)

    def recommend(self, prefs: Preferences) -> Tuple[Any, bool, Dict[str, int]]:
        """
        Returns (phase3_result_tuple, cache_hit, timings_ms)
        where phase3_result_tuple is:
          (recos, relaxations, notes, llm_used, model, fallback_used)
        """
        t_total0 = time.perf_counter()
        key = _prefs_cache_key(prefs)
        cached = self.cache.get(key)
        if cached is not None:
            timings = {"total": int((time.perf_counter() - t_total0) * 1000)}
            return cached, True, timings

        db_path = os.environ.get("RESTAURANTS_DB_PATH", DEFAULT_DB_PATH)

        t_llm0 = time.perf_counter()
        result = recommend_phase3(prefs=prefs, db_path=db_path)
        llm_ms = int((time.perf_counter() - t_llm0) * 1000)

        total_ms = int((time.perf_counter() - t_total0) * 1000)
        timings = {"llm_plus_rank": llm_ms, "total": total_ms}

        self.cache.set(key, result)
        return result, False, timings


def readiness() -> Dict[str, Any]:
    db_path = os.environ.get("RESTAURANTS_DB_PATH", DEFAULT_DB_PATH)
    db_ok = os.path.exists(db_path) and os.path.getsize(db_path) > 0
    groq_ok = bool(os.environ.get("GROQ_API_KEY"))
    return {"db_path": db_path, "db_ok": db_ok, "groq_key_present": groq_ok}

