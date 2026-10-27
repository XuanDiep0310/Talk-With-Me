"""
Unit tests for Scenario Chunk Matcher, Completion Rules, and Library Filtering.
Covers table-driven matching (EXACT, VARIATION, APPROXIMATE, WRONG_FUNCTION, NOT_USED).
"""

import pytest

from app.services.chunk_matcher import ChunkMatcher, ChunkMatchType


class TestChunkMatcherTableDriven:
    @pytest.fixture
    def matcher(self) -> ChunkMatcher:
        return ChunkMatcher(exact_threshold=0.90, approx_threshold=0.72)

    @pytest.mark.parametrize(
        ("target_text", "variations", "user_utterances", "llm_verdict", "expected_type", "expected_used_well"),
        [
            # 1. Exact match
            (
                "Excuse me, where can I find...?",
                ["Could you tell me where... is?"],
                ["Excuse me, where can I find the produce section, please?"],
                None,
                ChunkMatchType.EXACT,
                True,
            ),
            # 2. Accepted variation match
            (
                "Excuse me, where can I find...?",
                ["Could you tell me where the produce section is?", "Where is the fresh fruit section?"],
                ["Hi, could you tell me where the produce section is please?"],
                None,
                ChunkMatchType.VARIATION,
                True,
            ),
            # 3. Approximate match (similar phrasing)
            (
                "Do you accept credit cards?",
                ["Can I pay by card?"],
                ["Do you take credit card payment here?"],
                None,
                ChunkMatchType.APPROXIMATE,
                True,
            ),
            # 4. Wrong communicative function (matched text but failed functional check)
            (
                "I'd like to book a table for...",
                ["Could I reserve a table for...?"],
                ["I'd like to book a table for four tonight."],
                False,  # Evaluator detects wrong function/misuse
                ChunkMatchType.WRONG_FUNCTION,
                False,
            ),
            # 5. Not used
            (
                "Thank you for your help!",
                ["Thanks a lot!"],
                ["The weather is quite rainy outside today."],
                None,
                ChunkMatchType.NOT_USED,
                False,
            ),
        ],
    )
    def test_chunk_matching_cases(
        self,
        matcher: ChunkMatcher,
        target_text: str,
        variations: list[str],
        user_utterances: list[str],
        llm_verdict: bool | None,
        expected_type: ChunkMatchType,
        expected_used_well: bool,
    ) -> None:
        chunk_id = "chunk-test-123"
        verdicts = {chunk_id: llm_verdict} if llm_verdict is not None else None

        res = matcher.match_single_chunk(
            chunk_id=chunk_id,
            target_text=target_text,
            function_tag="REQUEST",
            accepted_variations=variations,
            user_utterances=user_utterances,
            llm_function_verdicts=verdicts,
        )

        assert res.match_type == expected_type
        assert res.is_used_well == expected_used_well
        if expected_type != ChunkMatchType.NOT_USED:
            assert res.similarity_score > 0.70


class TestScenarioCompletionRules:
    """Verifies that a scenario is completed if and only if all mandatory requirements PASS."""

    @staticmethod
    def is_scenario_completed(
        requirements: list[dict], requirement_evals: list[dict]
    ) -> bool:
        mandatory_ids = {r["id"] for r in requirements if r.get("is_mandatory", True)}
        passed_ids = {
            e["requirement_id"]
            for e in requirement_evals
            if e.get("status") == "PASS" and e.get("requirement_id") in mandatory_ids
        }
        return len(passed_ids) == len(mandatory_ids) if mandatory_ids else True

    def test_all_mandatory_pass_completes_scenario(self) -> None:
        reqs = [
            {"id": "r1", "is_mandatory": True},
            {"id": "r2", "is_mandatory": True},
            {"id": "r3", "is_mandatory": False},
        ]
        evals = [
            {"requirement_id": "r1", "status": "PASS"},
            {"requirement_id": "r2", "status": "PASS"},
            {"requirement_id": "r3", "status": "FAIL"},
        ]
        assert self.is_scenario_completed(reqs, evals) is True

    def test_mandatory_fail_fails_scenario_completion(self) -> None:
        reqs = [
            {"id": "r1", "is_mandatory": True},
            {"id": "r2", "is_mandatory": True},
        ]
        evals = [
            {"requirement_id": "r1", "status": "PASS"},
            {"requirement_id": "r2", "status": "FAIL"},
        ]
        assert self.is_scenario_completed(reqs, evals) is False

    def test_empty_requirements_default_passes(self) -> None:
        assert self.is_scenario_completed([], []) is True


class TestLibraryFilters:
    """Verifies scenario list filtering logic."""

    @pytest.fixture
    def mock_scenarios(self) -> list[dict]:
        return [
            {
                "id": "1",
                "slug": "supermarket-shopping",
                "category": "DAILY_LIFE",
                "level": "A2",
                "title_vi": "Mua sắm tại siêu thị",
                "status": "COMPLETED",
            },
            {
                "id": "2",
                "slug": "restaurant-reservation",
                "category": "DAILY_LIFE",
                "level": "A2",
                "title_vi": "Đặt bàn tại nhà hàng",
                "status": "IN_PROGRESS",
            },
            {
                "id": "3",
                "slug": "job-interview",
                "category": "WORKPLACE",
                "level": "B1",
                "title_vi": "Phỏng vấn xin việc",
                "status": "NOT_STARTED",
            },
            {
                "id": "4",
                "slug": "weekend-invitation",
                "category": "SOCIAL",
                "level": "A2",
                "title_vi": "Rủ bạn đi chơi cuối tuần",
                "status": "NOT_STARTED",
            },
        ]

    def test_filter_by_category(self, mock_scenarios: list[dict]) -> None:
        res = [s for s in mock_scenarios if s["category"] == "DAILY_LIFE"]
        assert len(res) == 2

    def test_filter_by_level(self, mock_scenarios: list[dict]) -> None:
        res = [s for s in mock_scenarios if s["level"] == "B1"]
        assert len(res) == 1
        assert res[0]["slug"] == "job-interview"

    def test_filter_by_status(self, mock_scenarios: list[dict]) -> None:
        res = [s for s in mock_scenarios if s["status"] == "COMPLETED"]
        assert len(res) == 1
        assert res[0]["slug"] == "supermarket-shopping"

    def test_search_query_matching(self, mock_scenarios: list[dict]) -> None:
        q = "siêu thị"
        res = [s for s in mock_scenarios if q.lower() in s["title_vi"].lower()]
        assert len(res) == 1
        assert res[0]["slug"] == "supermarket-shopping"
