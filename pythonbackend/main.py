import io
import os
import uuid
import datetime
import logging
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from PIL import Image

from schemas import (
    ClassificationResponse,
    Base64ClassifyRequest,
    BinGuideline,
    HistoryItem,
    HealthResponse,
    PredictionItem
)
from classifier import WasteClassifierModel, WASTE_GUIDELINES, decode_base64_image

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("waste_classifier_api")

app = FastAPI(
    title="♻️ Intelligent Waste Classifier API",
    description="Computer Vision REST API for automated waste sorting and eco-guidance.",
    version="1.0.0"
)

# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
model = WasteClassifierModel()

# In-memory history buffer (holds up to 50 recent records)
classification_history: List[HistoryItem] = []


def record_history(category: str, confidence: float, guideline: dict) -> HistoryItem:
    item = HistoryItem(
        id=str(uuid.uuid4())[:8],
        timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        category=category,
        confidence=confidence,
        bin_name=guideline["bin_name"],
        color_hex=guideline["color_hex"],
        icon=guideline["icon"]
    )
    classification_history.insert(0, item)
    if len(classification_history) > 50:
        classification_history.pop()
    return item


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint and model loading status."""
    return HealthResponse(
        status="healthy",
        model_loaded=model.is_loaded,
        model_name=model.model_name,
        device=model.device,
        version="1.0.0"
    )


@app.get("/api/categories", response_model=List[BinGuideline])
async def get_categories():
    """Returns all supported waste categories, bin recommendations, and eco guidelines."""
    return [
        BinGuideline(
            category=g["category"],
            bin_name=g["bin_name"],
            color_hex=g["color_hex"],
            badge_bg=g["badge_bg"],
            badge_text=g["badge_text"],
            icon=g["icon"],
            action_steps=g["action_steps"],
            eco_tip=g["eco_tip"]
        )
        for g in WASTE_GUIDELINES.values()
    ]


@app.post("/api/classify", response_model=ClassificationResponse)
async def classify_file_upload(file: UploadFile = File(...)):
    """Classifies an uploaded image file (multipart/form-data)."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image (JPEG, PNG, WEBP).")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        logger.error(f"Failed to decode uploaded image: {e}")
        raise HTTPException(status_code=400, detail="Invalid or corrupt image file.")

    category, confidence, predictions, guideline = model.classify_image(image)
    record_history(category, confidence, guideline)

    return ClassificationResponse(
        success=True,
        category=category,
        confidence=confidence,
        guideline=BinGuideline(**guideline),
        predictions=[PredictionItem(**p) for p in predictions],
        timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        filename=file.filename
    )


@app.post("/api/classify/base64", response_model=ClassificationResponse)
async def classify_base64_payload(payload: Base64ClassifyRequest):
    """Classifies a base64 encoded image string (e.g. from webcam capture)."""
    if not payload.image_base64:
        raise HTTPException(status_code=400, detail="Empty base64 payload provided.")

    try:
        image = decode_base64_image(payload.image_base64)
    except Exception as e:
        logger.error(f"Base64 image decode error: {e}")
        raise HTTPException(status_code=400, detail="Failed to decode base64 image data.")

    category, confidence, predictions, guideline = model.classify_image(image)
    record_history(category, confidence, guideline)

    return ClassificationResponse(
        success=True,
        category=category,
        confidence=confidence,
        guideline=BinGuideline(**guideline),
        predictions=[PredictionItem(**p) for p in predictions],
        timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        filename="webcam-capture.jpg"
    )


@app.get("/api/history", response_model=List[HistoryItem])
async def get_history():
    """Retrieve recent classification history logs."""
    return classification_history


@app.delete("/api/history")
async def clear_history():
    """Clear classification history."""
    classification_history.clear()
    return {"message": "Classification history cleared successfully."}


# Mount frontend static directory if present
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    logger.info(f"Frontend static files mounted from: {frontend_dir}")
else:
    @app.get("/")
    async def index_root():
        return {"message": "Intelligent Waste Classifier API is running. Visit /docs for OpenAPI documentation."}
