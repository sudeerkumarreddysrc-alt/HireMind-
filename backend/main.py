from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from . import models, schemas, crud, ai_service
from .ai_service import AIServiceUnavailableError
from .database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="HireMind AI Interview API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handler: AI service unavailable → HTTP 503
# ---------------------------------------------------------------------------
@app.exception_handler(AIServiceUnavailableError)
async def ai_service_unavailable_handler(request: Request, exc: AIServiceUnavailableError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": str(exc),
            "error": "ai_service_unavailable",
        },
    )


@app.get("/")
def read_root(request: Request):
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        return FileResponse(os.path.join(parent_dir, "index.html"))
    return {"status": "ok", "message": "HireMind Database API is running!"}

# --- Users ---
@app.post("/api/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@app.get("/api/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

# --- Sessions ---
@app.post("/api/sessions/", response_model=schemas.InterviewSession)
def create_session(session: schemas.InterviewSessionCreate, db: Session = Depends(get_db)):
    return crud.create_session(db=db, session=session)

@app.get("/api/sessions/{session_id}", response_model=schemas.InterviewSession)
def read_session(session_id: int, db: Session = Depends(get_db)):
    db_session = crud.get_session(db, session_id=session_id)
    if db_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_session

@app.get("/api/sessions/", response_model=List[schemas.InterviewSession])
def read_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sessions = crud.get_sessions(db, skip=skip, limit=limit)
    return sessions

# --- Questions & Answers ---
@app.post("/api/questions/", response_model=schemas.Question)
def create_question(question: schemas.QuestionCreate, db: Session = Depends(get_db)):
    return crud.create_question(db=db, question=question)

@app.post("/api/answers/", response_model=schemas.Answer)
def create_answer(answer: schemas.AnswerCreate, db: Session = Depends(get_db)):
    return crud.create_answer(db=db, answer=answer)

# --- Reports ---
@app.post("/api/reports/", response_model=schemas.Report)
def create_report(report: schemas.ReportCreate, db: Session = Depends(get_db)):
    return crud.create_report(db=db, report=report)

# --- AI Integration Endpoints ---
@app.post("/api/sessions/{session_id}/generate-questions", response_model=List[schemas.Question])
def generate_session_questions(session_id: int, db: Session = Depends(get_db)):
    db_session = crud.get_session(db, session_id=session_id)
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Use AI to generate questions.
    # AIServiceUnavailableError propagates to the global handler → HTTP 503.
    skills = [s.strip() for s in db_session.subjects.split(",")] if db_session.subjects else []
    year_label = f"Year {db_session.year}" if db_session.year else "Year 1"
    ai_questions = ai_service.generate_interview_questions(
        role=db_session.domain,
        experience=year_label,
        skills=skills,
        count=5
    )

    # Save to database
    saved_questions = []
    for q_data in ai_questions:
        q_create = schemas.QuestionCreate(
            session_id=session_id,
            text=q_data.get("text", ""),
            difficulty=q_data.get("difficulty", "Medium"),
            topic=q_data.get("topic", "General"),
            hint=q_data.get("hint", "")
        )
        saved_questions.append(crud.create_question(db, q_create))

    return saved_questions


class AnswerSubmission(BaseModel):
    text: str
    is_skipped: bool = False

@app.post("/api/questions/{question_id}/evaluate")
def evaluate_answer(question_id: int, submission: AnswerSubmission, db: Session = Depends(get_db)):
    db_question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")

    db_session = crud.get_session(db, db_question.session_id)
    role = db_session.domain if db_session else "Candidate"

    score = 0.0
    feedback = ""

    if not submission.is_skipped and submission.text.strip():
        # Evaluate using AI.
        # AIServiceUnavailableError propagates to the global handler → HTTP 503.
        eval_result = ai_service.evaluate_answer(
            question=db_question.text,
            answer=submission.text,
            role=role
        )
        score = float(eval_result.get("score", 0.0))
        feedback = eval_result.get("feedback", "")
    else:
        feedback = "Question skipped."

    # Save or update answer in database
    db_answer = db.query(models.Answer).filter(models.Answer.question_id == question_id).first()
    if db_answer:
        db_answer.text = submission.text
        db_answer.is_skipped = submission.is_skipped
        db_answer.score = score
        db.commit()
        db.refresh(db_answer)
    else:
        ans_create = schemas.AnswerCreate(
            question_id=question_id,
            text=submission.text,
            is_skipped=submission.is_skipped,
            score=score
        )
        crud.create_answer(db, ans_create)

    return {"status": "success", "score": score, "feedback": feedback}


@app.post("/api/sessions/{session_id}/generate-report", response_model=schemas.Report)
def generate_session_report(session_id: int, db: Session = Depends(get_db)):
    db_session = crud.get_session(db, session_id)
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check if report already exists for this session
    db_report = db.query(models.Report).filter(models.Report.session_id == session_id).first()
    if db_report:
        return db_report

    # Gather QA history
    qa_history = []
    total_score = 0
    answered = 0

    for q in db_session.questions:
        if q.answer:
            qa_history.append({
                "question": q.text,
                "answer": q.answer.text,
                "score": q.answer.score
            })
            if not q.answer.is_skipped:
                total_score += q.answer.score or 0
                answered += 1

    # Update Session Score
    if answered > 0:
        avg_score_pct = (total_score / (len(db_session.questions) * 10)) * 100
        crud.update_session_score(db, session_id, avg_score_pct)

    # Generate Report via AI.
    # AIServiceUnavailableError propagates to the global handler → HTTP 503.
    ai_report = ai_service.generate_summary_report(
        role=db_session.domain,
        qa_history=qa_history
    )

    report_create = schemas.ReportCreate(
        session_id=session_id,
        overall_feedback=ai_report.get("overall_feedback", "No feedback generated."),
        strengths=ai_report.get("strengths", ""),
        weaknesses=ai_report.get("weaknesses", "")
    )

    return crud.create_report(db, report_create)


# ---------------------------------------------------------------------------
# Serve frontend static assets securely (single-origin deployment support)
# ---------------------------------------------------------------------------
from fastapi.responses import FileResponse
import os

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@app.get("/app.js")
def serve_js():
    return FileResponse(os.path.join(parent_dir, "app.js"))

@app.get("/styles.css")
def serve_css():
    return FileResponse(os.path.join(parent_dir, "styles.css"))

# Catch-all for routing to index.html (supports single-page routing if needed)
@app.get("/{path:path}")
def serve_index(path: str):
    # If the path points to an API route that 404s, don't shadow it
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    return FileResponse(os.path.join(parent_dir, "index.html"))

