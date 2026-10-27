# Hướng dẫn thiết kế INPUT cho người dùng không chuyên IT

> **Bản chuẩn hiện tại:** xem [B1_1_final_input_output_spec.md](D:/khdv/docs/B1_1_final_input_output_spec.md) và [input_recommendation_final.md](D:/khdv/docs/input_recommendation_final.md). MVP dùng nhu cầu dự kiến và checkbox ca mẫu, không bắt người dùng nhập giờ bắt đầu/kết thúc riêng cho từng nhân viên. Các ví dụ cũ trong tài liệu này chỉ có giá trị tham khảo UX.

## 1. Mục tiêu của màn hình nhập liệu

Người dùng của ứng dụng là quản lý hoặc trưởng nhóm chăm sóc khách hàng. Họ biết:

- Ngày nào cần xếp lịch.
- Trung tâm hoạt động từ mấy giờ đến mấy giờ.
- Mỗi khoảng thời gian có bao nhiêu cuộc gọi.
- Một cuộc gọi thường mất bao nhiêu phút.
- Nhân viên nào đi làm được và ai xin nghỉ.

## 2. Luồng nhập liệu mà người dùng nhìn thấy

Màn hình nên có một wizard 4 bước:

```text
Bước 1: Chọn thời gian
        ↓
Bước 2: Nhập nhu cầu cuộc gọi
        ↓
Bước 3: Nhập nhân viên
        ↓
Bước 4: Chọn quy định đơn giản → Tạo lịch
```

Mỗi bước có nút **Tải file mẫu** và bảng xem trước. Người dùng chỉ được sang bước tiếp theo khi dữ liệu bước hiện tại hợp lệ.

---

## 3. Bước 1 — Chọn thời gian cần lập lịch

### 3.1. Các ô trên màn hình

| Nhãn hiển thị | Loại điều khiển | Bắt buộc | Giá trị mặc định | Giải thích cho người dùng |
|---|---|---:|---:|---|
| Ngày bắt đầu | Chọn ngày | Có | Ngày hiện tại hoặc ngày demo | Ngày đầu tiên muốn lập lịch |
| Ngày kết thúc | Chọn ngày | Có | Trùng ngày bắt đầu | Ngày cuối cùng muốn lập lịch |
| Giờ bắt đầu phục vụ | Chọn giờ | Có | 08:00 | Trung tâm bắt đầu nhận khách |
| Giờ kết thúc phục vụ | Chọn giờ | Có | 20:00 | Trung tâm ngừng nhận khách |
| Múi giờ | Danh sách cố định | Không | Việt Nam | Ẩn khỏi giao diện nếu chỉ phục vụ Việt Nam |

### 3.2. Cách giải thích trên giao diện

Hiển thị hướng dẫn ngay dưới form:

> Hệ thống sẽ chia thời gian hoạt động thành các khoảng 30 phút để tính số nhân viên cần trong từng khoảng. Bạn không cần tự chia thời gian.

### 3.3. Kiểm tra dữ liệu

- Ngày kết thúc không được trước ngày bắt đầu.
- Giờ kết thúc phải sau giờ bắt đầu.
- Khoảng lập lịch không được dài hơn 7 ngày trong MVP.
- Giờ bắt đầu và kết thúc phải theo mốc 30 phút. Nếu người dùng nhập 08:15, hiển thị:

> Vui lòng chọn giờ tròn hoặc nửa giờ, ví dụ 08:00 hoặc 08:30.

### 3.4. Khuyến nghị MVP

Ban đầu chỉ cho chọn một ngày. Khi mô hình một ngày ổn định mới bật lựa chọn nhiều ngày. Điều này giúp người dùng dễ hiểu và giảm lỗi do lịch sử nhiều ngày.

---

## 4. Bước 2 — Nhập nhu cầu cuộc gọi

Có hai cách nhập. Màn hình chính nên dùng **cách A**.

### Cách A — Bảng tổng hợp theo 30 phút, dành cho người dùng thường

Người dùng tải file CSV theo mẫu:

```csv
ngay,gio,so_cuoc_goi,thoi_gian_xu_ly_trung_binh_phut
02/11/2026,08:00,24,6
02/11/2026,08:30,18,5
02/11/2026,09:00,31,7
02/11/2026,09:30,28,6
```

### 4.1. Giải thích từng cột

