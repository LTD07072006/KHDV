# Workflow chính thống nhất cho BTL: Xếp lịch ca trung tâm chăm sóc khách hàng

> **Nguồn sự thật về INPUT:** xem [B1_1_final_input_output_spec.md](D:/khdv/docs/B1_1_final_input_output_spec.md). Tài liệu này thay thế các mô tả cũ về upload call log kỹ thuật, input `required_agents`, slot 1 giờ và cấu hình solver trên giao diện.

**Phiên bản:** 1.0  
**Thời lượng:** 8 tuần  
**Nhóm:** Nguyễn Quốc Khánh (A) và Lê Tuấn Dũng (B)  
**Mục tiêu:** Có một MVP chạy được từ nhập dữ liệu đến xuất lịch, giải thích được bằng báo cáo và demo trong 5–7 phút.

## 1. Quyết định chốt sau khi hợp nhất hai tài liệu

Đây là các quyết định dùng làm chuẩn trong toàn bộ 8 tuần. Khi tài liệu cũ hoặc ý tưởng mới mâu thuẫn với các điểm này, dùng các điểm dưới đây.

| Hạng mục | Quyết định thống nhất | Lý do |
|---|---|---|
| Luồng sản phẩm MVP | Chọn ngày → upload workbook `NhuCau` + `NhanVien` → chuẩn hóa → Erlang C → CP-SAT → validator → Gantt/bảng → CSV | Phù hợp người dùng non-IT và đủ để demo |
| Contract giữa module | `SchedulingRequest v1.0.0` và `SchedulingResult v1.0.0` trong `docs/contracts/` | Một chuẩn duy nhất, dễ mock và giảm lỗi ghép module |
| Định dạng ở biên | MVP nhận một workbook Excel hai sheet; adapter đổi sang JSON contract; CSV là phương án phụ | Không để solver đọc trực tiếp file người dùng |
| Độ phân giải tính toán | Slot 30 phút | Xử lý break, coverage và SLA chính xác; giao diện có thể gộp để xem theo giờ |
| Phạm vi thời gian | MVP một ngày; contract/fixture có thể mở rộng 1–7 ngày sau khi MVP ổn | Giảm dữ liệu người dùng và rủi ro lịch sử nhiều ngày |
| Khung demo | 08:00–20:00, một nhóm `Hỗ trợ chung`, 5–30 nhân viên, 2–3 mẫu ca | Giảm số lựa chọn và lỗi nhập liệu |
| Ca làm | Người dùng chọn template; productive 480 phút, break 60 phút, elapsed span 540 phút | Không bắt nhập giờ ca tự do |
| Thiếu người | `shortage` là biến mềm; luôn trả lịch hợp lệ nếu input hợp lệ, nhưng phải gắn trạng thái và số thiếu | Không biến nhu cầu vượt năng lực thành lỗi vô nghiệm giả |
| Tối ưu | Ưu tiên shortage trước, sau đó overstaff, số assignment, preference, fairness | Đảm bảo phủ nhu cầu quan trọng hơn làm đẹp lịch |
| Nhu cầu/forecast | MVP dùng nhu cầu dự kiến theo slot; forecast lịch sử là advanced sau MVP | Tách bài toán xếp lịch khỏi bài toán chuẩn bị dữ liệu lịch sử |
| SLA mẫu | 80% trong 20 giây; cho phép đổi trong UI | Đây là tham số minh họa, không khóa cứng nghiệp vụ |
| Trạng thái | Phân biệt `OPTIMAL`, `FEASIBLE`, `DEGRADED/BASELINE`, `INVALID_INPUT`, `ERROR` | Không gọi một lịch thiếu người là “tối ưu đầy đủ” |
| Triển khai | Thử deploy từ tuần 1, khóa dữ liệu/seed từ tuần 7 | Giảm rủi ro cuối kỳ không mở được web |

### Quy tắc diễn giải kết quả

