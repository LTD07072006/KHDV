# Technical Blueprint & Workflow Masterplan

**Dự án:** Xếp lịch ca làm việc cho trung tâm chăm sóc khách hàng  
**Thời lượng:** 8 tuần, 2 thành viên, làm song song  
**Kiến trúc:** Streamlit + Python domain modules + Google OR-Tools CP-SAT  
**Múi giờ mặc định:** Asia/Ho_Chi_Minh (+07:00)

> **Đặc tả INPUT đã chốt:** [B1_1_final_input_output_spec.md](D:/khdv/docs/B1_1_final_input_output_spec.md). Người dùng MVP nhập một workbook Excel gồm `NhuCau` và `NhanVien`; các tham số toán học, solver và JSON chỉ nằm ở backend/fixture.

> **Điều chỉnh cho BTL năm 3:** Đây là MVP học thuật để hai sinh viên hoàn thành, hiểu và demo được trong 8 tuần. Không cần production deployment, microservices, forecast ML phức tạp, multi-site, authentication, database phân tán hay benchmark quy mô lớn. MVP dùng một workbook Excel mẫu gồm sheet NhuCau và NhanVien, một nhóm Hỗ trợ chung, một ngày lập lịch và dashboard Streamlit đơn giản. Workbook/adapter là input người dùng; JSON fixture chỉ dùng nội bộ.

### Phạm vi tối thiểu phải làm

- MVP dùng nhu cầu dự kiến theo slot; forecast từ lịch sử nhiều tuần là luồng nâng cao sau khi MVP ổn. Không xây deep learning.
- Erlang C cho từng slot 30 phút với SLA cố định, ví dụ 80% trong 20 giây.
- OR-Tools CP-SAT với các hard constraint cốt lõi: ca 8 giờ có break 1 giờ, nghỉ 12 giờ, tối đa 5 ngày liên tiếp và skill.
- Shortage/overstaff là biến mềm để luôn có kết quả khi thiếu người.
- Giao diện có 3 vùng logic: nhập workbook/form đơn giản, xem target, xem Gantt + shortage.
- Mỗi thành viên viết unit test cho module của mình; chỉ cần 3–5 test integration từ JSON.

### Những phần để sau BTL

Forecast theo quantile nhiều mô hình, nhiều site/timezone, đăng nhập/phân quyền, database production, queue realtime, CI/CD cloud, lexicographic optimization nhiều pha, fairness nâng cao và tối ưu hiệu năng quy mô hàng nghìn nhân viên. Có thể ghi chúng vào mục “hướng phát triển”.

## 1. Mục tiêu và sản phẩm

Hệ thống nhận workbook nhu cầu dự kiến và nhân viên, chuẩn hóa theo mỗi 30 phút, tính staffing target bằng Erlang C, giải bài toán xếp ca và hiển thị Gantt tương tác. Luồng forecast lịch sử nhiều tuần được để sau MVP. Bản v1 phải trả được lịch khi nhu cầu vượt nguồn lực bằng shortage variables hoặc baseline fallback, đồng thời giải thích status, gap, thiếu/thừa người.

Kiến trúc dùng một ranh giới duy nhất: A phát hành SchedulingRequest JSON; B nhận JSON và phát hành SchedulingResult JSON. UI chỉ gọi adapter; solver không đọc DataFrame nội bộ của A. Hai thành viên có thể lập trình từ mock fixture ngay ngày 1.

## 2. Phân ranh giới theo chuyên môn

| Khu vực | Thành viên A | Thành viên B | Điểm giao |
|---|---|---|---|
| Ingest workbook, làm sạch, resample 30 phút | Chủ trì | Không sửa | demand trong request |
| Forecast lịch sử (advanced) / AHT | Chủ trì | Không sửa | fixture + provenance |
| Erlang C, SLA, occupancy, shrinkage | Chủ trì | kiểm thử biên | demand.erlang, required_agents |
| Candidate ca, CP-SAT, hard constraints | Không sửa | Chủ trì | shift_templates, rules |
| Objective shortage/overstaff/fairness | Không sửa | Chủ trì | objective |
| Streamlit, Plotly, upload/export | Chủ trì | Không sửa UI | result JSON |
| Schema và fixtures | request do A dẫn, result do B dẫn | cùng review | docs/contracts |
| Integration test | data/forecast | solver/constraint | serialized JSON |

A không quyết định ca nào được chọn; B không tự ý thay đổi Erlang target. Field mới phải được review và version hóa.

