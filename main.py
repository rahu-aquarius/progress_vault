from fastapi import FastAPI, Form, Request, Depends, Cookie, Response, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
import random
from datetime import timedelta, datetime, timezone
from passlib.context import CryptContext
from database import engine, get_db, Base
from models import Video, Comment, Settings, Heading, Post
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


# ============================================
# DASHBOARD STATS API - Get video/post counts
# ============================================
@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Get dashboard statistics for admin"""
    if not require_auth(user, required_role='admin'):
        return JSONResponse(status_code=401, content={'error': 'Unauthorized'})

    try:
        # Count all posts (these are your "videos")
        total_posts = db.query(Post).count()

        # Count by visibility
        public_posts = db.query(Post).filter(Post.visibility == 'public').count()
        private_posts = db.query(Post).filter(Post.visibility == 'private').count()

        # Count headings
        total_headings = db.query(Heading).filter(Heading.heading_type == 'heading').count()
        total_subheadings = db.query(Heading).filter(Heading.heading_type == 'subheading').count()
        total_smallheadings = db.query(Heading).filter(Heading.heading_type == 'smallheading').count()

        return JSONResponse(content={
            'success': True,
            'stats': {
                'total_posts': total_posts,
                'public_posts': public_posts,
                'private_posts': private_posts,
                'total_headings': total_headings,
                'total_subheadings': total_subheadings,
                'total_smallheadings': total_smallheadings
            }
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={'success': False, 'error': str(e)})


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


@app.get("/api/smallheading/next-number/{subheading_id}")
async def get_next_smallheading_number(
        subheading_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
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


@app.get("/api/heading/{heading_id}")
async def get_heading(
        heading_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Get a single heading by ID"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
        heading = db.query(Heading).filter(Heading.id == heading_id).first()
        if not heading:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Heading not found"}
            )

        nepal_time = heading.created_at + NEPAL_OFFSET

        return JSONResponse(content={
            "success": True,
            "heading": {
                "id": heading.id,
                "heading_type": heading.heading_type,
                "heading_name": heading.heading_name,
                "parent_heading_id": heading.parent_heading_id,
                "subheading_number": heading.subheading_number,
                "tags": heading.tags,
                "visibility": heading.visibility,
                "created_at": nepal_time.strftime("%B %d, %Y %I:%M %p")
            }
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.post("/admin/heading/edit/{heading_id}")
async def edit_heading(
        heading_id: int,
        heading_name: str = Form(...),
        visibility: str = Form(...),
        tags: str = Form(None),
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Edit an existing heading/subheading/smallheading"""
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})

    try:
        heading = db.query(Heading).filter(Heading.id == heading_id).first()
        if not heading:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Heading not found"}
            )

        heading.heading_name = heading_name
        heading.visibility = visibility
        if tags:
            heading.tags = tags

        db.commit()

        return JSONResponse(content={
            "success": True,
            "message": f"{heading.heading_type.capitalize()} updated successfully!"
        })

    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@app.delete("/admin/heading/delete/{heading_id}")