| Tên cột trong file mẫu | Bắt buộc | Người dùng điền gì | Ví dụ |
|---|---:|---|---:|
| `ngay` | Có | Ngày của số liệu | `02/11/2026` |
| `gio` | Có | Giờ bắt đầu khoảng 30 phút | `08:00` |
| `so_cuoc_goi` | Có | Tổng số cuộc gọi trong khoảng đó | `24` |
| `thoi_gian_xu_ly_trung_binh_phut` | Có | Một cuộc gọi thường mất bao nhiêu phút | `6` |
| `nhom_ho_tro` | Không | Tên nhóm, nếu có nhiều nhóm | `Thoai`, `Chat` |

### 4.2. Nếu người dùng chỉ có dữ liệu theo giờ

Cho phép nhập:

```csv
ngay,gio,so_cuoc_goi,thoi_gian_xu_ly_trung_binh_phut
02/11/2026,08:00,42,6
02/11/2026,09:00,55,7
```

Hệ thống có hai lựa chọn rõ ràng:

- **Dữ liệu đã là 30 phút** — giữ nguyên số liệu.
- **Dữ liệu là 1 giờ** — hệ thống chia đều số cuộc gọi thành hai khoảng 30 phút và báo đây là ước lượng.

MVP nên ưu tiên dữ liệu 30 phút; nếu chia đều dữ liệu 1 giờ, ghi cảnh báo trên kết quả để người dùng hiểu.

### 4.3. Nếu có nhiều nhóm hỗ trợ

Thêm cột dễ hiểu:

```csv
ngay,gio,nhom_ho_tro,so_cuoc_goi,thoi_gian_xu_ly_trung_binh_phut
02/11/2026,08:00,Thoai tieng Viet,24,6
02/11/2026,08:00,Chat tieng Viet,10,4
02/11/2026,08:30,Thoai tieng Viet,18,5
```

Người dùng chọn tên nhóm trong file; hệ thống tự tạo mã nội bộ. Không yêu cầu nhập `skill_id` như `voice_vi`.

Nếu không có cột `nhom_ho_tro`, hệ thống tự điền:

```text
Hỗ trợ chung
```

### 4.4. Nếu không có thời gian xử lý trung bình cho từng dòng

Cho phép người dùng nhập một giá trị chung trên form:

```text
Thời gian xử lý trung bình: 6 phút
```

Khi đó file chỉ cần:

```csv
ngay,gio,so_cuoc_goi
02/11/2026,08:00,24
02/11/2026,08:30,18
```

Nếu vừa có cột trong file vừa có giá trị trên form, ưu tiên cột trong file và báo:

> File đã có thời gian xử lý cho từng khoảng. Giá trị chung trên màn hình chỉ được dùng cho những dòng còn thiếu.

### 4.5. Các lỗi cần báo bằng tiếng Việt

| Tình huống | Thông báo nên hiển thị |
|---|---|
| Thiếu cột | `File chưa có cột “Số cuộc gọi”. Hãy tải file mẫu để xem đúng định dạng.` |
| Số cuộc gọi âm | `Số cuộc gọi tại 08:30 không thể nhỏ hơn 0.` |
| Số cuộc gọi là chữ | `Số cuộc gọi tại 09:00 cần là một con số, ví dụ 24.` |
| AHT bằng 0 khi có cuộc gọi | `Vui lòng nhập thời gian xử lý lớn hơn 0 phút tại 09:00.` |
| Trùng dòng | `Có hai dòng cùng ngày, giờ và nhóm hỗ trợ: 02/11/2026 08:00.` |
| Ngoài kỳ lập lịch | `Dòng ngày 03/11 nằm ngoài khoảng thời gian bạn đã chọn.` |
| Sai giờ | `Giờ cần có dạng 08:00 hoặc 08:30.` |
| Không có dữ liệu | `File chưa có dòng dữ liệu nào.` |

---

## 5. Bước 3 — Nhập danh sách nhân viên

Người dùng tải file mẫu nhân viên:

```csv
ma_nhan_vien,ho_ten,co_the_lam,gio_bat_dau,gio_ket_thuc,ngay_nghi
NV001,Nguyen Van A,Co,08:00,17:00,
NV002,Tran Thi B,Co,09:00,18:00,03/11/2026
NV003,Le Van C,Khong,,,
NV004,Pham Thi D,Co,11:00,20:00,
```

### 5.1. Giải thích từng cột

| Cột | Bắt buộc | Ý nghĩa |
|---|---:|---|
| `ma_nhan_vien` | Có | Mã duy nhất của nhân viên |
| `ho_ten` | Có | Tên hiện trên lịch |
| `co_the_lam` | Có | Nhân viên có thể đi làm trong kỳ không |
| `gio_bat_dau` | Có nếu có thể làm | Sớm nhất có thể bắt đầu |
| `gio_ket_thuc` | Có nếu có thể làm | Muộn nhất có thể kết thúc |
| `ngay_nghi` | Không | Ngày xin nghỉ; có thể để trống |
| `nhom_ho_tro` | Không | Nhóm mà nhân viên có thể phục vụ |