Quy ước ca: productive time 480 phút, đúng một break 60 phút, elapsed span 540 phút (ví dụ 08:00–17:00). Slot nằm trong break không tính coverage. Người dùng chọn ca mẫu thay vì nhập giờ tự do. Nghỉ giữa hai assignment tối thiểu 720 phút. Chuỗi làm việc tối đa 5 ngày theo ngày địa phương; request truyền lịch sử 6 ngày trước horizon khi chạy horizon nhiều ngày.

## 3. Data Contract v1.0.0

Schema đầy đủ:

- [scheduling-request.schema.json](/D:/khdv/docs/contracts/scheduling-request.schema.json)
- [scheduling-result.schema.json](/D:/khdv/docs/contracts/scheduling-result.schema.json)

Dùng JSON Schema Draft 2020-12. Timestamp phải ISO-8601 có offset, ví dụ 2026-11-02T08:00:00+07:00. Không nhận datetime naive. additionalProperties=false bắt typo sớm.

Các khóa nối request/result: request_id duy nhất và được echo; slot_id đại diện slot 30 phút; skill_id nối demand, employee và assignment; employee_id ổn định cho carry-out; template_id tham chiếu mẫu ca; contract_version là 1.0.0 và đổi semantics phải tăng major.

### Request nội bộ sau adapter

horizon có start/end và slot_minutes=30. slots được liệt kê tường minh. skills là danh mục chuẩn.

Mỗi demand là một cặp slot_id + skill_id và có:

- required_agents: target nguyên do A tính.
- priority: 1–100, dùng để ưu tiên shortage.
- forecast: expected_calls, aht_seconds, method, quantile.
- erlang: service_level, answer_within_seconds, max_occupancy, shrinkage_excluding_planned_breaks, offered_load_erlangs, net_agents.

employees có skill_ids, availability, max_scheduled_minutes_in_horizon (bội số 480), history gồm last_shift_end và 6 ngày trước, preferences. shift_templates có đúng một break 60 phút và allowed_skill_ids. rules chứa span 480, break 60, nghỉ 720, tối đa 5 ngày, tối đa một ca/ngày và allow_unassigned=true. objective dùng weighted_sum và trọng số integer. solver_options có time limit, số workers, seed và return_baseline_on_timeout.

Fixture mẫu (rút gọn):

~~~json
{
  "contract_version": "1.0.0",
  "request_id": "demo-2026-11-02",
  "timezone": "Asia/Ho_Chi_Minh",
  "horizon": {
    "start": "2026-11-02T00:00:00+07:00",
    "end": "2026-11-03T00:00:00+07:00",
    "slot_minutes": 30
  },
  "skills": [{"skill_id": "voice_vi", "label": "Thoại tiếng Việt"}],
  "slots": [{"slot_id": "2026-11-02T08:00", "start": "2026-11-02T08:00:00+07:00", "end": "2026-11-02T08:30:00+07:00"}],
  "demand": [{
    "slot_id": "2026-11-02T08:00", "skill_id": "voice_vi",
    "required_agents": 8, "priority": 100,
    "forecast": {"expected_calls": 24, "aht_seconds": 360, "method": "rolling_mean_4_weeks", "quantile": 0.8},
    "erlang": {"service_level": 0.8, "answer_within_seconds": 20, "max_occupancy": 0.85,
      "shrinkage_excluding_planned_breaks": 0.15, "offered_load_erlangs": 4.8, "net_agents": 8}
  }],
  "employees": [{
    "employee_id": "e001", "label": "NV 001", "skill_ids": ["voice_vi"],
    "availability": [{"start": "2026-11-02T08:00:00+07:00", "end": "2026-11-02T17:00:00+07:00"}],
    "max_scheduled_minutes_in_horizon": 480,
    "history": {"last_shift_end": null, "previous_local_days": [
      {"date": "2026-10-27", "worked": false}, {"date": "2026-10-28", "worked": false},
      {"date": "2026-10-29", "worked": false}, {"date": "2026-10-30", "worked": false},
      {"date": "2026-10-31", "worked": false}, {"date": "2026-11-01", "worked": false}]},
    "preferences": [{"template_id": "day_0800", "penalty": 0}]
  }],
  "shift_templates": [{
    "template_id": "day_0800", "start": "2026-11-02T08:00:00+07:00", "end": "2026-11-02T17:00:00+07:00",
    "breaks": [{"start": "2026-11-02T12:00:00+07:00", "end": "2026-11-02T13:00:00+07:00"}],
    "allowed_skill_ids": ["voice_vi"]
  }],
  "rules": {"shift_span_minutes": 480, "break_minutes": 60, "min_rest_minutes": 720,
    "max_consecutive_workdays": 5, "max_shifts_per_local_day": 1, "allow_unassigned": true},
  "objective": {"mode": "weighted_sum", "shortage_weight": 10000, "overstaff_weight": 10,
    "assignment_weight": 1, "preference_weight": 2, "fairness_weight": 1},
  "solver_options": {"time_limit_seconds": 30, "num_search_workers": 4,
    "random_seed": 42, "return_baseline_on_timeout": true}
}
~~~

