"""
HireMind — Complete Interview Workflow Test
==========================================
Stages:
  1. Create session
  2. Generate interview questions  (AI)
  3. Evaluate one answer           (AI)
  4. Generate final report         (AI)

Run:
    python test_workflow.py [--base-url http://127.0.0.1:8000]
"""

import sys
import json
import argparse
import urllib.request
import urllib.error
import urllib.parse

BASE_URL = "http://127.0.0.1:8000"

PASS  = "[  OK  ]"
FAIL  = "[ FAIL ]"
SKIP  = "[ SKIP ]"
WARN  = "[ WARN ]"

results = []   # list of (stage, label, passed, detail)

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def http(method: str, path: str, body: dict | None = None):
    """Return (status_code, parsed_json).  Never raises."""
    url = BASE_URL + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json"} if data else {}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read())
        except Exception:
            err_body = {}
        return e.code, err_body
    except Exception as e:
        return None, {"_exception": str(e)}


def record(stage: str, label: str, passed: bool, detail: str = ""):
    tag = PASS if passed else FAIL
    print(f"  {tag} {label}" + (f"\n         {detail}" if detail else ""))
    results.append((stage, label, passed, detail))


# ---------------------------------------------------------------------------
# Stage 1 — Create Session
# ---------------------------------------------------------------------------

def stage1_create_session():
    print("\n=== Stage 1: Create Interview Session ===")

    payload = {
        "category": "Technology",
        "branch": "Computer Science",
        "domain": "Python Backend Developer",
        "subjects": "Python, FastAPI, SQLAlchemy, REST APIs",
        "year": "3"
    }

    status, body = http("POST", "/api/sessions/", payload)

    if status == 200 and "id" in body:
        session_id = body["id"]
        record("stage1", "POST /api/sessions/ → 200", True)
        record("stage1", "Response contains session id", True, f"id={session_id}")
        record("stage1", "Domain preserved correctly",
               body.get("domain") == payload["domain"],
               f"domain='{body.get('domain')}'")
        return session_id
    else:
        record("stage1", "POST /api/sessions/ → 200", False,
               f"Got {status}: {body}")
        return None


# ---------------------------------------------------------------------------
# Stage 2 — Generate Questions
# ---------------------------------------------------------------------------

def stage2_generate_questions(session_id: int):
    print("\n=== Stage 2: Generate Interview Questions ===")

    if session_id is None:
        print(f"  {SKIP} Skipped — no session_id from Stage 1")
        return None

    status, body = http("POST", f"/api/sessions/{session_id}/generate-questions")

    if status == 503:
        detail = body.get("detail", "")
        error  = body.get("error", "")
        record("stage2", "503 handler fires correctly for missing API key",
               error == "ai_service_unavailable",
               f"error='{error}'  detail='{detail}'")
        record("stage2", "503 body has 'detail' field",  "detail" in body)
        record("stage2", "503 body has 'error' field",   "error"  in body)
        print(f"  {WARN} AI key not configured — question generation blocked as expected.")
        print(f"       To test with real AI, set GEMINI_API_KEY in .env")
        return None

    if status == 200 and isinstance(body, list) and len(body) > 0:
        record("stage2", "POST generate-questions → 200", True)
        record("stage2", f"Returned {len(body)} questions (≥1)", len(body) >= 1,
               f"count={len(body)}")
        first = body[0]
        record("stage2", "Question has 'text' field",       "text"       in first)
        record("stage2", "Question has 'difficulty' field", "difficulty" in first)
        record("stage2", "Question has 'topic' field",      "topic"      in first)
        record("stage2", "Question has 'id' field",         "id"         in first)
        return body   # list of questions

    record("stage2", "POST generate-questions → 200", False,
           f"Got {status}: {str(body)[:200]}")
    return None


# ---------------------------------------------------------------------------
# Stage 3 — Evaluate Answer
# ---------------------------------------------------------------------------

def stage3_evaluate_answer(questions: list | None):
    print("\n=== Stage 3: Evaluate One Answer ===")

    if not questions:
        print(f"  {SKIP} Skipped — no questions from Stage 2")
        return

    question = questions[0]
    q_id = question["id"]
    print(f"  Question [{q_id}]: {question.get('text', '')[:80]}…")

    payload = {
        "text": (
            "FastAPI is a modern, high-performance Python web framework built on "
            "Starlette and Pydantic. It uses Python type hints for data validation "
            "and auto-generates OpenAPI docs. It supports async/await natively, "
            "making it ideal for I/O-bound workloads."
        ),
        "is_skipped": False
    }

    status, body = http("POST", f"/api/questions/{q_id}/evaluate", payload)

    if status == 503:
        detail = body.get("detail", "")
        record("stage3", "503 handler fires correctly for missing API key",
               body.get("error") == "ai_service_unavailable",
               f"detail='{detail}'")
        print(f"  {WARN} AI key not configured — evaluation blocked as expected.")
        return

    if status == 200:
        record("stage3", "POST evaluate → 200", True)
        record("stage3", "Response has 'status' field",   "status"   in body)
        record("stage3", "Response has 'score' field",    "score"    in body)
        record("stage3", "Response has 'feedback' field", "feedback" in body)
        score = body.get("score", -1)
        record("stage3", f"Score in valid range 0–10 (got {score})",
               0 <= score <= 10, f"score={score}")
    else:
        record("stage3", "POST evaluate → 200", False,
               f"Got {status}: {str(body)[:200]}")


