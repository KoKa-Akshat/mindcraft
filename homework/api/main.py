"""
api/main.py

MindCraft Homework Help API — three endpoints:

  POST /submit   → full pipeline: orchestrate → agents → select → visual → cards
  POST /clue     → single clue for a stuck student (max 2 per step)
  POST /outcome  → record card outcome and update knowledge graph
  GET  /health   → service health check
"""

from __future__ import annotations
import asyncio, logging, os, uuid, json
from datetime import datetime, UTC
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from students.student_loader import load_student, update_knowledge_graph
from orchestrator.orchestrator import orchestrate
from agents.agent_runner import run_agents
from agents.knowledge_checker import select_best_path, get_most_visual_step
from visuals.manim_runner import render_visual
from cards.card_builder import build_cards
import anthropic

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

LOGS_DIR = Path(__file__).parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)
SESSION_LOG = LOGS_DIR / "sessions.jsonl"

app = FastAPI(title="MindCraft Homework Help", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://mindcraft-93858.web.app",
        "https://mindcraft-93858.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ──────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    student_id: str
    problem_text: str
    subject: str = "algebra"


class ClueRequest(BaseModel):
    student_id: str
    step_content: str
    concept_addressed: str
    preferred_style: str = "algebraic"
    clue_number: int = 1   # 1 or 2


class OutcomeRequest(BaseModel):
    student_id: str
    session_id: str
    concept_id: str
    outcome: float           # 0.0 wrong, 0.5 partial, 1.0 correct
    clues_used: int = 0


# ── /submit ────────────────────────────────────────────────────────────────────

@app.post("/submit")
async def submit_problem(req: SubmitRequest):
    session_id = str(uuid.uuid4())
    logger.info("[%s] New problem: %s", session_id, req.problem_text[:60])

    # 1. Load student profile
    student = load_student(req.student_id)

    # 2. Orchestrator → solution paths
    try:
        orchestrator_out = await orchestrate(
            problem_text    = req.problem_text,
            subject         = req.subject,
            student_strengths = student.strengths,
            student_gaps    = student.gaps,
        )
    except Exception as exc:
        logger.error("[%s] Orchestrator failed: %s", session_id, exc)
        raise HTTPException(status_code=500, detail=f"Orchestrator error: {exc}")

    # 3. Agents in parallel
    try:
        agent_outputs = await run_agents(
            paths        = orchestrator_out.paths,
            student      = student,
            problem_text = req.problem_text,
        )
    except Exception as exc:
        logger.error("[%s] Agents failed: %s", session_id, exc)
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}")

    # 4. Select best path
    best_path = select_best_path(agent_outputs, student)

    # 5. Generate visual for the most important step
    key_step   = get_most_visual_step(best_path)
    visual_idx = best_path.narrative.index(key_step)

    visual: dict | None = None
    if key_step.visual_needed and key_step.visual_description:
        try:
            visual = await render_visual(
                visual_description = key_step.visual_description,
                concept_key        = key_step.concept_addressed + "_" + best_path.framing,
            )
        except Exception as exc:
            logger.warning("[%s] Visual render failed: %s", session_id, exc)

    # 6. Build card sequence
    cards = build_cards(
        orchestrator_output = orchestrator_out,
        winning_path        = best_path,
        visual              = visual,
        visual_step_index   = visual_idx,
    )

    # 7. Log session
    _log_session(session_id, req, orchestrator_out, best_path, cards)

    return {
        "session_id":      session_id,
        "problem_summary": orchestrator_out.problem_summary,
        "target_concept":  orchestrator_out.target_concept,
        "path_framing":    best_path.framing,
        "cards":           cards,
        "paths_explored":  len(orchestrator_out.paths),
    }


# ── /clue ──────────────────────────────────────────────────────────────────────

CLUE_SYSTEM = (
    "You are a MindCraft teaching assistant giving a one-sentence nudge to a stuck student. "
    "Give a clue that moves them forward WITHOUT giving away the answer. "
    "End the clue with a short question that puts the student back in the driver's seat. "
    "Output ONLY the clue sentence. Nothing else. No preamble."
)

@app.post("/clue")
async def get_clue(req: ClueRequest):
    if req.clue_number > 2:
        return {
            "clue": "You're closer than you think. Try writing out what you DO know first — list every relevant formula or fact you can remember, then see what fits."
        }

    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    user_msg = (
        f"The student is stuck on this step:\n{req.step_content}\n\n"
        f"They are working toward understanding: {req.concept_addressed.replace('_', ' ')}\n"
        f"Their preferred learning style: {req.preferred_style}\n"
        f"This is clue #{req.clue_number} — make it {'slightly more direct' if req.clue_number == 2 else 'a gentle nudge'}."
    )
    try:
        message = await client.messages.create(
            model       = "claude-sonnet-4-5",
            max_tokens  = 150,
            temperature = 0.5,
            system      = CLUE_SYSTEM,
            messages    = [{"role": "user", "content": user_msg}],
        )
        clue = message.content[0].text.strip()
        return {"clue": clue}
    except Exception as exc:
        logger.error("Clue generation failed: %s", exc)
        return {"clue": "Think about what you already know about this concept — what's the most basic fact you can state with confidence?"}


# ── /outcome ───────────────────────────────────────────────────────────────────

@app.post("/outcome")
async def record_outcome(req: OutcomeRequest):
    try:
        updated = update_knowledge_graph(
            student_id  = req.student_id,
            concept_id  = req.concept_id,
            outcome     = req.outcome,
            clues_used  = req.clues_used,
        )
        return {
            "concept_id":      req.concept_id,
            "new_confidence":  updated.get_confidence(req.concept_id),
            "strengths":       updated.strengths[:5],
            "gaps":            updated.gaps[:5],
        }
    except Exception as exc:
        logger.error("Outcome update failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── /health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "mindcraft-homework"}


# ── Session logger ─────────────────────────────────────────────────────────────

def _log_session(session_id, req, orch_out, best_path, cards):
    try:
        entry = {
            "ts":          datetime.now(UTC).isoformat(),
            "session_id":  session_id,
            "student_id":  req.student_id,
            "problem":     req.problem_text[:200],
            "subject":     req.subject,
            "target":      orch_out.target_concept,
            "path_chosen": best_path.path_id,
            "framing":     best_path.framing,
            "card_count":  len(cards),
        }
        with open(SESSION_LOG, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass
