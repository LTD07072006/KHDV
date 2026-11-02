# Frontend demo — Xếp lịch CSKH

Frontend React độc lập cho luồng kiểm tra và xem trước lịch nhân viên Contact Center. Toàn bộ luồng demo hiện chạy bằng mock engine trong trình duyệt, không cần backend. API client được giữ riêng để tích hợp ở bước sau.

## Chạy ứng dụng

```bash
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal, thường là `http://localhost:5173/`.

Kiểm tra mã nguồn:

```bash
npm test
```

Lệnh này chạy oxlint, 13 unit test Vitest và build TypeScript/Vite.

## Luồng demo P0–P3

1. Chọn ngày lập lịch.
2. Chọn một trong bốn kịch bản, hoặc bấm vùng file để chọn workbook `.xlsx` thật.
3. Workbook thật cần có hai sheet `NhuCau` và `NhanVien` với các cột theo file mẫu. Frontend sẽ đọc dữ liệu, bắt lỗi thiếu sheet/cột, sai số, slot không dài 30 phút, trùng mã và nhân viên chưa chọn ca.
4. Trong bảng nhân viên, tích **Đi làm**, **Ca ngày** hoặc **Ca đêm**.
5. Bấm **Tạo bản xem trước**.
6. Xem bảng độ phủ, lịch nhân viên, bộ lọc ca, Gantt và tải CSV nếu cần. Có thể kéo thả workbook, theo dõi trạng thái đang đọc file và dùng giao diện ở màn hình hẹp.
7. Phiên làm việc được tự lưu trên trình duyệt (không lưu file Excel nhị phân). Khi mở lại trang, dữ liệu và kết quả gần nhất sẽ được khôi phục; dùng **Xóa phiên** nếu muốn xóa bản lưu.

Ca ngày là `08:00–20:00`, nghỉ `12:00–13:00`; ca đêm là `20:00–08:00`, nghỉ `00:00–01:00`.

## Cấu trúc chính

- `src/types/scheduling.ts`: kiểu dùng chung cho demand, nhân viên, fixture và kết quả.
- `src/services/mockSchedule.ts`: engine tính bản xem trước local.
- `src/services/validation.ts`: validation file và dữ liệu nhân viên.
- `src/services/workbookParser.ts`: đọc và chuẩn hóa workbook Excel phía frontend.
- `src/data/fixtures.ts`: bốn kịch bản frontend.
- `src/components/`: biểu đồ độ phủ, Gantt, SLA, telemetry, step indicator và thông báo.
- `src/App.tsx`: điều phối state và layout chính.

Nhãn **Có trong bản xem trước** chỉ là kết quả mô phỏng local. Nhãn **Đã xếp** được giữ riêng cho khi có solver thật ở giai đoạn tích hợp backend.
