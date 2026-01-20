from database import engine, Base
import models
from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

# Create tables automatically
models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="Progress Vault")

# Setup Templates (HTML)
templates = Jinja2Templates(directory="templates")

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "message": "Welcome to the Vault"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