- **Lịch hợp lệ:** không vi phạm hard constraint; `hard_constraint_violations = 0`.
- **Lịch tối ưu:** solver chứng minh được tối ưu (`OPTIMAL`).
- **Lịch khả thi:** có lịch nhưng chưa chứng minh tối ưu (`FEASIBLE`).
- **Lịch suy giảm:** timeout hoặc không hội tụ, dùng nghiệm hiện có hoặc baseline deterministic (`DEGRADED`, `solution_source=BASELINE`).
- **Thiếu người:** là kết quả nghiệp vụ được báo bằng `shortage_agents`; không che giấu và không gắn nhãn là full coverage.
- **Không có nghiệm:** chỉ dành cho input không hợp lệ hoặc lỗi runtime sau khi đã validate. Với request hợp lệ, shortage giúp mô hình vẫn có nghiệm.

## 2. Kiến trúc và ranh giới trách nhiệm

```text
Workbook Excel (NhuCau + NhanVien) + form đơn giản
                    │
                    ▼
        B: ingest / normalize / forecast / Erlang C
                    │  SchedulingRequest v1.0.0
                    ▼
        A: candidate shifts / CP-SAT / baseline fallback
                    │  SchedulingResult v1.0.0
                    ▼
        A: validator / Gantt / coverage / CSV export
                    ▲
                    │
        B: Streamlit input, parameter panel, deploy, smoke test
```

### Chủ sở hữu module

| Khu vực | Chủ trì | Người review |
|---|---|---|
| Yêu cầu, contract, fixture, quyết định thay đổi | A + B | A + B bắt buộc duyệt |
| CSV, timezone, làm sạch, resample 30 phút | B | A kiểm thử contract |
| Forecast baseline, AHT, Erlang C | B | A kiểm tra công thức và test biên |
| Candidate shift, CP-SAT, objective, baseline solver | A | B kiểm thử constraint |
| Validator và trạng thái solver | A | B kiểm tra theo acceptance criteria |
| Streamlit nhập liệu, tham số, deploy | B | A smoke test end-to-end |
| Gantt, coverage, cảnh báo, export CSV | A | B kiểm tra đối chiếu |
| Báo cáo, slide, kịch bản demo, QA cuối | A + B | Sở hữu chung |

**Nguyên tắc:** chủ trì được sửa module của mình; người review không tự ý đổi semantics của field. Thay đổi contract phải cập nhật schema, fixture, adapter và ghi vào changelog trong cùng một commit. UI dùng tiếng Việt; contract/backend dùng tiếng Anh.

## 3. Contract chuẩn duy nhất

### 3.1 `SchedulingRequest v1.0.0`

Producer là adapter/pipeline của B. Người dùng không nhập trực tiếp request. Request bắt buộc có:

- `contract_version`, `request_id`, `timezone=Asia/Ho_Chi_Minh`.
- `horizon` và `slots` tường minh, `slot_minutes=30`; timestamp luôn có offset, không nhận datetime naive.
- `skills` và `demand` theo cặp `slot_id + skill_id`.
- Mỗi demand có `required_agents`, `priority`, forecast, Erlang C và shrinkage.
- `employees` có skill, availability, giới hạn phút, lịch sử 6 ngày trước horizon và preference.
- `shift_templates` có start/end, đúng một break 60 phút, `allowed_skill_ids`.
- `rules`: span 480, break 60, nghỉ tối thiểu 720 phút, tối đa 5 ngày liên tiếp, tối đa một ca/ngày, cho phép unassigned.
- `objective` và `solver_options` để reproducible: seed 42, 4 workers, time limit 30 giây trong demo.

### 3.2 `SchedulingResult v1.0.0`

Consumer là solver của A; UI chỉ đọc result. Result luôn có:

- `status`, `solver_status`, `solution_source`, `has_solution`, `optimality_proven`.
- `assignments` với employee/template/skill, start/end và break.
- `coverage` là nguồn sự thật: `shortage_agents = max(required - scheduled, 0)`, `overstaff_agents = max(scheduled - required, 0)`.
- `metrics`: wall time, objective, bound, gap, các thành phần objective và hard violations.
- `diagnostics` có severity, code, message, JSON Pointer path.
- `carry_out` để truyền trạng thái nhân viên sang horizon kế tiếp.

