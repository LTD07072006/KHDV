> **Trạng thái:** Tài liệu lịch sử/phân tích. Quyết định đang áp dụng nằm trong [B1_1_final_input_output_spec.md](D:/khdv/docs/B1_1_final_input_output_spec.md). Không dùng các ví dụ cũ trong file này để thiết kế UI MVP.

# Nghiên cứu và khuyến nghị INPUT tối ưu cho người dùng không chuyên IT

## 1. Kết luận ngắn

INPUT hợp lý nhất cho MVP là **một file Excel mẫu có hai sheet**, cộng với một vài lựa chọn đơn giản trên màn hình:

```text
File Excel
├── NhuCau       # số cuộc gọi dự kiến theo khung giờ
└── NhanVien     # ai có thể làm và có thể làm lúc nào

Form trên màn hình
├── Ngày cần lập lịch
├── Mức phục vụ: Tiêu chuẩn / Cao
└── Ca mẫu muốn dùng
```

Người dùng không cần nhập dữ liệu log từng cuộc gọi, Erlang C, số nhân viên cần, AHT bằng giây, skill ID, forecast method, shrinkage, occupancy, objective weight hoặc CP-SAT options.

## 2. Vì sao cần thay đổi hướng INPUT hiện tại?

### 2.1. Đầu vào tối thiểu của bài toán xếp lịch khác với đầu vào của bài toán dự báo

Để xếp lịch, solver cần biết:

1. Mỗi khoảng thời gian cần bao nhiêu năng lực phục vụ.
2. Nhân viên nào có thể được xếp vào khoảng thời gian đó.
3. Những ca nào được phép dùng.

Để dự báo, hệ thống mới cần thêm dữ liệu lịch sử. Vì vậy không nên bắt người dùng phải có log từng cuộc gọi mới chạy được bài toán xếp lịch.

### 2.2. Log từng cuộc gọi là dữ liệu quá kỹ thuật

Các cột như:

```text
timestamp_arrival
call_duration_seconds
abandoned
```

phù hợp với hệ thống kỹ thuật hoặc nguồn dữ liệu tổng đài, nhưng khó với quản lý nhập thủ công. Họ thường có báo cáo dạng:

```text
08:00–08:30 có 24 cuộc gọi, xử lý trung bình 6 phút
```

Nên nhận cả hai dạng, nhưng **dạng tổng hợp theo khung giờ phải là luồng mặc định**.

### 2.3. Người dùng thường biết “cần phục vụ bao nhiêu”, không biết “Erlang C cần bao nhiêu người”

Nếu có báo cáo dự kiến hoặc kế hoạch kinh doanh, họ có thể nhập số cuộc gọi dự kiến. Hệ thống tự tính số người cần. Không nên bắt họ tự nhập `required_agents`, vì đó là kết quả của mô hình.

## 3. Kiến trúc INPUT được khuyến nghị

### 3.1. Ba lớp dữ liệu

#### Lớp 1 — Người dùng nhập

- Ngày lập lịch.
- Khung giờ hoạt động.
- Số cuộc gọi dự kiến theo khoảng 30 phút hoặc 1 giờ.
- Thời gian xử lý trung bình theo phút.
- Danh sách nhân viên và giờ có thể làm.
- Ngày nghỉ hoặc người không đi làm.
- Chọn một mức phục vụ dễ hiểu.
- Chọn ca mẫu.

#### Lớp 2 — Hệ thống tự chuẩn hóa

- Chuẩn hóa tên cột và định dạng ngày giờ.
- Chia dữ liệu 1 giờ thành hai slot 30 phút nếu cần.
- Đổi phút thành giây.
- Đổi tên nhóm hỗ trợ thành mã nội bộ.
- Sinh các ca cụ thể từ ca mẫu.
- Tạo `SchedulingRequest` chuẩn.

#### Lớp 3 — Hệ thống tự tính

- Forecast nếu người dùng cung cấp lịch sử.
- Offered load.
- Erlang C.
- Số nhân viên cần.
- Coverage, shortage, overstaff.
- Lịch CP-SAT.

Người dùng chỉ nhìn thấy kết quả nghiệp vụ, không phải dữ liệu lớp 2 và 3.

## 4. File Excel người dùng nên nhập

Nên ưu tiên `.xlsx` vì người dùng có thể mở bằng Excel, nhìn thấy hướng dẫn và không gặp lỗi encoding tiếng Việt như CSV. Vẫn có thể hỗ trợ CSV như phương án phụ.

### Sheet 1: `NhuCau`

#### Mẫu đơn giản nhất cho một ngày và một nhóm

| Khung giờ | Số cuộc gọi dự kiến | Xử lý trung bình (phút) |
|---|---:|---:|
| 08:00–08:30 | 24 | 6 |
| 08:30–09:00 | 18 | 5 |
| 09:00–09:30 | 31 | 7 |

Tên cột trong file:

```text
khung_gio
so_cuoc_goi_du_kien
thoi_gian_xu_ly_trung_binh_phut
```

