from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Date, DateTime
from sqlalchemy.orm import relationship
import datetime
from database import Base


class VideoEntry(Base):
    __tablename__ = "video_entries"

    id = Column(Integer, primary_key=True, index=True)
    date_posted = Column(Date, unique=True)  # One video per day
    video_url = Column(String, nullable=True)  # YouTube/Drive link
    status = Column(String, default="Pending")  # "Pending", "Completed", "Missed"

    # Relationship: A video can have many comments
    comments = relationship("Comment", back_populates="video")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    author = Column(String)  # "Samip" or "Guest"
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.now)
    is_admin = Column(Boolean, default=False)  # True if Samip wrote it

    # Foreign Key: Which video is this comment for?
    # If NULL, it is a "General Comment" for the whole site.
    video_id = Column(Integer, ForeignKey("video_entries.id"), nullable=True)

    # Relationship link back to video
    video = relationship("VideoEntry", back_populates="comments")
