# Hệ Thống Web Lập Lịch Ca Làm Việc Contact Center

> **Bài Tập Lớn môn Kinh doanh Dịch vụ / Kỹ thuật Dịch vụ (Service Science & Engineering)**  
> Ứng dụng mô hình hàng đợi **Erlang C (SLA 80/20)** và bộ giải tối ưu hóa ràng buộc **Google OR-Tools CP-SAT** để tự động lập lịch ca làm việc cho nhân viên tổng đài.

---

## 📌 Tổng Quan Kiến Trúc

Hệ thống hoạt động theo luồng dữ liệu khép kín:

```
[ Excel (.xlsx) / Giao diện người dùng ]
                 ↓
[ React Frontend (Vite + Tailwind CSS) ]
                 ↓  HTTP JSON / Multipart
[ FastAPI Backend (api.py) ]
                 ↓
[ Workbook Adapter (workbook_adapter.py) ]
                 ↓
[ Erlang C: Tính Required Agents theo SLA 80/20 (erlang_c.py) ]
                 ↓
[ Google OR-Tools CP-SAT Solver (scheduling_solver.py) ]
                 ↓
[ SchedulingResult v1.0.0 (Lịch ca, Coverage, Shortage, Overstaff) ]
                 ↓
[ Trực quan hóa Lịch làm việc & Xuất CSV (App.tsx) ]
```

---

## 🚀 Tính Năng Chính

1. **Tính toán nhu cầu nhân sự khoa học (Erlang C)**:
   - Dựa trên cuộc gọi dự kiến theo từng slot 30 phút và thời gian đàm thoại trung bình (AHT tính bằng phút/giây).
   - Đảm bảo Service Level tiêu chuẩn viễn thông (80% cuộc gọi được phục vụ trong 20 giây).

2. **Tối ưu hóa xếp ca thông minh (Google OR-Tools CP-SAT)**:
   - Hỗ trợ mô hình 2 ca tiêu chuẩn:
     - **Ca ngày (Day shift)**: 08:00 – 20:00 (Nghỉ 12:00 – 13:00).
     - **Ca đêm (Night shift)**: 20:00 – 08:00 (Nghỉ 00:00 – 01:00).
   - Ràng buộc cứng: Mỗi nhân viên làm tối đa 1 ca/ngày; chỉ phân ca mà nhân viên đã đăng ký; giờ nghỉ không tính vào độ phủ.
   - Hàm mục tiêu đa cấp: Ưu tiên tuyệt đối giảm thiểu thiếu hụt (soft shortage), sau đó tối ưu hóa độ thừa (overstaffing) và phân bổ công bằng (fairness).
   - Không bị lỗi `INFEASIBLE` khi thiếu người: Thay vào đó hệ thống sinh lịch tốt nhất kèm cảnh báo thiếu người rõ ràng.

3. **Giao diện Web Trực quan (React 19 + Tailwind CSS v4)**:
   - Tải lên workbook Excel `.xlsx` kéo-thả hoặc dùng nút tải nhanh 4 Fixtures mẫu.
   - Xem trước dữ liệu (Preview) nhu cầu từng slot và danh sách nhân viên.
   - Bảng phân công chi tiết ca làm việc, thời gian nghỉ và biểu tượng Trực quan (Mặt trời/Mặt trăng).
   - Bảng độ phủ (Coverage) với thanh tỷ lệ phần trăm (Progress bar) và tô màu cảnh báo khung giờ thiếu người.
   - Bộ lọc nhân viên nhanh (Tất cả, Đi làm, Nghỉ) và nút chọn nhanh hàng loạt.
   - Xuất dữ liệu: Tải file CSV phân công nhân sự và CSV độ phủ chi tiết.

4. **Bộ Fixtures & Kiểm Thử Tự Động (Automated Testing)**:
   - `01_normal.xlsx`: Kịch bản bình thường (đạt 100% độ phủ).
   - `02_peak_demand.xlsx`: Giờ cao điểm (cuộc gọi tăng đột biến, solver tập trung nhân sự).
   - `03_understaffed.xlsx`: Thiếu nhân lực (solver xếp lịch tối ưu kèm cảnh báo soft shortage).
   - `04_invalid_data.xlsx`: Dữ liệu sai (bộ kiểm tra chặn lỗi và báo tiếng Việt rõ ràng).

