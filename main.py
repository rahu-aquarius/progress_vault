from fastapi import FastAPI, Form, Request, Depends, Cookie, Response
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
import random
from datetime import timedelta

from database import engine, get_db, Base
from models import Video, Comment, Settings
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


# Prevent page caching
def add_no_cache_headers(response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


# Helper function to get/set settings
def get_setting(db: Session, key: str, default: str = "true"):
    setting = db.query(Settings).filter(Settings.key == key).first()
    if not setting:
        setting = Settings(key=key, value=default)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting.value


def set_setting(db: Session, key: str, value: str):
    setting = db.query(Settings).filter(Settings.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = Settings(key=key, value=value)
        db.add(setting)
    db.commit()


# STRICT authentication checker
def get_current_user(access_token: str = Cookie(None)):
    if not access_token:
        return None

    try:
        token = access_token.replace("Bearer ", "")
        payload = verify_token(token)
        return payload
    except:
        return None


# NEW: Require authentication decorator equivalent
def require_auth(user, required_role=None):
    if not user:
        return False
    if required_role and user.get("role") != required_role:
        return False
    return True


# ============= PUBLIC ROUTES =============

@app.get("/", response_class=HTMLResponse)
async def root(request: Request, user=Depends(get_current_user)):
    # If already logged in, redirect to appropriate page
    if user:
        if user.get("role") == "admin":
            return RedirectResponse(url="/admin/dashboard", status_code=303)
        else:
            return RedirectResponse(url="/viewing", status_code=303)

    response = templates.TemplateResponse("login.html", {"request": request})
    return add_no_cache_headers(response)


@app.get("/api/get-challenge")
async def get_challenge():
    code = generate_challenge_code()
    return {"code": code}


@app.post("/login-admin")
async def login_admin(password: str = Form(...)):
    if password == settings.ADMIN_PASSWORD:
        token = create_access_token(
            data={"sub": "admin", "role": "admin"},
            expires_delta=timedelta(minutes=5)
        )

        response = RedirectResponse(url="/admin/dashboard", status_code=303)
        response.set_cookie(
            key="access_token",
            value=f"Bearer {token}",
            httponly=True,
            max_age=300,
            samesite="lax"
        )
        return add_no_cache_headers(response)
    else:
        return RedirectResponse(url="/failed-login", status_code=303)


@app.get("/processing", response_class=HTMLResponse)
async def processing(request: Request):
    token = create_access_token(
        data={"sub": "guest", "role": "guest"},
        expires_delta=timedelta(minutes=5)
    )

    response = templates.TemplateResponse("processing.html", {"request": request})
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        max_age=300,
        samesite="lax"
    )
    return add_no_cache_headers(response)


@app.get("/api/check-guest-access")
async def check_guest_access(db: Session = Depends(get_db)):
    guest_enabled = get_setting(db, "guest_login_enabled", "true")
    return {"allowed": guest_enabled == "true"}


@app.get("/failed-login", response_class=HTMLResponse)
async def failed_login(request: Request):
    response = templates.TemplateResponse("failed.html", {"request": request})
    response.delete_cookie("access_token")
    return add_no_cache_headers(response)


@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/", status_code=303)
    response.delete_cookie("access_token")
    return add_no_cache_headers(response)


# ============= PROTECTED ROUTES - ADMIN =============

@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(
        request: Request,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    # STRICT CHECK: Must be authenticated AND must be admin
    if not require_auth(user, required_role="admin"):
        response = RedirectResponse(url="/", status_code=303)
        response.delete_cookie("access_token")
        return response

    videos = db.query(Video).order_by(Video.upload_date.desc()).all()
    guest_enabled = get_setting(db, "guest_login_enabled", "true") == "true"

    response = templates.TemplateResponse("admin_dashboard.html", {
        "request": request,
        "videos": videos,
        "user": user,
        "guest_login_enabled": guest_enabled
    })
    return add_no_cache_headers(response)


# ============= PROTECTED ROUTES - GUEST =============

@app.get("/viewing", response_class=HTMLResponse)
async def viewing_section(
        request: Request,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    # STRICT CHECK: Must be authenticated (admin OR guest)
    if not user:
        response = RedirectResponse(url="/", status_code=303)
        response.delete_cookie("access_token")
        return response

    # Get only non-hidden videos
    videos = db.query(Video).filter(Video.is_hidden == False).order_by(Video.upload_date.desc()).all()

    response = templates.TemplateResponse("viewing_section.html", {
        "request": request,
        "videos": videos,
        "user": user
    })
    return add_no_cache_headers(response)


# NEW: API to verify authentication status
@app.get("/api/verify-auth")
async def verify_auth(user=Depends(get_current_user)):
    if not user:
        return JSONResponse(
            status_code=401,
            content={"authenticated": False, "role": None}
        )
    return {
        "authenticated": True,
        "role": user.get("role"),
        "expires_at": user.get("exp")
    }


# ============= ADMIN API ROUTES =============

@app.post("/admin/toggle-guest-access")
async def toggle_guest_access(
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    current = get_setting(db, "guest_login_enabled", "true")
    new_value = "false" if current == "true" else "true"
    set_setting(db, "guest_login_enabled", new_value)

    return {"success": True, "enabled": new_value == "true"}


@app.post("/admin/video/add")
async def add_video(
        title: str = Form(...),
        youtube_url: str = Form(...),
        description: str = Form(""),
        category: str = Form("General"),
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not require_auth(user, required_role="admin"):
        return RedirectResponse(url="/", status_code=303)

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
async def delete_video(
        video_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        db.delete(video)
        db.commit()

    return {"success": True}


@app.post("/admin/video/toggle-hide/{video_id}")
async def toggle_hide_video(
        video_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        video.is_hidden = not video.is_hidden
        db.commit()

    return {"success": True, "is_hidden": video.is_hidden}
