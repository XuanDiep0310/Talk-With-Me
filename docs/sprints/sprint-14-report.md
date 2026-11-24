# Báo cáo Sprint 14 — Analytics và Nhật ký Kiểm toán

Trang Phân tích đọc trực tiếp dữ liệu đã commit từ PostgreSQL theo cửa sổ 7 hoặc 30 ngày, nhóm ngày theo giờ Việt Nam và cập nhật mỗi phút khi trang hiển thị. API `GET /api/v1/admin/analytics/overview` trả số phiên và học viên hoạt động, CEFR, thời lượng nói, confidence tham khảo, điểm theo phiên bản công thức, trạng thái feedback và kết quả tình huống. API `GET /api/v1/admin/audit-logs` hợp nhất nhật ký tài khoản, bài học và thao tác mới, hỗ trợ cursor và tìm mã vết.

Đã kiểm tra `EXPLAIN (ANALYZE, BUFFERS)` với 80.000 phiên và 160.000 đoạn transcript tổng hợp. Chỉ mục `sessions.ended_at` giảm thời gian quét phiên của cửa sổ 30 ngày từ khoảng 13 ms xuống 5 ms trong phép thử. Phép đo chỉ đại diện cho bộ dữ liệu kiểm thử.

D-49 đến D-53 ghi các quyết định về chủ đề, phần thưởng nhiệm vụ, đặc trưng giọng nói, báo cáo và lịch sử. Các phiên có dữ liệu cũ hoặc thiếu tín hiệu hiển thị N/A ở nơi cần số đo. Độ trễ dịch vụ STT/LLM nằm ngoài phạm vi Analytics hiện tại.

Bộ kiểm thử backend đạt 370 ca unit, integration và Schemathesis với PostgreSQL và Redis kiểm thử. Nhóm Coach, WebSocket và Scoring chạy lại đạt 11 ca sau cập nhật quyền riêng tư của ticket. Frontend đạt 116 ca và Playwright đạt 5 luồng Admin trên production build với provider Fake. Ruff, mypy và ESLint đều qua. Angular build thành công với cảnh báo ngân sách sẵn có của `admin.scss`.

Đã nâng Alembic trên DB trống, hạ một phiên bản rồi nâng lại. Cả bốn migration Sprint 11–14 cũng đã được rollback về Sprint 10 và chạy lại thành công trên DB thử nghiệm. OpenAPI và kiểu dữ liệu Angular đã được tái sinh.
