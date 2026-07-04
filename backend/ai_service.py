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

def generate_mock_questions(category, branch, year, domain, subjects, company, role):
    # Determine difficulty level name
    diff_name = "Easy" if year == "1" else "Medium" if year in ["2", "3"] else "Hard"
    
    questions = []
    
    # ── Year 1 ──
    if year == "1":
        # First Year: Very beginner-friendly, fundamentals, communication, basic programming
        q1_text = f"Introduce yourself. Why did you choose {branch.upper()} as your branch of study, and what are your academic goals?"
        q1_hint = "Talk about your background, interests, and what motivated you to join this field."
        
        q2_text = "What is the difference between a variable and a constant in programming? Explain with a simple analogy."
        q2_hint = "Think about a storage box vs. a printed label."
        
        q3_text = f"In {domain or 'your chosen domain'}, what is your understanding of the basic concepts? Explain it to someone with no technical background."
        q3_hint = "Keep it simple and avoid jargon."
        
        sub = subjects[0] if subjects else "Basic Programming"
        q4_text = f"Explain the basic concept of '{sub}' and why it is important for beginners in {branch.upper()}."
        q4_hint = "Provide a high-level definition and a common application."
        
        q5_text = "How do you manage your study time and handle academic stress as a first-year student?"
        q5_hint = "Discuss prioritization, schedules, and healthy coping mechanisms."

    # ── Year 2 ──
    elif year == "2":
        # Second Year: Core subjects, OOP, DBMS basics, web fundamentals
        q1_text = "Explain the concept of Object-Oriented Programming (OOP) and its four main pillars to a non-programmer."
        q1_hint = "Pillars: Encapsulation, Inheritance, Polymorphism, Abstraction."
        
        if branch in ["cse", "it", "aiml", "ds", "cyber"]:
            q2_text = "What is the difference between an Array and a Linked List? When would you use one over the other?"
            q2_hint = "Compare memory allocation (contiguous vs non-contiguous) and access time (O(1) vs O(n))."
        elif branch == "ece":
            q2_text = "Explain the difference between a microprocessor and a microcontroller."
            q2_hint = "Microprocessors have CPU only; microcontrollers have CPU, RAM, ROM, and peripherals on a single chip."
        elif branch == "eee":
            q2_text = "Explain Kirchhoff's Current Law (KCL) and Kirchhoff's Voltage Law (KVL)."
            q2_hint = "Conservation of charge (current entering node = leaving node) and energy (sum of voltages in a loop = 0)."
        elif branch == "mech":
            q2_text = "What are the differences between a 2-stroke and a 4-stroke engine?"
            q2_hint = "Compare power cycles, efficiency, and mechanical complexity."
        elif branch == "civil":
            q2_text = "Explain the difference between load-bearing walls and framed structures."
            q2_hint = "Load-bearing walls support loads directly; framed structures transfer loads via beams and columns to the foundation."
        else:
            q2_text = f"What are the core foundational concepts in {branch.upper()} that you found most important so far?"
            q2_hint = "Highlight a key theoretical concept and its significance."

        if branch in ["cse", "it", "aiml", "ds", "cyber"] or "dev" in domain.lower() or "stack" in domain.lower() or "backend" in domain.lower():
            q3_text = "Why is database normalization important? Explain 1NF, 2NF, and 3NF briefly."
            q3_hint = "Normalization reduces redundancy and improves data integrity by structuring tables logically."
        elif branch == "ece" or "embed" in domain.lower():
            q3_text = "What is a multiplexer (MUX)? Explain its basic function and how select lines work."
            q3_hint = "A MUX selects one of many input signals and forwards it to a single output line based on select inputs."
        elif branch == "eee":
            q3_text = "What is Faraday's Law of Electromagnetic Induction? Give a common real-world application."
            q3_hint = "A change in magnetic flux induces an electromotive force. Applied in electric generators and transformers."
        elif branch == "mech":
            q3_text = "What is Hooke's Law? Explain stress-strain relationship and elastic limit."
            q3_hint = "Stress is proportional to strain up to the proportional limit."
        else:
            q3_text = f"In {domain or 'your domain'}, explain a core technical concept that every sophomore should know."
            q3_hint = "Describe the mechanism and its primary use case."

        sub = subjects[0] if subjects else "Core Concepts"
        q4_text = f"What is the practical application of '{sub}' in modern engineering? Explain a scenario where you would apply it."
        q4_hint = "Describe a real-world problem and how this subject helps solve it."
        
        q5_text = "Imagine you are working in a team on a class project and a conflict arises regarding design choices. How do you resolve it?"
        q5_hint = "Discuss communication, listing pros/cons, and seeking consensus or advice."

    # ── Year 3 ──
    elif year == "3":
        # Third Year: Projects, System Design basics, APIs, frameworks, problem solving, internship-level questions.
        q1_text = "Describe a significant project you worked on recently. What was your role, what technology stack did you use, and what challenges did you face?"
        q1_hint = "Use the STAR method: Situation, Task, Action, Result. Focus on your individual contribution."
        
        if branch in ["cse", "it", "aiml", "ds", "cyber"]:
            q2_text = "How would you design a simple RESTful API for a library management system? What HTTP methods and status codes would you use?"
            q2_hint = "GET /books, POST /books, PUT /books/id, DELETE /books/id. Codes: 200 OK, 201 Created, 404 Not Found."
        elif branch == "ece":
            q2_text = "What is the Nyquist-Shannon sampling theorem? Why is it important in analog-to-digital conversion?"
            q2_hint = "Sampling rate must be at least twice the highest frequency component of the signal to prevent aliasing."
        elif branch == "eee":
            q2_text = "Explain the working principle of a 3-phase induction motor. How do you control its speed?"
            q2_hint = "Rotating magnetic field. Speed controlled by frequency (V/f control) or pole changing."
        elif branch == "mech":
            q2_text = "What is the difference between stress and strain? Explain Hooke's law and its limitations."
            q2_hint = "Stress is restoring force per area; strain is deformation ratio. Hooke's law is valid only within the elastic limit."
        elif branch == "civil":
            q2_text = "What is concrete curing, and why is it essential for structural integrity?"
            q2_hint = "Maintaining moisture and temperature conditions to allow concrete to gain strength and durability over time."
        else:
            q2_text = f"Describe an internship or practical hands-on project you completed in the {branch.upper()} field."
            q2_hint = "Mention the problem, tools used, results achieved, and what you learned."
            
        if "ml" in domain.lower() or "ai" in domain.lower() or "science" in domain.lower():
            q3_text = "What is the difference between supervised and unsupervised learning? Give examples of algorithms for each."
            q3_hint = "Supervised uses labeled data (Regression, Random Forest). Unsupervised uses unlabeled data (K-Means, PCA)."
        elif "web" in domain.lower() or "dev" in domain.lower():
            q3_text = "Explain the difference between client-side rendering (CSR) and server-side rendering (SSR)."
            q3_hint = "CSR renders in user's browser; SSR pre-renders pages on the server. CSR has fast transitions, SSR has better SEO."
        elif "embed" in domain.lower():
            q3_text = "Explain what interrupts are in microcontroller systems. How do interrupt service routines (ISR) work?"
            q3_hint = "Interrupts temporarily suspend main program execution to run a high-priority ISR, then resume the main program."
        elif branch == "mech":
            q3_text = "What is the Carnot cycle, and why is it considered the limit of thermodynamic efficiency?"
            q3_hint = "An idealized reversible thermodynamic cycle. Efficiency depends solely on the temperatures of hot and cold reservoirs."
        else:
            q3_text = f"What is your approach to system testing and validation for a project in {domain or 'your domain'}?"
            q3_hint = "Discuss writing test cases, validation protocols, and documenting bugs."

        sub = subjects[0] if subjects else "Advanced Frameworks"
        q4_text = f"Explain how you would implement '{sub}' in a scalable project. What frameworks or design patterns would you use?"
        q4_hint = "Mention MVC, Singleton, Factory, or specific frameworks like Spring Boot, React, Django."
        
        if company:
            q5_text = f"Why do you want to intern at {company} specifically? How do your skills in {domain} align with our products?"
            q5_hint = "Mention a specific product or initiative of the company and connect it with your project experience."
        else:
            q5_text = f"Explain the differences between SQL and NoSQL databases. When would you choose NoSQL for a {domain} application?"
            q5_hint = "Compare schema flexibility, scaling (horizontal vs vertical), and transaction guarantees (ACID vs BASE)."

    # ── Year 4 ──
    else:
        # Fourth Year: Placement-level interviews, Advanced DSA, System Design, Cloud, Distributed Systems, Real-world scenarios.
        if company:
            q1_text = f"Describe a complex technical challenge you solved in a previous project or internship. How does this prepare you for a role at {company}?"
            q1_hint = "Detail your debug/troubleshooting methodology, optimization metrics, and what you learned."
        else:
            q1_text = "Describe a complex technical problem you solved. What were the trade-offs, and how did you measure success?"
            q1_hint = "Use STAR method. Highlight trade-offs like latency vs. consistency, or development speed vs. performance."
            
        if branch in ["cse", "it", "aiml", "ds", "cyber"]:
            q2_text = "How would you design a scalable notification system like Twitter's notifications, capable of handling millions of real-time push events?"
            q2_hint = "Discuss message queues (Kafka), fan-out workers, caching (Redis), websocket connections, and database partitioning."
        elif branch == "ece":
            q2_text = "How would you design a real-time embedded system for an autonomous vehicle sensor module? What RTOS concepts are critical here?"
            q2_hint = "Discuss task scheduling, priority inversion (priority inheritance protocol), semaphores, and strict timing constraints."
        elif branch == "eee":
            q2_text = "Explain the concepts of active, reactive, and apparent power. How does power factor correction improve grid efficiency?"
            q2_hint = "Active power (watts), reactive (VAR), apparent (VA). Power factor = active/apparent. Capacitor banks improve power factor."
        elif branch == "mech":
            q2_text = "Explain Finite Element Analysis (FEA). How do you validate an FEA model's accuracy against physical test data?"
            q2_hint = "Mesh convergence studies, boundary condition validation, comparing strain gauge data with FEA stress outputs."
        elif branch == "civil":
            q2_text = "How do you design a foundation for a high-rise structure on soil with low bearing capacity?"
            q2_hint = "Discuss pile foundations, raft foundations, soil stabilization techniques, and load distribution calculation."
        else:
            q2_text = f"What is your approach to system-level integration of a complex project in {branch.upper()}?"
            q2_hint = "Discuss modular design, automated testing, continuous integration, and failure modes analysis."
            
        if company:
            if company.lower() in ["google", "microsoft", "amazon"]:
                q3_text = f"Given a huge stream of query search terms, how would you find the top K most frequent queries in real-time under memory constraints?"
                q3_hint = "Discuss Min-Heap, Hash Map, Count-Min Sketch, and MapReduce for distributed streams."
            else:
                q3_text = f"In a placement round for {company}, how would you optimize the performance of a high-traffic application in {domain}?"
                q3_hint = "Discuss load balancing, CDN caching, database index tuning, and asynchronous processing."
        else:
            q3_text = f"Explain the CAP theorem. How would you choose between consistency and availability in a distributed {domain} database?"
            q3_hint = "Consistency vs Availability vs Partition tolerance. Explain AP vs CP configurations with real databases (e.g. Cassandra vs MongoDB)."
            
        sub = subjects[0] if subjects else "Distributed Systems/Cloud"
        q4_text = f"How would you deploy and scale an application using '{sub}' on the cloud? What monitoring and disaster recovery strategies would you implement?"
        q4_hint = "Discuss autoscaling, Docker/Kubernetes, Prometheus/Grafana, multi-region failovers, and backup strategies."
        
        q5_text = f"If you are hired by {company or 'our organization'}, you might be tasked with refactoring a legacy codebase. How would you handle this without breaking existing functionality?"
        q5_hint = "Discuss regression testing, writing integration tests first, incremental refactoring (Strangler Fig pattern), and CI/CD pipelines."

    # Return exactly 5 questions
    q_texts = [q1_text, q2_text, q3_text, q4_text, q5_text]
    q_hints = [q1_hint, q2_hint, q3_hint, q4_hint, q5_hint]
    
    # Standardize topics
    topics = [
        "Behavioral/Intro",
        f"{branch.upper()} Core",
        f"{domain.split(' - ')[-1].replace('-', ' ').title()}",
        f"{subjects[0] if subjects else 'Specialization'}",
        "Scenario/Professional"
    ]
    
    for i in range(5):
        questions.append({
            "text": q_texts[i],
            "difficulty": diff_name,
            "topic": topics[i],
            "hint": q_hints[i]
        })
    return questions

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
                        
                    # Derive mock sub-scores from avg score
                    comm_score   = round(min(100, max(0, (avg_score if qa_list else 6.5) * 9.5)), 1)
                    tech_score   = round(min(100, max(0, (avg_score if qa_list else 6.0) * 9.8)), 1)
                    conf_score   = round(min(100, max(0, (avg_score if qa_list else 5.5) * 10.2)), 1)
 
                    mock_json = {
                        "overall_feedback": overall_feedback,
                        "strengths": strengths,
                        "weaknesses": weaknesses,
                        "communication_score": comm_score,
                        "technical_score": tech_score,
                        "confidence_score": conf_score,
                        "grammar_corrections": json.dumps([
                            {"original": "I have went to many interviews", "corrected": "I have been to many interviews"},
                            {"original": "Me and my team worked on this", "corrected": "My team and I worked on this"}
                        ]),
                        "ideal_answers": json.dumps([
                            {
                                "question": (qa_list[0]["question"] if qa_list else "Describe your approach to problem-solving."),
                                "ideal": "A strong answer should outline a structured methodology: clearly defining the problem, breaking it into sub-problems, evaluating trade-offs, implementing incrementally, and validating outcomes with metrics."
                            }
                        ]),
                        "improvement_suggestions": "- Practice using the STAR method (Situation, Task, Action, Result) for behavioral questions.\n- Deepen knowledge of system design patterns such as microservices and event-driven architecture.\n- Work on conciseness — aim to answer each question within 90 seconds.\n- Review data structures and complexity analysis for technical rounds.\n- Build confidence by mock interviewing with peers regularly."
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
                    # Generate interview questions dynamically!
                    category = "custom"
                    branch = "cse"
                    year = "1"
                    domain = "other"
                    subjects = []
                    
                    for line in prompt.splitlines():
                        line_stripped = line.strip()
                        if line_stripped.startswith("- Candidate's Branch/Stream:"):
                            val = line_stripped.split(":", 1)[1].strip()
                            if "computer" in val.lower(): branch = "cse"
                            elif "information" in val.lower(): branch = "it"
                            elif "electronics" in val.lower(): branch = "ece"
                            elif "electrical" in val.lower(): branch = "eee"
                            elif "mechanical" in val.lower(): branch = "mech"
                            elif "civil" in val.lower(): branch = "civil"
                            elif "artificial" in val.lower() or "ai" in val.lower(): branch = "aiml"
                            elif "data science" in val.lower(): branch = "ds"
                            elif "cyber" in val.lower(): branch = "cyber"
                            else: branch = "other"
                        elif line_stripped.startswith("- Academic Year/Level: Year"):
                            val = line_stripped.split(":", 1)[1].strip()
                            for char in val:
                                if char.isdigit():
                                    year = char
                                    break
                        elif line_stripped.startswith("- Interview Category:"):
                            val = line_stripped.split(":", 1)[1].strip()
                            if "hr" in val.lower(): category = "hr"
                            elif "software" in val.lower(): category = "sde"
                            elif "web" in val.lower(): category = "web"
                            elif "data" in val.lower(): category = "data"
                            elif "company" in val.lower(): category = "company"
                            else: category = "custom"
                        elif line_stripped.startswith("- Selected Domain:"):
                            domain = line_stripped.split(":", 1)[1].strip()
                        elif line_stripped.startswith("- Selected Subjects:"):
                            subj_str = line_stripped.split(":", 1)[1].strip()
                            subjects = [s.strip() for s in subj_str.split(",") if s.strip()]
                    
                    company = ""
                    role = domain
                    if "Company Prep for" in domain:
                        try:
                            parts = domain.split("Company Prep for ", 1)[1].split(" (Role: ", 1)
                            company = parts[0].strip()
                            role = parts[1].replace(")", "").strip()
                        except Exception:
                            pass
                    
                    questions_list = generate_mock_questions(category, branch, year, domain, subjects, company, role)
                    mock_json = {"questions": questions_list}
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


def generate_interview_questions(
    category: str,
    branch: str,
    domain: str,
    year: str,
    subjects: list,
    count: int = 5
) -> list:
    """Generate interview questions tailored to the candidate's profile.

    When *domain* represents a company role in format "Company - Role"
    the prompt is enriched with company-specific context.
    """
    from .question_bank import get_curated_questions
    return get_curated_questions(
        category=category,
        branch=branch,
        domain=domain,
        year=year,
        subjects=subjects,
        count=count
    )



def evaluate_answer(question: str, answer: str, role: str) -> dict:
    """Evaluate a candidate's answer and return a score (0-10) with feedback.

    Raises:
        AIServiceUnavailableError: propagated from _get_json_response.
    """
    from .question_bank import find_offline_question
    q_data = find_offline_question(question)
    
    ideal_str = ""
    keywords_str = ""
    if q_data:
        ideal_answer = q_data.get("ideal_answer") or q_data.get("hint")
        keywords = q_data.get("evaluation_keywords")
        if ideal_answer:
            ideal_str = f'\nIdeal Reference Answer: "{ideal_answer}"'
        if keywords:
            keywords_str = f'\nKey Evaluation Keywords/Phrases: {", ".join(keywords)}'

    prompt = f"""
You are an expert technical interviewer evaluating a candidate applying for a {role} role.

Question asked: "{question}"{ideal_str}{keywords_str}
Candidate's Answer: "{answer}"

Evaluate the answer on accuracy, completeness, and clarity. Score it out of 10.
CRITICAL: You must first verify if the candidate's answer is relevant to the question asked. 
If the answer is unrelated, off-topic, attempts to dodge the question, or is completely generic/nonsensical contextually, you must assign a score of 0.0 (or very low, e.g. < 1.0) and explain in the feedback that the answer is irrelevant or did not address the question. 
Otherwise, evaluate the correctness and depth of the answer relative to the question (using the Ideal Reference Answer and Key Evaluation Keywords if provided).

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
You are an expert hiring manager and professional career coach reviewing a completed interview session for a {role} candidate.
Here is the full Q&A transcript with scores (each question scored out of 10):
{history_str}

Provide a thorough, specific, and actionable final assessment based exclusively on the candidate's actual answers. Do NOT leave any field empty.

Return ONLY a valid JSON object (no markdown, no code fences, no explanation) with exactly these fields:
{{
  "overall_feedback": "A comprehensive 2-3 sentence summary of overall performance, referencing specific answers.",
  "strengths": "Bullet points (one per line starting with -) of the top 3 strongest areas demonstrated.",
  "weaknesses": "Bullet points (one per line starting with -) of the top 3 areas needing improvement.",
  "communication_score": <integer 0-100 reflecting clarity, structure, and articulation of answers>,
  "technical_score": <integer 0-100 reflecting domain knowledge and technical accuracy>,
  "confidence_score": <integer 0-100 reflecting decisiveness, depth, and conviction in answers>,
  "grammar_corrections": [
    {{"original": "exact phrase from their answer with a grammar error", "corrected": "corrected version"}}
  ],
  "ideal_answers": [
    {{"question": "question text", "ideal": "a model ideal answer for this question in 2-3 sentences"}}
  ],
  "improvement_suggestions": "Bullet points (one per line starting with -) of 4-5 personalized, specific, actionable improvement tips based on the weaknesses observed."
}}

Rules:
- communication_score, technical_score, confidence_score must be plain integers (no quotes, no units).
- grammar_corrections must be a JSON array (can be empty [] if no grammar errors found).
- ideal_answers must be a JSON array with one entry per question that was answered.
- improvement_suggestions must be a multiline string with each suggestion on its own line starting with -.
"""
    return _get_json_response(prompt)
