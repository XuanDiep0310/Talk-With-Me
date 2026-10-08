# Learning: Sprint 1 — Auth, Profile & Settings

Tài liệu này ghi lại kiến thức kỹ thuật đã áp dụng trong Sprint 1 để tham khảo và học hỏi.

---

## 1. Argon2 — Băm mật khẩu an toàn

**Thư viện:** `passlib[argon2]` (wrapper) + `argon2-cffi` (C library)

**Tại sao Argon2?**
- Argon2 thắng Password Hashing Competition (PHC) 2015.
- Có 3 biến thể: `argon2id` (khuyến nghị: chống cả side-channel và GPU attack).
- Có thể điều chỉnh: memory cost (m), time cost (t), parallelism (p).
- So với bcrypt: bcrypt không có memory hardness → dễ tấn công bằng GPU.
- So với scrypt: argon2id chống side-channel tốt hơn.

**Cách dùng trong Python:**
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

**Lưu ý quan trọng:**
- `hash()` luôn tạo ra chuỗi khác nhau dù cùng plain text (vì salt ngẫu nhiên).
- `verify()` so sánh timing-safe để chống timing attack.
- Không bao giờ lưu plain text password, chỉ lưu hash.

---

## 2. JWT — Access Token ngắn hạn

**Thư viện:** `python-jose[cryptography]`

**Cấu trúc JWT:**
```
header.payload.signature
```
- `header`: algorithm + type
- `payload`: claims (sub, exp, iat, ...)
- `signature`: HMAC-SHA256(base64(header) + "." + base64(payload), secret_key)

**Cách tạo:**
```python
from datetime import UTC, datetime, timedelta
from jose import jwt, JWTError

def create_access_token(user_id: str, secret: str, algorithm: str, expires_minutes: int) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=expires_minutes)
    payload = {
        "sub": user_id,      # subject
        "exp": expire,       # expiration
        "iat": datetime.now(UTC),  # issued at
        "type": "access"
    }
    return jwt.encode(payload, secret, algorithm=algorithm)

def decode_access_token(token: str, secret: str, algorithm: str) -> dict:
    try:
        return jwt.decode(token, secret, algorithms=[algorithm])
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
```

**Tại sao access token ngắn hạn (15-30 phút)?**
- Nếu access token bị leak, thiệt hại giới hạn theo thời gian.
- Refresh token dài hạn hơn nhưng chỉ dùng 1 lần → rotation.

**Token trong Authorization header:**
```
Authorization: Bearer <access_token>
```

---

## 3. Refresh Token Rotation + Reuse Detection

**Vấn đề:** Nếu refresh token bị đánh cắp, kẻ tấn công dùng được mãi mãi.

**Giải pháp — Token Rotation:**
1. Mỗi lần dùng refresh token → tạo mới, vô hiệu hóa cái cũ.
2. Cũ được đánh dấu `revoked = true`, `replaced_by_hash = hash(new_token)`.

**Giải pháp — Reuse Detection:**
- Nếu dùng token đã bị `revoked`:
  - → Có thể bị đánh cắp!
  - → Thu hồi TOÀN BỘ chuỗi refresh token của user đó.
  - → User phải đăng nhập lại.

**Cách lưu trong DB:**
```python
class RefreshToken(Base):
    token_hash: str      # SHA-256(raw_token) - không lưu raw
    expires_at: datetime
    revoked: bool
    replaced_by_hash: str | None  # hash của token mới thay thế
```

**Tại sao lưu hash thay vì raw token?**
- DB bị leak → kẻ tấn công không lấy được raw token.
- SHA-256 đủ nhanh và đủ mạnh cho mục đích này (không cần argon2 vì token đã random đủ entropy).

---

## 4. Rate Limiting với Redis

**Vấn đề:** Brute-force attack vào endpoint `/auth/login`.

**Giải pháp:** Redis INCR + EXPIRE

**Key design:** `rate_limit:login:{email}:{ip}` 
- Kết hợp cả email + IP để tránh phân tán attack.

**Thuật toán Fixed Window:**
```python
async def check_rate_limit(redis: Redis, key: str, max_attempts: int, window_seconds: int) -> None:
    count = await redis.incr(key)
    if count == 1:
        # Key mới → set TTL
        await redis.expire(key, window_seconds)
    if count > max_attempts:
        ttl = await redis.ttl(key)
        raise RateLimitExceededException(retry_after=ttl)
```

**Lưu ý Fixed Window vs Sliding Window:**
- Fixed Window: đơn giản, có thể bị bypass ở ranh giới window (edge burst).
- Sliding Window: chính xác hơn nhưng phức tạp hơn (dùng Redis Sorted Set).
- MVP dùng Fixed Window là đủ.

