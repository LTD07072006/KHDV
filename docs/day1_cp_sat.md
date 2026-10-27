# Ngày 1 — CP-SAT MVP

Module ngày 1 nằm ở [`day1_cp_sat.py`](../day1_cp_sat.py). Module nhận dữ liệu nghiệp vụ tối giản cho một ngày và một nhóm `Hỗ trợ chung`:

- `planning_date` dạng `YYYY-MM-DD`.
- `slots`: các khoảng 30 phút với `required_agents`.
- `employees`: mã, tên, trạng thái đi làm và các ca được phép (`ca_ngay`, `ca_dem`).

Hai ca đã cấu hình sẵn:

| Ca | Khoảng | Nghỉ |
|---|---|---|
| Ca ngày | 08:00–20:00 | 12:00–13:00 |
| Ca đêm | 20:00–08:00 ngày hôm sau | 00:00–01:00 |

## Cài đặt

```powershell
python -m pip install -r requirements-day1.txt
```

## Chạy demo

```powershell
python day1_demo.py
```

Demo có hai trường hợp:

1. Đủ người: solver trả `OPTIMAL`, shortage bằng 0.
2. Thiếu người: solver vẫn trả lịch, đồng thời báo shortage theo từng slot.

## Chạy test

```powershell
python -m unittest -v test_day1_cp_sat.py
```

## Ràng buộc và mục tiêu hiện tại

- Mỗi nhân viên tối đa một ca trong ngày.
- Chỉ chọn ca mà nhân viên được phép nhận.
- Slot nằm trong break không tính coverage.
- Thiếu người và dư người là biến mềm.
- Mục tiêu ưu tiên giảm shortage, sau đó giảm overstaff và số assignment.

Đây là solver ngày 1 để kiểm chứng mô hình. Bước tiếp theo sẽ đổi adapter để phát hành `SchedulingRequest v1.0.0` đầy đủ và nối result vào API/frontend.
