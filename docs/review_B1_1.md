> **Trạng thái:** Tài liệu lịch sử/phân tích. Quyết định đang áp dụng nằm trong [B1_1_final_input_output_spec.md](D:/khdv/docs/B1_1_final_input_output_spec.md). Không dùng các ví dụ cũ trong file này để thiết kế UI MVP.

# Duyệt B1.1 — Phân tích dữ liệu đầu vào và đầu ra

## Kết luận

**Trạng thái: Đạt về nội dung, cần chỉnh trước khi chốt chính thức.**

B1.1 đã có đủ bốn nhóm kết quả yêu cầu: danh sách dữ liệu vào, phương án nhập, đề xuất phiên bản đầu tiên và danh sách đầu ra. Tuy nhiên, chưa nên gửi nghiệm thu nguyên trạng vì còn mâu thuẫn về slot 1 giờ/30 phút, chưa tách rõ nhu cầu dự kiến với lịch sử forecast, và đang đưa quá nhiều tham số kỹ thuật cho người dùng non-IT.

## 1. Những phần đã làm tốt

- Bao quát đủ pipeline: lịch sử cuộc gọi, tuần/giờ mở cửa, AHT, SLA, nhân viên/kỹ năng, mẫu ca/break, rules, nghỉ/bận và tiêu chí ưu tiên.
- Đã nêu ba phương án nhập nhu cầu: lịch sử để forecast, tổng ngày + mẫu peak, bảng nhu cầu trực tiếp.
- Dùng nhãn nghiệp vụ dễ hiểu thay vì chỉ dùng tên field kỹ thuật.
- Nhận diện đúng các vấn đề thực tế: break lệch giờ, nhân viên đa kỹ năng, lịch sử trước tuần lập lịch.

## 2. Các điểm bắt buộc phải chỉnh

### 2.1. Chốt một độ phân giải

B1.1 mô tả lưới 7 ngày × 12 ô, mỗi ô 1 giờ; blueprint và contract hiện tại dùng slot 30 phút.

Chốt như sau:

- Chuẩn nội bộ/solver: 30 phút.
- UI có thể hiển thị theo 1 giờ cho dễ nhìn.
- Nếu người dùng nhập theo 1 giờ, hệ thống chia thành hai slot 30 phút và gắn cảnh báo “ước lượng”.

### 2.2. Phân biệt ba loại nhu cầu

| Loại | Người dùng nhập | Hệ thống làm |
|---|---|---|
| Lịch sử | Số cuộc gọi nhiều ngày/tuần trước | Forecast cho ngày/tuần tới |
| Dự kiến | Số cuộc gọi đã ước lượng cho kỳ cần xếp | Dùng trực tiếp để tính nhu cầu |
| Nhu cầu nhân lực | Số người cần theo slot | Bỏ qua forecast/Erlang, chỉ test solver |

Một lần chạy không được trộn ba nguồn này nếu chưa ghi rõ nguồn nào là authoritative.

### 2.3. Chọn phương án MVP

- Luồng chính cho non-IT: bảng nhu cầu dự kiến theo giờ/30 phút.
- Luồng advanced: tải lịch sử để chứng minh forecast.
- `required_agents` trực tiếp: chỉ dùng fixture/test solver.
- Tổng ngày + mẫu peak: chỉ fallback/demo; phân bố giả định có thể làm sai giờ cao điểm.

Lý do: solver cần nhu cầu theo thời gian. Bắt người dùng nhập tổng ngày rồi hệ thống tự đoán phân bố làm mất thông tin quan trọng nhất.

### 2.4. Hạ tham số kỹ thuật xuống backend

Không bắt người dùng non-IT nhập:

- lookback/backtest window;
- outlier policy chi tiết;
- solver time limit, workers, seed;
- objective weights;
- diagnostic mode;
- shrinkage/occupancy dạng số.

Thay bằng lựa chọn “Tiêu chuẩn/Cao”, ca mẫu và ngày nghỉ. Các tham số kỹ thuật dùng mặc định backend và ghi trong chi tiết kết quả.

### 2.5. Chốt input nhân viên tối thiểu

MVP chỉ cần:

```text
employee_id
name
work_status_for_day
allowed_shift_templates
```

Không bắt người dùng nhập giờ tùy ý nếu hệ thống đã có ca mẫu. Chọn “được nhận ca sáng/giữa/muộn” ít lỗi hơn và ánh xạ trực tiếp vào CP-SAT. Ban đầu nên dùng một nhóm “Hỗ trợ chung”; nhiều skill để sau.

### 2.6. Chốt thiếu người và vô nghiệm

Vì blueprint đã chọn shortage/overstaff là biến mềm:

- Nhu cầu vượt năng lực không gọi là `INFEASIBLE`.
- Vẫn tạo lịch hợp lệ và báo thiếu theo slot.
- `INFEASIBLE`/`INVALID_INPUT` chỉ dùng khi dữ liệu hoặc hard constraint mâu thuẫn.