---

## 5. Google OAuth với ID Token

**Luồng:**
1. Frontend dùng Google Identity Services JS SDK.
2. User chọn tài khoản → Google trả về ID token (JWT).
3. Frontend gửi ID token đến backend: `POST /auth/google { id_token: "..." }`.
4. Backend verify ID token (chữ ký, audience, issuer, exp).
5. Backend lấy thông tin user từ payload (sub, email, name, picture).

**Verify ID token (real):**
```python
from google.oauth2 import id_token
from google.auth.transport import requests

def verify(token: str) -> dict:
    return id_token.verify_oauth2_token(token, requests.Request(), GOOGLE_CLIENT_ID)
```

**Link account:** Nếu Google email trùng với tài khoản có sẵn → link vào tài khoản đó (tạo `auth_identities` row).

**Fake verifier cho dev/test:**
```python
class FakeGoogleTokenVerifier:
    async def verify(self, id_token: str) -> GoogleUserInfo:
        import json, base64
        data = json.loads(base64.b64decode(id_token + "=="))
        return GoogleUserInfo(sub=data["sub"], email=data["email"], ...)
```

---

## 6. Chuẩn hóa Error Response

**Yêu cầu từ AGENTS.md:**
```json
{
  "code": "SNAKE_UPPER_CODE",
  "message": "Mô tả người dùng đọc được",
  "traceId": "uuid-v4",
  "details": {}
}
```

**Cài đặt trong FastAPI:**
```python
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uuid

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "message": "Dữ liệu đầu vào không hợp lệ",
            "traceId": request.state.trace_id,
            "details": {"errors": exc.errors()}
        }
    )

app.add_exception_handler(RequestValidationError, validation_exception_handler)
```

**Trace ID Middleware:**
```python
@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    trace_id = str(uuid.uuid4())
    request.state.trace_id = trace_id
    response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id
    return response
```

---

## 7. Angular Functional Interceptor (Angular 14+)

**Thay cho class interceptor cũ:**
```typescript
// Kiểu cũ (Angular < 14)
@Injectable()
class TokenInterceptor implements HttpInterceptor { ... }

// Kiểu mới (Angular 14+) - functional
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.accessToken;
  
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
  
  return next(authReq);
};

// Đăng ký trong app.config.ts
provideHttpClient(withInterceptors([tokenInterceptor]))
```

**Tại sao functional interceptor tốt hơn?**
- Không cần `forRoot()` phức tạp.
- Hoạt động tốt với standalone components.
- `inject()` hoạt động trong functional context.

---

## 8. Refresh Token với Queue Pattern (Angular)

**Vấn đề:** Nhiều request đồng thời nhận 401 → gọi refresh API nhiều lần.

**Giải pháp: BehaviorSubject queue**
```typescript
let isRefreshing = false;
let refreshSubject = new BehaviorSubject<string | null>(null);

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  
  return next(addToken(req, authService.accessToken)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) throw error;
      
      if (isRefreshing) {
        // Đang refresh → chờ kết quả
        return refreshSubject.pipe(
          filter(token => token !== null),
          take(1),
          switchMap(token => next(addToken(req, token!)))
        );
      }
      
      // Bắt đầu refresh
      isRefreshing = true;
      refreshSubject.next(null);
      
      return authService.refreshTokens().pipe(
        switchMap(newToken => {
          isRefreshing = false;
          refreshSubject.next(newToken);
          return next(addToken(req, newToken));
        }),
        catchError(err => {
          isRefreshing = false;
          authService.logout();
          throw err;
        })
      );
    })
  );
};
```

---

## 9. Angular Signals + APP_INITIALIZER

**Khởi tạo auth state khi app load:**
```typescript
// app.config.ts
{
  provide: APP_INITIALIZER,
  useFactory: (authService: AuthService) => () => authService.initialize(),
  deps: [AuthService],
  multi: true
}
```

**AuthService.initialize():**
```typescript
async initialize(): Promise<void> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return;
  
  try {
    await firstValueFrom(this.refreshTokens());
    await this.loadCurrentUser();
  } catch {
    this.clearTokens(); // Refresh token hết hạn hoặc bị revoke
  }
}
```

**Tại sao cần `APP_INITIALIZER`?**
- Đảm bảo auth state được khôi phục TRƯỚC khi Angular render route đầu tiên.
- Tránh flash of unauthenticated content.
- Guard có thể check `isAuthenticated()` signal đáng tin cậy ngay từ đầu.

---

## 10. Password Strength Indicator (UI)

