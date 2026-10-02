import datetime
from typing import Optional
from pydantic import BaseModel

class DownloadRequest(BaseModel):
    url: str
    mode: str = "video" # video | audio
    quality: str = "720p"

class DownloadResponse(BaseModel):
    id: int
    title: Optional[str] = None
    url: str
    mode: str
    quality: str
    filename: Optional[str] = None
    file_size_mb: float = 0.0
    status: str
    error_message: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class MediaFileItem(BaseModel):
    filename: str
    size_mb: float = 0.0
    modified_at: str = ""
    file_type: str = "video" # video | audio
    download_url: str = ""
    stream_url: Optional[str] = ""
    status: Optional[str] = "COMPLETED"
    title: Optional[str] = None
    job_id: Optional[int] = None
