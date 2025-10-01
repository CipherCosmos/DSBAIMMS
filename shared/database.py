from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lms_user:lms_password@localhost:5432/lms_db")

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Create all tables based on the refactored models"""
    Base.metadata.create_all(bind=engine)

def drop_tables():
    """Drop all tables - use with caution"""
    Base.metadata.drop_all(bind=engine)