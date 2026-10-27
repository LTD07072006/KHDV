# Khuyến nghị cuối cùng về INPUT cho người dùng non-IT

## Quyết định chốt

MVP nên nhận **một file Excel có hai sheet** và một số lựa chọn rất ít trên màn hình:

```text
mau_xep_lich.xlsx
├── NhuCau
└── NhanVien
```

Người dùng không cần nhập dữ liệu lịch sử, log từng cuộc gọi, Erlang C, số nhân viên cần, AHT bằng giây, skill ID, shrinkage, occupancy, quantile, objective hoặc CP-SAT.

MVP mặc định dùng **nhu cầu dự kiến cho đúng ngày cần xếp lịch**. Đây là lựa chọn hợp lý nhất vì người dùng non-IT thường có báo cáo nhu cầu theo giờ, còn forecast lịch sử cần nhiều ngày dữ liệu và dễ làm họ nhầm giữa “số liệu lịch sử” và “nhu cầu của ngày sắp tới”.

## 1. Màn hình chính

### Bước 1 — Chọn ngày

```text
Ngày cần lập lịch: [02/11/2026]
```

MVP chỉ chọn một ngày. Khi bài toán một ngày ổn mới bật lịch nhiều ngày.

### Bước 2 — Tải một file Excel

Người dùng bấm **Tải file mẫu**, mở bằng Excel, điền dữ liệu rồi tải lên.

File có ba sheet:

```text
HuongDan   # có sẵn, chỉ để đọc
NhuCau     # người dùng điền
NhanVien   # người dùng điền
```

### Bước 3 — Chọn lựa chọn đơn giản

```text
Mức phục vụ:
(•) Tiêu chuẩn — hướng tới trả lời 80% cuộc gọi trong 20 giây
( ) Cao       — hướng tới trả lời 90% cuộc gọi trong 20 giây

Ca được phép dùng:
[x] Ca ngày  08:00–20:00, nghỉ 12:00–13:00
[x] Ca đêm  20:00–08:00 ngày hôm sau, nghỉ 00:00–01:00
```

Mức “Tiêu chuẩn” và ca sáng nên được chọn sẵn. Người dùng có thể bấm **Tạo lịch** ngay sau khi tải file.

## 2. Sheet `NhuCau` — người dùng điền nhu cầu

### Bản đơn giản nhất: một nhóm hỗ trợ, dữ liệu 30 phút

| Khung giờ | Số cuộc gọi dự kiến | Xử lý trung bình (phút) |
|---|---:|---:|
| 08:00–08:30 | 24 | 6 |
| 08:30–09:00 | 18 | 5 |
| 09:00–09:30 | 31 | 7 |

Tên cột trong Excel:

```text
khung_gio
so_cuoc_goi_du_kien
thoi_gian_xu_ly_trung_binh_phut
```

### Ý nghĩa

- `khung_gio`: khoảng thời gian dễ đọc, ví dụ `08:00–08:30`.
- `so_cuoc_goi_du_kien`: số cuộc gọi dự kiến trong khoảng đó.
- `thoi_gian_xu_ly_trung_binh_phut`: một cuộc gọi thường mất bao nhiêu phút.

Không yêu cầu nhập ngày trong từng dòng vì ngày đã chọn trên màn hình.

### Nếu người dùng chỉ biết số cuộc gọi

Cho phép để trống thời gian xử lý trong file và điền một ô trên màn hình:

```text
Thời gian xử lý trung bình cho các dòng còn thiếu: [6] phút
```

Nếu file có giá trị riêng trong một dòng thì ưu tiên giá trị riêng. Nếu cả file và form đều không có giá trị, báo lỗi rõ ràng.

### Nếu người dùng có dữ liệu theo giờ

Cho phép chọn:

```text
Dữ liệu trong file là: (•) 30 phút  ( ) 1 giờ
```

Nếu chọn 1 giờ, hệ thống chia đều số cuộc gọi thành hai slot 30 phút và báo cảnh báo:

> Dữ liệu theo giờ đã được chia đều. Hai khoảng 30 phút là ước lượng.

