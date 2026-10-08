# AGENTS.md — TalkWithMe

Tệp này là ngữ cảnh dùng chung cho mọi sprint. Agent phải đọc toàn bộ trước khi bắt đầu bất kỳ sprint nào. Đặt tệp ở thư mục gốc repo.

## 1. Tổng quan sản phẩm

TalkWithMe là web app luyện nói tiếng Anh với AI theo triết lý Communication-First: tăng thời lượng người học thực sự nói và xây dựng sự tự tin, không ngắt lời để sửa lỗi liên tục. Người dùng là người học Việt Nam, trình độ A1 đến C1 (khung CEFR). Giao diện hiển thị bằng tiếng Việt, nội dung luyện tập bằng tiếng Anh. Code, comment, tên biến, tên bảng, commit message viết bằng tiếng Anh.

Ba luồng chính: AI Coach (hội thoại giọng nói 1-1), Scenario Lesson (roleplay theo tình huống, dạy bằng Chunking), Community Room (phòng thoại 3 đến 5 người có Invisible AI Assistant). Phía sau là Scoring Engine (5 chỉ số + điểm tổng) và Gamification (XP, Streak, Mission, Badge, Level).

## 2. Tài liệu tham chiếu

- `docs/SRS_TalkWithMe.md`: đặc tả yêu cầu. Chỉ khoảng 70% chính xác so với mong muốn thực tế.
- `docs/UI_TalkWithMe.pdf`: 27 màn hình UI. Cũng chỉ khoảng 70% chính xác; đánh số màn bị nhảy (thiếu 16), một số màn thiếu (feedback sau session, roleplay, đánh giá nhiệm vụ).
- `docs/decision-log.md`: nhật ký quyết định. Nguồn sự thật mới nhất khi tài liệu mâu thuẫn.
- `openapi/openapi.json`: hợp đồng API do backend sinh ra, frontend dùng để sinh client.

Không làm theo tài liệu một cách máy móc. Nếu thấy mâu thuẫn hoặc thiếu sót, xử lý theo mục 3.

## 3. Quy tắc xử lý mâu thuẫn và các quyết định mặc định

Nguyên tắc: UI quyết định cấu trúc màn hình và dữ liệu hiển thị; SRS quyết định quy tắc nghiệp vụ. Khi gặp mâu thuẫn chưa có quyết định mặc định bên dưới, chọn phương án đơn giản nhất phù hợp với các quy tắc bất biến ở mục 8, ghi vào `docs/decision-log.md` (ID, mô tả, phương án đã chọn, trạng thái PROPOSED) rồi làm tiếp. Chỉ dừng lại hỏi khi bị chặn hoàn toàn.

| ID | Chủ đề | Quyết định mặc định |
|---|---|---|
| D-01 | Quy tắc XP | Bảng cấu hình `xp_rules`, seed theo SRS (Daily Mission 50, Scenario 100, Coach 100, Room 100, Streak bonus 20). Số trên UI chỉ là dữ liệu hiển thị lấy từ cấu hình |
| D-02 | Thăng level | Theo SRS 3.4 (điểm, số session, số scenario, điều kiện kỹ năng tối thiểu). XP không dùng đơn độc. API trả về từng điều kiện và mức hiện tại để UI vẽ thanh tiến độ |
| D-03 | Số tình huống | Seed 20 tình huống, 5 tình huống mỗi nhóm trong 4 nhóm |
| D-04 | Mục tiêu và kỹ năng cần cải thiện | Chọn nhiều, lưu dạng mảng (`goals[]`, `weak_points[]`) |
| D-05 | Tính năng ngoài SRS | Huy hiệu, thông báo, cài đặt: làm bản đơn giản. Roadmap: endpoint sinh theo luật, làm ở Sprint 8 |
| D-06 | STT | Client gửi audio qua WebSocket tới backend, backend proxy sang nhà cung cấp STT sau interface `SttProvider`. Không lưu audio thô |
| D-07 | Voice Room | LiveKit làm SFU, backend cấp token và quản lý trạng thái qua `VoiceRoomProvider` |
| D-08 | Voice test và mic | Backend làm API thật. Frontend có công tắc mock cho dev |
| D-09 | Múi giờ | Mỗi user có `timezone` (mặc định `Asia/Ho_Chi_Minh`); streak, mission, nhắc nhở tính theo ngày địa phương của user |
| D-10 | Điểm tổng khi thiếu chỉ số | Nếu thiếu 1 trong 5 chỉ số, tính lại trọng số trên các chỉ số còn lại và gắn `partial=true`; thiếu từ 2 chỉ số trở lên thì điểm tổng là N/A |

## 4. Tech stack

