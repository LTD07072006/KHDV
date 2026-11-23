# Điều phối CSKH

Màn hình **Xếp lịch tuần** dùng contract interval 30 phút của [backend `3af5b9b`](https://github.com/SkyAnzu/backend_khdv/commit/3af5b9b38acd340f43f96ccb99a51c4632a08dad).

## Chạy tại máy phát triển

Khởi động backend theo README của repo backend, sau đó chạy từ thư mục frontend:

```powershell
npm.cmd ci
npm.cmd run dev
```

Mở URL Vite hiện trong terminal. Vite chuyển tiếp `/api` và `/health` tới `http://127.0.0.1:8000`. Có thể đặt biến `KHDV_BACKEND_URL` trước khi chạy Vite nếu backend dùng cổng khác.

## Lập lịch

1. Chọn ngày thứ Hai, khai báo nhóm dịch vụ, SLA/ngưỡng chờ và AHT từng nhóm cần tính.
2. Khai báo một hoặc nhiều khoảng hoạt động mỗi ngày. Khoảng bắt đầu và kết thúc theo mốc nửa giờ. Có thể kết thúc ở 24:00.
3. Nhập trực tiếp hoặc nạp tệp. Với cuộc gọi dự kiến, điền mỗi ô trong lưới và chỉ nhập 0 khi biết chắc không có cuộc gọi. Với lịch sử, chọn khoảng ngày `[bắt đầu, kết thúc)` trước tuần xếp lịch và có ít nhất hai ngày quan sát cùng thứ, giờ bắt đầu và nhóm.
4. Khai báo nhân viên. Chọn kỹ năng, ngày nghỉ, giờ rảnh và giới hạn phút ca. Có thể tích các khoảng rảnh rời nhau.
5. Khai báo ca ứng viên và khoảng nghỉ. Ca phải nằm trọn trong giờ mở. Nhân viên phải rảnh cả phạm vi ca. Giờ nghỉ tính vào tổng phút ca và giới hạn tuần.
6. Bấm **Chạy xếp lịch**. Xem số cần, số đã xếp, biểu đồ theo ngày và nhóm, khoảng nghỉ và lịch phân công. CSV chỉ tải được khi có lịch khả thi và đầu vào chưa thay đổi.

Nút **Thay bằng cấu hình mẫu** dùng dữ liệu tổng hợp để minh họa và thay nội dung đang nhập.

## Nạp và xuất dữ liệu

- CSV/XLSX cần đúng cột `date,start,group_id,calls`. XLSX dùng một sheet tên `calls`. Các tệp được gửi nguyên bytes tới API. Hệ thống áp dụng giới hạn upload do backend cấu hình.
- ZIP trong chế độ lịch sử chỉ hỗ trợ hai thành phần `calls.csv`, `queues.csv` của [Database Sample](https://databasesample.com/datasets/call-centre-dataset-calls-agents-queues-and-abandonment). Đây là dữ liệu tổng hợp CC0. Backend xác minh hash khi nhập và trả nhóm, các quan sát và AHT khi có mẫu xử lý. Giờ mở, SLA, nhân viên và ca vẫn do người dùng cấu hình. Schedule API nhận lại các giá trị dưới dạng đầu vào của người gọi.
- Nút xuất lịch dùng API export. Mỗi dòng là một phân công làm việc 30 phút, cột thời lượng ca gồm cả nghỉ và được lặp lại theo từng dòng. Dùng tổng phút ca trên giao diện để đọc chi phí thời gian.

`npm.cmd test` chạy lint, unit tests và build.
