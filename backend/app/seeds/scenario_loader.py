"""
Scenario seed loader: loads, validates, and seeds scenarios from YAML files in app/seeds/scenarios/.
"""

import logging
import uuid
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.scenario import Scenario, ScenarioChunk, ScenarioRequirement

logger = logging.getLogger(__name__)

SCENARIO_SEEDS_DIR = Path(__file__).resolve().parent / "scenarios"
SCENARIO_NAMESPACE = uuid.UUID("4d9f8293-5523-5fc0-a342-d9795cce2501")

VALID_CATEGORIES = {"DAILY_LIFE", "SOCIAL", "TRAVEL_SHOPPING", "WORKPLACE"}
VALID_LEVELS = {"A1", "A2", "B1", "B2", "C1"}
VALID_FUNCTIONS = {"OPENING", "REQUEST", "CLARIFY", "AGREE_DECLINE", "CLOSING"}


def validate_scenario_dict(item: dict[str, Any]) -> None:
    """Validate schema of a single scenario seed."""
    required_keys = [
        "slug",
        "category",
        "title_vi",
        "title_en",
        "level",
        "estimated_duration_minutes",
        "context",
        "user_role",
        "ai_role",
        "goals",
        "sort_order",
        "requirements",
        "chunks",
    ]
    for key in required_keys:
        if key not in item:
            raise ValueError(f"Scenario seed missing required key '{key}' in: {item.get('slug')}")

    if item["category"] not in VALID_CATEGORIES:
        raise ValueError(
            f"Invalid category '{item['category']}' for scenario {item['slug']}. Must be one of {VALID_CATEGORIES}"
        )

    if item["level"] not in VALID_LEVELS:
        raise ValueError(
            f"Invalid level '{item['level']}' for scenario {item['slug']}. Must be one of {VALID_LEVELS}"
        )

    chunks = item.get("chunks", [])
    if not (4 <= len(chunks) <= 6):
        raise ValueError(
            f"Scenario {item['slug']} has {len(chunks)} chunks; must have between 4 and 6 chunks."
        )

    for chunk in chunks:
        for ckey in [
            "function_tag",
            "text",
            "meaning_vi",
            "example_sentence",
            "accepted_variations",
            "sort_order",
        ]:
            if ckey not in chunk:
                raise ValueError(
                    f"Chunk in scenario {item['slug']} missing key '{ckey}': {chunk}"
                )
        if chunk["function_tag"] not in VALID_FUNCTIONS:
            raise ValueError(
                f"Invalid function_tag '{chunk['function_tag']}' in scenario {item['slug']}. Must be one of {VALID_FUNCTIONS}"
            )

    requirements = item.get("requirements", [])
    if not requirements:
        raise ValueError(f"Scenario {item['slug']} must have at least 1 requirement.")

    for req in requirements:
        for rkey in ["description", "type", "is_mandatory", "sort_order"]:
            if rkey not in req:
                raise ValueError(
                    f"Requirement in scenario {item['slug']} missing key '{rkey}': {req}"
                )


def load_all_scenarios_from_yaml(seeds_dir: Path | None = None) -> list[dict[str, Any]]:
    """Load and validate all scenario seed entries from YAML files."""
    directory = seeds_dir or SCENARIO_SEEDS_DIR
    all_scenarios: list[dict[str, Any]] = []

    yaml_files = sorted(list(directory.glob("*.yaml")) + list(directory.glob("*.yml")))
    if not yaml_files:
        logger.warning("No YAML scenario seed files found in %s", directory)
        return []

    for file_path in yaml_files:
        with open(file_path, encoding="utf-8") as f:
            content = yaml.safe_load(f)
            if not content:
                continue
            if isinstance(content, dict) and "scenarios" in content:
                items = content["scenarios"]
            elif isinstance(content, list):
                items = content
            else:
                items = [content]

            for item in items:
                validate_scenario_dict(item)
                all_scenarios.append(item)

    # Sort by sort_order
    all_scenarios.sort(key=lambda s: s.get("sort_order", 0))
    return all_scenarios


async def seed_scenarios(db: AsyncSession, seeds_dir: Path | None = None) -> int:
    """
    Seed or update all scenarios into the database idempotently using deterministic UUIDs.
    Returns the count of seeded/verified scenarios.
    """
    scenarios_data = load_all_scenarios_from_yaml(seeds_dir)

    for s_dict in scenarios_data:
        slug = s_dict["slug"]
        s_id = uuid.uuid5(SCENARIO_NAMESPACE, f"scenario:{slug}")

        stmt = select(Scenario).options(
            selectinload(Scenario.requirements),
            selectinload(Scenario.chunks),
        ).where(Scenario.slug == slug)
        res = await db.execute(stmt)
        scenario = res.scalar_one_or_none()

        is_new = False
        if not scenario:
            is_new = True
            scenario = Scenario(
                id=s_id,
                slug=slug,
                category=s_dict["category"],
                title_vi=s_dict["title_vi"],
                title_en=s_dict["title_en"],
                level=s_dict["level"],
                estimated_duration_minutes=s_dict["estimated_duration_minutes"],
                context=s_dict["context"],
                user_role=s_dict["user_role"],
                ai_role=s_dict["ai_role"],
                goals=s_dict["goals"],
                sort_order=s_dict["sort_order"],
            )
            db.add(scenario)
            await db.flush()
        else:
            scenario.category = s_dict["category"]
            scenario.title_vi = s_dict["title_vi"]
            scenario.title_en = s_dict["title_en"]
            scenario.level = s_dict["level"]
            scenario.estimated_duration_minutes = s_dict["estimated_duration_minutes"]
            scenario.context = s_dict["context"]
            scenario.user_role = s_dict["user_role"]
            scenario.ai_role = s_dict["ai_role"]
            scenario.goals = s_dict["goals"]
            scenario.sort_order = s_dict["sort_order"]

        # Requirements
        existing_req_map = {} if is_new else {r.sort_order: r for r in scenario.requirements}
        for r_dict in s_dict["requirements"]:
            r_order = r_dict["sort_order"]
            r_id = uuid.uuid5(SCENARIO_NAMESPACE, f"req:{slug}:{r_order}")
            if r_order in existing_req_map:
                req = existing_req_map[r_order]
                req.description = r_dict["description"]
                req.type = r_dict.get("type", "TASK")
                req.expected_chunk_function = r_dict.get("expected_chunk_function")
                req.is_mandatory = r_dict.get("is_mandatory", True)
            else:
                new_req = ScenarioRequirement(
                    id=r_id,
                    scenario_id=scenario.id,
                    description=r_dict["description"],
                    type=r_dict.get("type", "TASK"),
                    expected_chunk_function=r_dict.get("expected_chunk_function"),
                    is_mandatory=r_dict.get("is_mandatory", True),
                    sort_order=r_order,
                )
                db.add(new_req)

        # Chunks
        existing_chunk_map = {} if is_new else {c.sort_order: c for c in scenario.chunks}
        for c_dict in s_dict["chunks"]:
            c_order = c_dict["sort_order"]
            c_id = uuid.uuid5(SCENARIO_NAMESPACE, f"chunk:{slug}:{c_order}")
            if c_order in existing_chunk_map:
                chk = existing_chunk_map[c_order]
                chk.function_tag = c_dict["function_tag"]
                chk.text = c_dict["text"]
                chk.meaning_vi = c_dict["meaning_vi"]
                chk.audio_url = c_dict.get("audio_url")
                chk.example_sentence = c_dict["example_sentence"]
                chk.accepted_variations = c_dict.get("accepted_variations", [])
            else:
                new_chunk = ScenarioChunk(
                    id=c_id,
                    scenario_id=scenario.id,
                    function_tag=c_dict["function_tag"],
                    text=c_dict["text"],
                    meaning_vi=c_dict["meaning_vi"],
                    audio_url=c_dict.get("audio_url"),
                    example_sentence=c_dict["example_sentence"],
                    accepted_variations=c_dict.get("accepted_variations", []),
                    sort_order=c_order,
                )
                db.add(new_chunk)

    await db.commit()
    logger.info("Successfully seeded %d scenarios from YAML.", len(scenarios_data))
    return len(scenarios_data)
