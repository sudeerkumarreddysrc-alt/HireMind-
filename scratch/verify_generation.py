import requests
import json

BASE_URL = "http://127.0.0.1:8000"

test_cases = [
    {
        "name": "CSE + First Year + HR",
        "category": "hr",
        "branch": "cse",
        "domain": "hr",
        "year": "1",
        "subjects": "Communication Skills, Professional Ethics"
    },
    {
        "name": "CSE + Second Year + Web Development",
        "category": "web",
        "branch": "cse",
        "domain": "web-dev",
        "year": "2",
        "subjects": "HTML, CSS, JavaScript, Basic SQL"
    },
    {
        "name": "AI & ML + Third Year + Machine Learning",
        "category": "custom",
        "branch": "aiml",
        "domain": "ai-ml",
        "year": "3",
        "subjects": "Supervised Learning, Neural Networks, Python, Linear Algebra"
    },
    {
        "name": "ECE + Second Year + Embedded Systems",
        "category": "custom",
        "branch": "ece",
        "domain": "embedded",
        "year": "2",
        "subjects": "Microcontrollers, C Programming, Digital Electronics"
    },
    {
        "name": "Mechanical + Third Year + Core Mechanical",
        "category": "custom",
        "branch": "mech",
        "domain": "mech",
        "year": "3",
        "subjects": "Thermodynamics, Strength of Materials, CAD"
    },
    {
        "name": "CSE + Fourth Year + Company Prep (Google Software Engineer)",
        "category": "company",
        "branch": "cse",
        "domain": "Google - Software Engineer",
        "year": "4",
        "subjects": "Algorithms, Data Structures, System Design, Distributed Systems"
    }
]

print("=== Starting E2E Verification of Question Generation ===")

all_ok = True

for case in test_cases:
    print(f"\nTesting Case: {case['name']}")
    # 1. Create Session
    session_res = requests.post(f"{BASE_URL}/api/sessions/", json={
        "category": case["category"],
        "branch": case["branch"],
        "domain": case["domain"],
        "year": case["year"],
        "subjects": case["subjects"]
    })
    
    if session_res.status_code != 200:
        print(f"Error creating session: {session_res.text}")
        all_ok = False
        continue
        
    session_id = session_res.json()["id"]
    
    # 2. Generate Questions
    gen_res = requests.post(f"{BASE_URL}/api/sessions/{session_id}/generate-questions")
    if gen_res.status_code != 200:
        print(f"Error generating questions: {gen_res.text}")
        all_ok = False
        continue
        
    questions = gen_res.json()
    print(f"Successfully generated {len(questions)} questions:")
    for idx, q in enumerate(questions, 1):
        print(f"  Q{idx}: {q['text']} [{q['difficulty']}] (Topic: {q['topic']})")
        print(f"     Hint: {q['hint']}")

if all_ok:
    print("\n=== E2E Verification Passed! ===")
else:
    print("\n=== E2E Verification Failed! ===")