### 5.2. Cách điền cột “Có thể làm”

Chấp nhận các cách viết thân thiện:

```text
Có / Không
Co / Khong
Yes / No
1 / 0
```

Sau đó hệ thống chuẩn hóa về Có/Không.

### 5.3. Nhân viên có nhiều ngày nghỉ

Có thể dùng một trong hai cách:

**Cách 1: nhiều ngày trong cùng ô**

```csv
ma_nhan_vien,ho_ten,co_the_lam,gio_bat_dau,gio_ket_thuc,ngay_nghi
NV002,Tran Thi B,Co,09:00,18:00,"03/11/2026;05/11/2026"
```

**Cách 2: file ngày nghỉ riêng**

```csv
ma_nhan_vien,ngay_nghi,ly_do
NV002,03/11/2026,Việc cá nhân
NV002,05/11/2026,Đào tạo
```

MVP một ngày chỉ cần một cột `ngay_nghi` đơn giản hoặc bỏ trống.

### 5.4. Nhân viên làm được nhiều nhóm

Nếu có nhiều nhóm hỗ trợ, thêm cột:

```csv
ma_nhan_vien,ho_ten,co_the_lam,gio_bat_dau,gio_ket_thuc,nhom_ho_tro
NV001,Nguyen Van A,Co,08:00,17:00,"Thoai tieng Viet;Chat tieng Viet"
NV002,Tran Thi B,Co,09:00,18:00,Chat tieng Viet
```

Người dùng chỉ chọn tên nhóm. Hệ thống tự bảo đảm một nhân viên không bị tính phục vụ hai nhóm cùng lúc.

### 5.5. Lỗi cần báo

- `Mã nhân viên NV001 bị trùng.`
- `NV002 có giờ kết thúc 07:00 trước giờ bắt đầu 09:00.`
- `NV003 được đánh dấu không thể làm nhưng lại có giờ làm; hệ thống sẽ bỏ qua giờ làm của nhân viên này.`
- `NV004 chưa có nhóm hỗ trợ phù hợp với nhu cầu.`
- `Ngày nghỉ của NV002 nằm ngoài kỳ lập lịch.`
- `Danh sách nhân viên đang trống.`

---

## 6. Bước 4 — Các lựa chọn đơn giản trên form

### 6.1. Mức phục vụ

Không dùng chữ “service level” trên giao diện. Dùng hai lựa chọn:

| Lựa chọn | Hệ thống hiểu là |
|---|---|
| Tiêu chuẩn | Hướng tới trả lời 80% cuộc gọi trong 20 giây |
| Cao | Hướng tới trả lời 90% cuộc gọi trong 20 giây |

Thêm dòng giải thích:

> Mức “Cao” thường cần nhiều nhân viên hơn. Nếu nhân viên không đủ, hệ thống vẫn tạo lịch và chỉ rõ khoảng thời gian bị thiếu.

### 6.2. Ca làm

Người dùng chọn checkbox hoặc nút radio:

```text
[x] Ca ngày    08:00–20:00, nghỉ 12:00–13:00
[x] Ca đêm    20:00–08:00 ngày hôm sau, nghỉ 00:00–01:00
```

Không hỏi người dùng số phút làm, số phút nghỉ hoặc công thức coverage. Các ca này được tạo sẵn và đã kiểm thử.

### 6.3. Quy định nghỉ

Trong MVP nên hiển thị dưới dạng thông tin cố định:

```text
Mỗi người tối đa một ca trong ngày.
Mỗi ca có 1 giờ nghỉ.
Thời gian nghỉ giữa hai ca tối thiểu 12 giờ.
```

Không nên cho người dùng sửa các con số này trong màn hình cơ bản. Nếu cần thay đổi, đó là phần cấu hình quản trị hoặc developer.

---

## 7. Màn hình xem trước trước khi tạo lịch

Sau khi tải file, hệ thống hiển thị bản tóm tắt:

```text
Kỳ lập lịch: 02/11/2026
Giờ phục vụ: 08:00–20:00
Số khoảng thời gian có dữ liệu: 24
Tổng số cuộc gọi dự kiến: 612
Thời gian xử lý trung bình: 6.2 phút
Số nhân viên có thể xếp: 18
Ca đã chọn: Ca ngày, Ca đêm
Mức phục vụ: Tiêu chuẩn
```

Nếu phát hiện vấn đề, hiển thị trước nút **Tạo lịch**:

```text
2 khoảng thời gian chưa có dữ liệu cuộc gọi.
3 nhân viên không có giờ có thể làm.
Nhu cầu lúc 10:00 có thể cao hơn số người có sẵn.
Bạn vẫn có thể tạo lịch; hệ thống sẽ báo số người thiếu trong kết quả.
```

Đây là cảnh báo, không phải lỗi, nếu dữ liệu vẫn đủ để tính.

---

## 8. Những gì hệ thống tự tính sau khi người dùng bấm “Tạo lịch”

Người dùng chỉ thấy tiến trình đơn giản:

```text
Đang đọc dữ liệu       ✓
Đang tính nhu cầu      ✓
Đang xếp ca             …
Đang kiểm tra lịch      …
```

Phía sau hệ thống tự:

1. Chuẩn hóa ngày, giờ và tên nhóm.
2. Chia dữ liệu thành slot 30 phút.
3. Tính số cuộc gọi và thời gian xử lý.
4. Tính số nhân viên cần theo mức phục vụ đã chọn.
5. Tạo ca có thể dùng từ các ca mẫu.
6. Xếp nhân viên theo giờ có thể làm và ngày nghỉ.
7. Kiểm tra một ca/ngày, break, nghỉ 12 giờ và chuỗi ngày làm.
8. Tính số người đã xếp, số thiếu và số dư.

Không hiển thị các biến toán học này trong màn hình nhập liệu.

---

## 9. Cách giải thích kết quả cho người dùng

Thay vì hiển thị `OPTIMAL`, `FEASIBLE`, `DEGRADED` ngay từ đầu, UI có thể dùng nhãn dễ hiểu:

| Nhãn hiển thị | Ý nghĩa |
|---|---|
| Lịch đã tạo | Có lịch hợp lệ |
| Lịch đã tạo nhưng còn thiếu người | Có lịch, nhưng một số khoảng chưa đủ người |
| Lịch cần xem lại | Solver phải dùng phương án dự phòng hoặc dữ liệu có cảnh báo |
| Không thể tạo lịch | Dữ liệu đầu vào có lỗi nghiêm trọng |

Có thể đặt phần kỹ thuật trong mục “Xem chi tiết” cho người làm dự án.

---

## 10. Bộ file mẫu nên cung cấp ngay trên giao diện

### `mau_nhu_cau_cuoc_goi.csv`

```csv
ngay,gio,so_cuoc_goi,thoi_gian_xu_ly_trung_binh_phut
02/11/2026,08:00,24,6
02/11/2026,08:30,18,5
02/11/2026,09:00,31,7
```

### `mau_danh_sach_nhan_vien.csv`

```csv
ma_nhan_vien,ho_ten,co_the_lam,gio_bat_dau,gio_ket_thuc,ngay_nghi
NV001,Nguyen Van A,Co,08:00,17:00,
NV002,Tran Thi B,Co,09:00,18:00,
NV003,Le Van C,Co,11:00,20:00,02/11/2026
```

### Hướng dẫn ngay cạnh nút tải file

> Bạn có thể mở file mẫu bằng Excel, thay các dòng ví dụ bằng dữ liệu của mình rồi lưu lại dưới dạng CSV UTF-8.

---

## 11. Đối chiếu với code hiện tại

Code hiện tại trong `erlang_c.py` đang yêu cầu dữ liệu cấp từng cuộc gọi với các cột:

```text
timestamp_arrival
call_duration_seconds
```

Thiết kế cho người dùng non‑IT ở tài liệu này dùng dữ liệu tổng hợp dễ nhập hơn:

```text
ngay
gio
so_cuoc_goi
thoi_gian_xu_ly_trung_binh_phut
```

Do đó, cần thêm một bước adapter:

```text
bảng tiếng Việt của người dùng
→ chuẩn hóa về slot 30 phút
→ tạo dữ liệu nội bộ cho forecast/Erlang
→ SchedulingRequest
```

Không nên bắt người dùng quay lại nhập format kỹ thuật chỉ vì module cũ đang dùng format đó. Format kỹ thuật nên nằm bên trong hệ thống.

## 12. Phạm vi MVP chốt

MVP dành cho non‑IT chỉ cần:

- Một ngày.
- Một nhóm hỗ trợ mặc định.
- Một file nhu cầu cuộc gọi tổng hợp.
- Một file danh sách nhân viên.
- Hai mức phục vụ: Tiêu chuẩn/Cao.
- Ba ca mẫu cố định.
- Ngày nghỉ và khung giờ có thể làm.
- Nút **Tạo lịch**.

Sau khi luồng này chạy ổn mới mở rộng nhiều nhóm, nhiều ngày, log cuộc gọi chi tiết và cấu hình nâng cao.