Không âm thầm chia dữ liệu nếu người dùng chưa chọn.

### Nhiều nhóm hỗ trợ

Chưa bật trong MVP đầu tiên. Khi cần, thêm cột dễ hiểu:

```text
nhom_ho_tro
```

Ví dụ:

| Khung giờ | Nhóm hỗ trợ | Số cuộc gọi dự kiến | Xử lý trung bình (phút) |
|---|---|---:|---:|
| 08:00–08:30 | Thoại | 24 | 6 |
| 08:00–08:30 | Chat | 10 | 4 |

Không yêu cầu người dùng nhập các tên như `voice_vi` hoặc `chat_vi`; hệ thống tự tạo mã nội bộ từ tên nhóm.

## 3. Sheet `NhanVien` — người dùng điền khả năng nhận ca

### Bản đơn giản nhất: chọn ca mẫu, không nhập giờ thủ công

| Mã nhân viên | Họ tên | Đi làm hôm nay? | Nhận ca sáng? | Nhận ca giữa? | Nhận ca muộn? |
|---|---|---|---|---|---|
| NV001 | Nguyễn Văn A | Có | Có | Không | Không |
| NV002 | Trần Thị B | Có | Không | Có | Không |
| NV003 | Lê Văn C | Không | Không | Không | Không |
| NV004 | Phạm Thị D | Có | Không | Không | Có |

Tên cột trong Excel:

```text
ma_nhan_vien
ho_ten
di_lam
ca_ngay
ca_dem
```

### Vì sao chọn ca thay vì nhập giờ bắt đầu/kết thúc?

- Người dùng không phải nhớ hoặc gõ đúng giờ.
- Không tạo khoảng giờ lệch với ca mà hệ thống đã kiểm thử.
- Ca và break đã được hệ thống định nghĩa sẵn.
- Mỗi dòng ánh xạ trực tiếp vào lựa chọn ca của CP-SAT.
- Ít lỗi hơn so với nhập `08:00`, `17:00` thủ công.

Nếu nhân viên nhận được tất cả ca, có thể chọn `Tất cả ca` trên màn hình hoặc điền “Có” ở cả ba cột. Nếu nhân viên nghỉ, điền `Không` ở `di_lam`.

### Dữ liệu không cần nhập trong MVP

Không đưa các cột sau vào file đầu tiên:

```text
ngay_nghi
contracted_hours
max_scheduled_minutes
last_shift_end
previous_local_days
preference_penalty
skill_id
```

Các giá trị này được cấu hình mặc định hoặc chỉ thêm khi mở rộng lịch 7 ngày/nhiều nhóm.

## 4. Quy tắc hệ thống tự áp dụng

Không bắt người dùng nhập các quy tắc sau:

- Mỗi ca có 8 giờ làm và 1 giờ nghỉ.
- Một nhân viên tối đa một ca trong ngày.
- Nghỉ giữa hai ca tối thiểu 12 giờ.
- Không làm quá 5 ngày liên tiếp trong lịch nhiều ngày.
- Break không được tính là thời gian phục vụ.
- Nếu thiếu người, vẫn tạo lịch và báo số người thiếu.

Đây là các quy tắc cố định của MVP, hiển thị trong phần “Quy định đang áp dụng” để người dùng biết nhưng không phải tự điền.

## 5. Những gì hệ thống tự tính

Sau khi bấm **Tạo lịch**, hệ thống tự:

1. Đọc hai sheet.
2. Kiểm tra lỗi cơ bản.
3. Chuyển khung giờ thành slot 30 phút.
4. Đổi phút sang đơn vị nội bộ.
5. Tính số nhân viên cần từ số cuộc gọi, thời gian xử lý và mức phục vụ.
6. Sinh các ca mẫu theo ngày.
7. Xếp nhân viên phù hợp.
8. Kiểm tra break và các quy tắc nghỉ.
9. Hiển thị lịch, độ phủ và khoảng thiếu người.

Người dùng không thấy công thức hoặc biến toán học trong bước nhập liệu.

## 6. Xem trước trước khi tạo lịch

