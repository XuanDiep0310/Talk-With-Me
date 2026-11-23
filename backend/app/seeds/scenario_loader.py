"""
Scenario seed loader: loads, validates, and seeds scenarios from YAML files in app/seeds/scenarios/.
"""

import logging
import uuid
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

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
                raise ValueError(f"Chunk in scenario {item['slug']} missing key '{ckey}': {chunk}")
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
    """Insert missing starter lessons while preserving editorial changes."""
    inserted = 0
    for item in load_all_scenarios_from_yaml(seeds_dir):
        slug = item["slug"]
        scenario_id = uuid.uuid5(SCENARIO_NAMESPACE, f"scenario:{slug}")
        content = {
            key: value for key, value in item.items() if key not in {"requirements", "chunks"}
        }
        statement = (
            insert(Scenario)
            .values(id=scenario_id, status="PUBLISHED", **content)
            .on_conflict_do_nothing(index_elements=["slug"])
            .returning(Scenario.id)
        )
        if await db.scalar(statement) is None:
            continue

        db.add_all(
            [
                ScenarioRequirement(
                    id=uuid.uuid5(SCENARIO_NAMESPACE, f"req:{slug}:{requirement['sort_order']}"),
                    scenario_id=scenario_id,
                    **requirement,
                )
                for requirement in item["requirements"]
            ]
            + [
                ScenarioChunk(
                    id=uuid.uuid5(SCENARIO_NAMESPACE, f"chunk:{slug}:{chunk['sort_order']}"),
                    scenario_id=scenario_id,
                    **chunk,
                )
                for chunk in item["chunks"]
            ]
        )
        inserted += 1

    await db.commit()
    logger.info("Inserted %d missing scenarios from YAML.", inserted)
    return inserted


async def seed_scenarios_if_empty(db: AsyncSession) -> None:
    if await db.scalar(select(Scenario.id).limit(1)) is None:
        await seed_scenarios(db)