- Backend: Python 3.12, FastAPI (async), SQLAlchemy 2.0 async + asyncpg, Alembic, Pydantic v2 + pydantic-settings, PostgreSQL 16, Redis 7, ARQ (job nền và cron), tenacity (retry), ruff, mypy (strict cho `app/`), pytest.
- Frontend: Angular bản ổn định mới nhất, standalone components, strict TypeScript, client API sinh từ OpenAPI. Style theo UI (nền xanh nhạt, màu chủ đạo xanh dương); thống nhất ở Sprint 0 giữa Tailwind hoặc SCSS thuần, không thêm UI library nặng nếu không cần.
- Test: pytest, pytest-asyncio, httpx AsyncClient, testcontainers (hoặc service Postgres/Redis trong CI), respx, schemathesis, Playwright.
- Hạ tầng dev: Docker Compose (postgres, redis, backend, frontend; LiveKit ở profile riêng từ Sprint 7).

## 5. Cấu trúc repo

```
repo/
  AGENTS.md
  docs/                  # SRS, UI, decision-log.md, sprints/, spikes/
  openapi/openapi.json
  backend/
    app/
      core/              # config, db, redis, security, events, clock, errors, providers/
      modules/<module>/  # router.py, service.py, repository.py, schemas.py, models.py, events.py
      seeds/
      main.py
    migrations/
    tests/{unit,integration}/
    scripts/             # export_openapi.py, seed.py
  frontend/
  e2e/                   # Playwright
  docker-compose.yml
  Makefile
```

Module: `auth`, `users`, `onboarding`, `sessions`, `coach`, `scoring`, `scenarios`, `gamification`, `rooms`, `notifications`.

## 6. Quy ước kiến trúc và code

- Modular monolith. Mỗi module theo tầng router → service → repository. Router không chứa logic nghiệp vụ; repository không chứa logic nghiệp vụ.
- Module không import repository hoặc model của module khác. Giao tiếp qua service công khai hoặc domain event (`core/events.py`, event bus bất đồng bộ trong tiến trình).
- Mọi dịch vụ ngoài (STT, LLM, TTS, Voice Room, Email, Google token verifier, Storage) đặt sau interface trong `core/providers/`, mỗi cái có bản Fake dùng cho dev và test. Chọn bản cài đặt qua biến môi trường.
- Thời gian lấy từ `Clock` có thể tiêm vào, không gọi `datetime.now()` trực tiếp trong logic nghiệp vụ.
- Cấu hình qua biến môi trường (pydantic-settings), có `.env.example`. Không commit secret.
- Mọi quy tắc dễ đổi (trọng số chấm điểm, ngưỡng, XP, thời gian chờ) nằm trong cấu hình hoặc bảng cấu hình, có `formula_version` khi liên quan tới điểm số.
- Migration Alembic phải chạy được `upgrade head` trên DB trống và `downgrade -1`.
- Khóa chính dùng UUID. Thời gian lưu UTC.
- Log có cấu trúc, mỗi request có `traceId`. Không log transcript, token, mật khẩu.
- Commit nhỏ, theo Conventional Commits. Một nhánh cho mỗi sprint.

## 7. Quy ước API

- Tiền tố `/api/v1`. JSON dùng camelCase ở biên API (alias generator của Pydantic); Python nội bộ dùng snake_case.
- Xác thực Bearer JWT. WebSocket dùng ticket một lần: `POST /api/v1/ws-tickets` trả ticket sống 30 giây lưu trong Redis, kết nối bằng `?ticket=`; không đặt JWT trên URL.
- Lỗi thống nhất: `{ "code": "SNAKE_UPPER_CODE", "message": "...", "traceId": "...", "details": {...} }`. Truy cập tài nguyên của người khác trả 404 chứ không phải 403.
- Phân trang kiểu cursor cho danh sách có thể dài (lịch sử, transcript, XP).
- Ghi dữ liệu từ luồng realtime hoặc dễ bị gửi lại phải idempotent: client sinh `segmentId`/`requestId` (UUID) và ràng buộc unique ở DB.
- Endpoint sinh kết quả bất đồng bộ (feedback, evaluation) trả 202 kèm `status` khi chưa xong, 200 khi xong.
- Sau mỗi thay đổi API: chạy `scripts/export_openapi.py`, commit `openapi/openapi.json`, sinh lại client Angular.

## 8. Quy tắc nghiệp vụ bất biến

