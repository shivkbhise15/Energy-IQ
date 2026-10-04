from __future__ import annotations

import math
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, PointStruct, VectorParams
except Exception:  # pragma: no cover - optional in local lightweight runs
    QdrantClient = None
    Distance = None
    PointStruct = None
    VectorParams = None

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover
    SentenceTransformer = None

app = FastAPI(title="EnergyIQ AI Service", version="0.1.0")

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "energyiq_knowledge")

embedding_model: Any | None = None
qdrant: Any | None = None


class Reading(BaseModel):
    timestamp: datetime
    value: float


class AnomalyRequest(BaseModel):
    readings: list[Reading] = Field(min_length=8)
    method: Literal["isolation_forest", "local_outlier_factor"] = "isolation_forest"


class ForecastRequest(BaseModel):
    horizon: Literal["NEXT_HOUR", "NEXT_DAY", "NEXT_WEEK", "NEXT_MONTH"]
    readings: list[Reading] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    anomaly: str
    device_name: str | None = None
    building_name: str | None = None
    similar_incidents: list[str] = Field(default_factory=list)


class VectorUpsertRequest(BaseModel):
    documents: list[dict[str, Any]]


class VectorSearchRequest(BaseModel):
    query: str
    limit: int = Field(default=5, ge=1, le=20)


@app.on_event("startup")
def startup() -> None:
    global embedding_model, qdrant
    if SentenceTransformer is not None:
      embedding_model = SentenceTransformer(MODEL_NAME)
    if QdrantClient is not None:
      qdrant = QdrantClient(url=QDRANT_URL)
      ensure_collection()


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"service": "ai-service", "status": "live"}


@app.get("/health/ready")
def ready() -> dict[str, str | bool]:
    return {
        "service": "ai-service",
        "status": "ready",
        "embeddings": embedding_model is not None,
        "qdrant": qdrant is not None,
    }


@app.post("/anomaly")
def detect_anomaly(payload: AnomalyRequest) -> dict[str, Any]:
    values = np.array([[reading.value] for reading in payload.readings], dtype=float)
    if payload.method == "local_outlier_factor":
        model = LocalOutlierFactor(n_neighbors=min(20, max(2, len(values) - 1)), contamination="auto")
        labels = model.fit_predict(values)
        scores = -model.negative_outlier_factor_
    else:
        model = IsolationForest(n_estimators=160, contamination="auto", random_state=42)
        labels = model.fit_predict(values)
        scores = -model.score_samples(values)

    normalized = normalize_scores(scores)
    anomalies = []
    for reading, label, score in zip(payload.readings, labels, normalized, strict=True):
        if label == -1 or score > 0.68:
            anomalies.append(
                {
                    "timestamp": reading.timestamp.isoformat(),
                    "value": reading.value,
                    "anomalyScore": round(float(score), 4),
                    "confidenceScore": round(min(0.98, 0.62 + float(score) * 0.35), 4),
                    "explanation": explain_anomaly(reading.value, [item.value for item in payload.readings]),
                }
            )

    return {"method": payload.method, "count": len(anomalies), "anomalies": anomalies}


@app.post("/forecast")
def forecast(payload: ForecastRequest) -> dict[str, Any]:
    count, interval = horizon_shape(payload.horizon)
    values = [reading.value for reading in payload.readings]
    baseline = float(np.mean(values)) if values else 500.0
    trend = estimate_trend(values)
    now = datetime.now(timezone.utc)
    predictions = []

    for index in range(count):
        seasonal = math.sin(index / 3.0) * 0.07
        value = max(0.0, baseline * (1 + seasonal) + trend * (index + 1))
        predictions.append(
            {
                "timestamp": (now + interval * (index + 1)).isoformat(),
                "value": round(value, 2),
                "low": round(value * 0.88, 2),
                "high": round(value * 1.12, 2),
                "modelVersion": "energyiq-fastapi-baseline-0.1",
            }
        )

    return {"horizon": payload.horizon, "predictions": predictions}


@app.post("/recommendations")
def recommendations(payload: RecommendationRequest) -> dict[str, Any]:
    similar = "; ".join(payload.similar_incidents[:3]) or "No similar incident context was available."
    location = " ".join(item for item in [payload.building_name, payload.device_name] if item)
    title = f"Inspect {payload.device_name or 'affected equipment'} operating baseline"
    narrative = (
        f"{location or 'The asset'} is showing a pattern consistent with avoidable energy waste. "
        f"Similar incidents: {similar} Recommended next action: inspect control schedules, filters, bearings, and recent maintenance changes."
    )
    return {
        "title": title,
        "narrative": narrative,
        "impact": "HIGH" if "65%" in payload.anomaly or "critical" in payload.anomaly.lower() else "MEDIUM",
        "confidenceScore": 0.84,
    }


@app.post("/vector/upsert")
def vector_upsert(payload: VectorUpsertRequest) -> dict[str, Any]:
    if qdrant is None or embedding_model is None or PointStruct is None:
        return {"stored": 0, "mode": "disabled"}
    ensure_collection()
    points = []
    for document in payload.documents:
        text = str(document.get("text") or document.get("body") or document.get("title") or "")
        vector = embed(text)
        points.append(
            PointStruct(
                id=document.get("id") or str(uuid.uuid4()),
                vector=vector,
                payload=document,
            )
        )
    qdrant.upsert(collection_name=QDRANT_COLLECTION, points=points)
    return {"stored": len(points), "collection": QDRANT_COLLECTION}


@app.post("/vector/search")
def vector_search(payload: VectorSearchRequest) -> dict[str, Any]:
    if qdrant is None or embedding_model is None:
        return {"matches": [], "mode": "disabled"}
    ensure_collection()
    results = qdrant.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=embed(payload.query),
        limit=payload.limit,
    )
    return {
        "matches": [
            {"id": str(result.id), "score": result.score, "payload": result.payload}
            for result in results
        ]
    }


def ensure_collection() -> None:
    if qdrant is None or VectorParams is None or Distance is None:
        return
    collections = qdrant.get_collections().collections
    if any(collection.name == QDRANT_COLLECTION for collection in collections):
        return
    qdrant.create_collection(
        collection_name=QDRANT_COLLECTION,
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )


def embed(text: str) -> list[float]:
    if embedding_model is None:
        return [0.0] * 384
    vector = embedding_model.encode(text or "empty", normalize_embeddings=True)
    return vector.tolist()


def normalize_scores(scores: np.ndarray) -> np.ndarray:
    minimum = float(np.min(scores))
    maximum = float(np.max(scores))
    if math.isclose(minimum, maximum):
        return np.zeros_like(scores)
    return (scores - minimum) / (maximum - minimum)


def explain_anomaly(value: float, history: list[float]) -> str:
    mean = float(np.mean(history))
    if value > mean:
        return f"Reading is {round(((value - mean) / max(mean, 1)) * 100, 1)}% above the recent baseline."
    return f"Reading is {round(((mean - value) / max(mean, 1)) * 100, 1)}% below the recent baseline."


def horizon_shape(horizon: str) -> tuple[int, timedelta]:
    if horizon == "NEXT_HOUR":
        return 1, timedelta(hours=1)
    if horizon == "NEXT_DAY":
        return 24, timedelta(hours=1)
    if horizon == "NEXT_WEEK":
        return 7, timedelta(days=1)
    return 30, timedelta(days=1)


def estimate_trend(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    first = float(np.mean(values[: max(1, len(values) // 4)]))
    last = float(np.mean(values[-max(1, len(values) // 4) :]))
    return (last - first) / max(len(values), 1)
