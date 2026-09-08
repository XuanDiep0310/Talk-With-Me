# 🐙 GitHub Workflow & Git Guidelines
---

## 📌 1. Chiến Lược Nhánh (Branch Strategy)

* `main`: Nhánh chính của dự án. **Tất cả các nhánh mới BẮT BUỘC phải checkout từ `main` sau khi đã `git pull origin main` mới nhất**.
* `develop`: Nhánh môi trường tích hợp / kiểm thử.
* Nhánh tính năng cá nhân: Được tạo theo quy tắc `1 Ticket = 1 Branch`.

---

## 🏷 2. Quy Tắc "1 Ticket = 1 Branch" & Đặt Tên Nhánh

> **QUY TẮC BẮT BUỘC**:
> 1. Trước khi tạo nhánh mới, BẮT BUỘC phải checkout và pull mới nhất từ `main`.
> 2. Đặt tên nhánh dạng `<prefix>/<JIRA-KEY>`.
> 3. **KHÔNG xóa nhánh sau khi merge**.

### Cú pháp đặt tên nhánh:
```text
<prefix>/<JIRA-KEY>
```

### Chi tiết các Prefix hợp lệ & Ví dụ:

| Prefix | Mục đích sử dụng | Ví dụ chuẩn (KHÔNG có short description) |
| :--- | :--- | :--- |
| `feature/` | Phát triển tính năng code mới (Frontend / Backend) | `feature/SCRUM-14` |
| `design/` | Thiết kế UI/UX Figma, CSS styleguide, Export assets | `design/SCRUM-1` |
| `docs/` | Soạn thảo / Cập nhật tài liệu specs, SRS, API, Prompts | `docs/SCRUM-4` |
| `bugfix/` | Sửa lỗi phát sinh trong quá trình dev / QA | `bugfix/SCRUM-20` |
| `chore/` | Cấu hình Docker, CI/CD, cài đặt thư viện dependency | `chore/SCRUM-13` |

---

## ⚡ 3. Quy Trình Xử Lý Merge Conflict (Resolve Conflict SOP)

Khi nhánh nguồn (nhánh tính năng bạn đang phát triển) bị **conflict** với nhánh đích (nhánh muốn merge vào, ví dụ: `develop` hoặc `main`), tuân thủ tuyệt đối quy trình sau:

### Quy tắc Vàng:
> 🚫 **LƯU Ý QUAN TRỌNG**: **KHÔNG** merge nhánh `develop` hay `main` trực tiếp vào nhánh tính năng gốc của mình để resolve conflict.

### Quy trình các bước thực hiện:
1. Checkout một **nhánh mới** từ **nhánh đích** (nhánh muốn merge vào).
2. Tên nhánh mới theo cú pháp: `<prefix>/<JIRA-KEY>-<tên-nhánh-đích>`
3. Merge nhánh nguồn (nhánh tính năng gốc) vào nhánh mới này để xử lý conflict local.
4. Xử lý xong conflict $\rightarrow$ Commit $\rightarrow$ Push nhánh mới lên GitHub.
5. Tạo Pull Request từ **nhánh mới** vào **nhánh đích**.

---

### Ví dụ minh họa chi tiết:

Giả sử bạn đang làm ticket **`SCRUM-14`** tại nhánh **`feature/SCRUM-14`**:

#### 🔹 Trường hợp 1: Nếu conflict khi merge vào `develop`
1. Từ nhánh `develop`, tạo nhánh mới:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/SCRUM-14-develop
   ```
2. Merge nhánh gốc `feature/SCRUM-14` vào nhánh mới này để xử lý conflict:
   ```bash
   git merge feature/SCRUM-14
   ```
3. Tiến hành resolve conflict bằng tay trong code $\rightarrow$ Save $\rightarrow$ Commit:
   ```bash
   git add .
   git commit -m "fix(conflict): resolve merge conflict with develop #SCRUM-14"
   git push -u origin feature/SCRUM-14-develop
   ```
4. Tạo PR từ nhánh `feature/SCRUM-14-develop` vào nhánh `develop`.

#### 🔹 Trường hợp 2: Nếu conflict khi merge vào `main`
1. Từ nhánh `main`, tạo nhánh mới:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/SCRUM-14-main
   ```