async def delete_heading(
        heading_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Delete a heading and all its children INCLUDING POSTS (cascade delete)"""
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})

    try:
        heading = db.query(Heading).filter(Heading.id == heading_id).first()
        if not heading:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Heading not found"}
            )

        heading_type = heading.heading_type

        # CASCADE DELETE WITH POSTS
        if heading_type == "heading":
            # Get all subheadings under this heading
            subheadings = db.query(Heading).filter(
                Heading.parent_heading_id == heading_id,
                Heading.heading_type == "subheading"
            ).all()

            for subheading in subheadings:
                # Get all small headings under each subheading
                smallheadings = db.query(Heading).filter(
                    Heading.parent_heading_id == subheading.id,
                    Heading.heading_type == "smallheading"
                ).all()

                # Delete posts under each small heading
                for smallheading in smallheadings:
                    db.query(Post).filter(Post.parent_heading_id == smallheading.id).delete()

                # Delete all small headings under this subheading
                db.query(Heading).filter(
                    Heading.parent_heading_id == subheading.id,
                    Heading.heading_type == "smallheading"
                ).delete()

                # Delete posts directly under the subheading (if no small headings)
                db.query(Post).filter(Post.parent_heading_id == subheading.id).delete()

            # Delete all subheadings
            db.query(Heading).filter(
                Heading.parent_heading_id == heading_id,
                Heading.heading_type == "subheading"
            ).delete()

        elif heading_type == "subheading":
            # Get all small headings under this subheading
            smallheadings = db.query(Heading).filter(
                Heading.parent_heading_id == heading_id,
                Heading.heading_type == "smallheading"
            ).all()

            # Delete posts under each small heading
            for smallheading in smallheadings:
                db.query(Post).filter(Post.parent_heading_id == smallheading.id).delete()

            # Delete all small headings
            db.query(Heading).filter(
                Heading.parent_heading_id == heading_id,
                Heading.heading_type == "smallheading"
            ).delete()

            # Delete posts directly under this subheading (if no small headings)
            db.query(Post).filter(Post.parent_heading_id == heading_id).delete()

        elif heading_type == "smallheading":
            # Delete all posts under this small heading
            db.query(Post).filter(Post.parent_heading_id == heading_id).delete()

        # Finally, delete the heading itself
        db.delete(heading)
        db.commit()

        return JSONResponse(content={
            "success": True,
            "message": f"{heading_type.capitalize()} deleted successfully!"
        })

    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )



# ============= PUBLIC CONTENT API (FOR VIEWER MODE & GUEST VIEWING) =============

@app.get("/api/public-content")
async def get_public_content(db: Session = Depends(get_db)):
    """
    Get hierarchical content with cascading visibility filtering.
    Rules:
    - Private heading → hide everything inside
    - Private subheading → hide everything inside (even if public)
    - Private small heading → hide posts inside
    - Private post → hide that specific post
    """
    try:
        # Get all main headings (no parent)
        main_headings = db.query(Heading).filter(
            Heading.heading_type == "heading",
            Heading.parent_heading_id == None
        ).order_by(Heading.created_at.desc()).all()

        result = []

        for heading in main_headings:
            # RULE 1: Skip if heading is private
            if heading.visibility == "private":
                continue

            # Heading is public, process it
            heading_data = {
                "id": heading.id,
                "type": "heading",
                "name": heading.heading_name,
                "visibility": heading.visibility,
                "created_at": (heading.created_at + NEPAL_OFFSET).strftime("%B %d, %Y %I:%M %p"),
                "subheadings": []
            }

            # Get subheadings under this heading
            subheadings = db.query(Heading).filter(
                Heading.heading_type == "subheading",
                Heading.parent_heading_id == heading.id
            ).order_by(Heading.subheading_number).all()

            for subheading in subheadings:
                # RULE 2: Skip if subheading is private
                if subheading.visibility == "private":
                    continue

                # Subheading is public, process it
                subheading_data = {
                    "id": subheading.id,
                    "type": "subheading",
                    "name": subheading.heading_name,
                    "number": subheading.subheading_number,
                    "visibility": subheading.visibility,
                    "created_at": (subheading.created_at + NEPAL_OFFSET).strftime("%B %d, %Y %I:%M %p"),
                    "smallheadings": [],
                    "posts": []
                }

                # Get small headings under this subheading
                smallheadings = db.query(Heading).filter(
                    Heading.heading_type == "smallheading",
                    Heading.parent_heading_id == subheading.id
                ).order_by(Heading.subheading_number).all()

                if smallheadings:
                    # Has small headings - process them
                    for smallheading in smallheadings:
                        # RULE 3: Skip if small heading is private
                        if smallheading.visibility == "private":
                            continue

                        # Small heading is public, get its posts
                        posts = db.query(Post).filter(
                            Post.parent_heading_id == smallheading.id
                        ).order_by(Post.created_at.desc()).all()

                        # Filter out private posts (RULE 4)
                        public_posts = []
                        for post in posts:
                            if post.visibility == "public":
                                # Extract YouTube video ID
                                video_id = ""
                                if "v=" in post.video_url:
                                    video_id = post.video_url.split("v=")[-1].split("&")[0]
                                elif "youtu.be/" in post.video_url:
                                    video_id = post.video_url.split("youtu.be/")[-1].split("?")[0]

                                thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg" if video_id else ""

                                public_posts.append({
                                    "id": post.id,
                                    "title": post.post_title,
                                    "video_url": post.video_url,
                                    "video_id": video_id,
                                    "thumbnail_url": thumbnail_url,
                                    "description": post.post_description,
                                    "visibility": post.visibility,
                                    "created_at": (post.created_at + NEPAL_OFFSET).strftime("%B %d, %Y %I:%M %p")
                                })

                        # Only add small heading if it has public posts
                        if public_posts:
                            smallheading_data = {
                                "id": smallheading.id,
                                "type": "smallheading",
                                "name": smallheading.heading_name,
                                "number": smallheading.subheading_number,
                                "visibility": smallheading.visibility,
                                "created_at": (smallheading.created_at + NEPAL_OFFSET).strftime("%B %d, %Y %I:%M %p"),
                                "posts": public_posts
                            }
                            subheading_data["smallheadings"].append(smallheading_data)

                else:
                    # No small headings - get posts directly under subheading
                    posts = db.query(Post).filter(
                        Post.parent_heading_id == subheading.id
                    ).order_by(Post.created_at.desc()).all()

                    # Filter out private posts (RULE 4)
                    for post in posts:
                        if post.visibility == "public":
                            # Extract YouTube video ID
                            video_id = ""
                            if "v=" in post.video_url:
                                video_id = post.video_url.split("v=")[-1].split("&")[0]
                            elif "youtu.be/" in post.video_url:
                                video_id = post.video_url.split("youtu.be/")[-1].split("?")[0]

                            thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg" if video_id else ""

                            subheading_data["posts"].append({
                                "id": post.id,
                                "title": post.post_title,
                                "video_url": post.video_url,
                                "video_id": video_id,
                                "thumbnail_url": thumbnail_url,
                                "description": post.post_description,
                                "visibility": post.visibility,
                                "created_at": (post.created_at + NEPAL_OFFSET).strftime("%B %d, %Y %I:%M %p")
                            })

                # Only add subheading if it has content (small headings or posts)
                if subheading_data["smallheadings"] or subheading_data["posts"]:
                    heading_data["subheadings"].append(subheading_data)

            # Only add heading if it has subheadings with content
            if heading_data["subheadings"]:
                result.append(heading_data)

        return JSONResponse(content={
            "success": True,
            "content": result
        })

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


# ============= POST ROUTES =============

@app.post("/admin/post/create")
async def create_post(
        parent_heading_id: int = Form(...),
        post_title: str = Form(...),           # NEW
        video_url: str = Form(...),            # NEW
        post_description: str = Form(None),    # NEW
        visibility: str = Form("public"),
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Create a new video post under a subheading or small heading"""
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})

    try:
        parent = db.query(Heading).filter(Heading.id == parent_heading_id).first()
        if not parent:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Parent heading not found"}
            )

        if parent.heading_type not in ["subheading", "smallheading"]:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Posts can only be created under subheadings or small headings"}
            )

        if parent.heading_type == "subheading":
            has_small_headings = db.query(Heading).filter(
                Heading.parent_heading_id == parent_heading_id,
                Heading.heading_type == "smallheading"
            ).count() > 0

            if has_small_headings:
                return JSONResponse(
                    status_code=400,
                    content={"success": False,
                             "error": "This subheading has small headings. Please add posts to the small headings instead."}
                )

        new_post = Post(
            parent_heading_id=parent_heading_id,
            post_title=post_title,
            video_url=video_url,
            post_description=post_description if post_description else "",
            visibility=visibility
        )
        db.add(new_post)
        db.commit()
        db.refresh(new_post)

        nepal_time = new_post.created_at + NEPAL_OFFSET

        return JSONResponse(content={
            "success": True,
            "message": "Video post created successfully!",
            "post": {
                "id": new_post.id,
                "parent_heading_id": new_post.parent_heading_id,
                "post_title": new_post.post_title,
                "video_url": new_post.video_url,
                "post_description": new_post.post_description,
                "visibility": new_post.visibility,
                "created_at": nepal_time.strftime("%B %d, %Y %I:%M %p")
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@app.get("/api/posts/by-heading/{heading_id}")
async def get_posts_by_heading(
        heading_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Get all posts under a specific heading"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
        posts = db.query(Post).filter(
            Post.parent_heading_id == heading_id
        ).order_by(Post.created_at.desc()).all()

        return JSONResponse(content={
            "success": True,
            "posts": [
                {
                    "id": p.id,
                    "parent_heading_id": p.parent_heading_id,
                    "post_title": p.post_title if p.post_title else "",
                    "video_url": p.video_url if p.video_url else "",
                    "post_description": p.post_description if p.post_description else "",
                    "post_content": p.post_content if p.post_content else "",  # backward compatibility
                    "visibility": p.visibility,
                    "created_at": (p.created_at + NEPAL_OFFSET).strftime("%B %d, %Y %I:%M %p"),
                    "updated_at": (p.updated_at + NEPAL_OFFSET).strftime("%B %d, %Y %I:%M %p")
                }
                for p in posts
            ]
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.get("/api/post/{post_id}")
async def get_post(
        post_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Get a single post by ID"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Post not found"}
            )

        nepal_time_created = post.created_at + NEPAL_OFFSET
        nepal_time_updated = post.updated_at + NEPAL_OFFSET

        return JSONResponse(content={
            "success": True,
            "post": {
                "id": post.id,
                "parent_heading_id": post.parent_heading_id,
                "post_title": post.post_title if post.post_title else "",
                "video_url": post.video_url if post.video_url else "",
                "post_description": post.post_description if post.post_description else "",
                "post_content": post.post_content if post.post_content else "",  # backward compatibility
                "visibility": post.visibility,
                "created_at": nepal_time_created.strftime("%B %d, %Y %I:%M %p"),
                "updated_at": nepal_time_updated.strftime("%B %d, %Y %I:%M %p")
            }
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.post("/admin/post/edit/{post_id}")
async def edit_post(
        post_id: int,
        post_title: str = Form(...),           # NEW
        video_url: str = Form(...),            # NEW
        post_description: str = Form(None),    # NEW
        visibility: str = Form(...),
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Edit an existing video post"""
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})

    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Post not found"}
            )

        post.post_title = post_title
        post.video_url = video_url
        post.post_description = post_description if post_description else ""
        post.visibility = visibility
        post.updated_at = datetime.utcnow()

        db.commit()

        return JSONResponse(content={
            "success": True,
            "message": "Video post updated successfully!"
        })

    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@app.delete("/admin/post/delete/{post_id}")
async def delete_post(
        post_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Delete a post"""
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})

    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Post not found"}
            )

        db.delete(post)
        db.commit()

        return JSONResponse(content={
            "success": True,
            "message": "Post deleted successfully!"
        })

    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@app.get("/api/check-can-add-post/{heading_id}")
async def check_can_add_post(
        heading_id: int,
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Check if posts can be added to this heading"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    try:
        heading = db.query(Heading).filter(Heading.id == heading_id).first()
        if not heading:
            return JSONResponse(content={"can_add": False, "reason": "Heading not found"})

        if heading.heading_type not in ["subheading", "smallheading"]:
            return JSONResponse(
                content={"can_add": False, "reason": "Only subheadings and small headings can have posts"})

        if heading.heading_type == "subheading":
            has_small_headings = db.query(Heading).filter(
                Heading.parent_heading_id == heading_id,
                Heading.heading_type == "smallheading"
            ).count() > 0

            if has_small_headings:
                return JSONResponse(content={"can_add": False,
                                             "reason": "This subheading has small headings. Add posts to small headings instead."})

        return JSONResponse(content={"can_add": True, "reason": ""})

    except Exception as e:
        return JSONResponse(content={"can_add": False, "reason": str(e)})


# ============= CLEANUP ORPHANED POSTS (RUN ONCE) =============

@app.post("/admin/cleanup-orphaned-posts")
async def cleanup_orphaned_posts(
        db: Session = Depends(get_db),
        user=Depends(get_current_user)
):
    """Remove posts whose parent heading no longer exists"""
    if not require_auth(user, required_role="admin"):
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})

    try:
        # Get all posts
        all_posts = db.query(Post).all()
        deleted_count = 0

        for post in all_posts:
            # Check if parent heading exists
            parent_exists = db.query(Heading).filter(Heading.id == post.parent_heading_id).first()
            if not parent_exists:
                db.delete(post)
                deleted_count += 1

        db.commit()

        return JSONResponse(content={
            "success": True,
            "message": f"Cleaned up {deleted_count} orphaned posts"
        })
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