---

## 📂 Cấu Trúc Thư Mục

```
khdv/
├── api.py                    # FastAPI Backend phục vụ preview và xếp lịch
├── scheduling_solver.py      # Core solver Google OR-Tools CP-SAT v1.0.0
├── scheduling_contract.py    # Schema & dataclass chuẩn SchedulingRequest/Result
├── workbook_adapter.py       # Bộ chuyển đổi Excel (.xlsx) sang SchedulingRequest
├── erlang_c.py               # Thuật toán hàng đợi Erlang C tính nhân sự
├── requirements.txt          # Danh sách thư viện Python cần thiết
├── test_fixtures.py          # Script kiểm thử tự động 4 kịch bản fixture
├── create_fixtures.py        # Script sinh 4 file Excel fixture mẫu
├── fixtures/                 # Thư mục lưu 4 file Excel test
│   ├── 01_normal.xlsx
│   ├── 02_peak_demand.xlsx
│   ├── 03_understaffed.xlsx
│   └── 04_invalid_data.xlsx
├── docs/                     # Tài liệu thiết kế kỹ thuật, hợp đồng JSON schema
│   ├── contracts/
│   │   ├── scheduling-request.schema.json
│   │   └── scheduling-result.schema.json
│   ├── Technical_Blueprint_Workflow_Masterplan.md
│   └── ...
└── frontend/                 # Ứng dụng Web React (Vite + Tailwind CSS v4)
    ├── package.json
    ├── vite.config.ts        # Cấu hình proxy chuyển tiếp /api -> localhost:8000
    ├── public/
    │   └── fixtures/         # 4 file fixture phục vụ nút load nhanh trên web
    └── src/
        ├── App.tsx           # Giao diện chính tương tác trực tiếp Backend
        ├── services/api.ts   # API Client giao tiếp FastAPI
        └── data/             # Fixtures dữ liệu mẫu dự phòng
```

---

## 🛠️ Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Khởi chạy Backend (FastAPI)

Yêu cầu: Python 3.10 trở lên.

```bash
# Cài đặt thư viện
pip install -r requirements.txt

# Khởi chạy server FastAPI (mặc định tại port 8000)
uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```

Kiểm tra API hoạt động tại: `http://127.0.0.1:8000/health` (trả về `{"status": "ok"}`).

### 2. Khởi chạy Frontend (React + Vite)

Yêu cầu: Node.js 18 trở lên.

```bash
cd frontend

# Cài đặt dependencies (chỉ cần chạy lần đầu)
npm install

# Khởi chạy môi trường phát triển (mặc định tại port 5173)
npm run dev
```

Mở trình duyệt truy cập: `http://localhost:5173`. Giao diện sẽ tự động kết nối với backend qua proxy.

### 3. Chạy Kiểm Thử Tự Động (Automated Testing)

Để kiểm tra độ chính xác của adapter, solver và các kịch bản biên:

```bash
python test_fixtures.py
```

Kết quả mong đợi: `4 passed in 0.5s` (Tất cả 4 kịch bản đều đạt chuẩn).

---

## 📋 Hợp Đồng Dữ Liệu (Contract)

Hệ thống tuân thủ nghiêm ngặt chuẩn hợp đồng v1.0.0 đã được định nghĩa tại `docs/contracts/`:
- `SchedulingRequest v1.0.0`: Định nghĩa danh sách các slot 30 phút (kèm số cuộc gọi, AHT, required agents) và danh sách nhân viên (kèm ca đăng ký).
- `SchedulingResult v1.0.0`: Định nghĩa kết quả phân bổ ca, thời gian bắt đầu/kết thúc, slot nghỉ (break) và bảng tổng hợp độ phủ (coverage) theo từng slot.
