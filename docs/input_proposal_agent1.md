> **Trạng thái:** Tài liệu lịch sử/phân tích. Quyết định đang áp dụng nằm trong [B1_1_final_input_output_spec.md](D:/khdv/docs/B1_1_final_input_output_spec.md). Không dùng các ví dụ cũ trong file này để thiết kế UI MVP.

# Agent 1 — Đề xuất INPUT cho hệ thống xếp lịch call center

> Bản thay thế tuần tự do backend không khởi chạy được agent phụ.

## 1. Nguyên tắc thiết kế

Người dùng không nên nhập trực tiếp tất cả biến của mô hình. INPUT chỉ gồm dữ liệu nghiệp vụ người dùng biết; các giá trị như offered load, required agents, coverage, shortage và objective value do hệ thống suy ra.

Hệ thống nên có hai chế độ:

- **MVP dễ dùng:** upload call log + danh sách nhân viên + chọn tham số SLA/rules trên form.
- **Chế độ nâng cao/test:** upload `SchedulingRequest` JSON đầy đủ để kiểm tra solver bằng fixture.

## 2. Danh mục INPUT đề xuất

### 2.1. Call log lịch sử — bắt buộc cho luồng forecast

Định dạng: CSV.

| Field | Bắt buộc | Đơn vị/kiểu | Ý nghĩa |
|---|---:|---|---|
| `timestamp_arrival` | Có | ISO-8601 có offset | Thời điểm cuộc gọi đến |
| `call_duration_seconds` | Có | số nguyên dương | AHT của cuộc gọi, tính bằng giây |
| `abandoned` | Không | boolean | Cuộc gọi bị bỏ trước khi xử lý |
| `call_id` | Nên có | chuỗi duy nhất | Kiểm tra duplicate và audit |
| `skill_id` | Nên có khi nhiều skill | chuỗi | Kỹ năng/queue cần xử lý |
| `channel` | Tùy chọn | voice/chat/email | Kênh phục vụ |
| `timestamp_answered` | Tùy chọn | ISO-8601 | Thời điểm bắt máy |
| `wait_seconds` | Tùy chọn | số | Thời gian khách chờ |

MVP có thể chạy với ba cột đầu tiên (trong đó `abandoned` là tùy chọn). Khi có nhiều skill, bắt buộc thêm `skill_id`; nếu không, hệ thống chỉ được phép tạo một skill mặc định và phải cảnh báo.

Validation:

- Không có CSV rỗng; cột bắt buộc phải tồn tại.
- Timestamp parse được, cùng timezone hoặc được chuẩn hóa về timezone request.
- `call_id` không trùng nếu có.
- AHT không âm; dòng AHT bằng 0 chỉ được giữ cho abandoned hoặc bị loại khỏi tính AHT.
- Không tự coi cột `calls`/`required_agents` là call log cấp cuộc gọi nếu chưa chọn chế độ dữ liệu tổng hợp.

### 2.2. Nhân viên — bắt buộc cho bước xếp lịch

Định dạng đề xuất: CSV dễ nhập hoặc JSON chuẩn hóa nội bộ. UI có thể cho upload một file CSV và chuyển thành domain object.

Các field nghiệp vụ:

| Field | Bắt buộc | Ý nghĩa |
|---|---:|---|
| `employee_id` | Có | Mã duy nhất |
| `label` | Có | Tên hiển thị |
| `skill_ids` | Có | Các skill nhân viên có |
| `availability` | Có trong contract | Khoảng thời gian có thể làm |
| `max_scheduled_minutes_in_horizon` | Có | Giới hạn phút trong horizon |
| `last_shift_end` | Nên có | Kết thúc ca trước horizon để kiểm rest |
| `previous_local_days` | Có cho horizon nhiều ngày | Lịch sử 6 ngày trước để kiểm max 5/6 ngày |
| `preferences` | Tùy chọn | Phạt/ưu tiên mẫu ca |

CSV dễ nhập có thể tách availability thành `available_start`, `available_end`; nhiều khoảng availability dùng nhiều dòng cùng `employee_id`. JSON request dùng mảng `availability`.

Validation:

- `employee_id` duy nhất.
- Mọi `skill_id` tham chiếu danh mục skill.
- Availability có start < end và nằm trong horizon hoặc được cắt theo policy.
- Giới hạn phút không âm và phù hợp với độ dài ca.
- Lịch sử có đủ 6 ngày địa phương nếu dùng constraint chuỗi ngày.

### 2.3. Danh mục skill — bắt buộc khi có phân skill

