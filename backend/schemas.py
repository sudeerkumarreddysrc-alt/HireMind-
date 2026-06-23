from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- Role ---
class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    pass

class Role(RoleBase):
    id: int
    class Config:
        from_attributes = True

# --- User ---
class UserBase(BaseModel):
    email: str
    name: str

class UserCreate(UserBase):
    password: str
    role_id: int

class User(UserBase):
    id: int
    role_id: int
    class Config:
        from_attributes = True

# --- Answer ---
class AnswerBase(BaseModel):
    text: str
    is_skipped: bool = False
    score: Optional[float] = None

class AnswerCreate(AnswerBase):
    question_id: int

class Answer(AnswerBase):
    id: int
    question_id: int
    class Config:
        from_attributes = True

# --- Question ---
class QuestionBase(BaseModel):
    text: str
    difficulty: str
    topic: str
    hint: Optional[str] = None

class QuestionCreate(QuestionBase):
    session_id: int

class Question(QuestionBase):
    id: int
    session_id: int
    answer: Optional[Answer] = None
    class Config:
        from_attributes = True

# --- Report ---
class ReportBase(BaseModel):
    overall_feedback: str
    strengths: str
    weaknesses: str

class ReportCreate(ReportBase):
    session_id: int

class Report(ReportBase):
    id: int
    session_id: int
    class Config:
        from_attributes = True

# --- Session ---
class InterviewSessionBase(BaseModel):
    category: str
    branch: str
    domain: str
    subjects: str
    year: Optional[str] = "1"

class InterviewSessionCreate(InterviewSessionBase):
    user_id: Optional[int] = None

class InterviewSession(InterviewSessionBase):
    id: int
    user_id: Optional[int] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    score_pct: Optional[float] = None
    questions: List[Question] = []
    report: Optional[Report] = None
    class Config:
        from_attributes = True