**Đánh giá độ mạnh đơn giản:**
```typescript
function getPasswordStrength(password: string): { level: 0|1|2|3|4; label: string } {
  if (!password) return { level: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  const level = Math.min(4, Math.ceil(score / 1.25)) as 0|1|2|3|4;
  const labels = ['', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];
  return { level, label: labels[level] };
}
```

**Hiển thị thanh:**
```html
<div class="flex gap-1 mt-2">
  @for (i of [1,2,3,4]; track i) {
    <div class="h-1 flex-1 rounded"
      [style.background]="strength.level >= i ? strengthColors[strength.level] : '#E2F0F9'">
    </div>
  }
</div>
```

---

## 11. Alembic Migration — Best Practices

**Tạo migration:**
```bash
alembic revision --autogenerate -m "create_auth_tables"
# --autogenerate so sánh models với DB hiện tại
```

**File migration có 2 hàm:**
```python
def upgrade() -> None:
    # Tạo bảng
    op.create_table('users', ...)
    
def downgrade() -> None:
    # Xóa bảng theo thứ tự ngược (xóa FK trước)
    op.drop_table('users')
```

**Quy tắc quan trọng:**
- Migration phải chạy được `upgrade head` trên DB trống.
- Migration phải có `downgrade -1` hoạt động.
- Không sửa migration đã được merge (tạo migration mới nếu cần fix).
- Dùng `UUID` cho primary key: `sa.Column('id', postgresql.UUID(as_uuid=True), ...)`.

---

## 12. Provider Pattern cho External Services

**Vấn đề:** Không muốn test code gọi API thật (email, Google, storage).

**Giải pháp: Protocol + Fake implementation:**
```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class EmailSender(Protocol):
    async def send_password_reset(self, email: str, token: str, reset_url: str) -> None: ...

class FakeEmailSender:
    """Dùng cho dev và test. Chỉ log ra stdout."""
    async def send_password_reset(self, email: str, token: str, reset_url: str) -> None:
        logger.info(f"[FAKE EMAIL] Reset token for {email}: {reset_url}")

class SmtpEmailSender:
    """Dùng cho production."""
    def __init__(self, host: str, port: int, user: str, password: str) -> None: ...
    async def send_password_reset(self, ...) -> None: ...
```

**Chọn implementation qua config:**
```python
def get_email_sender(settings: Settings = Depends(get_settings)) -> EmailSender:
    if settings.EMAIL_PROVIDER == "smtp":
        return SmtpEmailSender(...)
    return FakeEmailSender()
```

**Ưu điểm:**
- Test không cần mock phức tạp, chỉ dùng `FakeEmailSender`.
- Dễ thay đổi provider (SendGrid, AWS SES) mà không thay đổi business logic.
- Duck typing: `Protocol` không cần inheritance.

---

## 13. Idempotency trong API

**Nguyên tắc (AGENTS.md mục 7):**
> Ghi dữ liệu từ luồng realtime hoặc dễ bị gửi lại phải idempotent: client sinh `segmentId`/`requestId` (UUID) và ràng buộc unique ở DB.

**Trong Auth Sprint:**
- `refresh_tokens.token_hash` có UNIQUE constraint → retry không tạo bản ghi trùng.
- `password_reset_tokens.token_hash` có UNIQUE constraint.
- `auth_identities` có UNIQUE(provider, provider_user_id) → link account idempotent.

**Pattern chung:**
```sql
INSERT INTO refresh_tokens (token_hash, ...) 
VALUES (...)
ON CONFLICT (token_hash) DO NOTHING;
```

---

## 14. Nguyên tắc bảo mật quan trọng (AGENTS.md mục 8)

1. **Không bịa điểm:** → áp dụng cho auth: không trả `200 OK` khi thực ra đăng nhập fail.
2. **Scope dữ liệu theo user_id:** → Mọi query `/me/...` luôn filter `WHERE user_id = current_user.id`.
3. **404 thay 403:** → Truy cập resource của người khác → 404 (không lộ sự tồn tại).
4. **Không log nhạy cảm:** → Không log password, token, transcript. Chỉ log `user_id`.
5. **Microphone dừng khi session kết thúc:** → Sprint 1 chưa có session, nhưng cần nhớ cho Sprint 3+.

---

## 15. Clock Injectable — Testable Time

**Vấn đề:** `datetime.now()` trực tiếp làm code không thể test (không thể mock time).