Định dạng: form nhỏ hoặc JSON.

```json
[{"skill_id":"voice_vi","label":"Thoại tiếng Việt"}]
```

MVP có thể dùng một skill mặc định `voice_vi`; khi có từ hai skill trở lên phải nhập rõ demand theo skill.

### 2.4. Horizon và time settings — bắt buộc

Định dạng: form.

- `timezone`: mặc định `Asia/Ho_Chi_Minh`.
- `horizon_start`, `horizon_end`.
- `slot_minutes`: MVP cố định 30, không cho nhập tùy ý nếu chưa hỗ trợ bước khác.
- Khung hoạt động hoặc service window, ví dụ 08:00–20:00.

Validation: start < end; timestamp có offset; slot chia hết horizon; slot nằm đúng bước 30 phút.

### 2.5. Tham số phục vụ — bắt buộc với forecast/Erlang

Định dạng: form.

| Field | Mặc định demo | Ý nghĩa |
|---|---:|---|
| `service_level` | 0.80 | Tỷ lệ đạt SLA |
| `answer_within_seconds` | 20 | Ngưỡng trả lời |
| `max_occupancy` | 0.85 | Occupancy tối đa |
| `shrinkage_excluding_planned_breaks` | 0 hoặc 0.15 | Tỷ lệ không sẵn sàng ngoài break |
| `forecast_method` | rolling mean | Phương pháp forecast |
| `forecast_history_policy` | weekday + time-of-day | Cách gom lịch sử |

Nếu người dùng nhập trực tiếp `required_agents`, các tham số forecast/Erlang có thể bỏ qua cho chế độ test solver; không được dùng lẫn lộn mà không ghi rõ nguồn.

### 2.6. Mẫu ca — bắt buộc cho solver

Định dạng: form hoặc JSON.

Mỗi template gồm:

- `template_id`.
- `start`, `end`.
- đúng một break 60 phút trong MVP.
- `allowed_skill_ids`.

MVP khuyến nghị cung cấp sẵn 2–3 template; người dùng chỉ chọn/bật template thay vì tự nhập mọi timestamp.

### 2.7. Rules — form có giá trị mặc định

- `shift_span_minutes=480`.
- `break_minutes=60`.
- `min_rest_minutes=720`.
- `max_consecutive_workdays=5`.
- `max_shifts_per_local_day=1`.
- `allow_unassigned=true`.

Không nên cho người dùng sửa tự do các rules cốt lõi trong demo nếu việc sửa làm sai semantics của solver; chỉ cho chọn policy đã được kiểm thử.

### 2.8. Direct demand fixture — tùy chọn nâng cao

Định dạng: JSON theo `slot_id + skill_id + required_agents + priority`.

Dùng cho test solver, peak, thiếu người và kiểm constraint. Trong luồng người dùng bình thường, `required_agents` phải do forecast + Erlang C suy ra.

## 3. Những thứ không phải INPUT người dùng

Hệ thống tự tính:

- `offered_load_erlangs`.
- `net_agents`/`required_agents` nếu đi qua forecast.
- `scheduled_agents`, `shortage_agents`, `overstaff_agents`.
- solver status, objective value, bound, gap.
- assignments và coverage.

## 4. MVP đề xuất

Luồng MVP có ba input:

1. `call_logs.csv` với `timestamp_arrival`, `call_duration_seconds`, optional `abandoned`.
2. `employees.csv`/`employees.json` với employee, skill, availability và giới hạn phút.
3. Form: horizon, SLA 80%/20 giây, timezone, 1–2 template ca và rules mặc định.

MVP chỉ nên bật một skill trước; thêm nhiều skill sau khi end-to-end một skill đã ổn. Chế độ upload JSON request dùng cho developer fixture, không phải màn hình chính.

## 5. Các điểm cần Agent 2 phản biện

1. Có nên bắt buộc người dùng nhập `availability` chi tiết hay suy ra từ template/ngày làm?
2. Có nên nhập `max_scheduled_minutes_in_horizon` hay chỉ nhập contracted hours rồi suy ra?
3. Có nên cho phép sửa `min_rest`, `max_consecutive` trong UI không?
4. Cách xử lý nhân viên đa skill để không đếm một người hai lần trong cùng slot.
5. Cách biểu diễn template lặp theo nhiều ngày mà không gắn timestamp cố định một ngày.
6. Có nên cho phép input `required_agents` trực tiếp cùng call log hay tách thành hai chế độ.
7. Bộ validation tối thiểu để request luôn tạo được mô hình CP-SAT khả thi.
