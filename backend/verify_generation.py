import sys
import os

# Add parent directory to sys.path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import ai_service
from backend.question_bank import find_offline_question

def test_generation():
    print("Testing question generation...")
    # Test case 1: Year 1 CSE
    q1 = ai_service.generate_interview_questions(
        category="sde",
        branch="cse",
        domain="web-dev",
        year="1",
        subjects=["Python", "Variables"],
        count=5
    )
    print("\n--- Test Case 1: Year 1 CSE Web Dev ---")
    for idx, q in enumerate(q1):
        print(f"{idx+1}. [{q.get('difficulty')}] {q.get('text')}")
        print(f"   Ideal Answer: {q.get('ideal_answer')}")
        print(f"   Keywords: {q.get('evaluation_keywords')}")
        print(f"   Follow-ups: {q.get('follow_up_questions')}")

    # Test case 2: Year 4 CSE
    q2 = ai_service.generate_interview_questions(
        category="sde",
        branch="cse",
        domain="backend",
        year="4",
        subjects=["Scalability"],
        count=5
    )
    print("\n--- Test Case 2: Year 4 CSE Backend ---")
    for idx, q in enumerate(q2):
        print(f"{idx+1}. [{q.get('difficulty')}] {q.get('text')}")
        print(f"   Ideal Answer: {q.get('ideal_answer')}")
        print(f"   Keywords: {q.get('evaluation_keywords')}")

    # Test case 3: Company specific (Google)
    q3 = ai_service.generate_interview_questions(
        category="company",
        branch="cse",
        domain="Google - Software Engineer",
        year="3",
        subjects=["Data Structures"],
        count=5
    )
    print("\n--- Test Case 3: Google SDE Year 3 ---")
    for idx, q in enumerate(q3):
        print(f"{idx+1}. [{q.get('difficulty')}] {q.get('text')}")
        print(f"   Keywords: {q.get('evaluation_keywords')}")

    # Test case 4: HR Interview
    q4 = ai_service.generate_interview_questions(
        category="hr",
        branch="cse",
        domain="General",
        year="2",
        subjects=[],
        count=5
    )
    print("\n--- Test Case 4: HR Interview (Personality, Comm, etc.) ---")
    for idx, q in enumerate(q4):
        print(f"{idx+1}. {q.get('text')}")
        print(f"   Topic: {q.get('topic')}")
        print(f"   Ideal Answer: {q.get('ideal_answer')}")
        print(f"   Keywords: {q.get('evaluation_keywords')}")
        print(f"   Follow-ups: {q.get('follow_up_questions')}")

if __name__ == "__main__":
    test_generation()