`khung_gio` là một giá trị dễ đọc như `08:00–08:30`; người dùng không phải tách ngày và giờ thành hai cột khi chỉ lập lịch một ngày.

#### Nếu người dùng chỉ có số cuộc gọi

Cho phép bỏ trống cột thời gian xử lý và nhập một giá trị chung trên màn hình:

```text
Thời gian xử lý trung bình: 6 phút
```

Hệ thống dùng 6 phút cho những dòng bị trống. Nếu có cả giá trị theo dòng và giá trị chung, giá trị theo dòng được ưu tiên.

#### Nếu người dùng có nhiều nhóm hỗ trợ

Thêm cột tùy chọn:

```text
nhom_ho_tro
```

Ví dụ:

| Khung giờ | Nhóm hỗ trợ | Số cuộc gọi dự kiến | Xử lý trung bình (phút) |
|---|---|---:|---:|
| 08:00–08:30 | Thoại | 24 | 6 |
| 08:00–08:30 | Chat | 10 | 4 |
| 08:30–09:00 | Thoại | 18 | 5 |

Nếu bỏ cột này, hệ thống tự đặt tên nhóm là `Hỗ trợ chung`.

#### Cho phép nhập dữ liệu theo 1 giờ

Người dùng có thể chọn trong form:

```text
Dữ liệu của tôi theo: (•) 30 phút  ( ) 1 giờ
```

Nếu chọn 1 giờ, hệ thống chia đều số cuộc gọi thành hai slot 30 phút và hiển thị cảnh báo:

> Dữ liệu theo giờ đã được chia đều để tính lịch. Kết quả trong hai nửa giờ là ước lượng.

Không tự chia dữ liệu 1 giờ nếu người dùng chưa chọn tùy chọn này.

### Sheet 2: `NhanVien`

#### Mẫu đơn giản nhất cho một ngày

| Mã nhân viên | Họ tên | Đi làm hôm nay? | Có thể bắt đầu từ | Có thể làm đến |
|---|---|---|---|---|
| NV001 | Nguyễn Văn A | Có | 08:00 | 17:00 |
| NV002 | Trần Thị B | Có | 09:00 | 18:00 |
| NV003 | Lê Văn C | Không |  |  |
| NV004 | Phạm Thị D | Có | 11:00 | 20:00 |

Tên cột trong file:

```text
ma_nhan_vien
ho_ten
di_lam
co_the_bat_dau_tu
co_the_lam_den
```

Ở MVP một ngày, không nên bắt nhập `ngay_nghi` vì cột `di_lam` đã trả lời câu hỏi chính. `ngay_nghi` chỉ cần khi mở rộng lịch nhiều ngày.

#### Khi có nhiều nhóm hỗ trợ

Thêm cột tùy chọn:

```text
nhom_ho_tro
```

Ví dụ:

| Mã nhân viên | Họ tên | Đi làm hôm nay? | Có thể bắt đầu từ | Có thể làm đến | Nhóm hỗ trợ |
|---|---|---|---|---|---|
| NV001 | Nguyễn Văn A | Có | 08:00 | 17:00 | Thoại; Chat |
| NV002 | Trần Thị B | Có | 09:00 | 18:00 | Chat |

Nếu chỉ có một nhóm, bỏ cột này. Hệ thống tự gán tất cả nhân viên vào `Hỗ trợ chung`.

## 5. Các lựa chọn trên màn hình, không đặt trong file

### 5.1. Ngày lập lịch

```text
Ngày cần lập lịch: [02/11/2026]
```

Không lặp lại ngày trong từng dòng sheet `NhuCau` ở MVP một ngày.

### 5.2. Mức phục vụ

```text
(•) Tiêu chuẩn — hướng tới trả lời 80% cuộc gọi trong 20 giây
( ) Cao       — hướng tới trả lời 90% cuộc gọi trong 20 giây
```

Hệ thống tự map sang SLA và thời gian chờ. Nếu sau này cần tùy chỉnh, đặt trong mục “Thiết lập nâng cao”, không nằm trên màn hình chính.

### 5.3. Ca mẫu

```text
[x] Ca ngày: 08:00–20:00, nghỉ 12:00–13:00
[x] Ca đêm: 20:00–08:00 ngày hôm sau, nghỉ 00:00–01:00
```

Ca mẫu do nhóm phát triển chuẩn bị và kiểm thử. Người dùng chỉ chọn ca.

### 5.4. Dữ liệu cuộc gọi là lịch sử hay dự kiến?

Nên hỏi một câu đơn giản:

```text
Dữ liệu bạn tải lên là:
(•) Nhu cầu dự kiến cho ngày cần lập lịch
( ) Số liệu lịch sử để hệ thống ước tính
```

- **Nhu cầu dự kiến:** dùng trực tiếp số cuộc gọi trong sheet `NhuCau`.
- **Số liệu lịch sử:** người dùng tải nhiều ngày; hệ thống tự tính trung bình theo ngày/giờ và tạo nhu cầu cho ngày lập lịch.

MVP nên mặc định là **Nhu cầu dự kiến**, vì đây là cách ít gây hiểu nhầm và không cần thêm lựa chọn forecast phức tạp.

