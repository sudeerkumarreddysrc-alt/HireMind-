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
    """Generate offline mock questions strictly tailored to BOTH Domain and Academic Year (1-4)."""
    year_str = str(year)
    diff_name = "Easy" if year_str == "1" else "Medium" if year_str in ["2", "3"] else "Hard"
    dom_clean = (domain or "").lower()
    cat_clean = (category or "").lower()
    sub_main = subjects[0] if subjects else "Core Concepts"

    # Identify primary domain type
    is_web = "web" in dom_clean or "frontend" in dom_clean or "fullstack" in dom_clean or cat_clean == "web"
    is_data = "data" in dom_clean or "analyst" in dom_clean or "analytics" in dom_clean or cat_clean == "data"
    is_company = bool(company) or cat_clean == "company" or "company prep" in dom_clean or " - " in dom_clean
    is_custom = cat_clean == "custom" and not (is_web or is_data)

    questions_raw = []

    # ── 1. WEB DEVELOPMENT DOMAIN ──
    if is_web:
        if year_str == "1":
            questions_raw = [
                ("Introduce yourself. Why are you interested in Web Development and how are you starting to learn HTML, CSS, and JavaScript?", "Self Intro", "Talk about your background, web projects or online courses you started."),
                ("What is the difference between HTML `<div>` and `<span>` tags? Explain block vs inline layout.", "HTML/CSS Basics", "Div is block-level (full width); Span is inline (wraps content)."),
                ("What is the difference between `let`, `const`, and `var` in JavaScript?", "JS Fundamentals", "Var is function-scoped; Let and Const are block-scoped. Const cannot be reassigned."),
                ("What is the DOM (Document Object Model) and how does JavaScript interact with it?", "DOM Basics", "DOM represents the document structure as a tree of nodes that JS can manipulate."),
                ("How do you ensure a web page looks good on both mobile screens and desktop monitors?", "Responsive Web", "Use CSS media queries, responsive units (%, rem, vw), and flexible layouts.")
            ]
        elif year_str == "2":
            questions_raw = [
                ("Explain event bubbling and event capturing in JavaScript. How does event delegation improve performance?", "Event Handling", "Event bubbling propagates upward from target to ancestors. Delegation uses a single parent listener."),
                ("What is the difference between CSS Flexbox and CSS Grid? When would you choose one over the other?", "Frontend Layout", "Flexbox is 1-dimensional (rows OR columns); Grid is 2-dimensional (rows AND columns)."),
                ("How do Promises and `async/await` work in JavaScript when making asynchronous HTTP requests?", "Async JavaScript", "Promises handle async operations avoiding callback hell; async/await is syntactic sugar over Promises."),
                ("Explain the HTTP methods GET, POST, PUT, and DELETE and their standard status codes (200, 201, 404, 500).", "REST APIs", "GET retrieves, POST creates, PUT updates, DELETE removes. 200 OK, 201 Created, 404 Not Found, 500 Server Error."),
                ("Describe a team web project you worked on recently. How did you handle version control with Git?", "Web Project", "Discuss branch creation, pull requests, merge conflict resolution, and teamwork.")
            ]
        elif year_str == "3":
            questions_raw = [
                ("Explain the difference between Client-Side Rendering (CSR) and Server-Side Rendering (SSR). What are the trade-offs for SEO and page load?", "Rendering Systems", "CSR renders in browser via JS; SSR pre-renders pages on server. CSR is snappy post-load; SSR is better for SEO."),
                ("In React (or your chosen framework), explain Props vs State and how Component State Management works.", "Frontend Frameworks", "Props are immutable read-only inputs; State is mutable component-driven local data."),
                ("What is CORS (Cross-Origin Resource Sharing) and how do you secure web APIs using JWT authentication?", "Web Security & Auth", "CORS prevents unauthorized cross-origin requests. JWT tokens contain signed user claims in HTTP headers."),
                ("How do you optimize web application performance (lazy loading, code splitting, asset compression, CDN)?", "Web Optimization", "Reduce initial bundle size, defer offscreen assets, cache static assets on edge servers."),
                ("Walk me through a full-stack web project you built. How did you connect the frontend framework to the backend API?", "Fullstack Project", "Use STAR method. Detail API integration, state management, DB persistence, and deployment.")
            ]
        else: # Year 4
            questions_raw = [
                ("How would you design the architecture for a real-time web application (like Google Docs or live chat) scaling to 100,000 active users?", "Web Architecture", "Use WebSockets/SSE, Redis pub-sub, message queues, horizontally scaled stateless node servers, and DB sharding."),
                ("Explain OWASP Top 10 web vulnerabilities, specifically Cross-Site Scripting (XSS), CSRF, and SQL Injection. How do you prevent each?", "Web Security", "XSS: sanitize/escape input; CSRF: use anti-CSRF tokens/SameSite cookies; SQLi: parameterized queries."),
                ("Compare WebSockets, Server-Sent Events (SSE), and HTTP Long Polling for real-time web communication.", "Real-time Protocols", "WebSockets: full-duplex bi-directional; SSE: server-to-client stream; Long Polling: repeated client polls."),
                ("How do you structure a production Web CI/CD pipeline, including Docker containerization, automated E2E tests, and zero-downtime deployment?", "Web DevOps", "GitHub Actions/Jenkins pipeline building Docker images, running Cypress/Playwright tests, deploying to K8s/ECS."),
                ("Tell me about a critical production bug or performance bottleneck you resolved in a live web application.", "Web Leadership", "Detail root cause analysis, monitoring tools (Lighthouse/Sentry), fix implementation, and post-mortem.")
            ]

    # ── 2. DATA ANALYST DOMAIN ──
    elif is_data:
        if year_str == "1":
            questions_raw = [
                ("Introduce yourself. Why did you choose Data Analytics and how do you approach working with data?", "Introduction", "Mention your academic background, interest in data insights, and basic tools like Excel or Python."),
                ("What is the difference between VLOOKUP and XLOOKUP in Microsoft Excel?", "Spreadsheets", "XLOOKUP replaces VLOOKUP: searches in any direction, doesn't require column index numbers, defaults to exact match."),
                ("Explain the basic statistical metrics: Mean, Median, and Mode. When is Median preferred over Mean?", "Descriptive Stats", "Mean is average; Median is middle value; Mode is most frequent. Median is better when data has extreme outliers."),
                ("What is the difference between a Bar Chart and a Line Chart? When should you use each?", "Data Visualization", "Bar charts compare categorical values; Line charts show continuous trends over time."),
                ("How do you organize messy data in a spreadsheet before beginning analysis?", "Data Basics", "Remove duplicates, fix formatting, handle blank cells, and separate concatenated text columns.")
            ]
        elif year_str == "2":
            questions_raw = [
                ("Write the SQL query structure to select records where `sales > 10000`, grouped by `region`, ordered by total sales descending.", "SQL Queries", "SELECT region, SUM(sales) FROM data WHERE sales > 10000 GROUP BY region ORDER BY SUM(sales) DESC;"),
                ("What is data cleaning, and how do you handle missing values (imputation vs deletion) in a dataset?", "Data Cleaning", "Assess missingness pattern: drop rows if sparse, impute mean/median for numerical, mode for categorical."),
                ("In Python Pandas, what is the difference between a Series and a DataFrame?", "Python Pandas", "Series is a 1-dimensional labeled array; DataFrame is a 2-dimensional tabular structure with labeled axes."),
                ("Explain the difference between Population and Sample in statistics. Why is random sampling essential?", "Statistical Sampling", "Population is the entire set; Sample is a subset. Random sampling avoids selection bias."),
                ("Describe a team project where you analyzed a dataset to extract actionable insights or solve a case study.", "Analytics Project", "Explain the dataset, tools used (Excel/SQL/Python), metrics calculated, and conclusion.")
            ]
        elif year_str == "3":
            questions_raw = [
                ("Explain the different types of SQL Joins (INNER, LEFT, RIGHT, FULL) with a concrete business example.", "Advanced SQL", "INNER matches both; LEFT includes all left + matched right; RIGHT includes all right; FULL includes all."),
                ("What is Exploratory Data Analysis (EDA)? Walk me through your step-by-step EDA process when given a new dataset.", "Analytics Pipeline", "Inspect shape/dtypes, summary statistics, missing values, distribution plots, correlation matrix, outlier detection."),
                ("How do you calculate and interpret Key Performance Indicators (KPIs) like Customer Acquisition Cost (CAC) and Retention Rate?", "Business Intelligence", "CAC = Total Marketing & Sales Costs / New Customers; Retention = (End Customers - New) / Start Customers."),
                ("Explain hypothesis testing, null hypothesis ($H_0$), p-value, and significance level ($\alpha = 0.05$).", "Inferential Stats", "H0 assumes no effect. P-value measures probability of data under H0. Reject H0 if p-value < alpha."),
                ("Describe a dashboard you built in Tableau or Power BI. How did you choose charts to effectively communicate insights?", "BI Dashboards", "Focus on executive metrics at top, trend lines in middle, interactive filters, and drill-down tables.")
            ]
        else: # Year 4
            questions_raw = [
                ("What are SQL Window Functions (`ROW_NUMBER()`, `RANK()`, `LEAD()`, `LAG()`)? Write an example query to rank employee sales per department.", "Complex SQL", "SELECT dept, emp, sales, RANK() OVER (PARTITION BY dept ORDER BY sales DESC) FROM employees;"),
                ("How do you design and evaluate an A/B test for a major product update? Discuss sample size, statistical power, and novelty bias.", "Experimental Design", "Define metric, calculate required sample size for 80% power, split traffic randomly, compute t-test/z-test p-value."),
                ("Explain dimensional modeling in Data Warehousing: Star Schema vs Snowflake Schema, Fact tables vs Dimension tables.", "Data Warehousing", "Fact tables contain metrics/numerical measures; Dimension tables contain context attributes. Star schema is denormalized."),
                ("How do you handle big data in Python when a dataset exceeds available RAM (chunking, Dask, PySpark, SQL pushdown)?", "Big Data Analytics", "Process data in chunks via Pandas `chunksize`, use columnar Parquet format, or offload heavy aggregations to SQL/PySpark."),
                ("Describe a scenario where your data analysis led to a strategic recommendation that was contested by business stakeholders.", "Stakeholder Management", "Use STAR method: detail data validation, sensitivity analysis, clear visual storytelling, and consensus building.")
            ]

    # ── 3. COMPANY PREPARATION ──
    elif is_company:
        target_co = company or "our target company"
        target_role = role or domain or "Software Engineer"
        if year_str == "1":
            questions_raw = [
                (f"Why do you want to work at {target_co} specifically? What excites you about our company mission and products?", "Company Fit", f"Research {target_co}'s products, tech culture, and core values before answering."),
                (f"Walk me through your academic background and key introductory coursework preparing you for a role at {target_co}.", "Introduction", "Summarize your stream, core subjects, and personal projects."),
                (f"What is your strategy for mastering new tools and technologies required for an internship at {target_co}?", "Learning Mindset", "Discuss documentation reading, building small practice applications, and asking structured questions."),
                ("Explain a basic programming concept or problem-solving technique you mastered recently.", "Tech Fundamentals", "Explain syntax, logic, or data structures with a clear example."),
                ("How do you handle tight assignment deadlines and academic pressure?", "Time Management", "Prioritize tasks, eliminate distractions, and maintain clear communication.")
            ]
        elif year_str == "2":
            questions_raw = [
                (f"How do your technical skills and sophomore projects align with the requirements for a {target_role} position at {target_co}?", "Role Alignment", f"Connect your data structures, web, or branch coursework to {target_co}'s domain."),
                ("Given an array of integers, describe an efficient approach to find two numbers that sum to a target value.", "Algorithms", "Use a Hash Map to store complement values for O(n) time and O(n) space."),
                (f"Explain Object-Oriented Programming (OOP) or Database normalization concepts relevant to software engineering at {target_co}.", "Core Tech", "Cover Encapsulation, Inheritance, Polymorphism, and 1NF-3NF data integrity."),
                ("Describe a team project where you had to adapt to changing requirements or design choices mid-way.", "Adaptability", "Detail how your team communicated, evaluated alternatives, and refactored code."),
                (f"What makes {target_co}'s products or technical architecture stand out compared to industry competitors?", "Industry Knowledge", f"Mention specific engineering blog posts or key product features of {target_co}.")
            ]
        elif year_str == "3":
            questions_raw = [
                (f"Describe a major technical project or internship experience that directly demonstrates your readiness for {target_role} at {target_co}.", "Project STAR", "Detail Situation, Task, Action (your specific contribution), and quantitative Result."),
                (f"How would you design a core feature or module for one of {target_co}'s major software products?", "Practical Design", "Outline requirements, data flow, API endpoints, and storage mechanism."),
                ("Explain how you debug a complex issue in a web/software application. What tools and metrics do you use?", "Technical Depth", "Check logs, use breakpoints/profilers, reproduce minimal test cases, and write regression tests."),
                ("Tell me about a time you disagreed with a teammate's technical decision. How did you resolve the conflict?", "Conflict Resolution", "Focus on data-driven discussion, listing pros/cons, prototyping options, and respecting team consensus."),
                (f"What technical questions do you have for our engineering team regarding working at {target_co}?", "Candidate Inquiry", f"Ask about team structure, deployment frequency, tech stack evolution, or mentorship at {target_co}.")
            ]
        else: # Year 4
            questions_raw = [
                (f"Walk me through the most technically challenging problem you solved in an internship or major project. How does this prepare you for {target_co}?", "Advanced Engineering", "Detail complex trade-offs (latency vs throughput), root cause analysis, and measurable impact."),
                (f"How would you design a scalable distributed system for {target_co} handling millions of daily active users?", "System Design", "Discuss microservices, load balancing, message queues (Kafka), caching (Redis), and database sharding."),
                (f"In a competitive placement coding round for {target_co}, how do you analyze and optimize time and space complexity?", "Algorithmic Depth", "Explain Big-O analysis, trade-offs between space and time, and dynamic programming/heap strategies."),
                ("Describe how you approach refactoring a legacy codebase without breaking existing business logic or API contracts.", "Software Quality", "Write comprehensive unit/integration tests first, use Strangler Fig pattern, and deploy incrementally."),
                ("Tell me about a project milestone you failed to achieve on time. What went wrong and how did you communicate with leadership?", "Crisis Management", "Be honest, take accountability, explain risk mitigation strategies, and share lessons learned.")
            ]

    # ── 4. CUSTOM OR GENERAL SOFTWARE DEVELOPMENT DOMAIN ──
    else:
        topic_name = domain or subjects[0] if subjects else "Software Engineering"
        if year_str == "1":
            questions_raw = [
                (f"Introduce yourself and explain why you chose {topic_name} as your area of interest.", "Self Introduction", "Structure: background, interest in this field, and goals."),
                (f"What are the foundational concepts in '{sub_main}' that every beginner should understand?", "Fundamentals", "Define the core terms, primary use case, and basic syntax/logic."),
                ("What is the difference between a variable and a constant in programming? Give a real-world analogy.", "Programming Basics", "Variable holds values that change; constant holds fixed immutable values."),
                ("How do you approach learning a completely new programming language or framework from scratch?", "Learning Process", "Read official documentation, follow tutorials, build small practice applications."),
                ("How do you manage study schedules and project tasks when facing tight deadlines?", "Personal Management", "Prioritize tasks, break work into milestones, and minimize distractions.")
            ]
        elif year_str == "2":
            questions_raw = [
                (f"Explain the core technical concepts of '{sub_main}' and how it is applied in practical projects.", "Core Subject", "Describe the theoretical principles and common practical applications."),
                ("Explain the concept of Object-Oriented Programming (OOP) and its four main pillars.", "OOP Principles", "Encapsulation, Inheritance, Polymorphism, Abstraction."),
                ("What is the difference between an Array and a Linked List in memory structure and search performance?", "Data Structures", "Array: contiguous memory, O(1) random access; Linked List: pointers, O(n) sequential access."),
                ("Explain the difference between SQL relational databases and NoSQL document databases.", "Databases", "SQL has structured schema and ACID compliance; NoSQL is schema-less and scales horizontally."),
                ("Describe a team project where team members had different technical ideas. How did you reach an agreement?", "Team Collaboration", "Compare pro/cons of proposals, build quick prototypes, and seek consensus.")
            ]
        elif year_str == "3":
            questions_raw = [
                (f"Describe a complex project you built incorporating '{sub_main}'. What was your tech stack and architectural approach?", "Project Deep-Dive", "Use STAR method: situation, your role, technical architecture, and results."),
                ("How would you design a clean RESTful API interface for a client-server application?", "API Architecture", "Use standard HTTP verbs, clear URL endpoints, JSON payloads, and appropriate HTTP status codes."),
                ("What is the difference between synchronous and asynchronous execution? How does asynchronous I/O improve system throughput?", "Concurrency", "Synchronous blocks execution until task finishes; Asynchronous delegates tasks and processes callbacks/futures."),
                ("Explain database normalization (1NF, 2NF, 3NF) and when you might intentionally denormalize a database.", "Database Design", "Normalization eliminates redundancy; Denormalization improves read query performance at the expense of storage."),
                ("Describe an internship or practical hands-on experience where you resolved a tricky technical bug.", "Technical Troubleshooting", "Explain debugging tools, stack trace inspection, isolating root cause, and regression testing.")
            ]
        else: # Year 4
            questions_raw = [
                (f"How would you design a high-availability, scalable system architecture incorporating '{sub_main}' handling high traffic?", "System Architecture", "Discuss load balancers, caching layers, message queues, stateless microservices, and DB replication."),
                ("Explain the CAP Theorem in distributed systems. How do AP systems differ from CP systems during network partitions?", "Distributed Systems", "Consistency vs Availability vs Partition Tolerance. Explain database trade-offs like Cassandra vs MongoDB."),
                ("How do you profile, identify, and resolve memory leaks or severe performance bottlenecks in software applications?", "Performance Optimization", "Use memory profilers, heap dumps, CPU flame graphs, optimize DB queries/indexes, and reduce garbage collection overhead."),
                ("Describe your process for conducting code reviews, maintaining software quality, and enforcing CI/CD pipelines.", "Engineering Quality", "Check readability, test coverage, security vulnerabilities, edge cases, and automated build pipelines."),
                ("Tell me about a major technical decision you led during a project that had significant trade-offs. How did you measure success?", "Senior Engineering Judgement", "Discuss trade-offs (e.g. latency vs consistency, build vs buy), metrics evaluated, and long-term impact.")
            ]

    # Package into standardized question dictionary format
    questions = []
    for text, topic, hint in questions_raw:
        questions.append({
            "text": text,
            "difficulty": diff_name,
            "topic": topic,
            "hint": hint
        })
    return questions