### Result

SchedulingResult luôn có solver_status, solution_source, has_solution, optimality_proven, assignments, coverage, metrics, diagnostics và carry_out.

- SUCCESS + OPTIMAL: chứng minh tối ưu.
- SUCCESS + FEASIBLE: có solution, chưa chứng minh tối ưu.
- DEGRADED + BASELINE: timeout hoặc chưa hội tụ nhưng baseline hợp lệ.
- INVALID_INPUT: schema/liên trường sai.
- ERROR: lỗi runtime.

coverage là nguồn sự thật: shortage_agents=max(required-scheduled,0), overstaff_agents=max(scheduled-required,0). Result có solution phải có hard_constraint_violations=0. metrics ghi wall time, objective components, bound và relative gap.

### Validate

1. Validate JSON Schema trước khi tạo domain objects.
2. Validate slot trong horizon, đúng bước 30 phút; demand có slot/skill; template span 480 phút, break 60 phút; availability hợp lệ.
3. Validate Erlang: offered_load_erlangs = expected_calls * aht_seconds / 1800; target đã áp dụng rounding policy.
4. B trả INVALID_INPUT với JSON Pointer trong diagnostics.path, không ném exception lên UI.

## 4. Module A — Forecast và Erlang C

> Trong MVP, B phát hành demand từ workbook dự kiến. Forecast rolling mean từ lịch sử nhiều tuần là nhánh advanced; không bắt người dùng cấu hình lookback/backtest/outlier trong luồng chính.

Pipeline:

1. Ingest workbook `NhuCau` + `NhanVien`; kiểm tra sheet/cột, duplicate, missing và khung giờ.
2. Normalize tên nhóm, phút và khung giờ về timezone request, resample 30 phút.
3. MVP dùng số cuộc gọi dự kiến trực tiếp; advanced mới forecast rolling mean/median theo weekday và time-of-day.
4. Offered load = calls trong slot * AHT giây / 1800.
5. Erlang C: với A Erlang và N agent, tính xác suất chờ Pw; service level = 1 - Pw * exp(-(N-A) * target_seconds / AHT); tăng N đến SLA và occupancy cap.
6. Shrinkage s: ceil(required_before_shrinkage / (1-s)). Break kế hoạch do solver xử lý, không cộng lại vào shrinkage.
7. Emit slots, demand, candidate templates và request fixture; lưu input, công thức và rounding policy.

Test A: A=0; monotonicity theo volume/AHT/SLA; ngưỡng SLA/occupancy; volume/AHT cực đại; SLA 0.99; target vượt cap; đối chiếu bảng tính độc lập.

## 5. Module B — OR-Tools CP-SAT

### Biến và ràng buộc

Candidate a=(employee e, template t, skill k) chỉ tạo khi employee có skill, template cho skill và availability bao phủ ca.

- x[e,t,k] nhị phân: chọn assignment.
- cover[s,k]: assignment active trong slot, trừ break.
- shortage[s,k] và overstaff[s,k] không âm với phương trình cover + shortage - overstaff = required.
- worked[e,d] nhị phân; cửa sổ 6 ngày có tổng worked <= 5.
- load_minutes[e] và deviation[e] cho giới hạn/fairness.

Hard constraints: tối đa một ca mỗi employee mỗi ngày; availability và skill hợp lệ; span 480 và break 60; hai ca cách nhau >=720 phút; mọi cửa sổ 6 ngày kể cả history không vượt 5 ngày làm; không vượt max_scheduled_minutes; không skill mismatch.

Shortage là soft variable, không phải hard constraint. Do đó mô hình khả thi khi thiếu người.

Objective:

~~~text
min shortage_weight * sum(priority * shortage)
  + overstaff_weight * sum(overstaff)
  + assignment_weight * sum(x)
  + preference_weight * sum(preference_penalty * x)
  + fairness_weight * sum(deviation)
