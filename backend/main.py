from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import date, timedelta
import os
import numpy as np
import cv2

import models
import schemas
from database import engine, SessionLocal
from pose.detector import detect_landmarks
from exercises.squat import analyze_squat

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_reset_token,
    verify_reset_token,
)

from fastapi_mail import FastMail, MessageSchema
from email_config import conf
from dotenv import load_dotenv

# =========================
# ENV + DATABASE
# =========================

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# DATABASE SESSION
# =========================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =========================
# AUTH
# =========================

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")

        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.email == email).first()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return user

# =========================
# REGISTER
# =========================

@app.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):

    existing_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        username=user.username,
        email=user.email,
        password=hash_password(user.password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully"}

# =========================
# LOGIN
# =========================

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):

    db_user = db.query(models.User).filter(
        models.User.email == form_data.username
    ).first()

    if not db_user or not verify_password(form_data.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    today = date.today()

    if db_user.last_login_date is None:
        db_user.streak = 1

    elif db_user.last_login_date == today - timedelta(days=1):
        db_user.streak += 1

    elif db_user.last_login_date != today:
        db_user.streak = 1

    db_user.last_login_date = today
    db.commit()

    token = create_access_token({"sub": db_user.email})

    return {
        "access_token": token,
        "token_type": "bearer"
    }

# =========================
# PROFILE DASHBOARD
# =========================

@app.get("/api/profile")
def get_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    sessions = db.query(models.WorkoutSession).filter(
        models.WorkoutSession.user_id == current_user.id
    ).all()

    # -------- CALORIES --------

    calorie_map = {
        "burpees": 0.5,
        "dumbbells": 0.35,
        "jumping_jacks": 0.2,
        "planks": 0.15,
        "pilates": 0.18,
        "pushups": 0.32,
        "resistance_band": 0.25,
        "squat": 0.32,
        "steps": 0.04,
        "yoga": 0.12,
        "zumba": 0.3
    }

    total_calories = 0

    for s in sessions:

        name = s.exercise.lower()

        if name in ["planks", "yoga", "pilates"]:
            calories = int(s.duration * 0.08)
        else:
            per_rep = calorie_map.get(name, 0.2)
            calories = int(s.reps * per_rep)

        total_calories += calories

    # -------- HEATMAP --------

    heatmap = {}

    for s in sessions:
        day = s.date.strftime("%Y-%m-%d")
        heatmap[day] = heatmap.get(day, 0) + 1

    progress = [{"date": d, "count": c} for d, c in heatmap.items()]

    # -------- WEEKLY ACCURACY --------

    weekly_map = {}

    for s in sessions:

        day = s.date.strftime("%a")

        if day not in weekly_map:
            weekly_map[day] = []

        weekly_map[day].append(s.accuracy)

    weekly = [
        {"date": d, "accuracy": int(sum(v) / len(v))}
        for d, v in weekly_map.items()
    ]

    # -------- EXERCISE DISTRIBUTION --------

    exercise_map = {}

    for s in sessions:
        exercise_map[s.exercise] = exercise_map.get(s.exercise, 0) + 1

    exercise_distribution = [
        {"exercise": k, "value": v}
        for k, v in exercise_map.items()
    ]

    # -------- TIME EXERCISED --------

    time_map = {}

    for s in sessions:
        day = s.date.strftime("%a")
        time_map[day] = time_map.get(day, 0) + s.duration

    time_spent = [
        {"day": k, "time": v}
        for k, v in time_map.items()
    ]

    return {
        "user": {
            "name": current_user.username,
            "email": current_user.email,
            "joinDate": current_user.created_at.strftime("%Y-%m-%d"),
        },
        "stats": {
            "totalWorkouts": len(sessions),
            "avgAccuracy": current_user.avg_accuracy,
            "totalCalories": total_calories,
            "streak": current_user.streak,
        },
        "progress": progress,
        "weekly": weekly,
        "exerciseDistribution": exercise_distribution,
        "timeSpent": time_spent,
    }

# =========================
# SAVE SESSION
# =========================

@app.post("/api/session")
def save_session(
    session: schemas.WorkoutSessionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    new_session = models.WorkoutSession(
        user_id=current_user.id,
        exercise=session.exercise,
        reps=session.reps,
        accuracy=session.accuracy,
        duration=session.duration,
    )

    db.add(new_session)

    current_user.total_workouts += 1

    if current_user.total_workouts > 0:
        current_user.avg_accuracy = int(
            (
                current_user.avg_accuracy * (current_user.total_workouts - 1)
                + session.accuracy
            )
            / current_user.total_workouts
        )

    db.commit()
    db.refresh(new_session)

    return {"message": "Session saved", "id": new_session.id}

# =========================
# HISTORY
# =========================

@app.get("/api/sessions")
def get_sessions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    sessions = (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.user_id == current_user.id)
        .order_by(models.WorkoutSession.date.desc())
        .all()
    )

    return [
        {
            "id": s.id,
            "exercise": s.exercise,
            "reps": s.reps,
            "accuracy": s.accuracy,
            "duration": s.duration,
            "date": s.date.strftime("%Y-%m-%d %H:%M"),
        }
        for s in sessions
    ]