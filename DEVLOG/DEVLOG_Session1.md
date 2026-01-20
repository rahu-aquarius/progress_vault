# Development Log - Progress Vault

## Project Overview
Goal: Build an accountability video journal app ("Progress Vault") where the user must upload daily videos.
Authentication: "Bitcoin Price Puzzle" for guests, Fixed Password for Admin.

## Session 1: Setup & Infrastructure (Completed)
- [x] **Project Initialization**
    - Created `progress_vault` folder.
    - Set up Virtual Environment (`venv`).
    - Installed PyCharm.
- [x] **Git & GitHub Configuration (The Hard Part)**
    - Configured `.gitignore` (ignored venv, .env, .db).
    - Solved Authentication issues (PAT Token).
    - Solved "Repo Not Found" (Private Repo permissions & URL typos).
    - Successfully pushed to `main`.
- [x] **Tech Stack Installation**
    - Installed `fastapi`, `uvicorn`, `jinja2`, `sqlalchemy`.
    - Generated `requirements.txt`.
- [x] **"Hello World" Implementation**
    - Created `main.py` (Basic FastAPI app).
    - Created `templates/index.html`.
    - Verified server runs on `http://127.0.0.1:8000`.

## Git Workflow Mastery (Learned)
1. **Branching:** Created `feature/initial-setup`.
2. **Merging:** Pushed branch -> Created Pull Request on GitHub -> Merged to Main.
3. **Syncing:** `git checkout main` -> `git pull` (To sync local laptop with GitHub server).

## Next Steps (Session 2)
- [ ] **Database Setup:** Create `models.py` for Video Entries and Comments.
- [ ] **The "Bitcoin Challenge":** Implement the background task to fetch BTC price.
- [ ] **Auth System:** Build the "Who are you?" login screen.
