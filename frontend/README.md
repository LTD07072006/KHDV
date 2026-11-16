# Frontend demo — Xếp lịch CSKH

Màn hình **Xếp lịch tuần** chạy hai kịch bản mẫu qua API backend. Nút **Mở bản mô phỏng** mở riêng bản xem trước cũ trong trình duyệt.

## Xếp lịch tuần với CSV hoặc XLSX

Khởi động backend tại `127.0.0.1:8000` để Vite chuyển tiếp `/api`. Chọn kịch bản **Dự báo từ lịch sử** hoặc **Cuộc gọi dự kiến**. Chọn định dạng và tệp, bấm **Nạp tệp**, sau đó **Chạy xếp lịch**. Nút **Tải lịch CSV** xuất kết quả gần nhất khi trạng thái là `OPTIMAL` hoặc `FEASIBLE`.

Tệp có giới hạn 2 MiB, với bốn cột theo thứ tự `date,hour,group_id,calls`. XLSX dùng một sheet tên `calls`. Cả hai kịch bản dùng nhóm `sales`, giờ 08:00 và 09:00, tuần bắt đầu 02/11/2026. Cuộc gọi dự kiến cần dòng cho cả hai giờ vào ngày 02/11. Lịch sử cần ít nhất hai thứ Hai trước tuần này có dữ liệu cho từng giờ. Điền 0 khi không có cuộc gọi. Chỉ số cuộc gọi được thay bằng dữ liệu trong tệp.

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

Lệnh này chạy oxlint, Vitest và build TypeScript/Vite.

## Luồng demo P0–P3

1. Chọn ngày lập lịch.
2. Chọn một trong bốn kịch bản, hoặc bấm vùng file để chọn workbook `.xlsx` thật.
3. Workbook thật cần có hai sheet `NhuCau` và `NhanVien` với các cột theo file mẫu. Frontend sẽ đọc dữ liệu, bắt lỗi thiếu sheet/cột, sai số, slot không dài 30 phút, trùng mã và nhân viên chưa chọn ca.
4. Trong bảng nhân viên, tích **Đi làm**, **Ca ngày** hoặc **Ca đêm**.
5. Bấm **Tạo bản xem trước**.
6. Xem bảng độ phủ, lịch nhân viên, bộ lọc ca, Gantt và tải CSV nếu cần. Có thể tải thêm **Audit (JSON)** để đối chiếu đầu vào và kết quả bản xem trước. CSV có UTF-8 BOM và escape đúng dấu phẩy/dấu ngoặc kép để mở bằng Excel. Có thể kéo thả workbook, theo dõi trạng thái đang đọc file và dùng giao diện ở màn hình hẹp.
7. Phiên làm việc được tự lưu trên trình duyệt (không lưu file Excel nhị phân). Khi mở lại trang, dữ liệu và kết quả gần nhất sẽ được khôi phục; dùng **Xóa phiên** nếu muốn xóa bản lưu.
8. Trước khi tạo lịch, thẻ tóm tắt cho biết ngày, số slot, tổng cuộc gọi, số nhân viên và mức phục vụ. Sau khi có kết quả, bảng nhu cầu có thể lọc nhanh **Đủ người**, **Thiếu người** hoặc **Giờ nghỉ**.

Ca ngày là `08:00–20:00`, nghỉ `12:00–13:00`; ca đêm là `20:00–08:00`, nghỉ `00:00–01:00`.

## Cấu trúc chính

- `src/types/scheduling.ts`: kiểu dùng chung cho demand, nhân viên, fixture và kết quả.
- `src/services/mockSchedule.ts`: engine tính bản xem trước local.
- `src/services/exporters.ts`: xuất CSV/audit JSON dùng chung và có test escape dữ liệu.
- `src/services/validation.ts`: validation file và dữ liệu nhân viên.
- `src/services/workbookParser.ts`: đọc và chuẩn hóa workbook Excel phía frontend.
- `src/data/fixtures.ts`: bốn kịch bản frontend.
- `src/components/`: biểu đồ độ phủ, Gantt, SLA, telemetry, step indicator và thông báo.
- `src/App.tsx`: điều phối state và layout chính.

Nhãn **Có trong bản xem trước** chỉ là kết quả mô phỏng local. Nhãn **Đã xếp** được giữ riêng cho khi có solver thật ở giai đoạn tích hợp backend.

Màn hình **Xếp lịch tuần** dùng `src/services/scheduleV2.ts` và `src/services/scheduleV2Files.ts` cho API v2. `src/services/api.ts` thuộc bản mô phỏng cũ.

## P4.5, P4.8 và P5.1

- **P4.5:** CSV lịch và độ phủ được xuất UTF-8 có BOM, escape đúng dữ liệu tiếng Việt/dấu phẩy/dấu ngoặc kép; có thêm Audit JSON gồm đầu vào và kết quả bản xem trước.
- **P4.8:** tab, bộ lọc và chế độ xem có trạng thái `aria-selected`/`aria-pressed`, bảng có vùng cuộn ngang và thao tác bằng Tab.
- **P5.1:** API client giữ đúng multipart endpoint và kiểm tra response theo `SchedulingResult v1.0.0` trước khi trả dữ liệu cho UI. Luồng demo hiện tại vẫn dùng mock local.