2. Merge nhánh gốc `feature/SCRUM-14` vào nhánh mới này để xử lý conflict:
   ```bash
   git merge feature/SCRUM-14
   ```
3. Xử lý conflict $\rightarrow$ Commit $\rightarrow$ Push:
   ```bash
   git add .
   git commit -m "fix(conflict): resolve merge conflict with main #SCRUM-14"
   git push -u origin feature/SCRUM-14-main
   ```
4. Tạo PR từ nhánh `feature/SCRUM-14-main` vào nhánh `main`.

---

## 💬 4. Quy Tắc Commit Messages (Conventional Commits)

Nội dung commit tuân theo định dạng Conventional Commits:

```text
<type>(<scope>): <Mô tả ngắn công việc> [#<JIRA-KEY>]
```

* `feat`: Thêm tính năng code mới.
* `design`: Cập nhật thiết kế Figma, giao diện UI, CSS styles.
* `docs`: Cập nhật file tài liệu Markdown, SRS, API specs.
* `fix`: Sửa lỗi (Bugfix / Conflict fix).
* `chore`: Cập nhật config, dependencies, file `.gitignore`.

### Ví dụ Commit Messages:
```bash
git commit -m "design(sys): add color tokens #SCRUM-1"
git commit -m "docs(srs): add AI Coach workflow spec #SCRUM-4"
git commit -m "feat(backend): implement healthcheck endpoint #SCRUM-14"
```

---

## 🔀 5. Quy Tắc Tạo & Duyệt Pull Request (PR Policy)

### 5.1 Quy tắc đặt Tiêu đề PR:
```text
[<JIRA-KEY>] <Type>: <Mô tả ngắn gọn>
```
* **Ví dụ**: `[SCRUM-1] Design: Add Figma Design System`

### 5.2 Merge Policy (Chính sách Merge):
1. **BẮT BUỘC có 1 Reviewer Approval**: Cần ít nhất 1 thành viên review và bấm Approved.
2. 🚫 **KHÔNG DÙNG SQUASH MERGE**: Chọn phương thức **`Create a merge commit`** (hoặc `Rebase and merge` tùy cấu hình repo), **KHÔNG** chọn `Squash and merge`.
3. 🚫 **KHÔNG XÓA NHÁNH SAU MERGE**: Giữ nguyên nhánh sau khi đã merge thành công (Không bấm nút "Delete branch").

---

## 🔄 6. Quy Trình 6 Bước Thực Hiện Công Việc Hàng Ngày

```text
[1. Nhận Ticket Jira] ──► [2. Pull main & Create Branch] ──► [3. làm việc & Commit]
                                                                     │
[6. Done Jira Ticket] ◄── [5. Review & Standard Merge] ◄── [4. Create PR (Check Conflict)]
```

### 🔹 BƯỚC 1: Nhận Ticket trên Jira
- Chuyển trạng thái Ticket `SCRUM-X` trên Jira sang `In Progress`.

### 🔹 BƯỚC 2: Pull từ `main` & Tạo nhánh mới
```bash
# BẮT BUỘC pull từ main trước khi tạo nhánh mới
git checkout main
git pull origin main
git checkout -b feature/SCRUM-14
```

### 🔹 BƯỚC 3: Làm việc & Commit
```bash
git add .
git commit -m "feat(backend): add async db session manager #SCRUM-14"
```

### 🔹 BƯỚC 4: Push & Tạo PR
```bash
git push -u origin feature/SCRUM-14
```
- Tạo PR trên GitHub hướng vào nhánh đích (`develop` hoặc `main`).
- **Nếu phát hiện Conflict**: Làm đúng theo **Quy trình tại Mục 3** (Tạo nhánh mới từ nhánh đích, merge nhánh gốc vào để fix conflict, rồi tạo PR từ nhánh mới đó).

### 🔹 BƯỚC 5: Review & Merge PR
- Nhận Approval từ Reviewer.
- Thực hiện Merge PR bằng **Standard Merge Commit** (🚫 **KHÔNG SQUASH**).
- 🚫 **KHÔNG XÓA NHÁNH** sau khi merge.

### 🔹 BƯỚC 6: Cập nhật Jira Ticket
- Chuyển trạng thái Ticket trên Jira sang `Done`.
