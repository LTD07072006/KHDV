# Frontend & Fullstack — Xếp lịch CSKH

Ứng dụng web xếp lịch làm việc cho Contact Center (KHDV), tích hợp:
- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS v4.
- **Backend:** FastAPI + Python.
- **Thuật toán:**
  - **Erlang C:** Tự động tính số lượng nhân viên cần (`required_agents`) từ số cuộc gọi dự kiến và AHT theo SLA 80/20.
  - **Google OR-Tools CP-SAT:** Tối ưu hóa phân ca làm việc, giải quyết các ràng buộc phân công và xử lý cảnh báo thiếu người mềm (soft shortage).

---

## Yêu cầu môi trường
- Python 3.10+
- Node.js 20+
- npm 10+

---

## Hướng dẫn cài đặt & khởi chạy (2 lệnh)

### 1. Khởi động Backend API (Terminal 1)
```bash
# Cài đặt thư viện Python
pip install -r requirements.txt fastapi uvicorn python-multipart

# Chạy server FastAPI
uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```
API hoạt động tại: `http://127.0.0.1:8000` (Kiểm tra health: `http://127.0.0.1:8000/health`).

### 2. Khởi động Frontend Dev Server (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Mở trình duyệt tại: `http://localhost:5173/`

---

## 4 Bộ dữ liệu kiểm thử mẫu (Fixtures - Ngày 8)

Hệ thống cung cấp sẵn 4 bộ dữ liệu mẫu trong thư mục `fixtures/` (và có nút bấm thử nghiệm trực tiếp ngay trên giao diện web):

1. **`01_normal.xlsx` (Bình thường):**
   - 24 khung giờ, 6 nhân viên.
   - Nhu cầu được đáp ứng đầy đủ. Solver đạt **100% độ phủ, 0 thiếu người (0 shortage)**.

2. **`02_peak_demand.xlsx` (Giờ cao điểm):**
   - Cuộc gọi tăng vọt vào khung giờ 09:30–11:00 và 14:00–15:00 (cần 11–12 nhân sự).
   - Solver tối ưu hóa 6 nhân sự hiện có và kích hoạt **Cảnh báo thiếu người (Shortage)** tại các slot cao điểm mà không bị crash.

3. **`03_understaffed.xlsx` (Thiếu nhân viên):**
   - Nhu cầu bình thường nhưng chỉ có 2 nhân viên đi làm.
   - Hệ thống vẫn xếp ca hợp lệ cho 2 nhân sự và cảnh báo thiếu người diện rộng.

4. **`04_invalid_data.xlsx` (Dữ liệu lỗi):**
   - Chứa lỗi: nhân viên đi làm nhưng không chọn ca, trùng mã nhân viên.
   - Bộ lọc **Validation** bắt lỗi tức thì và trả về thông báo lỗi tiếng Việt dễ hiểu trên giao diện.

### Chạy kiểm thử tự động cho 4 Fixtures:
```bash
python test_fixtures.py
```

---

## Kiểm tra chất lượng mã nguồn (Lint & Build)

```bash
cd frontend
npm test
```
*(Chạy oxlint kiểm tra cú pháp và build TypeScript/Vite)*
