from typing import List, Optional
from pydantic import BaseModel, Field


class PredictionItem(BaseModel):
    label: str
    score: float = Field(..., description="Score between 0 and 1")
    percentage: float = Field(..., description="Score formatted as percentage 0-100")


class BinGuideline(BaseModel):
    category: str
    bin_name: str
    color_hex: str
    badge_bg: str
    badge_text: str
    icon: str
    action_steps: List[str]
    eco_tip: str


class ClassificationResponse(BaseModel):
    success: bool = True
    category: str
    confidence: float
    guideline: BinGuideline
    predictions: List[PredictionItem]
    timestamp: str
    filename: Optional[str] = None


class Base64ClassifyRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image string or data URL")


class HistoryItem(BaseModel):
    id: str
    timestamp: str
    category: str
    confidence: float
    bin_name: str
    color_hex: str
    icon: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str
    device: str
    version: str = "1.0.0"
