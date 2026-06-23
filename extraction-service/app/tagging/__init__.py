"""Skill-tagging pass (knowledge-graph): map extracted questions to TOEIC skill
codes as a focused, single-task LLM step decoupled from extraction."""
from app.tagging.skill_tagger import tag_questions

__all__ = ["tag_questions"]
