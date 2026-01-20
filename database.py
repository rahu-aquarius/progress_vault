from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# The address of our database (It will create a file named 'progress.db')
SQLALCHEMY_DATABASE_URL = "sqlite:///./progress.db"

# Create the engine (The actual connection)
# check_same_thread=False is needed only for SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# A session factory (It creates new database sessions for each request)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# The Base class (All our models will inherit from this)
Base = declarative_base()

# Dependency (We use this in main.py to get a DB session)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
