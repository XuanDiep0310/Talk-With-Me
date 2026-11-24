from collections.abc import Mapping
from datetime import date, datetime
from typing import cast

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# A single PostgreSQL statement gives all sections the same committed snapshot.
OVERVIEW = text("""
WITH practice AS MATERIALIZED (
    SELECT s.id, s.user_id, s.type, s.scenario_id, s.topic_id, s.ended_at, s.spoken_seconds, s.speech_features_version
    FROM sessions s
    JOIN users u ON u.id = s.user_id AND u.role = 'LEARNER'
    WHERE s.ended_at >= :start_at AND s.ended_at <= :generated_at
      AND s.type IN ('COACH', 'ROLEPLAY')
), daily_practice AS (
    SELECT CAST(timezone(:timezone, ended_at) AS date) AS day,
           count(*) FILTER (WHERE type = 'COACH') AS coach_sessions,
           count(*) FILTER (WHERE type = 'ROLEPLAY') AS roleplay_sessions
    FROM practice
    GROUP BY 1
), activity_events AS MATERIALIZED (
    SELECT user_id, ended_at AS occurred_at FROM practice
    UNION ALL
    SELECT s.user_id, s.started_at
    FROM sessions s JOIN users u ON u.id = s.user_id AND u.role = 'LEARNER'
    WHERE s.started_at BETWEEN :start_at AND :generated_at
      AND s.type IN ('COACH', 'ROLEPLAY') AND s.status <> 'CREATED'
    UNION ALL
    SELECT s.user_id, CAST(:generated_at AS timestamptz)
    FROM sessions s JOIN users u ON u.id = s.user_id AND u.role = 'LEARNER'
    WHERE s.started_at <= :generated_at AND s.ended_at IS NULL
      AND s.type IN ('COACH', 'ROLEPLAY') AND s.status = 'ACTIVE'
    UNION ALL
    SELECT p.user_id, p.completed_at
    FROM placement_tests p JOIN users u ON u.id = p.user_id AND u.role = 'LEARNER'
    WHERE p.completed_at BETWEEN :start_at AND :generated_at AND p.status = 'COMPLETED'
), daily_activity AS (
    SELECT CAST(timezone(:timezone, occurred_at) AS date) AS day,
           count(DISTINCT user_id) AS active_learners
    FROM activity_events GROUP BY 1
), days AS (
    SELECT CAST(calendar.day AS date) AS day, COALESCE(coach_sessions, 0) AS coach_sessions,
           COALESCE(roleplay_sessions, 0) AS roleplay_sessions,
           COALESCE(active_learners, 0) AS active_learners,
           CAST(calendar.day AS date) = CAST(:last_day AS date) AS is_partial
    FROM generate_series(CAST(:first_day AS date), CAST(:last_day AS date), interval '1 day')
         AS calendar(day)
    LEFT JOIN daily_practice d ON d.day = CAST(calendar.day AS date)
    LEFT JOIN daily_activity a ON a.day = CAST(calendar.day AS date)
), levels AS (
    SELECT CASE WHEN p.cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1')
                THEN p.cefr_level ELSE 'UNKNOWN' END AS level, count(*) AS total
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.role = 'LEARNER'
    GROUP BY 1
), measured_segments AS MATERIALIZED (
    SELECT t.session_id, t.speech_ms, t.confidence
    FROM transcript_segments t
    JOIN practice p ON p.id = t.session_id
    WHERE t.speaker = 'USER' AND t.is_final AND t.speech_source IN ('STT', 'STT_NO_WORD_TIMES')
      AND (t.speech_ms IS NOT NULL OR t.confidence IS NOT NULL)
), spoken AS (
    SELECT p.id,
           CASE WHEN p.speech_features_version IS NOT NULL AND p.spoken_seconds > 0
                THEN p.spoken_seconds
                ELSE COALESCE(sum(t.speech_ms) / 1000.0, NULLIF(p.spoken_seconds, 0))
           END AS seconds,
           p.speech_features_version IS NULL AND sum(t.speech_ms) IS NULL AS legacy_estimate
    FROM practice p LEFT JOIN measured_segments t ON t.session_id = p.id
    GROUP BY p.id, p.spoken_seconds, p.speech_features_version
), feedback AS MATERIALIZED (
    SELECT p.id, COALESCE(f.status, 'NOT_REQUESTED') AS status, f.formula_version
    FROM practice p
    LEFT JOIN session_feedback f ON f.session_id = p.id
), skill_averages AS (
    SELECT s.skill_name AS skill, f.formula_version, avg(s.score) AS average,
           count(s.score) AS sample_count, s.skill_name = 'pronunciation' AS is_reference
    FROM feedback f
    JOIN session_skill_scores s ON s.session_id = f.id
    WHERE f.status = 'FEEDBACK_READY' AND s.score IS NOT NULL
    GROUP BY s.skill_name, f.formula_version
), status_totals AS (
    SELECT status, count(*) total FROM feedback GROUP BY status
), content AS (
    SELECT s.id, s.title_vi AS title, count(*) AS attempts,
           count(e.session_id) FILTER (WHERE e.status = 'COMPLETED') AS evaluated_attempts,
           count(e.session_id) FILTER (WHERE e.status = 'COMPLETED' AND NOT e.passed) AS failed_attempts,
           (count(e.session_id) FILTER (WHERE e.status = 'COMPLETED' AND NOT e.passed))::float
               / NULLIF(count(e.session_id) FILTER (WHERE e.status = 'COMPLETED'), 0) AS failure_rate
    FROM practice p
    JOIN scenarios s ON s.id = p.scenario_id
    LEFT JOIN roleplay_evaluations e ON e.session_id = p.id
    WHERE p.type = 'ROLEPLAY'
    GROUP BY s.id, s.title_vi
), popular_topics AS (
    SELECT t.id, t.title, count(*) AS attempts
    FROM practice p JOIN coach_topics t ON t.id = p.topic_id
    WHERE p.type = 'COACH'
    GROUP BY t.id, t.title
    ORDER BY attempts DESC, t.id LIMIT 10
), popular AS (
    SELECT * FROM content ORDER BY attempts DESC, id LIMIT 10
), difficult AS (
    SELECT * FROM content WHERE failure_rate IS NOT NULL
    ORDER BY failure_rate DESC, evaluated_attempts DESC, id LIMIT 10
)
SELECT COALESCE((SELECT active_learners FROM daily_activity WHERE day = CAST(:last_day AS date)), 0)
           AS active_today,
       (SELECT count(DISTINCT user_id) FROM activity_events) AS active_in_period,
       (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM days d) AS days,
       COALESCE((SELECT jsonb_object_agg(level, total) FROM levels), '{}') AS cefr,
       (SELECT jsonb_build_object('average', avg(seconds) / 60, 'sample_count', count(seconds),
                                  'legacy_sample_count', count(seconds) FILTER (WHERE legacy_estimate))
        FROM spoken WHERE seconds > 0) AS speaking_minutes,
       (SELECT jsonb_build_object('average', avg(confidence), 'sample_count', count(confidence))
        FROM measured_segments) AS stt_confidence,
       COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.formula_version, s.skill) FROM skill_averages s), '[]')
           AS skills,
       COALESCE((SELECT jsonb_object_agg(status, total) FROM status_totals), '{}') AS feedback_statuses,
       COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.attempts DESC, p.id) FROM popular p), '[]')
           AS popular_scenarios,
       COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.attempts DESC, t.id) FROM popular_topics t), '[]')
           AS popular_coach_topics,
       COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.failure_rate DESC, d.evaluated_attempts DESC, d.id)
                 FROM difficult d), '[]') AS difficult_scenarios
""")


class AdminAnalyticsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def overview(
        self,
        *,
        timezone: str,
        start_at: datetime,
        generated_at: datetime,
        first_day: date,
        last_day: date,
    ) -> Mapping[str, object]:
        row = (
            (
                await self.db.execute(
                    OVERVIEW,
                    {
                        "timezone": timezone,
                        "start_at": start_at,
                        "generated_at": generated_at,
                        "first_day": first_day,
                        "last_day": last_day,
                    },
                )
            )
            .mappings()
            .one()
        )
        return cast(Mapping[str, object], row)