### 3.3 Adapter bắt buộc cho repo hiện tại

Repo hiện có `erlang_c.py`, `solver.py` và `app.py` đang dùng format cũ `staffing_requirements.json`/`optimized_roster.json`, field kiểu `intervals`, `roster`, `understaffed`. Không duy trì hai contract song song.

Trong tuần 1–2, làm theo thứ tự:

1. Giữ hàm tính toán thuần trong `erlang_c.py`, nhưng thêm producer tạo `SchedulingRequest`.
2. Đổi `solver.solve_contract()` nhận request chuẩn và trả result chuẩn.
3. Đặt adapter tương thích tạm thời ở rìa UI nếu cần đọc fixture cũ; không để adapter đi vào solver.
4. Khi integration test v1 chạy, xóa đường đi chính qua format cũ và đổi tên/ghi chú rõ các file legacy.

## 4. Workflow chạy một ca từ đầu đến cuối

### Bước 1 — Nhập và kiểm tra dữ liệu

UI nhận workbook `NhuCau` + `NhanVien` và form ngày/mức phục vụ/ca mẫu. B kiểm tra sheet/cột, duplicate, missing, khung giờ, số cuộc gọi, AHT và trạng thái đi làm. Dữ liệu mô phỏng phải được ghi nhãn trong UI và báo cáo.

### Bước 2 — Chuẩn hóa

Đổi `khung_gio` dạng người dùng sang slot 30 phút, gán ngày từ form, chuẩn hóa số phút và tên nhóm. Nếu file theo 1 giờ, chỉ chia đôi khi người dùng đã chọn tùy chọn đó và phải ghi cảnh báo. Tạo request nội bộ sau validation.

### Bước 3 — Chuẩn bị nhu cầu

MVP dùng trực tiếp số cuộc gọi dự kiến trong `NhuCau`. Chỉ ở advanced mới dùng lịch sử nhiều tuần để rolling mean theo thứ + khung giờ; người dùng không phải cấu hình lookback/backtest/outlier trong luồng chính.

### Bước 4 — Tính Erlang C

Với mỗi slot/skill:

```text
offered_load = expected_calls × aht_seconds / 1800
required_before_shrinkage = số agent nhỏ nhất đạt SLA
required_agents = ceil(required_before_shrinkage / (1 - shrinkage))
```

Mức “Tiêu chuẩn/Cao” trên UI được map sang SLA backend. Break kế hoạch do solver xử lý; không cộng break lần nữa vào shrinkage. Nếu target vượt capacity, vẫn phát hành request và cảnh báo capacity.

### Bước 5 — Sinh candidate và giải CP-SAT

Chỉ tạo candidate `(employee, template, skill)` khi skill, availability và horizon hợp lệ. Áp hard constraint: một ca/ngày, nghỉ 12 giờ, tối đa 5 ngày trong mọi cửa sổ 6 ngày, giới hạn phút, skill và availability. Dùng shortage/overstaff làm biến mềm.

Objective mặc định:

```text
shortage_weight × priority × shortage
+ overstaff_weight × overstaff
+ assignment_weight × assignments
+ preference_weight × preference_penalty
+ fairness_weight × deviation
```

Trọng số khởi đầu: shortage 10000, overstaff 10, assignment 1, preference 2, fairness 1. Time limit 30 giây; nếu timeout/UNKNOWN thì chạy baseline first-fit deterministic, validate lại và trả `DEGRADED`.

### Bước 6 — Validate độc lập

Validator không dùng objective của solver để kết luận hợp lệ. Nó đếm coverage từ assignment thực tế, trừ break, rồi kiểm:

- Không có hai ca cùng nhân viên/cùng ngày.
- Khoảng nghỉ giữa ca ≥ 720 phút.
- Không có cửa sổ 6 ngày làm đủ 6 ngày.
- Ca span đúng 480 phút, break đúng 60 phút.
- Không skill mismatch hoặc assignment ngoài availability.
- `scheduled + shortage - overstaff = required` cho từng slot/skill.

