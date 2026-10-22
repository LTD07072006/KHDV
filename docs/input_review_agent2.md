> **Trạng thái:** Tài liệu lịch sử/phân tích. Quyết định đang áp dụng nằm trong [B1_1_final_input_output_spec.md](D:/khdv/docs/B1_1_final_input_output_spec.md). Không dùng các ví dụ cũ trong file này để thiết kế UI MVP.

# Agent 2 — Phản biện INPUT dưới góc OR / SAT / CP-SAT

> Bản thay thế tuần tự do backend không khởi chạy được agent phụ.

## 1. Kết luận nhanh

Đề xuất của Agent 1 đúng về các nhóm dữ liệu, nhưng cần sửa một nguyên tắc: **INPUT của CP-SAT phải là một snapshot đã được chuẩn hóa và đóng băng**, không phải tập tùy chọn mơ hồ. Người dùng có thể nhập nhiều nguồn, nhưng trước khi tạo model phải biến chúng thành một `SchedulingRequest` hợp lệ duy nhất.

Tách rõ ba lớp:

1. **Raw input:** call log, employee file, form.
2. **Derived input:** forecast, AHT, demand, candidate shift instances, normalized availability.
3. **Solver output:** assignment, coverage, shortage, status.

Nếu không tách ba lớp, người dùng có thể nhập đồng thời call log, required_agents và forecast khiến hệ thống không biết nguồn sự thật nào được ưu tiên.

## 2. Phản biện từng nhóm INPUT

### 2.1. Call log

Nên giữ `timestamp_arrival` và `call_duration_seconds` cho MVP. `abandoned` cần quy định rõ semantics: abandoned có được tính vào volume hay không. Không được để code tự ngầm hiểu khác với báo cáo.

`timestamp_answered` và `wait_seconds` là dữ liệu hữu ích để đánh giá SLA thực tế, nhưng không cần cho CP-SAT. Nếu cả hai cùng nhập, chọn một nguồn sự thật và kiểm tra:

```text
wait_seconds = timestamp_answered - timestamp_arrival
```

`call_id` nên bắt buộc trong dữ liệu production/demo có audit; có thể optional chỉ trong fixture nhanh.

`skill_id` không nên chỉ là “nên có” khi hệ thống đã công bố hỗ trợ nhiều skill. Quy tắc chốt:

- Một skill: hệ thống tự gán skill mặc định và hiện cảnh báo.
- Nhiều skill: `skill_id` bắt buộc ở mọi dòng hoặc phải có mapping queue → skill.
- Không cho phép một dòng vừa có `skill_id` vừa có nhiều skill không rõ ràng.

Không nên nhận trực tiếp cột `required_agents` trong cùng call log. Đó là derived demand, không phải event-level input.

### 2.2. Nhân viên

`employee_id`, skills và availability là dữ liệu thực sự cần để sinh candidate. `label` chỉ phục vụ UI, không tham gia model; có thể tự suy ra từ employee_id nếu trống.

`contracted_hours` và `max_scheduled_minutes_in_horizon` là hai cách biểu diễn cùng một giới hạn. Không nhận cả hai cùng lúc trừ khi có quy tắc kiểm nhất quán:

```text
max_scheduled_minutes = floor(contracted_hours × 60 / 480) × 480
```

Đề xuất contract chỉ giữ `max_scheduled_minutes_in_horizon`; UI có thể cho nhập contracted hours rồi suy ra field chuẩn.

`availability` phải là các interval cụ thể, vì CP-SAT cần biết candidate nào được phép tạo. Không thể chỉ nhập “full-time” hoặc “ca ngày” rồi mong solver tự hiểu nếu chưa có mapping template.

`previous_local_days` không phải dữ liệu để tối ưu trực tiếp; nó là state đầu vào cho constraint max consecutive. Với horizon 1 ngày, chỉ cần số ngày đã làm liên tiếp tính đến ngày trước horizon và `last_shift_end`; với horizon 7 ngày, giữ 6 ngày dạng boolean là rõ nhất.

`preferences` nên là penalty số nguyên trên `(employee, template)`. Không nhập văn bản tự do như “thích ca sáng”, vì CP-SAT không xử lý semantics đó nếu chưa map thành penalty.

### 2.3. Skills

