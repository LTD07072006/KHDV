# Frontend — Xếp lịch CSKH

Prototype React cho B1.2, xây bằng Vite + TypeScript + Tailwind CSS. Giao diện dùng dữ liệu mẫu từ B1.1 và chưa gọi backend.

## Yêu cầu

- Node.js 20 trở lên.
- npm 10 trở lên.

## Cài đặt và chạy

```bash
cd frontend
npm install
npm run dev
```

Mở URL Vite in trong terminal, thường là `http://localhost:5173`.

## Build kiểm tra

```bash
npm run build
npm run preview
```

Kiểm tra nhanh cả lint và build bằng một lệnh:

```bash
npm test
```

Lệnh này chưa chạy test backend hoặc test unit vì prototype B1.2 chưa nối adapter và solver.

## Kiểm thử giao diện thủ công

Sau `npm run dev`, mở URL Vite hiển thị trong terminal và kiểm tra:

1. Trang hiển thị tiêu đề `Tạo lịch nhân viên cho ngày sắp tới`.
2. Ngày mặc định hiển thị `02/11/2026`.
3. Bấm `Tải workbook mẫu`; trình duyệt tải `mau_xep_lich.xlsx`.
4. Chọn một file `.xlsx`; tên file xuất hiện trong thẻ `Dữ liệu đầu vào` và hiện thông báo đã đọc workbook.
5. Chọn file không phải `.xlsx`; hiện lỗi và nút `Tạo lịch thử nghiệm` bị khóa.
6. Với file hợp lệ, bấm `Tạo lịch thử nghiệm`; nút hiện `Đang tạo lịch…` rồi chuyển sang tab `Lịch nhân viên`.
7. Kiểm tra trạng thái `Cần xem lại` và thông báo còn thiếu người.
8. Bấm biểu tượng tải CSV; file `lich_2026-11-02.csv` được tải xuống.

Nếu các bước 1–8 đều đúng, prototype B1.2 đạt phần giao diện thử nghiệm. Việc parse nội dung workbook, gọi backend và chạy CP-SAT thuộc B2.2.

## Cấu trúc chính

```text
frontend/
├── src/
│   ├── App.tsx          # layout prototype và dữ liệu mẫu
│   ├── App.css          # tinh chỉnh CSS nhỏ
│   ├── index.css        # Tailwind và global styles
│   ├── components/      # component tái sử dụng
│   ├── pages/           # màn hình cấp trang
│   └── services/        # ranh giới giao tiếp backend
├── vite.config.ts       # React + Tailwind Vite plugin
└── package.json
```

## Phạm vi prototype

- Chọn ngày lập lịch.
- Chọn workbook `.xlsx` để hiển thị tên file.
- Tải workbook mẫu trực tiếp từ giao diện.
- Kiểm tra đuôi file `.xlsx` trước khi cho tạo lịch.
- Xem bảng nhu cầu mẫu và lịch nhân viên mẫu.
- Bấm “Tạo lịch thử nghiệm” để mô phỏng trạng thái xử lý.
- Sau khi tạo lịch, tải CSV lịch mẫu.
- Có trạng thái preview, validation và cảnh báo thiếu người.
- Chưa upload workbook lên backend, chưa gọi adapter Python và chưa chạy CP-SAT.

Các phần backend sẽ nối ở B2.2 qua `src/services/api.ts`, giữ nguyên contract `SchedulingRequest v1.0.0` của B1.1.
