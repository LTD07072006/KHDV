# B1.2 — Phiếu bàn giao frontend

## Deliverables

- Dự án React + Vite + TypeScript tại `frontend/`.
- Tailwind CSS qua `@tailwindcss/vite`.
- Cấu hình shadcn/ui tại `frontend/components.json` và component nền `src/components/ui/button.tsx`.
- Giao diện thử nghiệm dùng dữ liệu mẫu B1.1.
- Cấu trúc `src/components`, `src/pages`, `src/services`, `src/lib`.
- Hướng dẫn chạy tại `frontend/README.md`.

## Luồng prototype

1. Chọn ngày lập lịch.
2. Chọn workbook `.xlsx` và hiển thị tên file.
3. Tải workbook mẫu trực tiếp hoặc chọn file `.xlsx`.
4. Xem trạng thái preview và validation đuôi file.
5. Xem thẻ tóm tắt số slot, tổng cuộc gọi và số người cao nhất cần.
6. Xem bảng nhu cầu theo slot 30 phút.
7. Xem bảng lịch nhân viên mẫu.
8. Bấm `Tạo lịch thử nghiệm` để mô phỏng trạng thái kết quả.
9. Tải CSV lịch mẫu sau khi kết quả xuất hiện.

## Baseline B1.1 được giữ nguyên

- Một ngày, một nhóm `Hỗ trợ chung`.
- Slot 30 phút.
- Hai ca mẫu: ca ngày và ca đêm.
- Không có bộ chọn ca toàn cục.
- `required_agents` là kết quả tính toán, không phải input giao diện.

## Kiểm tra

```bash
cd frontend
npm run build
npm run lint
npm run dev
```

Build và lint đã chạy thành công trong lần bàn giao này. Giao diện đã được mở trên trình duyệt local và hiển thị đúng các vùng header, input, bảng nhu cầu và trạng thái prototype.

## Giới hạn có chủ ý

Prototype chưa upload workbook lên backend và chưa gọi API thật. Adapter và solver đã được đưa ra mã nguồn chính ở root; frontend sẽ gọi contract `SchedulingRequest v1.0.0`/`SchedulingResult v1.0.0` qua `src/services/api.ts` ở bước tích hợp tiếp theo.
