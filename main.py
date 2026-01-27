from fastapi import FastAPI, Form, Request, Depends, Cookie, Response
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
import random
from datetime import timedelta, datetime, timezone
from passlib.context import CryptContext
from database import engine, get_db, Base
from models import Video, Comment, Settings, Heading
from config import settings
from auth import create_access_token, verify_token

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

CODE_POOL = "0123456789SAMIPARYAL"

# Nepal timezone offset
NEPAL_OFFSET = timedelta(hours=5, minutes=45)


def get_cache_buster():
    return int(datetime.now().timestamp())


def generate_challenge_code():
    return ''.join(random.choice(CODE_POOL) for _ in range(7))


def add_no_cache_headers(response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


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


def get_current_user(access_token: str = Cookie(None)):
    if not access_token:
        return None

    try:
        token = access_token.replace("Bearer ", "")
        payload = verify_token(token)
        return payload
    except:
        return None


def require_auth(user, required_role=None):
    if not user:
        return False
    if required_role and user.get("role") != required_role:
        return False
    return True


# ============= PUBLIC ROUTES =============

@app.get("/", response_class=HTMLResponse)
async def root(request: Request, user=Depends(get_current_user)):
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
async def login_admin(password: str = Form(...), db: Session = Depends(get_db)):
    db_password = None
    try:
        db_password_setting = db.query(Settings).filter(Settings.key == "admin_password").first()
        if db_password_setting:
            db_password = db_password_setting.value
    except:
        pass

    correct_password = db_password if db_password else settings.ADMIN_PASSWORD

    if password == correct_password:
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

@app.post("/admin/change-password")
async def change_password(
        current_password: str = Form(...),
        new_password: str = Form(...),
        confirm_checkbox: str = Form(...),
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    db_password_setting = db.query(Settings).filter(Settings.key == "admin_password").first()
    current_correct_password = db_password_setting.value if db_password_setting else settings.ADMIN_PASSWORD

    if current_password != current_correct_password:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": "Current password is incorrect"
        })

    if confirm_checkbox != "true":
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": "You must confirm by checking the box"
        })

    if len(new_password) < 8:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": "New password must be at least 8 characters"
        })

    set_setting(db, "admin_password", new_password)
    settings.ADMIN_PASSWORD = new_password

    return {
        "success": True,
        "message": "Password changed successfully. You will need to login again with the new password."
    }


@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(
        request: Request,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
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
        "guest_login_enabled": guest_enabled,
        "cache_buster": get_cache_buster()
    })
    return add_no_cache_headers(response)


# ============= PROTECTED ROUTES - GUEST =============

@app.get("/viewing", response_class=HTMLResponse)
async def viewing_section(
        request: Request,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not user:
        response = RedirectResponse(url="/", status_code=303)
        response.delete_cookie("access_token")
        return response

    videos = db.query(Video).filter(Video.is_hidden == False).order_by(Video.upload_date.desc()).all()

    response = templates.TemplateResponse("viewing_section.html", {
        "request": request,
        "videos": videos,
        "user": user
    })
    return add_no_cache_headers(response)


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


@app.get("/api/check-session")
async def check_session(user=Depends(get_current_user)):
    if not user:
        return JSONResponse(
            status_code=401,
            content={"valid": False}
        )

    import time
    exp_timestamp = user.get("exp", 0)
    current_timestamp = time.time()

    if current_timestamp >= exp_timestamp:
        return JSONResponse(
            status_code=401,
            content={"valid": False}
        )

    return {"valid": True, "expires_in": int(exp_timestamp - current_timestamp)}


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


# ============= HEADING ROUTES =============

@app.post("/admin/heading/create")
async def create_heading(
        heading_type: str = Form(...),
        heading_name: str = Form(...),
        parent_heading_id: int = Form(None),
        subheading_number: int = Form(None),
        tags: str = Form(None),
        visibility: str = Form(...),
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})

    try:
        new_heading = Heading(
            heading_type=heading_type,
            heading_name=heading_name,
            parent_heading_id=parent_heading_id,
            subheading_number=subheading_number,
            tags=tags if tags else "",
            visibility=visibility
        )
        db.add(new_heading)
        db.commit()
        db.refresh(new_heading)

        nepal_time = new_heading.created_at + NEPAL_OFFSET

        return JSONResponse(content={
            "success": True,
            "message": f"{heading_type.capitalize()} created successfully!",
            "heading": {
                "id": new_heading.id,
                "heading_type": new_heading.heading_type,
                "heading_name": new_heading.heading_name,
                "parent_heading_id": new_heading.parent_heading_id,
                "subheading_number": new_heading.subheading_number,
                "tags": new_heading.tags,
                "visibility": new_heading.visibility,
                "created_at": nepal_time.strftime("%B %d, %Y %I:%M %p")
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@app.get("/api/headings")
async def get_headings(
        visibility: str = None,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
        query = db.query(Heading).order_by(Heading.created_at.desc())

        if visibility:
            query = query.filter(Heading.visibility == visibility)

        headings = query.all()

        return JSONResponse(content={
            "success": True,
            "headings": [
                {
                    "id": h.id,
                    "heading_type": h.heading_type,
                    "heading_name": h.heading_name,
                    "parent_heading_id": h.parent_heading_id,
                    "subheading_number": h.subheading_number,
                    "tags": h.tags,
                    "visibility": h.visibility,
                    "created_at": (h.created_at + NEPAL_OFFSET).strftime("%B %d, %Y %I:%M %p")
                }
                for h in headings
            ]
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.get("/api/headings/list")
async def list_headings_only(
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
        headings = db.query(Heading).filter(Heading.heading_type == "heading").order_by(Heading.heading_name).all()
        return JSONResponse(content={
            "success": True,
            "headings": [
                {"id": h.id, "name": h.heading_name}
                for h in headings
            ]
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.get("/api/subheading/next-number/{parent_id}")
async def get_next_subheading_number(
        parent_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
        count = db.query(Heading).filter(
            Heading.parent_heading_id == parent_id,
            Heading.heading_type == "subheading"
        ).count()

        return JSONResponse(content={
            "success": True,
            "next_number": count + 1
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


# Get subheadings for a specific heading (for small heading form)
@app.get("/api/subheadings/by-heading/{heading_id}")
async def get_subheadings_by_heading(
        heading_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
        subheadings = db.query(Heading).filter(
            Heading.heading_type == "subheading",
            Heading.parent_heading_id == heading_id
        ).order_by(Heading.subheading_number).all()

        return JSONResponse(content={
            "success": True,
            "subheadings": [
                {"id": sh.id, "name": f"{sh.subheading_number}) {sh.heading_name}"}
                for sh in subheadings
            ]
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


# Get next small heading number for a parent subheading
@app.get("/api/smallheading/next-number/{subheading_id}")
async def get_next_smallheading_number(
        subheading_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
        # Count existing small headings under this subheading
        count = db.query(Heading).filter(
            Heading.parent_heading_id == subheading_id,
            Heading.heading_type == "smallheading"
        ).count()

        return JSONResponse(content={
            "success": True,
            "next_number": count + 1
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