~~~

Trọng số khởi đầu: shortage 10000, overstaff 10, assignment 1, preference 2, fairness 1. Nếu shortage phải tuyệt đối ưu tiên, chạy lexicographic 2 pha: tối thiểu shortage, cố định optimum, rồi tối thiểu phần còn lại.

Khi timeout hoặc UNKNOWN, B chạy baseline deterministic first-fit, kiểm hard constraints, tính coverage và trả solution_source=BASELINE, status=DEGRADED. Nếu baseline không hợp lệ do input, trả has_solution=false.

Chống solve lâu/OOM: prune candidate theo skill/availability/horizon/max minutes; gộp template trùng; time limit 30–120 giây; 4 workers; seed cố định; cảnh báo demand > capacity; tạo biến theo employee-template; warm-start hints; ghi wall time, bound, gap.

## 6. Workflow 8 tuần — phiên bản phù hợp sinh viên năm 3

### Tuần 1 — Chốt đề bài và chạy được ví dụ nhỏ

**A:** tạo fixture workbook 1 ngày, 1 nhóm, 24 slot; viết loader nhu cầu và hàm Erlang C bản đơn giản với SLA mặc định.

**B:** tạo dữ liệu 5–10 nhân viên với cột `di_lam/ca_sang/ca_giua/ca_muon` và 2–3 mẫu ca; viết CP-SAT toy với target nội bộ; in lịch ra terminal.

**Hội quân H1:** thống nhất workbook non-IT, adapter và 10 field JSON tối thiểu (request_id, slots, demand, employees, templates, rules, objective); bỏ input kỹ thuật khỏi UI. **Đầu ra:** cả hai chạy được mock mà không chờ nhau.

### Tuần 2 — Hoàn thiện hai module riêng

**A:** hoàn thiện adapter từ workbook và target Erlang C; viết 3 test: volume bằng 0, volume tăng, target là số nguyên.

**B:** thêm assignment theo employee/template, coverage theo slot, availability từ ca mẫu, một ca/ngày và break.

**Hội quân H2:** A xuất một request JSON; B đọc JSON và trả result JSON. Chưa cần UI đẹp.

### Tuần 3 — Thêm ràng buộc bắt buộc và biến phạt

**A:** thêm cấu hình SLA/AHT và bảng target; xử lý dữ liệu thiếu bằng quy tắc đơn giản (điền 0 hoặc trung bình).

**B:** thêm nghỉ tối thiểu 12 giờ, tối đa 5 ngày liên tiếp, shortage và overstaff. Dùng trọng số shortage lớn hơn overstaff.

**Hội quân H3:** chạy hai ca kiểm thử: đủ người và thiếu người. Trường hợp thiếu người phải trả lịch + số thiếu, không trả lỗi vô nghiệm.

### Tuần 4 — Ghép pipeline tối thiểu

**A:** làm Streamlit page nhập workbook/form non-IT và nút “Tạo lịch”; hiển thị bảng nhu cầu/target.

**B:** đóng gói `solve(request)` và timeout khoảng 30 giây; nếu timeout, trả nghiệm hiện có hoặc baseline greedy đơn giản.

**Hội quân H4:** nút “Tạo lịch” chạy được từ UI → workbook adapter → request JSON → solver → result JSON.

### Tuần 5 — Gantt và giải thích kết quả

**A:** vẽ Plotly Gantt theo employee; thêm bảng required/scheduled/shortage/overstaff; thêm nút tải CSV.

**B:** bổ sung status OPTIMAL/FEASIBLE/DEGRADED, objective value và 3 cảnh báo dễ hiểu: thiếu người, skill không khớp, timeout.

**Hội quân H5:** đối chiếu bằng tay 3–5 assignment trên Gantt; xác nhận break không bị tính là coverage.

### Tuần 6 — Kiểm thử theo kịch bản BTL

**A:** tạo 4 fixture: bình thường, peak, thiếu dữ liệu, thiếu nhân viên; hoàn thiện thông báo lỗi tiếng Việt.

**B:** viết kiểm tra hard constraint; chạy 4 fixture; sửa các lỗi model thay vì mở rộng tính năng.

**Hội quân H6:** chốt bộ kết quả dùng trong báo cáo: target, lịch, shortage, thời gian chạy và ảnh dashboard.

### Tuần 7 — Viết báo cáo và ổn định demo

**A:** viết phần dữ liệu, forecast, Erlang C, giao diện; chuẩn bị demo script 5–7 phút.