“Diagnostic mode” nên đổi thành cảnh báo thiếu người theo slot; không phải input người dùng.

## 3. Bảng so sánh nên đưa vào B1.1

| Phương án | Người dùng nhập | Ưu điểm | Hạn chế | Phù hợp MVP |
|---|---|---|---|---|
| Lịch sử cuộc gọi | CSV nhiều ngày, giờ, nhóm, số cuộc gọi | Có phần forecast học thuật | Khó chuẩn bị, cần xử lý thiếu/outlier | Advanced |
| Dự kiến theo slot | Bảng giờ, số cuộc gọi, AHT phút | Dễ hiểu, chạy ngay, đúng nhu cầu solver | Phụ thuộc ước lượng quản lý | **Khuyến nghị chính** |
| Tổng ngày + mẫu peak | Tổng cuộc gọi/ngày, kiểu phân bố | Ít ô nhập | Giả định phân bố có thể sai | Fallback/demo |
| Required agents trực tiếp | Slot, skill, số người cần | Test CP-SAT nhanh | Người dùng không biết con số | Developer fixture |

## 4. INPUT non-IT nên chốt

### Trên màn hình

1. Ngày hoặc tuần cần lập lịch.
2. Giờ mở cửa/đóng cửa.
3. Mức phục vụ: Tiêu chuẩn/Cao.
4. Ca mẫu được phép dùng.
5. AHT chung bằng phút nếu bảng chưa có AHT.

### File nhu cầu

```text
khung_gio
so_cuoc_goi_du_kien
thoi_gian_xu_ly_trung_binh_phut (có thể trống nếu đã nhập AHT chung)
nhom_ho_tro (tùy chọn; mặc định Hỗ trợ chung)
```

### File nhân viên

```text
ma_nhan_vien
ho_ten
di_lam
ca_sang
ca_giua
ca_muon
nhom_ho_tro (tùy chọn khi có nhiều nhóm)
```

## 5. Đầu ra cần ghi rõ

### Cho người quản lý

1. Nhu cầu dự kiến theo ngày/giờ/nhóm.
2. Số nhân viên cần theo từng khoảng.
3. Lịch phân ca: nhân viên, ngày, ca, nhóm.
4. Độ phủ: cần bao nhiêu, đã xếp bao nhiêu.
5. Khoảng thiếu/thừa người.
6. Cảnh báo dữ liệu và thiếu người.
7. Trạng thái dễ hiểu: “Lịch đã tạo”, “Lịch đã tạo nhưng còn thiếu người”, “Không thể tạo lịch”.
8. Tải CSV lịch phân công.

### Cho A/backend

1. `request_id`.
2. `required_agents` theo slot/skill.
3. Assignments có employee/template/skill/start/end/break.
4. Solver status, wall time, objective, gap.
5. Diagnostics lỗi/cảnh báo.

## 6. Câu hỏi cần chốt với A/giảng viên

1. Demo một ngày hay cả tuần? Khuyến nghị một ngày trước, fixture tuần để test.
2. Canonical slot 30 phút hay 1 giờ? Khuyến nghị 30 phút; UI có thể xem theo 1 giờ.
3. Một nhóm “Hỗ trợ chung” hay nhiều nhóm? Khuyến nghị một nhóm trước.
4. Nhu cầu chính là dự kiến trực tiếp hay forecast lịch sử? Khuyến nghị dự kiến trực tiếp cho demo, lịch sử ở advanced.
5. Có minimum floor khi mở cửa không? Nếu có, mặc định 1 người/nhóm, không bắt chỉnh lần đầu.
6. Ca mẫu và break cụ thể là gì? Cần chốt trước B2.1/A2.1.
7. UI tiếng Việt và contract tiếng Anh có được chấp nhận không? Khuyến nghị UI tiếng Việt, adapter đổi sang contract.

## 7. Checklist cần bổ sung để đóng B1.1

- Thêm bảng so sánh có tiêu chí và chọn phương án chính.
- Phân biệt lịch sử/dự kiến/required agents.
- Ghi 30 phút là chuẩn nội bộ dù UI hiển thị 1 giờ.
- Hạ input kỹ thuật xuống backend/Advanced.
- Ghi file mẫu tối thiểu cho nhu cầu và nhân viên.
- Tách output cho người quản lý và output kỹ thuật.
- Ghi câu hỏi cần giảng viên xác nhận.
- Nêu adapter vì code hiện tại vẫn nhận log từng cuộc gọi kỹ thuật.

## Verdict

B1.1 hiện đạt khoảng **75–80%**. Sau khi bổ sung checklist trên, có thể gửi A để chốt contract và gửi giảng viên xác nhận phạm vi. Không cần đưa công thức OR/CP-SAT vào B1.1; chỉ cần mô tả dữ liệu đủ để solver sử dụng.
