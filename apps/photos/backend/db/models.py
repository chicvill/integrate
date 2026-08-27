"""
apps/photos/backend/db/models.py
SQLAlchemy models for Photos & Media Gallery.
"""
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from shared.core.base_database import Base


class PhotoAlbum(Base):
    __tablename__ = "photo_albums"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), default="default", index=True)
    name = Column(String(100), nullable=False)
    folder_path = Column(String(255), unique=True, nullable=False)
    cover_image_url = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    item_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class MediaItem(Base):
    __tablename__ = "photo_media_items"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), default="default", index=True)
    album_id = Column(Integer, ForeignKey("photo_albums.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(255), nullable=False)
    relative_path = Column(String(500), unique=True, nullable=False)
    media_type = Column(String(20), default="image") # image, video, document
    file_size_bytes = Column(Integer, default=0)
    mime_type = Column(String(100), nullable=True)
    ai_tags = Column(Text, nullable=True) # JSON list or comma-separated
    ai_description = Column(Text, nullable=True)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