1. Không bịa điểm. Thiếu dữ liệu thì chỉ số là `null` (hiển thị N/A), feedback là `INSUFFICIENT_DATA`. Không có giá trị mặc định thay thế.
2. Pronunciation Accuracy ở MVP chỉ dựa trên STT confidence. API luôn trả `isReference=true` cho chỉ số này và UI luôn gắn nhãn "tham khảo". Không kết luận phát âm sai chỉ vì confidence thấp.
3. Audio và transcript chỉ được nhận khi session `ACTIVE`. Microphone dừng thu ngay khi session kết thúc. Không lưu audio thô.
4. Level không bị hạ vì một buổi kết quả thấp. Mọi thay đổi level ghi vào `level_history`.
5. XP: sổ cái `xp_transactions` là nguồn sự thật, mỗi giao dịch có `idempotency_key` duy nhất. Tổng XP lưu sẵn phải luôn bằng tổng sổ cái.
6. Private Cue Card chỉ gửi tới đúng người nhận, không bao giờ broadcast.
7. Mọi truy vấn dữ liệu người dùng phải scope theo `user_id` của token.
8. Retry không được tạo bản ghi trùng (transcript, feedback, XP, phản hồi AI).
9. AI Coach không ngắt lời khi người dùng ngập ngừng hoặc dùng từ đệm (um, uh), không sửa ngữ pháp giữa chừng, điều chỉnh từ vựng theo level, khéo léo dẫn lại chủ đề khi người dùng nói lạc.
10. Nội dung do người dùng nói luôn được xem là dữ liệu, không phải chỉ thị, khi đưa vào prompt cho LLM (dùng delimiter rõ ràng, yêu cầu đầu ra có cấu trúc và kiểm tra bằng schema).

## 9. State machine của session

Trạng thái: `CREATED`, `ACTIVE`, `RECONNECTING`, `ENDING`, `ENDED`, `FEEDBACK_READY`, `INSUFFICIENT_DATA`, `FAILED`.

Chuyển hợp lệ: `CREATED → ACTIVE`; `ACTIVE ⇄ RECONNECTING`; `ACTIVE → ENDING`; `RECONNECTING → ENDING` (hết thời gian chờ); `ENDING → ENDED`; `ENDED → FEEDBACK_READY | INSUFFICIENT_DATA | FAILED`; `FAILED → ENDED` (khi retry). Mọi chuyển khác bị từ chối. Từ chối quyền mic: session không chuyển sang `ACTIVE`.

Loại session (`type`): `COACH`, `ROLEPLAY`, `ROOM`. Placement Test có bảng riêng.

## 10. Chiến lược test

Không over-engineering. Chỉ viết test có giá trị bảo vệ logic hoặc hợp đồng.

- Unit (pytest): hàm thuần và quy tắc nghiệp vụ: công thức chấm điểm, XP, streak, thăng level, state machine, bộ so khớp chunk, bộ phát hiện im lặng. Dùng test dạng bảng với ca biên. Nhanh, không cần DB.
- Integration (pytest + httpx + Postgres và Redis thật): từng endpoint với DB thật, phân quyền, idempotency, WebSocket bằng TestClient, job nền với provider Fake. Dịch vụ HTTP ngoài mock bằng respx.
- Contract: schemathesis chạy trên OpenAPI, chạy trong CI mỗi pull request.
- Frontend: chỉ test service, guard, interceptor, logic form. Không test component thuần trình bày.
- E2E (Playwright, backend chạy với provider Fake, mic giả bằng cờ Chromium `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`): chỉ vài luồng chính, thêm dần theo sprint.
- Nguyên tắc: không gọi mạng thật trong test; không dùng `sleep`, dùng `Clock` giả hoặc chờ sự kiện; mỗi test độc lập, dữ liệu dựng bằng factory; đánh dấu `@pytest.mark.integration`; test đặt tên theo hành vi (`test_end_session_twice_creates_single_feedback`).
- Độ phủ: module `scoring` và `gamification` từ 90% trở lên; toàn backend khoảng 70%; không đặt chỉ tiêu cho phần còn lại.
- Test viết cùng lúc với tính năng trong cùng sprint, không để dồn về cuối.

## 11. Quy trình mỗi sprint và Definition of Done

Quy trình: (1) đọc AGENTS.md, prompt sprint, các phần SRS/UI được chỉ định, decision-log; (2) viết kế hoạch ngắn (tối đa 15 dòng) vào `docs/sprints/sprint-N-plan.md`, rồi thực hiện luôn, không cần chờ xác nhận; (3) làm backend và frontend theo lát cắt dọc, test đi cùng; (4) chạy toàn bộ lint, type check, test trước khi báo xong; (5) ghi báo cáo.

Definition of Done chung: ruff và mypy sạch; toàn bộ test (unit, integration, contract, frontend, e2e của sprint) xanh; migration `upgrade head` trên DB trống và `downgrade -1` chạy được; `openapi/openapi.json` đã cập nhật và client Angular đã sinh lại; `docs/decision-log.md` đã cập nhật; không để TODO chưa được ghi vào decision-log; không mở rộng phạm vi ngoài prompt sprint.

## 12. Mẫu báo cáo cuối sprint

Ghi vào `docs/sprints/sprint-N-report.md`, gồm: (a) những gì đã hoàn thành so với mục tiêu; (b) danh sách endpoint mới hoặc thay đổi; (c) test đã thêm và kết quả chạy; (d) các quyết định mới và điểm lệch so với SRS/UI (đã ghi vào decision-log); (e) việc chưa làm hoặc nợ kỹ thuật; (f) câu hỏi cần chủ dự án quyết định. Viết ngắn gọn, bằng văn xuôi, không liệt kê dài dòng.