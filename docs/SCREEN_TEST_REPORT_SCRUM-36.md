# Báo cáo Kiểm thử Màn hình & Frontend Tests: Auth, Profile, Settings (SCRUM-36)

- **Mã công việc:** [SCRUM-36](https://diepp031005.atlassian.net/browse/SCRUM-36)
- **Tên công việc:** Screen test cases và frontend tests cho Auth/Profile/Settings
- **Phạm vi kiểm thử:**
  - Đăng ký (Register), Đăng nhập (Login), Quên mật khẩu & Đặt lại mật khẩu (Forgot & Reset Password)
  - Hồ sơ cá nhân (Profile), Cập nhật thông tin, Tải ảnh đại diện (Avatar), Đổi mật khẩu
  - Cài đặt hệ thống (Settings): Thông báo, Nhắc nhở hằng ngày, Giọng AI, Tốc độ nói AI, Giao diện màu, Trạng thái hệ thống (Health), Múi giờ
  - Điều hướng, AuthGuard, Token Interceptor, Session hết hạn, Trạng thái Loading, Xử lý lỗi API & Mất mạng, Thao tác bàn phím, Responsive layout
  - *(Không bao gồm Onboarding và Placement Test)*
- **File bảng tính Excel bàn giao:** `docs/Testcase_Screen_Auth_Profile_Settings.xlsx`

---

## 1. Tổng quan Bộ Screen Test Cases (Excel)

Tệp Excel `docs/Testcase_Screen_Auth_Profile_Settings.xlsx` được thiết kế chuẩn xác 100% theo mẫu:
- **Sheet `Report`:** Bảng Dashboard tổng hợp tiến độ kiểm thử, liên kết nhanh (hyperlink) tới từng sheet màn hình, công thức tính tổng và tỷ lệ phần trăm tự động theo các chiều: Result (Chrome), Execution (Automation/Manual), Type (UI/Function/Validate).
- **5 Sheet chi tiết màn hình (`SR_001` đến `SR_005`):**
  - Khối thống kê Result (Passed, Failed, Blocked, Not run), Execution (Automation, Manual, N/A), Type (UI, Function, Validate) ở góc trái trên.
  - Bảng Test case chuẩn: `No.`, `Main Category`, `Sub Category`, `Type`, `Pre-Conditions`, `Test Descriptions`, `Steps`, `Expected Result`, `Testing result (Chrome)`, `Execution`, `Remarks`.

### Bảng tổng hợp số lượng Test Case (Trích xuất từ Sheet `Report`)

| Mã Screen | Tên màn hình / Luồng | Tổng số TC | Passed | Failed | Blocked | Automation | Manual | UI | Function | Validate | Progress |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **SR_001** | Màn hình đăng ký tài khoản (Register) | 28 | 28 | 0 | 0 | 19 | 9 | 8 | 10 | 10 | 100.00% |
| **SR_002** | Màn hình đăng nhập (Login) | 26 | 26 | 0 | 0 | 19 | 7 | 6 | 14 | 6 | 100.00% |
| **SR_003** | Màn hình quên và đặt lại mật khẩu | 24 | 24 | 0 | 0 | 16 | 8 | 8 | 9 | 7 | 100.00% |
| **SR_004** | Màn hình hồ sơ cá nhân (Profile) | 28 | 28 | 0 | 0 | 18 | 10 | 8 | 10 | 10 | 100.00% |
| **SR_005** | Màn hình cài đặt (Settings) | 25 | 25 | 0 | 0 | 15 | 10 | 8 | 17 | 0 | 100.00% |
| **TỔNG CỘNG** | **Toàn bộ phạm vi SCRUM-36** | **131** | **131** | **0** | **0** | **87** | **44** | **38** | **60** | **33** | **100.00%** |
| **Tỷ lệ (%)** | | | **100%** | **0%** | **0%** | **66.41%** | **33.59%** | **29.01%** | **45.80%** | **25.19%** | |

---

## 2. Kết quả Bổ sung Frontend Tests (Unit Tests & Integration)

Đã bổ sung bộ kiểm thử tự động toàn diện cho các service, guard, interceptor và component liên quan trong frontend (Angular 19, Jasmine, Karma):

### Danh sách các file test đã bổ sung:
1. `src/app/core/services/auth.service.spec.ts`:
   - Kiểm tra `initialize()`: phục hồi phiên làm việc qua refresh token trong storage, xử lý khi token hết hạn.
   - Kiểm tra `login()`: xác thực, lưu token an toàn, nạp user, điều hướng `/dashboard`.
   - Kiểm tra `register()`: tạo tài khoản, nạp user, điều hướng `/onboarding`.
   - Kiểm tra `loginWithGoogle()`: gửi Google credential, xác thực.
   - Kiểm tra `logout()`: thu hồi refresh token, dọn sạch in-memory access token và localStorage, redirect `/login`.
   - Kiểm tra `forgotPassword()` và `resetPassword()`.
   - Kiểm tra `refreshTokens()`: quản lý queue refresh token, retry request, xử lý lỗi token hết hạn.
   - Kiểm tra bộ chuyển đổi mã lỗi máy chủ `mapApiError()`.
2. `src/app/core/services/user.service.spec.ts`:
   - Kiểm tra `updateMe()`: cập nhật họ tên qua PATCH `/me`.
   - Kiểm tra `uploadAvatar()`: gửi multipart file qua POST `/me/avatar`.
   - Kiểm tra `getSettings()` & `updateSettings()`: lấy và cập nhật cài đặt người dùng qua GET/PATCH `/me/settings`.
   - Kiểm tra `changePassword()`: đổi mật khẩu an toàn qua POST `/me/change-password`.
3. `src/app/features/auth/login.component.spec.ts`:
   - Kiểm tra render, toggle show/hide password, toggle remember me checkbox.
   - Validation form đăng nhập (email format, password min length 6).
   - Kiểm tra đăng nhập thành công và xử lý lỗi INVALID_CREDENTIALS, ACCOUNT_LOCKED, mất mạng.
   - Kiểm tra luồng chuyển sang chế độ Quên mật khẩu và gửi email khôi phục.
4. `src/app/features/auth/register.component.spec.ts`:
   - Kiểm tra thuật toán phát hiện mật khẩu yếu (`isWeakPassword`: 123456, password, 111111...).
   - Kiểm tra thanh đo độ mạnh mật khẩu và nhãn văn bản theo từng mức độ dài.
   - Validation form (họ tên tối thiểu 2 ký tự, email RFC, mật khẩu, bắt buộc tick điều khoản).
   - Kiểm tra submit đăng ký thành công, xử lý lỗi trùng email (EMAIL_ALREADY_EXISTS).
5. `src/app/features/auth/reset-password.component.spec.ts`:
   - Kiểm tra phát hiện thiếu token trong URL -> hiển thị cảnh báo "Liên kết không hợp lệ".
   - Kiểm tra form khi có token: validation độ dài mật khẩu, mật khẩu yếu, kiểm tra mật khẩu xác nhận không khớp.
   - Submit đổi mật khẩu thành công và màn hình chúc mừng.
6. `src/app/features/profile/profile.component.spec.ts`:
   - Chế độ xem: hiển thị tên, email, avatar URL hoặc ký tự đại diện (initials), thống kê học tập.
   - Chế độ chỉnh sửa: mở edit mode, hủy bỏ, lưu họ tên mới và cập nhật tức thì.
   - Upload avatar: chặn file vượt quá dung lượng 2 MB, upload file hợp lệ.
   - Đổi mật khẩu: kiểm tra mật khẩu mới yếu, trùng mật khẩu cũ, mật khẩu xác nhận không khớp, xử lý lỗi INVALID_OLD_PASSWORD.
7. `src/app/features/settings/settings.component.spec.ts`:
   - Khởi tạo nạp cài đặt từ API `/me/settings`.
   - Bật/tắt switch Thông báo và Nhắc nhở hằng ngày.
   - Thay đổi dropdown Giọng AI (female/male) và Tốc độ nói AI (slow/normal/fast).
   - Đổi giao diện Theme (light/dark/system).
   - Lưu trữ và đồng bộ trạng thái.

### Kết quả chạy kiểm thử thực tế:
- **Lệnh thực thi:** `ng test --watch=false --browsers=ChromeHeadless`
- **Kết quả:** **87 / 87 unit tests SUCCESS** (0 failed, thời gian chạy: ~0.6s)
- **Kiểm tra Lint:** `npm run lint` -> **Exit code 0**, không còn bất kỳ lỗi nào.
- **Kiểm tra Production Build:** `npm run build` -> **Exit code 0**, bundles tạo đầy đủ không lỗi compile.

---

## 3. Phạm vi Thiết bị, Trình duyệt & Các Test Case Kiểm thử Thủ công (Manual)

### 3.1. Phạm vi Thiết bị & Trình duyệt đã kiểm thử
- **Desktop Chrome (1920x1080 & 1440x900):** Giao diện 2 cột màn hình Login/Register, bố cục card căn giữa trên Profile/Settings.
- **Mobile Viewport (375x667 iPhone SE, 390x844 iPhone 12/13/14, 412x915 Pixel 7):** Cột quảng bá bên trái tự động ẩn, form căn giữa 1 cột, input và button kích thước tối ưu cho ngón tay chạm (touch target >= 44px).
- **Tablet Viewport (768x1024 iPad Mini / Air):** Bố cục responsive dạng 1 cột cân đối với padding và khoảng cách chuẩn 24px.

### 3.2. Danh sách các Test Case kiểm thử thủ công (Manual Execution)
Các trường hợp kiểm thử sau cần được QA/Tester kiểm tra thủ công trên trình duyệt thực tế do liên quan đến giao diện người dùng, phần cứng hoặc dịch vụ bên thứ ba:
1. **Google Identity Services Popup:** Kiểm tra hiển thị One Tap prompt và cửa sổ chọn tài khoản Google thật.
2. **File Picker Native Dialog:** Kiểm tra hộp thoại chọn tệp của hệ điều hành Windows/macOS khi chọn ảnh đại diện.
3. **Hiệu ứng chuyển động (Visual Animation & Transitions):** Hiệu ứng trượt nút switch toggle trong Settings, hiệu ứng chuyển màu của thanh đo độ mạnh mật khẩu (Password Strength Bar).
4. **Hỗ trợ tiếp cận (Accessibility - a11y):** Kiểm tra trải nghiệm đọc màn hình bằng phím Tab tuần tự qua từng trường nhập liệu và nhãn `role="switch"`, `aria-checked`, `aria-label`.
5. **Hiển thị Responsive thực tế trên thiết bị di động:** Kiểm tra cuộn trang, bàn phím ảo (virtual keyboard) xuất hiện không làm che khuất nút submit.