Nếu có violation, không hiển thị là thành công; trả `ERROR` hoặc `INVALID_INPUT` kèm diagnostics.

### Bước 7 — Hiển thị và xuất

UI có 3 vùng logic:

1. **Input & target:** upload workbook, chọn mức phục vụ/ca mẫu, bảng nhu cầu và target.
2. **Schedule:** Gantt theo nhân viên, break nhìn thấy, filter ngày/skill.
3. **Coverage & export:** required/scheduled/shortage/overstaff, solver status, wall time/gap, cảnh báo và tải CSV.

## 5. Kế hoạch 8 tuần với cổng nghiệm thu

### Tuần 1 — Chốt phạm vi và dựng đường chạy tối thiểu

**A:** chốt biến CP-SAT, ca productive 480 + break 60, objective và prototype 4–6 nhân viên.  
**B:** dựng Streamlit skeleton, kiểm tra deploy, tạo workbook fixture `NhuCau`/`NhanVien`.  
**Cả hai:** chốt request/result v1.0.0, timezone, 30 phút và cách gắn status.

**Cổng H1:** `streamlit run app.py` mở được; CP-SAT toy chạy; fixture JSON được đọc; deploy thử thành công.

### Tuần 2 — Contract và hai module độc lập

**A:** hoàn thiện `solve(request)` và result fixture; candidate theo skill/availability.  
**B:** loader workbook, normalize khung giờ/phút, offered load, Erlang C; input page đọc được hai sheet.  
**Cả hai:** test round-trip request/result, không thêm field ngoài schema.

**Cổng H2:** B phát hành một `SchedulingRequest`; A đọc đúng request và trả `SchedulingResult`; không phụ thuộc DataFrame.

### Tuần 3 — Constraint bắt buộc và shortage

**A:** thêm break, một ca/ngày, nghỉ 12 giờ, max 5 ngày/6 ngày, shortage/overstaff, seed/time limit.  
**B:** thêm mức phục vụ Tiêu chuẩn/Cao, AHT chung/dòng, missing-data policy và diagnostics input.  
**Cả hai:** chạy đủ người và thiếu người.

**Cổng H3:** thiếu người vẫn có lịch hợp lệ + shortage; đủ người có shortage bằng 0; không vi phạm hard constraint.

### Tuần 4 — Ghép pipeline Python và UI tối thiểu

**A:** đóng gói solver/validator; baseline fallback.  
**B:** nối upload workbook → chuẩn hóa → Erlang → request; hiển thị target.  
**Cả hai:** nút “Tạo lịch” chạy end-to-end từ UI.

**Cổng H4:** một click tạo result chuẩn; lỗi schema hiển thị ở UI, không ném traceback cho người dùng.

### Tuần 5 — Gantt, coverage và giải thích

**A:** Gantt, coverage theo slot/skill, export CSV, cảnh báo status.  
**B:** hoàn thiện bảng nhu cầu/target, tham số đơn giản và thông báo tiếng Việt.  
**Cả hai:** đối chiếu thủ công 3–5 assignment và một break.

**Cổng H5:** Gantt không vẽ coverage trong break; bảng UI khớp result JSON và CSV.

### Tuần 6 — Bộ kịch bản BTL và sửa lỗi model

Tạo và khóa 4 fixture: bình thường, peak, thiếu dữ liệu, thiếu nhân viên; thêm fixture 7 ngày cho lịch sử 5 ngày. Chạy test contract, Erlang, solver constraint và 3–5 integration tests từ JSON.

**Cổng H6:** pass các kịch bản nghiệm thu; mọi result có solution đều có `hard_constraint_violations=0`.

### Tuần 7 — Release candidate và tài liệu

**A:** hoàn thiện mô hình, validator, log solver, phần toán trong báo cáo.  
**B:** khóa deploy, README, hướng dẫn cài, screenshot, phần dữ liệu/UI.  
**Cả hai:** chạy trên máy sạch, khóa seed và bộ dữ liệu demo, không thêm feature mới.

