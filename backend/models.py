from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text, Float
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)  # e.g., "admin", "candidate"

    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    hashed_password = Column(String)
    role_id = Column(Integer, ForeignKey("roles.id"))

    role = relationship("Role", back_populates="users")
    sessions = relationship("InterviewSession", back_populates="user")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    category = Column(String)
    branch = Column(String)
    domain = Column(String)
    subjects = Column(String)  # Stored as comma-separated values for simplicity
    year = Column(String, nullable=True, default="1")
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    score_pct = Column(Float, nullable=True)

    user = relationship("User", back_populates="sessions")
    questions = relationship("Question", back_populates="session")
    report = relationship("Report", back_populates="session", uselist=False)


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"))
    text = Column(Text)
    difficulty = Column(String)
    topic = Column(String)
    hint = Column(Text, nullable=True)

    session = relationship("InterviewSession", back_populates="questions")
    answer = relationship("Answer", back_populates="question", uselist=False)


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), unique=True)
    text = Column(Text)
    is_skipped = Column(Boolean, default=False)
    score = Column(Float, nullable=True) # Score for this specific answer

    question = relationship("Question", back_populates="answer")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), unique=True)
    overall_feedback = Column(Text)
    strengths = Column(Text)
    weaknesses = Column(Text)

    session = relationship("InterviewSession", back_populates="report")
