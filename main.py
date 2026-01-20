from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import asyncio
import uvicorn

# Import database stuff
from database import engine, Base
import models

# Import our new background task
from services import update_password_task

# 1. Create the Database Tables
Base.metadata.create_all(bind=engine)

# 2. Define the Lifecycle (Startup/Shutdown logic)
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- SERVER STARTING: Initializing Bitcoin Security Protocol ---")
    # Start the background task
    task = asyncio.create_task(update_password_task())
    yield
    print("--- SERVER STOPPING ---")
    task.cancel()

# 3. Create the App
app = FastAPI(title="Progress Vault", lifespan=lifespan)

# 4. Setup Templates
templates = Jinja2Templates(directory="templates")

# 5. Basic Route
@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "message": "System Online - Ready for Auth Interface"
    })

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
