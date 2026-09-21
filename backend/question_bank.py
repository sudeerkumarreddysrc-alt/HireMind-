import os
import json
import random
from typing import List, Dict, Any

# Load the JSON question bank
QB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "question_bank.json")

try:
    with open(QB_PATH, "r", encoding="utf-8") as f:
        QB_DATA = json.load(f)
except Exception as e:
    print(f"[HireMind] Error loading question_bank.json: {e}")
    QB_DATA = {"hr": {}, "technical": {}, "company_prep": {}}


def _make_hint(q: Dict[str, Any]) -> str:
    """Return a short, non-spoiling hint shown via the 'Need a Hint?' button.

    Derived from evaluation_keywords (max 4) so it steers the candidate
    toward the right concepts without revealing the full ideal answer.
    """
    keywords = q.get("evaluation_keywords", [])
    if keywords:
        preview = ", ".join(keywords[:4])
        return f"Think about: {preview}"
    # Fallback: first sentence of ideal answer, truncated to 80 chars
    ideal = q.get("ideal_answer", "")
    if ideal:
        sentence = ideal.split(".")[0].strip()
        return sentence[:80] + ("…" if len(sentence) > 80 else "")
    return ""


def get_curated_questions(
    category: str,
    branch: str,
    domain: str,
    year: str,
    subjects: List[str],
    count: int = 5
) -> List[Dict[str, Any]]:
    """
    Selects a customized list of questions from the offline JSON question bank.
    
    For HR interviews (category == "hr"):
      - Pulls questions from categories: Personality, Communication, Leadership, Teamwork, Ethics, Confidence, Career Goals, Stress Management.
      
    For Technical/Company Prep interviews:
      - Matches company-specific questions if it's a Company Prep session.
      - Matches Branch -> Year -> Domain -> Subject -> Difficulty.
      - Implements a cascading fallback system to guarantee exactly `count` questions.
    """
    selected: List[Dict[str, Any]] = []
    seen_questions = set()

    # Determine target difficulty based on Academic Year:
    # Year 1 -> Easy, Year 2 & 3 -> Medium, Year 4 -> Hard
    year_str = str(year)
    if year_str == "1":
        target_difficulty = "Easy"
    elif year_str in ["2", "3"]:
        target_difficulty = "Medium"
    else:
        target_difficulty = "Hard"

    # --- HR INTERVIEWS ---
    if category.lower() == "hr" or category.lower() == "human resources":
        hr_bank = QB_DATA.get("hr", {})
        # Get list of HR categories we want to pull from
        hr_categories = [
            "Personality", "Communication", "Leadership", "Teamwork", 
            "Ethics", "Confidence", "Career Goals", "Stress Management"
        ]
        
        # Round-robin selection across categories to ensure diversity
        attempts = 0
        while len(selected) < count and attempts < 10:
            attempts += 1
            for cat in hr_categories:
                if len(selected) >= count:
                    break
                cat_qs = hr_bank.get(cat, [])
                for q in cat_qs:
                    q_text = q.get("question") or q.get("text")
                    if q_text and q_text not in seen_questions:
                        seen_questions.add(q_text)
                        # Ensure fields match database expectation
                        selected.append({
                            "text": q_text,
                            "difficulty": q.get("difficulty", "Easy"),
                            "topic": f"HR / {cat}",
                            "hint": _make_hint(q),
                            "ideal_answer": q.get("ideal_answer", ""),
                            "evaluation_keywords": q.get("evaluation_keywords", []),
                            "follow_up_questions": q.get("follow_up_questions", [])
                        })
                        break

    # --- TECHNICAL / COMPANY PREP INTERVIEWS ---
    else:
        # 1. Company Prep matching
        company_key = None
        # Support formats like "Google - SDE" or domain value containing company names
        domain_lower = domain.lower()
        if " - " in domain:
            company_name = domain.split(" - ", 1)[0].strip().lower()
        elif "prep for" in domain_lower:
            # e.g., "Company Prep for Google"
            company_name = domain_lower.split("prep for")[-1].strip()
        else:
            company_name = domain_lower

        # Find matching key in company_prep
        company_bank = QB_DATA.get("company_prep", {})
        for k in company_bank.keys():
            if k in company_name:
                company_key = k
                break

        if company_key:
            co_qs = company_bank.get(company_key, [])
            for q in co_qs:
                q_text = q.get("question") or q.get("text")
                if q_text and q_text not in seen_questions:
                    seen_questions.add(q_text)
                    selected.append({
                        "text": q_text,
                        "difficulty": q.get("difficulty", target_difficulty),
                        "topic": q.get("topic", "Company Prep"),
                        "hint": _make_hint(q),
                        "ideal_answer": q.get("ideal_answer", ""),
                        "evaluation_keywords": q.get("evaluation_keywords", []),
                        "follow_up_questions": q.get("follow_up_questions", [])
                    })

        # 2. Extract technical questions from hierarchy
        branch_key = branch.lower()
        tech_bank = QB_DATA.get("technical", {})
        
        # Fallback list for branch key
        branches_to_try = [branch_key]
        if branch_key != "other":
            branches_to_try.append("other")
            
        # Fallback list for academic year
        years_to_try = [year_str]
        if year_str != "1":
            years_to_try.append("1")

        # Normalize domain to key
        domain_key = "general"
        domain_lower = domain.lower()
        if "web" in domain_lower:
            domain_key = "web-dev"
        elif "backend" in domain_lower:
            domain_key = "backend"
        elif "full" in domain_lower:
            domain_key = "fullstack"
        elif "mobile" in domain_lower:
            domain_key = "mobile-dev"
        elif "devops" in domain_lower:
            domain_key = "devops"
        elif "ai" in domain_lower or "ml" in domain_lower:
            domain_key = "ai-ml"
        elif "science" in domain_lower:
            domain_key = "data-science"
        elif "analyst" in domain_lower or "analytics" in domain_lower:
            domain_key = "data-analyst"
        elif "nlp" in domain_lower:
            domain_key = "nlp"
        elif "cyber" in domain_lower or "security" in domain_lower:
            domain_key = "cybersec"
        elif "network" in domain_lower:
            domain_key = "networking"
        elif "cloud" in domain_lower:
            domain_key = "cloud"
        elif "embed" in domain_lower:
            domain_key = "embedded"
        elif "game" in domain_lower:
            domain_key = "game-dev"
        elif "product" in domain_lower:
            domain_key = "product"

        domains_to_try = [domain_key]
        # Domain family fallback (prevent cross-domain leaks)
        if domain_key in ["data-analyst", "data-science"]:
            domains_to_try.extend(["data-analyst", "data-science", "analytics"])
        elif domain_key in ["web-dev", "frontend", "backend", "fullstack"]:
            domains_to_try.extend(["web-dev", "frontend", "backend", "fullstack"])
        elif domain_key in ["devops", "cloud", "networking"]:
            domains_to_try.extend(["devops", "cloud", "networking"])
        elif domain_key in ["ai-ml", "nlp"]:
            domains_to_try.extend(["ai-ml", "nlp", "data-science"])
        else:
            domains_to_try.extend(["general", "Programming", "Data Structures", "Algorithms"])

        # Deduplicate while preserving order
        seen_doms = set()
        domains_to_try = [d for d in domains_to_try if not (d in seen_doms or seen_doms.add(d))]

        # Map subjects
        subjects_to_try = []
        for s in subjects:
            s_clean = s.strip().lower().replace("-", "").replace(" ", "")
            # check basic matches
            if "python" in s_clean:
                subjects_to_try.append("python")
            elif "javascript" in s_clean or "js" in s_clean:
                subjects_to_try.append("javascript")
            elif "sql" in s_clean or "db" in s_clean:
                subjects_to_try.append("sql")
            elif "struct" in s_clean or "dsa" in s_clean:
                subjects_to_try.append("data-structures")
            elif "os" in s_clean or "operating" in s_clean:
                subjects_to_try.append("operating-systems")
            elif "network" in s_clean:
                subjects_to_try.append("networking")
            elif "circuit" in s_clean:
                subjects_to_try.append("circuits")
            else:
                subjects_to_try.append("general")
        if not subjects_to_try:
            subjects_to_try.append("general")
        if "general" not in subjects_to_try:
            subjects_to_try.append("general")

        difficulties_to_try = [target_difficulty]
        # fallback difficulties
        for diff in ["Medium", "Easy", "Hard"]:
            if diff not in difficulties_to_try:
                difficulties_to_try.append(diff)

        # Let's perform search
        for b_name in branches_to_try:
            if len(selected) >= count:
                break
            b_data = tech_bank.get(b_name, {})
            for y_name in years_to_try:
                if len(selected) >= count:
                    break
                y_data = b_data.get(y_name, {})
                for d_name in domains_to_try:
                    if len(selected) >= count:
                        break
                    d_data = y_data.get(d_name, {})
                    for s_name in subjects_to_try:
                        if len(selected) >= count:
                            break
                        s_data = d_data.get(s_name, {})
                        for diff_name in difficulties_to_try:
                            if len(selected) >= count:
                                break
                            q_list = s_data.get(diff_name, [])
                            for q in q_list:
                                q_text = q.get("question") or q.get("text")
                                if q_text and q_text not in seen_questions:
                                    seen_questions.add(q_text)
                                    selected.append({
                                        "text": q_text,
                                        "difficulty": q.get("difficulty", diff_name),
                                        "topic": q.get("topic", f"{b_name.upper()} {s_name.capitalize()}"),
                                        "hint": _make_hint(q),
                                        "ideal_answer": q.get("ideal_answer", ""),
                                        "evaluation_keywords": q.get("evaluation_keywords", []),
                                        "follow_up_questions": q.get("follow_up_questions", [])
                                    })

    # --- DOMAIN-AWARE FALLBACK ---
    # Fill remaining slots with domain x year mock templates if JSON search falls short
    if len(selected) < count:
        from .ai_service import generate_mock_questions
        # Determine company / role
        co_name = ""
        role_name = domain
        if " - " in domain:
            parts = domain.split(" - ", 1)
            co_name = parts[0].strip()
            role_name = parts[1].strip()
        mock_qs = generate_mock_questions(category, branch, year, domain, subjects, co_name, role_name)
        for q in mock_qs:
            if len(selected) >= count:
                break
            q_text = q.get("text")
            if q_text and q_text not in seen_questions:
                seen_questions.add(q_text)
                selected.append(q)

    # --- FINAL SAFETY FALLBACK (HR / behavioral) ---
    if len(selected) < count:
        for cat, q_list in QB_DATA.get("hr", {}).items():
            for q in q_list:
                if len(selected) >= count:
                    break
                q_text = q.get("question") or q.get("text")
                if q_text and q_text not in seen_questions:
                    seen_questions.add(q_text)
                    selected.append({
                        "text": q_text,
                        "difficulty": q.get("difficulty", "Easy"),
                        "topic": f"HR / {cat}",
                        "hint": _make_hint(q),
                        "ideal_answer": q.get("ideal_answer", ""),
                        "evaluation_keywords": q.get("evaluation_keywords", []),
                        "follow_up_questions": q.get("follow_up_questions", [])
                    })

    return selected[:count]


def find_offline_question(text: str) -> Dict[str, Any]:
    """
    Search the question bank for a question matching `text`
    to retrieve its ideal answer and evaluation keywords.
    """
    text_clean = text.strip().lower()
    
    # 1. Check HR bank
    for cat, q_list in QB_DATA.get("hr", {}).items():
        for q in q_list:
            q_txt = (q.get("question") or q.get("text") or "").strip().lower()
            if q_txt == text_clean or text_clean in q_txt or q_txt in text_clean:
                return q
                
    # 2. Check Company Prep
    for co, q_list in QB_DATA.get("company_prep", {}).items():
        for q in q_list:
            q_txt = (q.get("question") or q.get("text") or "").strip().lower()
            if q_txt == text_clean or text_clean in q_txt or q_txt in text_clean:
                return q
                
    # 3. Check Technical
    for b, b_data in QB_DATA.get("technical", {}).items():
        for y, y_data in b_data.items():
            for d, d_data in y_data.items():
                for s, s_data in d_data.items():
                    for diff, q_list in s_data.items():
                        for q in q_list:
                            q_txt = (q.get("question") or q.get("text") or "").strip().lower()
                            if q_txt == text_clean or text_clean in q_txt or q_txt in text_clean:
                                return q
                                
    return {}
