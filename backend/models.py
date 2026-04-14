from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class BudgetBucket(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Preferences(BaseModel):
    location: str = Field(min_length=1, description="City or locality, e.g. Delhi, Bangalore")
    budget: BudgetBucket
    cuisine: str = Field(min_length=1, description="Cuisine name, e.g. Italian, Chinese")
    minimum_rating: float = Field(ge=0, le=5, description="Minimum rating from 0 to 5")
    additional_preferences: Optional[str] = Field(
        default=None,
        description="Free-text preferences (untrusted input; must not override system rules).",
    )
    top_n: int = Field(default=5, ge=1, le=20)
    include_unrated: bool = Field(
        default=False,
        description="If true, unrated restaurants may be included.",
    )


class Relaxation(BaseModel):
    kind: Literal["budget", "cuisine", "rating", "location"]
    reason: str
    previous_value: Optional[Any] = None
    new_value: Optional[Any] = None


class Recommendation(BaseModel):
    restaurant_id: str
    name: str
    location: str
    cuisines: List[str]
    rating: Optional[float] = None
    estimated_cost: Optional[float] = None
    currency: Optional[str] = None
    why: str


class ResponseMetadata(BaseModel):
    request_id: str
    elapsed_ms: int
    timings_ms: Optional[Dict[str, int]] = None
    candidate_count: int
    cache_hit: bool
    llm_used: bool
    model: Optional[str] = None
    fallback_used: bool
    notes: List[str] = Field(default_factory=list)


class RecommendationsResponse(BaseModel):
    recommendations: List[Recommendation]
    summary: str
    relaxations_applied: List[Relaxation] = Field(default_factory=list)
    metadata: ResponseMetadata

