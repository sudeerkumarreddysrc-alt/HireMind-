import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# Create a client only when a key is present
_client = None
if GEMINI_API_KEY and GEMINI_API_KEY != "your_google_gemini_api_key_here":
    if GEMINI_API_KEY == "mock":
        class MockModels:
            def generate_content(self, model, contents, config=None):
                class MockResponse:
                    def __init__(self, text):
                        self.text = text
                
                prompt = contents
                prompt_lower = prompt.lower()
                
                if "overall_feedback" in prompt_lower or "hiring manager" in prompt_lower:
                    # Dynamically generate final summary report based on parsed Q&A history
                    import re
                    # Look for JSON array in prompt
                    match = re.search(r'\[\s*\{.*\}\s*\]', prompt, re.DOTALL)
                    qa_list = []
                    if match:
                        try:
                            qa_list = json.loads(match.group(0))
                        except Exception:
                            pass
                    
                    overall_feedback = "The candidate demonstrated solid fundamental programming knowledge and decent systems concepts."
                    strengths = "- Good understanding of Python basics.\n- Clear explanation of API design."
                    weaknesses = "- Could improve in distributed systems database scaling options."
                    
                    if qa_list:
                        total_score = sum(item.get("score", 0.0) for item in qa_list)
                        avg_score = total_score / len(qa_list) if qa_list else 0.0
                        
                        strength_list = []
                        weakness_list = []
                        
                        for item in qa_list:
                            q_text = item.get("question", "").lower()
                            score_val = item.get("score", 0.0)
                            
                            topic = "general concepts"
                            if "list" in q_text or "tuple" in q_text or "python" in q_text:
                                topic = "Python programming fundamentals"
                            elif "virtual memory" in q_text or "operating system" in q_text:
                                topic = "operating systems and virtual memory"
                            elif "rate limiter" in q_text or "system design" in q_text:
                                topic = "system design and rate limiting"
                                
                            if score_val >= 6.0:
                                strength_list.append(f"- Strong understanding of {topic} (Score: {score_val}/10).")
                            else:
                                weakness_list.append(f"- Needs improvement in {topic} (Score: {score_val}/10).")
                        
                        if not strength_list:
                            strength_list.append("- No significant strengths demonstrated in the evaluated answers.")
                        if not weakness_list:
                            weakness_list.append("- General concepts are acceptable, no major weaknesses identified.")
                            
                        strengths = "\n".join(strength_list)
                        weaknesses = "\n".join(weakness_list)
                        overall_feedback = f"The candidate completed the interview with an average score of {avg_score:.1f}/10. They showed variable competence across the topics discussed."
                        
                    mock_json = {
                        "overall_feedback": overall_feedback,
                        "strengths": strengths,
                        "weaknesses": weaknesses
                    }
                elif "candidate's answer:" in prompt_lower or "question asked:" in prompt_lower:
                    # Evaluate relevance of candidate's answer to the specific question asked
                    question = ""
                    answer = ""
                    try:
                        if 'Question asked: "' in prompt:
                            q_start = prompt.find('Question asked: "') + len('Question asked: "')
                            q_end = prompt.find('"', q_start)
                            question = prompt[q_start:q_end]
                        if 'Candidate\'s Answer: "' in prompt:
                            a_start = prompt.find('Candidate\'s Answer: "') + len('Candidate\'s Answer: "')
                            a_end = prompt.find('"', a_start)
                            answer = prompt[a_start:a_end]
                    except Exception:
                        pass
                        
                    score = 8.5
                    feedback = "The candidate explained the core concepts clearly, showing good understanding."
                    follow_up_question = ""
                    
                    question_lower = question.lower()
                    answer_lower = answer.lower()
                    
                    import re
                    answer_words = set(re.findall(r'\b\w+\b', answer_lower))
                    
                    if "list" in question_lower or "tuple" in question_lower:
                        if any(w in answer_words for w in ["list", "lists", "tuple", "tuples", "mutable", "immutability", "immutable", "sequence"]):
                            score = 8.5
                            feedback = "The candidate correctly identified that lists are mutable and tuples are immutable, providing a clear explanation of memory and performance differences."
                        elif any(w in answer_words for w in ["fastapi", "pydantic", "openapi", "framework", "api"]):
                            score = 0.0
                            feedback = "The candidate's answer is completely irrelevant. It describes FastAPI and Pydantic instead of explaining the difference between lists and tuples in Python."
                        else:
                            score = 2.0
                            feedback = "The answer does not adequately address the differences between a list and a tuple in Python."
                    elif "virtual memory" in question_lower:
                        if any(w in answer_words for w in ["memory", "paging", "ram", "page", "table", "tables", "faults", "fault", "address"]):
                            score = 8.0
                            feedback = "The candidate provided a solid explanation of virtual memory, referencing paging, translation, and page faults."
                        else:
                            score = 0.0
                            feedback = "The answer is not relevant to virtual memory systems."
                    elif "rate limiter" in question_lower or "rate limit" in question_lower:
                        if any(w in answer_words for w in ["limit", "limiter", "limiting", "bucket", "token", "window", "sliding", "redis", "leaking"]):
                            score = 9.0
                            feedback = "Excellent response detailing rate limiting algorithms (token bucket / sliding window) and distributed state storage."
                        else:
                            score = 0.0
                            feedback = "The answer does not address how to design a rate limiter."
                    else:
                        if not answer_lower.strip() or len(answer_lower) < 10:
                            score = 0.0
                            feedback = "The answer is too short or empty to evaluate."
                        else:
                            score = 7.0
                            feedback = "Solid general response matching the interviewer's question."
                            
                    mock_json = {
                        "score": score,
                        "feedback": feedback,
                        "follow_up_question": follow_up_question
                    }
                else:
                    # Generate interview questions (default block)
                    mock_json = {
                        "questions": [
                            {
                                "text": "What is the difference between a list and a tuple in Python?",
                                "difficulty": "Easy",
                                "topic": "Python Basics",
                                "hint": "Think about mutability."
                            },
                            {
                                "text": "Explain how the virtual memory system works.",
                                "difficulty": "Medium",
                                "topic": "Operating Systems",
                                "hint": "Discuss paging, page tables, and page faults."
                            },
                            {
                                "text": "Design a rate limiter for a distributed API system.",
                                "difficulty": "Hard",
                                "topic": "System Design",
                                "hint": "Talk about token bucket, leaking bucket, or sliding window logs."
                            }
                        ]
                    }
                return MockResponse(json.dumps(mock_json))
        
        class MockClient:
            def __init__(self):
                self.models = MockModels()
        
        _client = MockClient()
        print(f"[HireMind] Mock Gemini client initialised with model: {GEMINI_MODEL}")
    else:
        _client = genai.Client(api_key=GEMINI_API_KEY)
        print(f"[HireMind] Gemini client initialised with model: {GEMINI_MODEL}")