# ---------------------------------------------------------------------------
# Stage 3b — Evaluate a SKIPPED answer (no AI call, always works)
# ---------------------------------------------------------------------------

def stage3b_evaluate_skipped(questions: list | None):
    print("\n=== Stage 3b: Evaluate Skipped Answer (no AI call) ===")

    if not questions:
        print(f"  {SKIP} Skipped — no questions from Stage 2")
        return

    question = questions[-1]   # use the last question
    q_id = question["id"]
    print(f"  Question [{q_id}]: {question.get('text', '')[:80]}…")

    payload = {"text": "", "is_skipped": True}
    status, body = http("POST", f"/api/questions/{q_id}/evaluate", payload)

    if status == 200:
        record("stage3b", "POST evaluate (skipped) → 200", True)
        record("stage3b", "score == 0.0", body.get("score") == 0.0,
               f"score={body.get('score')}")
        record("stage3b", "feedback == 'Question skipped.'",
               body.get("feedback") == "Question skipped.",
               f"feedback='{body.get('feedback')}'")
    else:
        record("stage3b", "POST evaluate (skipped) → 200", False,
               f"Got {status}: {str(body)[:200]}")


# ---------------------------------------------------------------------------
# Stage 4 — Generate Report
# ---------------------------------------------------------------------------

def stage4_generate_report(session_id: int | None):
    print("\n=== Stage 4: Generate Final Report ===")

    if session_id is None:
        print(f"  {SKIP} Skipped — no session_id from Stage 1")
        return

    status, body = http("POST", f"/api/sessions/{session_id}/generate-report")

    if status == 503:
        detail = body.get("detail", "")
        record("stage4", "503 handler fires correctly for missing API key",
               body.get("error") == "ai_service_unavailable",
               f"detail='{detail}'")
        print(f"  {WARN} AI key not configured — report generation blocked as expected.")
        return

    if status == 200:
        record("stage4", "POST generate-report → 200", True)
        record("stage4", "Report has 'overall_feedback'", "overall_feedback" in body)
        record("stage4", "Report has 'strengths'",        "strengths"        in body)
        record("stage4", "Report has 'weaknesses'",       "weaknesses"       in body)
        record("stage4", "Report has 'session_id'",       "session_id"       in body)
        print(f"\n  --- Report Preview ---")
        print(f"  Overall: {body.get('overall_feedback','')[:120]}")
        print(f"  Strengths: {body.get('strengths','')[:80]}")
        print(f"  Weaknesses: {body.get('weaknesses','')[:80]}")
    else:
        record("stage4", "POST generate-report → 200", False,
               f"Got {status}: {str(body)[:200]}")


# ---------------------------------------------------------------------------
# Bonus — Non-existent session (should 404)
# ---------------------------------------------------------------------------

def bonus_404_check():
    print("\n=== Bonus: 404 for unknown session ===")
    status, body = http("GET", "/api/sessions/99999")
    record("bonus", "GET /api/sessions/99999 → 404", status == 404,
           f"Got {status}")


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def print_summary():
    print("\n" + "=" * 62)
    passed = [r for r in results if r[2]]
    failed = [r for r in results if not r[2]]
    print(f"RESULTS: {len(passed)} passed  |  {len(failed)} failed  |  {len(results)} total")
    if failed:
        print("\nFAILURES:")
        for stage, label, _, detail in failed:
            print(f"  [{stage}] {label}")
            if detail:
                print(f"           {detail}")
    print("=" * 62)
    return len(failed)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=BASE_URL)
    args = parser.parse_args()
    BASE_URL = args.base_url.rstrip("/")

    print(f"HireMind Workflow Test  →  {BASE_URL}")

    # Verify server is reachable
    status, body = http("GET", "/")
    if status != 200:
        print(f"\n{FAIL} Server not reachable at {BASE_URL} (got {status}: {body})")
        print("Start the server first:  uvicorn backend.main:app --reload")
        sys.exit(1)
    print(f"{PASS} Server reachable: {body.get('message','')}")

    session_id = stage1_create_session()
    questions  = stage2_generate_questions(session_id)
    stage3_evaluate_answer(questions)
    stage3b_evaluate_skipped(questions)
    stage4_generate_report(session_id)
    bonus_404_check()

    n_failed = print_summary()
    sys.exit(0 if n_failed == 0 else 1)