**B:** viết phần mô hình ILP/CP-SAT, biến quyết định, ràng buộc, objective, penalty; chụp log solver.

**Hội quân H7:** chạy demo trên máy sạch, sửa lỗi cài đặt/import, khóa dữ liệu mẫu và seed.

### Tuần 8 — Hoàn thiện BTL

**A:** hoàn thiện UI, biểu đồ và export; kiểm tra chính tả, nhãn, đơn vị phút/giây.

**B:** hoàn thiện bảng kết quả và giải thích khi thiếu người; kiểm tra lại các constraint cứng.

**Hội quân H8:** chạy full demo, lưu source/fixture/README, phân công phần thuyết trình và chuẩn bị câu hỏi phản biện.

## 7. Rủi ro kỹ thuật và giảm thiểu (mức BTL)

### R1 — Erlang target quá cao

Forecast peak/AHT hoặc shrinkage nhân đôi làm target vượt capacity và mô hình phình to. A ghi công thức/rounding; B pre-check capacity, prune candidate, chunk horizon, time limit, workers, shortage variables và baseline fallback. UI báo target, capacity, wall time và gap.

Trong phạm vi BTL, không cần chunk horizon hay benchmark lớn. Chỉ cần giới hạn 1–7 ngày, khoảng 5–30 nhân viên, time limit 30 giây và cảnh báo khi tổng target lớn hơn tổng nhân viên khả dụng.

### R2 — Sai break/timezone

Ca 8 giờ bị hiểu thành 8 giờ làm cộng nghỉ; slot qua nửa đêm hoặc break vẫn tính coverage. Ép timestamp offset, schema span/break, một hàm is_productive(employee, slot), golden case 08:00–17:00 nghỉ 12:00–13:00 và hiển thị timezone.

### R3 — Skill/availability và solver status mismatch

Demand không có skill phù hợp, availability hở, history bị bỏ qua, hoặc UI coi FEASIBLE là OPTIMAL. Validate liên trường; candidate chỉ tạo khi đủ điều kiện; giữ hard constraints; diagnostics theo slot/skill/employee; phân biệt OPTIMAL/FEASIBLE/BASELINE/INVALID_INPUT.

## 8. Kiểm thử và nghiệm thu tối giản

Chỉ cần ba nhánh hoặc thư mục làm việc rõ ràng: `member-a`, `member-b`, `integration`. Không cần CI/CD cloud; có thể chạy một script `python -m pytest` trước mỗi lần hội quân. Shared changes gồm schema, fixture và README.

Với mọi result có solution: assignment tham chiếu entity hợp lệ; không hai ca cùng ngày; nghỉ >=12 giờ; không 6 ngày làm liên tiếp; break đúng 60 phút; scheduled + shortage - overstaff = required; shortage/overstaff đúng max; hard violations = 0.

| Kịch bản | Kỳ vọng |
|---|---|
| Đủ nhân lực | OPTIMAL/FEASIBLE, shortage = 0 |
| Demand > capacity | lịch khả thi, shortage > 0, không INFEASIBLE vì shortage |
| Không skill phù hợp | INVALID_INPUT hoặc shortage toàn bộ, diagnostics rõ |
| Peak 1–2 slot | ưu tiên phủ theo priority |
| Timeout | FEASIBLE hoặc BASELINE, có gap/wall time |
| History 5 ngày | không assignment thứ 6 liên tiếp |
| Timestamp naive/lệch 30 phút | INVALID_INPUT + JSON Pointer |

Demo 5–7 phút: tải workbook mẫu → xem bảng nhu cầu/target → Tạo lịch → xem Gantt/break → mở scenario thiếu người → chỉ ra shortage và tải CSV kết quả. JSON audit có thể trình bày trong phụ lục, không cần xây màn hình riêng.

## 9. Cấu trúc thư mục

~~~text
app.py
src/
  data_pipeline/       # A
  erlang/              # A
  scheduling_contract/ # shared
  solver/              # B
  dashboard/            # A
docs/
  Technical_Blueprint_Workflow_Masterplan.md
  contracts/
    scheduling-request.schema.json
    scheduling-result.schema.json
tests/
  fixtures/request_demo.json
  fixtures/result_demo.json
  test_erlang_properties.py
  test_solver_constraints.py
  test_contract_roundtrip.py
~~~

A có thể hoàn thiện producer từ request schema/fixture; B hoàn thiện consumer/solver từ cùng fixture; integration chỉ bắt đầu sau H1 và lặp lại tại H2–H8.