else:
    print("[HireMind] WARNING: GEMINI_API_KEY is not set. AI features will be disabled.")


class AIServiceUnavailableError(Exception):
    """Raised when the Gemini AI service is unavailable or misconfigured.

    Callers (e.g. FastAPI route handlers) should catch this and return
    an HTTP 503 Service Unavailable response.
    """
    pass


def _get_json_response(prompt: str) -> dict:
    """Send a prompt to Gemini and parse the JSON response.

    Raises:
        AIServiceUnavailableError: if the API key is missing, the Gemini
            SDK raises any exception, or the response cannot be parsed as JSON.
    """
    if not _client:
        raise AIServiceUnavailableError(
            "GEMINI_API_KEY is not configured. AI features are currently disabled."
        )

    try:
        response = _client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
                max_output_tokens=2048,
            ),
        )
    except Exception as exc:
        print(f"[HireMind] Gemini API call failed: {exc}")
        raise AIServiceUnavailableError(
            "The Gemini AI service is currently unavailable. Please try again later."
        ) from exc

    raw = response.text
    # Strip markdown code fences if the model wraps JSON in ```json ... ```
    if raw.strip().startswith("```"):
        lines = raw.strip().splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"[HireMind] Failed to parse JSON response: {exc}\nRaw: {raw[:300]}")
        raise AIServiceUnavailableError(
            "Received an unexpected response from the AI service. Please try again."
        ) from exc


def generate_interview_questions(role: str, experience: str, skills: list, count: int = 5) -> list:
    """Generate interview questions tailored to the candidate's profile.

    Raises:
        AIServiceUnavailableError: propagated from _get_json_response.
    """
    prompt = f"""
You are an expert technical interviewer. Generate exactly {count} interview questions for a candidate.
Role: {role}
Experience Level: {experience}
Specific Skills/Subjects: {', '.join(skills)}

Return ONLY a valid JSON object (no markdown, no explanation) in this exact structure:
{{
    "questions": [
        {{
            "text": "The full question text",
            "difficulty": "Easy",
            "topic": "Topic being tested",
            "hint": "A short hint or talking point for the candidate"
        }}
    ]
}}
Difficulty must be one of: Easy, Medium, Hard.
"""
    result = _get_json_response(prompt)
    return result.get("questions", [])


def evaluate_answer(question: str, answer: str, role: str) -> dict:
    """Evaluate a candidate's answer and return a score (0-10) with feedback.

    Raises:
        AIServiceUnavailableError: propagated from _get_json_response.
    """
    prompt = f"""
You are an expert technical interviewer evaluating a candidate applying for a {role} role.

Question asked: "{question}"
Candidate's Answer: "{answer}"

Evaluate the answer on accuracy, completeness, and clarity. Score it out of 10.
CRITICAL: You must first verify if the candidate's answer is relevant to the question asked. 
If the answer is unrelated, off-topic, attempts to dodge the question, or is completely generic/nonsensical contextually, you must assign a score of 0.0 (or very low, e.g. < 1.0) and explain in the feedback that the answer is irrelevant or did not address the question. 
Otherwise, evaluate the correctness and depth of the answer relative to the question.

Return ONLY a valid JSON object (no markdown, no explanation):
{{
    "score": 7.5,
    "feedback": "Detailed evaluation of the answer, highlighting strengths and what was missing.",
    "follow_up_question": "An optional follow-up question, or empty string if not applicable."
}}
"""
    return _get_json_response(prompt)


def generate_summary_report(role: str, qa_history: list) -> dict:
    """Generate a final interview summary from the full Q&A transcript.

    Raises:
        AIServiceUnavailableError: propagated from _get_json_response.
    """
    history_str = json.dumps(qa_history, indent=2)
    prompt = f"""
You are an expert hiring manager reviewing a completed interview session for a {role} candidate.
Here is the full Q&A transcript with scores:
{history_str}

Provide a thorough final assessment. You must analyze the transcript to formulate detailed, specific strengths and weaknesses based on the candidate's actual answers. 
CRITICAL: Even if the interview is short or has only one question, you must synthesize and generate meaningful feedback. Do not leave fields empty or return blank strings/placeholders. All three fields ('overall_feedback', 'strengths', and 'weaknesses') must be fully generated and populated.

Return ONLY a valid JSON object (no markdown, no explanation):
{{
    "overall_feedback": "A comprehensive 2-3 sentence summary of their overall performance.",
    "strengths": "Bullet points (one per line starting with -) of their top 3 strongest areas.",
    "weaknesses": "Bullet points (one per line starting with -) of their top 3 areas for improvement."
}}
"""
    return _get_json_response(prompt)
