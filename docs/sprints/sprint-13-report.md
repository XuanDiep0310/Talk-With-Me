# Báo cáo Sprint 13 — Session QA và hồ sơ học viên

Admin có danh sách phiên, chi tiết, transcript phân trang, nhãn QA và retry cùng luồng với API học viên. Hồ sơ có dữ liệu học tập, placement, gamification và thao tác thu hồi phiên đăng nhập. Sprint thêm các API dưới `/api/v1/admin/sessions` và `/api/v1/admin/users/{id}`.

D-51 ghi nguồn và giới hạn của đặc trưng giọng nói, audit khi đọc transcript và thu hồi xác thực. Các test bảo vệ idempotency đoạn thoại, phân quyền, retry đồng thời và hủy ticket cũ. Kết quả xác minh được tổng hợp ở Sprint 14.

Mốc từ Groq được lấy từ phản hồi có timestamp. Trường confidence tham khảo để trống khi provider thiếu giá trị tương ứng. [Tài liệu Groq Speech to Text](https://console.groq.com/docs/speech-to-text)
