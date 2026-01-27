# models.py
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    youtube_url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    upload_date = Column(DateTime, default=datetime.utcnow)
    is_hidden = Column(Boolean, default=False)
    view_count = Column(Integer, default=0)
    category = Column(String, nullable=True)
    duration = Column(String, nullable=True)

    comments = relationship("Comment", back_populates="video", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"))
    author_name = Column(String, default="Guest")
    comment_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_hidden = Column(Boolean, default=False)

    video = relationship("Video", back_populates="comments")


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Heading(Base):
    __tablename__ = "headings"

    id = Column(Integer, primary_key=True, index=True)
    heading_type = Column(String)  # 'heading', 'subheading', 'smallheading'
    heading_name = Column(String)
    parent_heading_id = Column(Integer, nullable=True)  # NEW - for subheadings under headings
    subheading_number = Column(Integer, nullable=True)  # NEW - serial number like 1, 2, 3
    tags = Column(String, nullable=True)
    visibility = Column(String)  # 'public' or 'private'
    created_at = Column(DateTime, default=datetime.utcnow)

