from fastapi import FastAPI, HTTPException
import csv
import sys
import json
import requests
from pathlib import Path
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# =========================================================
# NETSAGE AI - BACKEND
# =========================================================

app = FastAPI(
    title="NetSage AI",
    description="AI-assisted Cisco network troubleshooting API",
    version="1.0.0"
)

# =========================================================
# CORS - ALLOW REACT FRONTEND
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# PROJECT PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

CASES_FILE = BASE_DIR / "data" / "netsage_cases.csv"

PROMPT_FILE = BASE_DIR / "prompts" / "diagnose_prompt.md"

REVIEWS_FILE = BASE_DIR / "data" / "reviews.json"

RULE_CHECKER_DIR = BASE_DIR / "rule_checker"


# =========================================================
# IMPORT RULE CHECKER
# =========================================================

if str(RULE_CHECKER_DIR) not in sys.path:
    sys.path.append(str(RULE_CHECKER_DIR))

from checker import run_case


# =========================================================
# OLLAMA CONFIGURATION
# =========================================================

OLLAMA_URL = "http://localhost:11434/api/generate"

OLLAMA_MODEL = "qwen2.5:7b"


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {
        "message": "NetSage AI backend is running",
        "status": "success"
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health_check():

    return {
        "status": "healthy"
    }


# =========================================================
# GET ALL CASES
# =========================================================

@app.get("/cases")
def get_cases():

    if not CASES_FILE.exists():

        raise HTTPException(
            status_code=404,
            detail="cases.csv not found"
        )

    with open(
        CASES_FILE,
        "r",
        encoding="utf-8-sig"
    ) as file:

        reader = csv.DictReader(file)

        cases = list(reader)

    return {
        "total_cases": len(cases),
        "cases": cases
    }


# =========================================================
# GET ONE CASE
# =========================================================

@app.get("/cases/{case_code}")
def get_case(case_code: str):

    if not CASES_FILE.exists():

        raise HTTPException(
            status_code=404,
            detail="cases.csv not found"
        )

    with open(
        CASES_FILE,
        "r",
        encoding="utf-8-sig"
    ) as file:

        reader = csv.DictReader(file)

        for case in reader:

            if case["case_code"].upper() == case_code.upper():

                return case

    raise HTTPException(
        status_code=404,
        detail=f"Case {case_code} not found"
    )


# =========================================================
# RUN RULE CHECKER
# =========================================================

@app.get("/check/{case_code}")
def check_case(case_code: str):

    if not CASES_FILE.exists():

        raise HTTPException(
            status_code=404,
            detail="cases.csv not found"
        )

    with open(
        CASES_FILE,
        "r",
        encoding="utf-8-sig"
    ) as file:

        reader = csv.DictReader(file)

        for case in reader:

            if case["case_code"].upper() == case_code.upper():

                results = run_case(case)

                failures = [
                    result
                    for result in results
                    if result["status"] == "FAIL"
                ]

                return {
                    "case_code": case["case_code"],
                    "total_rules": len(results),
                    "failed_rules": len(failures),
                    "results": results
                }

    raise HTTPException(
        status_code=404,
        detail=f"Case {case_code} not found"
    )


# =========================================================
# PREPARE CASE FOR AI
# =========================================================

@app.get("/diagnose-input/{case_code}")
def prepare_diagnosis(case_code: str):

    if not CASES_FILE.exists():

        raise HTTPException(
            status_code=404,
            detail="cases.csv not found"
        )

    case = None

    with open(
        CASES_FILE,
        "r",
        encoding="utf-8-sig"
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:

            if row["case_code"].upper() == case_code.upper():

                case = row
                break

    if case is None:

        raise HTTPException(
            status_code=404,
            detail=f"Case {case_code} not found"
        )

    rule_results = run_case(case)

    failed_rules = [
        rule
        for rule in rule_results
        if rule["status"] == "FAIL"
    ]

    diagnosis_input = {

        "case_id": case["case_code"],

        "symptom": case["symptom"],

        "topology": case["topology_note"],

        "show_command_output": case["show_outputs"],

        "expected_concept": case["concept"],

        "severity": case["severity"],

        "rule_checker_findings": failed_rules
    }

    return {

        "message": "Case prepared for AI diagnosis",

        "ai_input": diagnosis_input,

        "rule_checker_summary": {

            "total_rules": len(rule_results),

            "failed_rules": len(failed_rules)
        }
    }


# =========================================================
# LOAD AI PROMPT
# =========================================================

def load_prompt():

    if not PROMPT_FILE.exists():

        raise FileNotFoundError(
            "diagnose_prompt.md not found"
        )

    return PROMPT_FILE.read_text(
        encoding="utf-8"
    )


# =========================================================
# CLEAN AI RESPONSE
# =========================================================

def clean_json_response(text):

    text = text.strip()

    if text.startswith("```json"):

        text = text[7:]

    elif text.startswith("```"):

        text = text[3:]

    if text.endswith("```"):

        text = text[:-3]

    text = text.strip()

    return json.loads(text)


# =========================================================
# CALL OLLAMA
# =========================================================

def call_ollama(prompt):

    payload = {

        "model": OLLAMA_MODEL,

        "prompt": prompt,

        "stream": False,

        "format": "json"
    }

    response = requests.post(

        OLLAMA_URL,

        json=payload,

        timeout=180
    )

    response.raise_for_status()

    data = response.json()

    return data["response"]


# =========================================================
# AI DIAGNOSIS
# =========================================================

@app.get("/diagnose/{case_code}")
def diagnose_case(case_code: str):

    if not CASES_FILE.exists():

        raise HTTPException(
            status_code=404,
            detail="cases.csv not found"
        )

    # -----------------------------------------
    # Find case
    # -----------------------------------------

    case = None

    with open(
        CASES_FILE,
        "r",
        encoding="utf-8-sig"
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:

            if row["case_code"].upper() == case_code.upper():

                case = row
                break

    if case is None:

        raise HTTPException(
            status_code=404,
            detail=f"Case {case_code} not found"
        )

    # -----------------------------------------
    # Run rule checker
    # -----------------------------------------

    rule_results = run_case(case)

    failed_rules = [

        rule
        for rule in rule_results
        if rule["status"] == "FAIL"
    ]

    # -----------------------------------------
    # Load AI prompt
    # -----------------------------------------

    try:

        system_prompt = load_prompt()

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    # -----------------------------------------
    # Build AI input
    # -----------------------------------------

    ai_case_data = {

        "case_id": case["case_code"],

        "symptom": case["symptom"],

        "topology": case["topology_note"],

        "show_command_output": case["show_outputs"],

        "expected_concept": case["concept"],

        "severity": case["severity"],

        "rule_checker_findings": failed_rules
    }

    full_prompt = f"""
{system_prompt}

==================================================
CASE TO ANALYZE
==================================================

{json.dumps(ai_case_data, indent=2)}

==================================================
IMPORTANT
==================================================

Analyze the case using ONLY the supplied evidence.

Return ONLY valid JSON.

Remember:

- Do not invent evidence.
- Identify the most likely root cause.
- Give a confidence score from 0 to 100.
- Identify the relevant OSI layer.
- Provide evidence from the supplied case.
- Give the next useful Cisco troubleshooting command.
- Give practical fix steps.
- Keep human review mandatory.
"""

    # -----------------------------------------
    # Call Ollama
    # -----------------------------------------

    try:

        ai_response = call_ollama(full_prompt)

    except requests.exceptions.ConnectionError:

        raise HTTPException(

            status_code=503,

            detail=(
                "Ollama is not running. "
                "Start Ollama before using /diagnose."
            )
        )

    except requests.exceptions.Timeout:

        raise HTTPException(

            status_code=504,

            detail="Ollama took too long to respond."
        )

    except requests.exceptions.RequestException as error:

        raise HTTPException(

            status_code=502,

            detail=f"Ollama request failed: {error}"
        )

    # -----------------------------------------
    # Parse AI JSON
    # -----------------------------------------

    try:

        diagnosis = clean_json_response(
            ai_response
        )

    except json.JSONDecodeError:

        raise HTTPException(

            status_code=502,

            detail={
                "message": "AI returned invalid JSON",
                "raw_response": ai_response
            }
        )

    # -----------------------------------------
    # Return diagnosis
    # -----------------------------------------

    return {

        "case": case,

        "rule_checker": {

            "total_rules": len(rule_results),

            "failed_rules": len(failed_rules),

            "results": rule_results
        },

        "ai_diagnosis": diagnosis
    }


# =========================================================
# SUBMIT HUMAN REVIEW
# =========================================================

@app.post("/review")
def submit_review(review: dict):

    # -----------------------------------------
    # Validate required fields
    # -----------------------------------------

    required_fields = [
        "case_id",
        "decision"
    ]

    for field in required_fields:

        if field not in review:

            raise HTTPException(

                status_code=400,

                detail=f"Missing required field: {field}"
            )

    # -----------------------------------------
    # Validate decision
    # -----------------------------------------

    allowed_decisions = [
        "Accepted",
        "Edited",
        "Rejected"
    ]

    if review["decision"] not in allowed_decisions:

        raise HTTPException(

            status_code=400,

            detail=(
                "Decision must be "
                "Accepted, Edited, or Rejected"
            )
        )

    # -----------------------------------------
    # Create reviews file if needed
    # -----------------------------------------

    if not REVIEWS_FILE.exists():

        REVIEWS_FILE.write_text(
            "[]",
            encoding="utf-8"
        )

    # -----------------------------------------
    # Read existing reviews
    # -----------------------------------------

    try:

        reviews = json.loads(

            REVIEWS_FILE.read_text(
                encoding="utf-8"
            )
        )

    except json.JSONDecodeError:

        reviews = []

    # -----------------------------------------
    # Create review ID
    # -----------------------------------------

    review["review_id"] = len(reviews) + 1

    # -----------------------------------------
    # Add timestamp
    # -----------------------------------------

    review["reviewed_at"] = datetime.now().isoformat()

    # -----------------------------------------
    # Save review
    # -----------------------------------------

    reviews.append(review)

    REVIEWS_FILE.write_text(

        json.dumps(
            reviews,
            indent=4
        ),

        encoding="utf-8"
    )

    return {

        "message": "Human review saved successfully",

        "review": review
    }
# =========================================================
# GET ALL HUMAN REVIEWS
# =========================================================

@app.get("/reviews")
def get_reviews():

    # If the file doesn't exist, return an empty list
    if not REVIEWS_FILE.exists():
        return {
            "total_reviews": 0,
            "reviews": []
        }

    try:
        reviews = json.loads(
            REVIEWS_FILE.read_text(
                encoding="utf-8"
            )
        )

    except json.JSONDecodeError:

        reviews = []

    return {
        "total_reviews": len(reviews),
        "reviews": reviews
    }