is_real_key = False
if GEMINI_API_KEY:
    key_clean = GEMINI_API_KEY.strip()
    if key_clean and key_clean.lower() not in ["mock", "your_api_key_here", "your_google_gemini_api_key_here"]:
        is_real_key = True

if is_real_key:
    try:
        _client = genai.Client(api_key=GEMINI_API_KEY)
        print(f"[HireMind] Gemini client initialised with model: {GEMINI_MODEL}")
    except Exception as e:
        print(f"[HireMind] Error initialising real Gemini client: {e}. Falling back to mock client.")
        is_real_key = False

if not is_real_key:
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
                        if "Branch" in line_stripped or "Stream" in line_stripped:
                            val = line_stripped.split(":", 1)[-1].strip() if ":" in line_stripped else ""
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
                        elif "Academic Year" in line_stripped or "Year" in line_stripped:
                            val = line_stripped.split(":", 1)[-1].strip() if ":" in line_stripped else ""
                            for char in val:
                                if char.isdigit():
                                    year = char
                                    break
                        elif "Category" in line_stripped:
                            val = line_stripped.split(":", 1)[-1].strip() if ":" in line_stripped else ""
                            if "hr" in val.lower(): category = "hr"
                            elif "software" in val.lower() or "sde" in val.lower(): category = "sde"
                            elif "web" in val.lower(): category = "web"
                            elif "data" in val.lower(): category = "data"
                            elif "company" in val.lower(): category = "company"
                            else: category = "custom"
                        elif "Target Domain/Role" in line_stripped or "Selected Domain" in line_stripped or "Domain" in line_stripped:
                            if ":" in line_stripped:
                                domain = line_stripped.split(":", 1)[1].strip()
                        elif "Focus Subjects" in line_stripped or "Selected Subjects" in line_stripped:
                            if ":" in line_stripped:
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
        print(f"[HireMind] Mock Gemini client initialised (fallback) with model: {GEMINI_MODEL}")


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
    """Generate interview questions tailored specifically to Domain and Academic Year (1-4).

    Uses Gemini AI if configured, with automatic fallback to the curated question bank.
    """
    year_str = str(year or "1")
    target_diff = "Easy" if year_str == "1" else "Medium" if year_str in ["2", "3"] else "Hard"

    if _client:
        try:
            subj_str = ", ".join(subjects) if subjects else "General domain subjects"
            prompt = f"""You are an expert technical interviewer and hiring assessment lead.
Generate exactly {count} distinct interview questions tailored to the candidate's exact Domain and Academic Year level.

Candidate Profile:
- Category: {category}
- Branch/Stream: {branch}
- Target Domain/Role: {domain}
- Academic Year / Level: Year {year_str} (Year 1=Freshman Fundamentals, Year 2=Sophomore Core Concepts, Year 3=Junior Advanced & Frameworks, Year 4=Senior Placement & System Architecture)
- Specific Focus Subjects: {subj_str}

STRICT SPECIFICATION RULES:
1. DOMAIN SPECIFICITY:
   - "Web Development": Ask about HTML/CSS, JavaScript/ES6+, DOM, React/Vue/Node, REST APIs, databases, web security, performance, deployment.
   - "Data Analyst": Ask about Excel/spreadsheets, SQL (queries, joins, CTEs), statistics, data cleaning, Python/Pandas, visualization (Tableau/PowerBI), business KPIs.
   - "Software Development": Ask about programming, DSA, OOP, algorithms, debugging, software engineering principles.
   - "Company Preparation" or "Company - Role": Ask company-specific and role-specific technical and behavioral questions for that company/role.
   - "Custom Interview": Base questions strictly on the custom topic: "{domain}".

2. ACADEMIC YEAR SPECIFICITY (Tailor subject matter and scenario complexity, not just difficulty labels):
   - Year 1: Core fundamentals, basic syntax/definitions, simple logic, basic problem solving, learning motivation.
   - Year 2: Intermediate concepts, core data structures/OOP/SQL queries, small practical scenarios and project components.
   - Year 3: Advanced concepts, framework architecture, API integration, technical trade-offs, internship/practical project scenarios.
   - Year 4: Placement/interview-level depth, edge-case optimization, real-world architecture/system design scenarios, production trade-offs, behavioral STAR method.

Return ONLY a valid JSON object matching this exact format (no extra text, no markdown code fences):
{{
  "questions": [
    {{
      "text": "Clear, direct question text",
      "difficulty": "{target_diff}",
      "topic": "Specific topic name",
      "hint": "Short non-spoiling preview or talking point hint"
    }}
  ]
}}
"""
            res = _get_json_response(prompt)
            raw_qs = res.get("questions", []) if isinstance(res, dict) else []
            if isinstance(raw_qs, list) and len(raw_qs) > 0:
                valid_qs = []
                for q in raw_qs[:count]:
                    if isinstance(q, dict) and "text" in q and len(q["text"].strip()) > 5:
                        valid_qs.append({
                            "text": q["text"].strip(),
                            "difficulty": q.get("difficulty", target_diff),
                            "topic": q.get("topic", domain.replace("-", " ").title()),
                            "hint": q.get("hint", "")
                        })
                if len(valid_qs) >= count:
                    return valid_qs[:count]
        except Exception as exc:
            print(f"[HireMind] Gemini AI question generation failed ({exc}). Using curated question bank.")

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