**Giải pháp:**
```python
# core/clock.py
from datetime import UTC, datetime
from typing import Protocol

class Clock(Protocol):
    def now(self) -> datetime: ...

class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)

class FakeClock:
    """Dùng trong test để control thời gian."""
    def __init__(self, fixed_time: datetime):
        self._time = fixed_time
    
    def now(self) -> datetime:
        return self._time
    
    def advance(self, **kwargs) -> None:
        from datetime import timedelta
        self._time += timedelta(**kwargs)
```

**Dùng trong Service:**
```python
class AuthService:
    def __init__(self, ..., clock: Clock = SystemClock()) -> None:
        self._clock = clock
    
    async def create_refresh_token(self, ...) -> RefreshToken:
        now = self._clock.now()
        expires_at = now + timedelta(days=self.settings.REFRESH_TOKEN_EXPIRE_DAYS)
        ...
```

**Test:**
```python
def test_token_expires_correctly():
    fake_clock = FakeClock(datetime(2024, 1, 1, tzinfo=UTC))
    service = AuthService(..., clock=fake_clock)
    token = await service.create_refresh_token(...)
    
    # Tiến thời gian 31 ngày
    fake_clock.advance(days=31)
    
    # Token phải hết hạn
    with pytest.raises(TokenExpiredError):
        await service.refresh_tokens(token)
```


---

## 16. Hướng dẫn cấu hình Google OAuth & Email SMTP

### 16.1. Google OAuth (Google Identity Services - GSI)
1. **Tạo Client ID trên Google Cloud Console**:
   - Truy cập: `https://console.cloud.google.com/apis/credentials`
   - Tạo OAuth 2.0 Client ID (Application type: *Web application*).
   - Authorized JavaScript origins: `http://localhost:4200`
   - Authorized redirect URIs: `http://localhost:4200`
   - Copy Client ID (dạng `xxxxxx.apps.googleusercontent.com`).
2. **Điền vào cấu hình**:
   - **Frontend**: Điền vào `frontend/src/environments/environment.development.ts` (và `environment.ts`):
     ```typescript
     googleClientId: 'xxxxxx.apps.googleusercontent.com'
     ```
   - **Backend**: Điền vào `backend/.env`:
     ```env
     GOOGLE_CLIENT_ID=xxxxxx.apps.googleusercontent.com
     GOOGLE_TOKEN_VERIFIER=real
     ```
3. **Cơ chế hoạt động**:
   - Frontend dùng script Google Identity Services (`https://accounts.google.com/gsi/client`) mở Google popup/prompt, trả về `id_token` (JWT do Google ký).
   - Frontend gửi `id_token` tới Backend qua `POST /api/v1/auth/google`.
   - Backend dùng `google.oauth2.id_token.verify_oauth2_token` xác minh chữ ký từ Google servers và đối chiếu `audience == GOOGLE_CLIENT_ID`.
   - Nếu email đã tồn tại trong bảng `users`, backend tự động liên kết danh tính (`auth_identities`), nếu chưa thì tạo user mới.

---

### 16.2. Email Service (SMTP Gmail / Mailtrap)
1. **Sử dụng Gmail**:
   - Bật Xác thực 2 bước (2FA) trong tài khoản Google cá nhân.
   - Truy cập: `https://myaccount.google.com/apppasswords`.
   - Tạo Mật khẩu ứng dụng (App Password) 16 chữ cái cho app TalkWithMe.
2. **Điền vào cấu hình Backend `backend/.env`**:
   ```env
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx
   SMTP_FROM_EMAIL=your_email@gmail.com
   SMTP_TLS=true
   ```
3. **Cơ chế gửi bất đồng bộ (Non-blocking I/O)**:
   - Module `smtplib` trong Python là thư viện đồng bộ (blocking).
   - Do đó, `SmtpEmailSender` bọc việc gửi email vào `asyncio.to_thread(_send_sync)` để tránh làm nghẽn Event Loop của FastAPI khi gửi email.

---

## 17. Đổi mật khẩu an toàn & Quản lý Avatar

### 17.1. Đổi mật khẩu (Change Password)
- **Luồng xử lý bảo mật**:
  1. Người dùng nhập: `old_password`, `new_password`, `confirm_new_password`.
  2. Backend kiểm tra `verify_password(old_password, current_user.password_hash)`.
  3. Băm `new_password` bằng Argon2.
  4. Thu hồi **toàn bộ refresh token** hiện có của user (`auth_repo.revoke_all_user_tokens(user_id)`) nhằm vô hiệu hóa các phiên đăng nhập khác hoặc thiết bị bị chiếm quyền trước đó.

