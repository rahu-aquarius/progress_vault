# main.py
from fastapi import FastAPI, Form, Request, Depends, Cookie, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
import random
from datetime import timedelta

from database import engine, get_db, Base
from models import Video, Comment
from config import settings
from auth import create_access_token, verify_token

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

CODE_POOL = "0123456789SAMIPARYAL"


def generate_challenge_code():
    return ''.join(random.choice(CODE_POOL) for _ in range(7))


# ============= AUTHENTICATION ROUTES =============

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/api/get-challenge")
async def get_challenge():
    code = generate_challenge_code()
    return {"code": code}


@app.post("/login-admin")
async def login_admin(password: str = Form(...)):
    if password == settings.ADMIN_PASSWORD:
        # Create JWT token with 5-min expiry
        token = create_access_token(
            data={"sub": "admin", "role": "admin"},
            expires_delta=timedelta(minutes=5)
        )

        response = RedirectResponse(url="/admin/dashboard", status_code=303)
        response.set_cookie(
            key="access_token",
            value=f"Bearer {token}",
            httponly=True,
            max_age=300,  # 5 minutes
            samesite="lax"
        )
        return response
    else:
        return RedirectResponse(url="/failed-login", status_code=303)


@app.get("/guest-success")
async def guest_success():
    # Create guest JWT token
    token = create_access_token(
        data={"sub": "guest", "role": "guest"},
        expires_delta=timedelta(minutes=5)
    )

    response = RedirectResponse(url="/viewing", status_code=303)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        max_age=300,
        samesite="lax"
    )
    return response


@app.get("/failed-login", response_class=HTMLResponse)
async def failed_login(request: Request):
    return templates.TemplateResponse("failed.html", {"request": request})


@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/", status_code=303)
    response.delete_cookie("access_token")
    return response


# ============= PROTECTED ROUTES =============

def get_current_user(access_token: str = Cookie(None)):
    if not access_token:
        return None

    token = access_token.replace("Bearer ", "")
    payload = verify_token(token)
    return payload


@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not user or user.get("role") != "admin":
        return RedirectResponse(url="/", status_code=303)

    # Get all videos
    videos = db.query(Video).order_by(Video.upload_date.desc()).all()

    return templates.TemplateResponse("admin_dashboard.html", {
        "request": request,
        "videos": videos,
        "user": user
    })


@app.get("/viewing", response_class=HTMLResponse)
async def viewing_section(request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not user:
        return RedirectResponse(url="/", status_code=303)

    # Get only non-hidden videos
    videos = db.query(Video).filter(Video.is_hidden == False).order_by(Video.upload_date.desc()).all()

    return templates.TemplateResponse("viewing_section.html", {
        "request": request,
        "videos": videos,
        "user": user
    })


# ============= ADMIN API ROUTES =============

@app.post("/admin/video/add")
async def add_video(
        title: str = Form(...),
        youtube_url: str = Form(...),
        description: str = Form(""),
        category: str = Form("General"),
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not user or user.get("role") != "admin":
        return RedirectResponse(url="/", status_code=303)

    # Extract video ID from YouTube URL
    video_id = youtube_url.split("v=")[-1].split("&")[0] if "v=" in youtube_url else ""
    thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg" if video_id else ""

    new_video = Video(
        title=title,
        youtube_url=youtube_url,
        description=description,
        category=category,
        thumbnail_url=thumbnail_url
    )

    db.add(new_video)
    db.commit()

    return RedirectResponse(url="/admin/dashboard", status_code=303)


@app.post("/admin/video/delete/{video_id}")
async def delete_video(video_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not user or user.get("role") != "admin":
        return {"error": "Unauthorized"}

    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        db.delete(video)
        db.commit()

    return {"success": True}


@app.post("/admin/video/toggle-hide/{video_id}")
async def toggle_hide_video(video_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not user or user.get("role") != "admin":
        return {"error": "Unauthorized"}

    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        video.is_hidden = not video.is_hidden
        db.commit()

    return {"success": True, "is_hidden": video.is_hidden}