**Cổng H7:** người khác clone repo, cài môi trường và chạy demo theo README.

### Tuần 8 — Bàn giao và diễn tập

Chạy full demo, sửa lỗi cuối, kiểm chính tả/đơn vị phút–giây, hoàn thiện báo cáo và slide. Phân vai thuyết trình: B giải thích dữ liệu/forecast/Erlang; A giải thích CP-SAT/validator; cả hai trả lời trade-off và shortage.

**Cổng H8:** web, source, contract, fixture, README, báo cáo, slide và kịch bản demo nằm trong một release/tag.

## 6. Definition of Done

### Chức năng

- Upload workbook hợp lệ và báo lỗi rõ cho sheet/cột sai.
- Nhu cầu dự kiến được chuẩn hóa; Erlang trả required agent nguyên.
- Solver xử lý skill, availability, break, nghỉ 12 giờ, một ca/ngày, max 5 ngày liên tiếp.
- Demand vượt capacity vẫn có result hợp lệ với shortage và cảnh báo.
- UI có target, Gantt, coverage, status, wall time/gap và CSV export.
- CSV export khớp assignment đang hiển thị.

### Kỹ thuật

- JSON Schema v1.0.0 validate trước khi tạo domain objects.
- Không có timestamp naive; mọi timestamp có offset.
- Seed cố định cho demo; time limit 30 giây.
- Có unit test riêng của A/B và integration test từ JSON fixture.
- README chạy được trên máy sạch; deploy được bằng fixture đã khóa.

### Báo cáo và demo

Kịch bản 5–7 phút: tải workbook mẫu → xem bảng nhu cầu/target → Tạo lịch → chỉ break trên Gantt → mở scenario thiếu người → chỉ shortage/status → tải CSV. Forecast lịch sử và JSON audit chỉ trình bày ở phụ lục/advanced.

## 7. Rủi ro và cách xử lý đã chốt

| Rủi ro | Dấu hiệu | Xử lý |
|---|---|---|
| Hai contract song song | UI có `intervals` nhưng solver đòi `demand` | Chỉ dùng v1.0.0; adapter cũ chỉ ở biên và phải xóa sau H2 |
| Nhầm 8 giờ làm + break | Gantt phủ đủ trong break hoặc span 9 giờ không nhất quán | Golden case 08:00–17:00, break 12:00–13:00; một hàm coverage chung |
| Solver gắn nhãn tối ưu khi thiếu người | `status=OPTIMAL` nhưng shortage > 0 bị giải thích sai | Hiển thị shortage; “optimal” chỉ nói tối ưu objective có shortage penalty |
| Erlang target quá lớn | Candidate phình, timeout | Cảnh báo capacity, prune candidate, 30 giây, baseline fallback |
| Sai timezone/đơn vị | target thay đổi bất thường | ISO-8601 có offset, AHT giây, offered load chia 1800 |
| Deploy hỏng cuối kỳ | local chạy nhưng cloud lỗi import | Deploy thử H1, smoke test H4/H7, khóa requirements |
| Scope creep | thêm ML, multi-site, auth, realtime | Ghi vào “hướng phát triển”, không đưa vào Definition of Done |

## 8. Cấu trúc repo sau khi hợp nhất

```text
app.py
src/
  data_pipeline/       # B: ingest, normalize, forecast
  erlang/              # B: Erlang C, shrinkage, target
  scheduling_contract/ # A+B: schema/domain/validation
  solver/              # A: CP-SAT, baseline, status
  dashboard/           # B input; A result/Gantt/export
docs/
  BTL_8_week_unified_workflow.md
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
```

**Điểm cần làm ngay sau khi chốt tài liệu:** tạo `request_demo.json` theo schema v1.0.0, sửa `erlang_c.py` thành producer của request, sửa `solver.py` thành consumer/result v1.0.0, rồi nối Streamlit vào hai adapter này. Đây là đường ngắn nhất để từ repo hiện tại đạt H2 và tránh ghép hai hệ thống khác nhau ở cuối kỳ.