Danh mục skill là cần thiết nếu có phân skill. Phải có kiểm tra mọi `demand.skill_id`, `employee.skill_ids` và `template.allowed_skill_ids` đều tham chiếu cùng một danh mục.

### 2.4. Horizon và slot

`slot_minutes=30` nên cố định trong MVP. Cho người dùng nhập 15/20/60 phút sẽ tạo thêm logic coverage, break và rounding mà chưa cần thiết.

Horizon phải là khoảng thời gian có thứ tự và timezone rõ. Nếu horizon nhiều ngày, slot_id phải duy nhất toàn horizon; không dùng chỉ `08:00` làm ID.

### 2.5. SLA/Erlang

`service_level`, `answer_within_seconds`, `max_occupancy` và `shrinkage` là input của bước demand generation, không phải biến CP-SAT thuần.

Đặc biệt, `shrinkage` phải ghi rõ break kế hoạch đã loại ra chưa. Nếu break vừa nằm trong template vừa bị tính trong shrinkage, target bị phồng hai lần.

`forecast_method` nên là enum đã triển khai (`rolling_mean`, `weekday_time_mean`), không cho nhập text tự do. `quantile` chỉ nên xuất hiện khi code thực sự tính quantile; MVP baseline có thể để null.

### 2.6. Shift templates

Đây là nơi Agent 1 cần chỉnh mạnh. Template không nên gắn timestamp của một ngày cụ thể nếu dùng horizon nhiều ngày. Tách:

- **Template pattern:** `template_id`, local start time, local end time, local break intervals, allowed skills.
- **Shift instance:** pattern được instantiate cho một `local_date` trong horizon.

Ví dụ pattern `day_0800` có start 08:00, end 17:00, break 12:00–13:00; hệ thống tự tạo instance cho từng ngày. Chỉ shift instance mới có timestamp đầy đủ.

CP-SAT cần span và break kiểm được bằng số phút nguyên. Validate:

```text
end - start = 540 elapsed minutes
break duration = 60
productive minutes = 480
```

Nếu schema gọi `shift_span_minutes=480` nhưng start–end là 540 phút, semantics đang mâu thuẫn. Cần chốt tên:

- `productive_minutes=480`
- `elapsed_span_minutes=540`
- `break_minutes=60`

Hoặc giữ contract cũ nhưng ghi rõ `shift_span_minutes` là productive minutes và validator kiểm elapsed span = 540. Không được để solver hiểu 480 là end-start trong khi ví dụ lại là 08:00–17:00.

### 2.7. Rules

Các rules cốt lõi nên là policy đã kiểm thử, không phải input tự do trong MVP. Người dùng có thể chọn profile:

- `standard`: 8 giờ productive, break 60, rest 12 giờ, tối đa 5/6 ngày.
- `part_time`: giới hạn phút khác.

Cho sửa số tùy ý làm thay đổi search space và có thể tạo ca không tương thích với contract. Nếu vẫn cho sửa, phải validate trước khi tạo model và ghi contract version.

### 2.8. Direct demand fixture

Nên giữ như một **chế độ loại trừ** với call log:

- `mode=forecast`: call log là nguồn demand, hệ thống tính forecast/Erlang.
- `mode=direct_demand`: demand đã biết, bỏ qua forecast/Erlang.

Không cho phép nhập cả hai rồi trộn ngầm. Direct demand rất hữu ích để test CP-SAT và các case thiếu người, nhưng không nên hiện trong luồng demo người dùng thường.

## 3. Những INPUT cần suy ra thay vì bắt nhập

CP-SAT không cần người dùng nhập:

- `offered_load_erlangs` — suy ra từ expected calls và AHT.
- `required_agents` — suy ra từ Erlang C trong forecast mode.
- shift instances — sinh từ template pattern + ngày trong horizon.
- `cover[a, slot, skill]` — tính từ assignment candidate và break.
- shortage/overstaff — biến model.
- objective value, bound, gap — output solver.

Nếu người dùng nhập một derived field để override, phải có cờ `source=manual` và không được đồng thời tính lại tự động.

## 4. Validation tối thiểu trước CP-SAT

### Contract

- Validate JSON Schema trước domain objects.
- `additionalProperties=false` để bắt typo.
- IDs duy nhất và tham chiếu hợp lệ.
- Timestamp có offset và cùng timezone sau normalize.