### 17.2. Tải ảnh đại diện trực tiếp (Direct Avatar Upload)
- **Frontend**:
  - Giao diện dạng Avatar tròn với Icon Máy Ảnh nổi bật ở góc phải dưới và hiệu ứng hover.
  - Khi click vào bất kỳ đâu trên ảnh đại diện hoặc icon máy ảnh, kích hoạt sự kiện click của thẻ `<input type="file" accept="image/jpeg,image/png,image/webp" class="hidden">`.
  - Validate dung lượng phía client (< 2 MB) trước khi upload.
  - Sử dụng `FormData` để gửi multipart request lên endpoint `POST /api/v1/me/avatar`.

---

## 18. Toast Notification Architecture (Tránh Layout Shift / Nhảy UI)

### 18.1. Vấn đề của Inline Alert Banners
- Trước đây, các thông báo lỗi (`@if (error())`) hoặc thành công (`@if (saved())`) được render ngay bên trong các form (Login, Register, Profile, Settings, Reset Password).
- **Hệ quả UX**: Khi thông báo xuất hiện hoặc biến mất, toàn bộ layout bên dưới bị đẩy xuống hoặc co lên đột ngột (hiện tượng **Cumulative Layout Shift - CLS** hay "nhảy UI"). Người dùng dễ bấm hụt nút hoặc cảm giác giao diện giật lag.

### 18.2. Giải pháp: Toast Notification dạng nổi (Floating Toast Service)
1. **ToastService (`core/services/toast.service.ts`)**:
   - Sử dụng Angular Signals: `readonly toasts = signal<ToastItem[]>([])`.
   - Các hàm helper: `success(message, duration?)`, `error(message, duration?)`, `info(message, duration?)`.
   - Cơ chế tự hủy (`setTimeout`) sau 3.5s - 4.5s hoặc cho phép người dùng click đóng (`dismiss(id)`).
2. **ToastContainerComponent (`shared/components/toast-container`)**:
   - Vị trí cố định ở góc trên bên phải màn hình: `fixed top-5 right-5 z-[9999]`.
   - Hiệu ứng slide-in mượt mà, glassmorphism (`backdrop-blur-md`), bóng đổ nhẹ nhàng và phân loại màu sắc trực quan (Xanh lá cho thành công, Đỏ cho lỗi, Xanh dương cho thông tin).
   - Được gắn một lần duy nhất ở gốc ứng dụng (`app.component.html`), không ảnh hưởng tới layout của bất kỳ màn hình nào.

---

## 19. Đồng bộ hóa Form Mật khẩu & Validation Nhất Quán

- **Vấn đề**: Các màn hình Đăng ký, Đổi mật khẩu, và Đặt lại mật khẩu có các quy tắc kiểm tra khác nhau, tạo cảm giác thiếu nhất quán (ví dụ: màn đặt lại mật khẩu cho phép nhập `123456`, trong khi màn đăng ký thì chặn).
- **Giải pháp đồng bộ toàn diện**:
  1. **Thang đo độ mạnh mật khẩu (Password Strength Meter)**: Đồng nhất 4 mức (Yếu / Trung bình / Mạnh / Rất mạnh) với thanh màu trực quan (`passwordBars`).
  2. **Chặn mật khẩu dễ đoán (`isWeakPassword`)**: Chặn các chuỗi thông dụng như `123456`, `password`, `111111`, các ký tự lặp lại... trên cả 3 màn hình và ở cả backend.
  3. **Ẩn/hiện mật khẩu (Eye Toggle)**: Cung cấp nút con mắt cho cả ô nhập mật khẩu mới và ô xác nhận mật khẩu để người dùng dễ kiểm tra và tránh gõ nhầm.

---

## 20. Đồng bộ hóa Trạng thái Người dùng & Đăng xuất Toàn diện

1. **Hiển thị tên thật của người dùng**:
   - Ở Dashboard (lời chào "Xin chào, [Tên]! 👋"), Header bar, và Profile: Đọc nguồn sự thật từ `authService.currentUser()?.fullName`, sau đó mới fallback về mock user nếu chưa đăng nhập.
2. **Đăng xuất đồng bộ và an toàn**:
   - Thiết kế nút đăng xuất nhất quán (card có viền đỏ nhạt, chữ đỏ, icon đăng xuất, hiệu ứng hover mượt mà) trên cả trang **Hồ sơ cá nhân** và **Cài đặt**.
   - Trong `AuthService.logout()`:
     - Gửi token lên backend để thu hồi (`POST /api/v1/auth/logout`).
     - Xóa refresh token khỏi `localStorage`.
     - Xóa `accessToken` trong memory.
     - Reset `currentUser.set(null)` trong `AuthService`.
     - Reset `appState.user.set(null)` và xóa `talk-with-me.mock-user` trong `localStorage`.
     - Điều hướng an toàn về `/login`.

