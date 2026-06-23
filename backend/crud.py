from sqlalchemy.orm import Session
from . import models, schemas
import datetime

# --- User & Role ---
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    fake_hashed_password = user.password + "notreallyhashed"
    db_user = models.User(email=user.email, name=user.name, hashed_password=fake_hashed_password, role_id=user.role_id)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_role(db: Session, role: schemas.RoleCreate):
    db_role = models.Role(name=role.name)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

# --- Interview Session ---
def create_session(db: Session, session: schemas.InterviewSessionCreate):
    db_session = models.InterviewSession(**session.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def get_session(db: Session, session_id: int):
    return db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()

def get_sessions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.InterviewSession).offset(skip).limit(limit).all()

def update_session_score(db: Session, session_id: int, score_pct: float):
    db_session = get_session(db, session_id)
    if db_session:
        db_session.score_pct = score_pct
        db_session.end_time = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_session)
    return db_session

# --- Questions & Answers ---
def create_question(db: Session, question: schemas.QuestionCreate):
    db_question = models.Question(**question.model_dump())
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    return db_question

def get_questions_by_session(db: Session, session_id: int):
    return db.query(models.Question).filter(models.Question.session_id == session_id).all()

def create_answer(db: Session, answer: schemas.AnswerCreate):
    db_answer = models.Answer(**answer.model_dump())
    db.add(db_answer)
    db.commit()
    db.refresh(db_answer)
    return db_answer

# --- Reports ---
def create_report(db: Session, report: schemas.ReportCreate):
    db_report = models.Report(**report.model_dump())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report