### Dữ liệu

- Horizon start < end; slot 30 phút; slot nằm trong horizon.
- Demand có đúng một skill và slot tồn tại.
- Không có employee duplicate.
- Availability start < end, không mâu thuẫn với max minutes.
- Mẫu ca productive 480 + break 60; break nằm trong ca.
- Template allowed skills tồn tại.
- `required_agents >= 0`, priority trong 1–100.
- SLA trong (0,1], AHT > 0 khi volume > 0, shrinkage trong [0,1).

### Mô hình

- Candidate chỉ tạo khi employee có skill, template cho skill, availability bao phủ shift instance.
- Một employee tối đa một assignment mỗi local date.
- Các cặp assignment cùng employee có rest đủ 720 phút.
- Mọi cửa sổ 6 ngày có tổng worked ≤ 5, tính cả history trước horizon.
- `cover + shortage - overstaff = required` cho từng slot/skill.
- Mọi result có assignment phải được validator độc lập kiểm lại.

## 5. Bản INPUT cải tiến đề xuất

### Chế độ A — Forecast mode (MVP)

**Upload 1: `call_logs.csv`**

```text
call_id,timestamp_arrival,call_duration_seconds,abandoned,skill_id
```

`skill_id` optional chỉ khi hệ thống bật đúng một skill mặc định; bắt buộc nếu nhiều skill.

**Upload 2: `employees.csv` hoặc JSON**

```text
employee_id,skill_ids,availability_start,availability_end,max_scheduled_minutes
```

Nhiều interval availability dùng nhiều dòng cùng employee hoặc JSON array. History có thể là JSON phụ/field trạng thái trong MVP 1 ngày.

**Form cấu hình**

- horizon date/start/end, timezone.
- SLA và answer-within.
- shrinkage, occupancy.
- profile template ca, hoặc upload shift pattern.
- profile rules standard.

### Chế độ B — Direct-demand test mode

**Upload `demand.json`** gồm slot, skill, required_agents, priority; không nhận call log trong cùng run.

**Upload employees + templates + rules** như mode A.

Dùng cho unit/integration test, peak và thiếu người.

### Chế độ C — Full contract mode

Developer upload trực tiếp `SchedulingRequest v1.0.0`; hệ thống chỉ validate rồi gọi solver. Không nên đưa lên UI chính của người dùng.

## 6. Phán quyết cho các câu hỏi Agent 1

1. **Availability:** bắt buộc ở dạng interval chuẩn; có thể cho UI nhập availability theo template nhưng phải expand thành interval trước solver.
2. **Contracted hours vs max minutes:** chỉ giữ một canonical field; UI có thể nhận contracted hours rồi suy ra max minutes.
3. **Rules sửa tự do:** không trong MVP; dùng profile đã kiểm thử.
4. **Multi-skill:** mỗi assignment phải gắn một skill; một employee không thể cover hai skill cùng slot nếu chưa có capacity fraction được mô hình hóa.
5. **Template nhiều ngày:** pattern không có ngày; instantiate thành shift instance theo local date.
6. **Direct required_agents:** cho phép chỉ trong direct-demand mode, loại trừ call-log forecast mode.
7. **Feasibility validation:** shortage là soft nên demand cao không làm infeasible; chỉ lỗi domain/constraint cứng mới trả INVALID_INPUT hoặc ERROR.

## 7. Các chỉnh sửa cần đưa vào schema/code trước khi triển khai UI

1. Chốt semantics productive minutes versus elapsed span; ví dụ 08:00–17:00 cần productive 480, elapsed 540.
2. Đổi template từ timestamp cố định sang pattern + ngày instantiate, hoặc thêm rõ `local_start_time`/`local_end_time`.
3. Thêm `input_mode` (`forecast` hoặc `direct_demand`) để tránh trộn nguồn demand.
4. Đưa skill vào pipeline forecast; nếu không có skill, ghi `default_skill_id` rõ ràng.
5. Canonicalize employee limit thành `max_scheduled_minutes_in_horizon`.
6. Thêm validator consistency cho `timestamp_answered`, `wait_seconds`, `abandoned`.
7. Giữ direct-demand fixture ngoài màn hình chính nhưng bắt buộc cho test solver.
