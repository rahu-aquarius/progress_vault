from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import random

app = FastAPI()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Character pool for code generation
CODE_POOL = "0123456789SAMIPARYAL"


def generate_challenge_code():
    """Generate a random 7-character code"""
    return ''.join(random.choice(CODE_POOL) for _ in range(7))


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main login page"""
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/api/get-challenge")
async def get_challenge():
    """Return a new challenge code"""
    code = generate_challenge_code()
    return {"code": code}


@app.post("/login-admin")
async def login_admin(password: str = Form(...)):
    """Admin login endpoint"""
    ADMIN_PASSWORD = "your_secure_password_here"  # Change this

    if password == ADMIN_PASSWORD:
        return RedirectResponse(url="/dashboard", status_code=303)
    else:
        return RedirectResponse(url="/failed-login", status_code=303)


@app.get("/failed-login", response_class=HTMLResponse)
async def failed_login(request: Request):
    """Failed login page"""
    return templates.TemplateResponse("failed.html", {"request": request})


@app.get("/success", response_class=HTMLResponse)
async def success(request: Request):
    """Success page"""
    return templates.TemplateResponse("success.html", {"request": request})


@app.get("/dashboard")
async def dashboard():
    """Protected dashboard"""
    return {"message": "Welcome to Progress Vault"}