Sau khi tải file, hiển thị:

```text
Ngày lập lịch: 02/11/2026
Số khoảng nhu cầu: 24
Tổng số cuộc gọi dự kiến: 612
Thời gian xử lý trung bình: 6,2 phút
Nhân viên đi làm: 18
Ca được phép dùng: Ca ngày, Ca đêm
Mức phục vụ: Tiêu chuẩn
```

Nếu có vấn đề, phân biệt lỗi và cảnh báo:

**Lỗi — phải sửa trước khi tạo:**

- Thiếu cột “Số cuộc gọi dự kiến”.
- Có mã nhân viên trùng.
- Khung giờ không đúng dạng.
- Số cuộc gọi là chữ hoặc số âm.
- Không có nhân viên nào đi làm.

**Cảnh báo — vẫn có thể tạo:**

- Một số khoảng không có nhu cầu.
- Nhu cầu có thể cao hơn số người đi làm.
- Dữ liệu theo giờ được chia đều.
- Một số nhân viên chỉ nhận một ca.

## 7. Thông báo lỗi thân thiện

| Tình huống | Thông báo |
|---|---|
| Thiếu sheet | `File cần có hai trang NhuCau và NhanVien. Hãy tải file mẫu.` |
| Thiếu cột | `Trang NhuCau chưa có cột Số cuộc gọi dự kiến.` |
| Sai khung giờ | `Khung giờ cần viết như 08:00–08:30.` |
| Số âm | `Số cuộc gọi không thể nhỏ hơn 0.` |
| AHT thiếu | `Hãy nhập thời gian xử lý trung bình hoặc điền giá trị chung trên màn hình.` |
| Mã trùng | `Mã NV001 xuất hiện nhiều lần.` |
| Ca không hợp lệ | `NV002 chưa được chọn ca nào nhưng đang đánh dấu đi làm.` |
| Không nhân viên | `Chưa có nhân viên nào được đánh dấu Đi làm hôm nay.` |
| Ngoài giờ | `Khung 21:00–21:30 nằm ngoài giờ phục vụ.` |

## 8. Dữ liệu lịch sử và log chi tiết để sau

Không đưa các phần sau vào MVP non-IT:

- Log từng cuộc gọi.
- Dữ liệu lịch sử nhiều ngày để forecast.
- Nhiều skill hoặc channel.
- Shrinkage tùy chỉnh.
- Occupancy tùy chỉnh.
- Direct demand bằng `required_agents`.
- Upload JSON.

Các phần này chỉ dành cho developer hoặc phiên bản sau. Người dùng chính chỉ cung cấp **nhu cầu dự kiến** và **khả năng nhận ca của nhân viên**.

## 9. INPUT tối thiểu cuối cùng

### Người dùng nhập trên màn hình

1. Ngày cần lập lịch.
2. Mức phục vụ: Tiêu chuẩn/Cao.
3. Các ca mẫu được phép dùng.
4. Một giá trị AHT chung nếu file không có AHT từng dòng.

### Người dùng điền trong file Excel

Sheet `NhuCau`:

```text
khung_gio
so_cuoc_goi_du_kien
thoi_gian_xu_ly_trung_binh_phut
```

Sheet `NhanVien`:

```text
ma_nhan_vien
ho_ten
di_lam
ca_ngay
ca_dem
```

Đây là phương án ít INPUT nhất nhưng vẫn đủ cho bài toán: **nhu cầu theo thời gian + người có thể nhận ca**. Phần còn lại do hệ thống tự tính.

## 10. Việc cần sửa trong code

Code hiện tại đang nhận log từng cuộc gọi trong `erlang_c.py`. Cần thêm adapter đọc workbook:

```text
mau_xep_lich.xlsx
→ đọc NhuCau và NhanVien
→ đổi khung_gio thành slot nội bộ
→ đổi ca_ngay/ca_dem thành ca mẫu
→ tính nhu cầu
→ tạo request nội bộ
→ gọi solver
```

Không nên bắt người dùng non-IT nhập format kỹ thuật chỉ vì module bên trong đang dùng format đó.
