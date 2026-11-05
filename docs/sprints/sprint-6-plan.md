# Sprint 6 Plan: Gamification, Level, Progress & Dashboard

1. Tạo models & alembic migration 0006: xp_rules, xp_transactions, gamification_profiles, mission_definitions, user_daily_missions, badge_definitions, user_badges, notifications, level_history.
2. Seed: 5 xp_rules, 4 mission_definitions, 6 badge_definitions theo UI & SRS.
3. Event handlers: FeedbackGenerated, RoleplayEvaluated, RoomSessionCompleted -> cộng XP (idempotency <rule>:<source_id>), cập nhật streak (D-09) và thưởng streak, cập nhật daily mission, đánh giá level (D-02, Bảng 3.4), đánh giá badge, tạo notifications.
4. Services: GamificationService, DailyMissionService, BadgeService, LevelService, ProgressService, NotificationService.
5. ARQ cron / periodic job: Reset streak về 0 nếu user bỏ lỡ ngày hôm qua (theo timezone user, D-09).
6. Endpoints: /dashboard, /progress/summary, /progress/skills, /progress/history, /gamification/summary, /missions/today, /badges, /xp-history, /notifications, PATCH /notifications/{id}/read.
7. Export OpenAPI & generate Angular client.
8. Frontend: Cập nhật Màn 12/13 (Dashboard), 22/23/24 (Tiến độ: Kỹ năng, Lịch sử), 25 (Thành tích: Huy hiệu, Nhiệm vụ ngày, Lịch sử XP), Chip level & XP ở sidebar, Streak chip & chuông thông báo ở header.
9. Tests: Unit tests >= 90% cho gamification & scoring logic, integration tests, E2E test.
10. Cập nhật decision-log.md, tạo tài liệu learning/, báo cáo sprint-6-report.md.