## 6. Có nên dùng một file hay hai file?

### Khuyến nghị chính: một file Excel, hai sheet

Ưu điểm:

- Người dùng chỉ phải tải lên một file.
- Dễ tải mẫu, điền, lưu và gửi cho người khác.
- Nhân viên và nhu cầu luôn thuộc cùng một lần chạy.
- Có thể đặt sheet `HuongDan` ở đầu file.

File đề xuất:

```text
mau_xep_lich.xlsx
├── HuongDan
├── NhuCau
└── NhanVien
```

### Vì sao không nên bắt nhập JSON?

JSON phù hợp để module giao tiếp, không phù hợp để quản lý nhập tay. JSON dễ sai dấu ngoặc, tên field và định dạng timestamp.

### Vì sao không nên bắt upload log từng cuộc gọi trong MVP?

Vì log thường cần export từ hệ thống tổng đài, có nhiều cột khó hiểu và không cần thiết nếu người dùng đã có báo cáo tổng hợp.

## 7. Validation phù hợp với người dùng

Không hiện lỗi schema thô. Chuyển thành câu hướng dẫn:

| Lỗi | Thông báo |
|---|---|
| Thiếu sheet | `File cần có hai trang “NhuCau” và “NhanVien”. Bạn có thể tải file mẫu.` |
| Thiếu cột | `Trang NhuCau chưa có cột “Số cuộc gọi dự kiến”.` |
| Trùng nhu cầu | `Khoảng 08:00–08:30 có hai dòng cùng nhóm. Hãy gộp thành một dòng.` |
| Giờ sai | `Khung giờ cần viết như 08:00–08:30.` |
| Số âm | `Số cuộc gọi không thể là số âm.` |
| AHT sai | `Thời gian xử lý cần là số phút lớn hơn 0.` |
| Nhân viên trùng mã | `Mã NV001 xuất hiện nhiều lần.` |
| Khoảng làm sai | `Giờ có thể làm đến phải sau giờ bắt đầu.` |
| Không có nhân viên | `Chưa có nhân viên nào được đánh dấu “Có”.` |
| Ngoài giờ phục vụ | `Khung 21:00–21:30 nằm ngoài giờ phục vụ đã chọn.` |

### Cảnh báo, không chặn

- Một số slot không có cuộc gọi.
- Nhu cầu lớn hơn số nhân viên.
- Nhân viên có khoảng làm ngắn hơn ca mẫu.
- Dữ liệu 1 giờ được chia thành hai slot.

Các cảnh báo này vẫn cho phép tạo lịch nếu dữ liệu không vi phạm điều kiện bắt buộc.

## 8. Trường hợp nào cần dữ liệu nâng cao?

Chỉ bật trong mục dành cho developer hoặc quản trị viên:

- Log từng cuộc gọi.
- Nhiều ngày lịch sử để forecast.
- Nhiều skill/channel.
- Lịch sử làm việc 6 ngày trước.
- Preference ca.
- Shrinkage và occupancy tùy chỉnh.
- Direct demand theo `required_agents`.
- Upload `SchedulingRequest` JSON.

Những thứ này không nên xuất hiện trong màn hình chính vì làm người dùng nhầm rằng họ phải hiểu mô hình toán.

## 9. Quyết định cuối cùng cho MVP

### Người dùng nhập

**Trên màn hình:**

1. Ngày cần lập lịch.
2. Dữ liệu là “nhu cầu dự kiến” hay “lịch sử”.
3. Mức phục vụ Tiêu chuẩn/Cao.
4. Ca mẫu muốn sử dụng.
5. File Excel một workbook có sheet `NhuCau` và `NhanVien`.

**Trong sheet `NhuCau`:**

```text
khung_gio
so_cuoc_goi_du_kien
thoi_gian_xu_ly_trung_binh_phut
```

**Trong sheet `NhanVien`:**

```text
ma_nhan_vien
ho_ten
di_lam
co_the_bat_dau_tu
co_the_lam_den
```

### Hệ thống tự tính

```text
slot 30 phút
forecast hoặc dùng trực tiếp nhu cầu dự kiến
Erlang C
required agents
shift instances
coverage
shortage/overstaff
CP-SAT schedule
validation
```

Đây là phương án ít field nhất nhưng vẫn đủ thông tin để giải bài toán, dễ giải thích cho người dùng non‑IT và không làm mất phần thuật toán cần trình bày trong BTL.

## 10. Thay đổi cần làm trong code

Code hiện tại nhận log cấp từng cuộc gọi trong `erlang_c.py`. Để khớp INPUT được khuyến nghị, cần thêm adapter đọc workbook:

```text
mau_xep_lich.xlsx
→ đọc NhuCau và NhanVien
→ chuẩn hóa khung giờ / phút / tên nhóm
→ tạo demand theo slot
→ tạo SchedulingRequest nội bộ
→ gọi solver
```

Không cần bỏ module Erlang C hoặc solver. Chỉ thay đổi lớp nhập liệu; phần toán và phần xếp lịch vẫn nằm phía sau.
