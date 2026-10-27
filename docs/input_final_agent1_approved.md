> **Trạng thái:** Tài liệu lịch sử/phân tích. Quyết định đang áp dụng nằm trong [B1_1_final_input_output_spec.md](D:/khdv/docs/B1_1_final_input_output_spec.md). Không dùng các ví dụ cũ trong file này để thiết kế UI MVP.

# INPUT cuối cùng — Phiên bản đơn giản cho người dùng không chuyên IT

Phiên bản này giữ lại các phản biện OR/CP-SAT quan trọng nhưng thiết kế màn hình theo ngôn ngữ nghiệp vụ. Người dùng không phải nhập công thức, xác suất, trọng số tối ưu, JSON Schema hay cấu hình solver. Hệ thống tự tính các giá trị toán học và trung gian.

## 1. Nguyên tắc cho người dùng

- Chỉ hỏi những điều người dùng biết: ngày cần xếp lịch, giờ phục vụ, số cuộc gọi, thời gian xử lý, danh sách nhân viên và ngày nghỉ.
- Dùng file mẫu tiếng Việt, có thể mở bằng Excel.
- Có giá trị mặc định cho giờ làm, giờ nghỉ và mức phục vụ.
- Các trường nâng cao được hệ thống tự tính hoặc ẩn khỏi luồng chính.
- Trong MVP, người dùng không cần biết CP-SAT, Erlang C, offered load, skill ID, quantile, objective weight, shortage variable hay JSON contract.

## 2. Những thông tin người dùng nhập

### A. Kỳ cần lập lịch

Nhập bằng form:

| Trên màn hình | Ví dụ | Mặc định MVP |
|---|---|---|
| Ngày bắt đầu | 02/11/2026 | Hôm nay hoặc ngày demo |
| Ngày kết thúc | 02/11/2026 | Cùng ngày với ngày bắt đầu |
| Giờ bắt đầu phục vụ | 08:00 | 08:00 |
| Giờ kết thúc phục vụ | 20:00 | 20:00 |

Múi giờ cố định là Việt Nam. Hệ thống tự chia thành từng khoảng 30 phút; người dùng không cần chọn slot size.

### B. Số cuộc gọi và thời gian xử lý

Người dùng tải lên bảng CSV/XLSX theo mẫu:

```csv
ngay,gio,so_cuoc_goi,thoi_gian_xu_ly_trung_binh_phut
02/11/2026,08:00,24,6
02/11/2026,08:30,18,5
02/11/2026,09:00,31,7
```

Giải thích đơn giản:

- `ngay`: ngày ghi nhận.
- `gio`: giờ bắt đầu khoảng 30 phút.
- `so_cuoc_goi`: số cuộc gọi đến trong khoảng đó.
- `thoi_gian_xu_ly_trung_binh_phut`: trung bình một cuộc gọi mất bao nhiêu phút để xử lý.

Hệ thống tự đổi phút sang giây và tự tính nhu cầu nhân viên. Không yêu cầu người dùng đưa offered load hoặc số nhân viên cần.

Nếu chỉ có một nhóm phục vụ, hệ thống mặc định “Hỗ trợ chung”. Nếu có nhiều nhóm, bật cột dễ hiểu `nhom_ho_tro`, ví dụ “Thoại”, “Chat”. Người dùng không cần nhập mã kỹ thuật `skill_id`.

Tùy chọn về sau: nếu doanh nghiệp có dữ liệu từng cuộc gọi, hệ thống có thể nhận file log chi tiết. Đây không phải file bắt buộc cho MVP.

### C. Danh sách nhân viên

Người dùng tải lên bảng theo mẫu:

```csv
ma_nhan_vien,ho_ten,co_the_lam,gio_bat_dau,gio_ket_thuc,ngay_nghi
NV001,Nguyen Van A,Co,08:00,17:00,
NV002,Tran Thi B,Co,09:00,18:00,03/11/2026
NV003,Le Van C,Khong,,,
```

Giải thích:

- `ma_nhan_vien`: mã duy nhất của nhân viên.
- `ho_ten`: tên hiển thị trong lịch.
- `co_the_lam`: Có/Không trong kỳ đang lập lịch.
- `gio_bat_dau`, `gio_ket_thuc`: khoảng giờ có thể làm.
- `ngay_nghi`: ngày nhân viên xin nghỉ, nếu có.

Trong MVP một ngày, chỉ cần mã, tên, có thể làm hay không, khoảng giờ có thể làm và ngày nghỉ nếu có. Các giới hạn tuần và lịch sử nhiều ngày có thể bổ sung khi làm lịch 7 ngày.

### D. Chọn mức phục vụ

Không hiển thị các thông số Erlang bằng tên kỹ thuật. Người dùng chọn một lựa chọn dễ hiểu:

- **Tiêu chuẩn** — mặc định: hướng tới trả lời 80% cuộc gọi trong 20 giây.
- **Cao** — ví dụ: hướng tới trả lời 90% cuộc gọi trong 20 giây.

Hệ thống tự chuyển lựa chọn này thành tham số để tính số nhân viên cần. Các con số chính xác có thể được giải thích trong phần kết quả, nhưng không bắt người dùng cấu hình nếu họ không muốn.

### E. Chọn ca làm

MVP cung cấp sẵn 2–3 lựa chọn, ví dụ:

- Ca ngày: 08:00–20:00, nghỉ 12:00–13:00.
- Ca đêm: 20:00–08:00 ngày hôm sau, nghỉ 00:00–01:00.

Người dùng chỉ bật/tắt các ca áp dụng. Hệ thống tự hiểu mỗi ca có 8 giờ làm và 1 giờ nghỉ. Về mặt tính toán, thời gian từ đầu đến cuối ca là 9 giờ; 1 giờ break không được tính là thời gian phục vụ.

### F. Ngày nghỉ và trường hợp đặc biệt

Người dùng có thể nhập ngày nghỉ qua cột `ngay_nghi` hoặc một bảng nhỏ:

```csv
ma_nhan_vien,ngay_nghi,ghi_chu
NV002,03/11/2026,Việc cá nhân
```

Ghi chú chỉ để con người đọc; solver không cần dùng nội dung ghi chú.

## 3. Những việc hệ thống tự làm

Người dùng không nhập:

- Chia dữ liệu thành slot 30 phút.
- Dự báo lượng cuộc gọi.
- Tính số nhân viên cần bằng Erlang C.
- Quy đổi phút sang giây.
- Tính offered load.
- Sinh các ca cụ thể từ ca mẫu và ngày cần xếp.
- Tính mức thiếu/thừa nhân viên.
- Tối ưu lịch bằng CP-SAT.
- Kiểm tra nghỉ giữa ca, số ca/ngày và số ngày làm liên tiếp.

Nếu thiếu nhân viên, hệ thống vẫn hiển thị lịch và báo rõ khoảng nào thiếu bao nhiêu người; không gọi đó là lịch đáp ứng đầy đủ.

## 4. Hai nguồn nhu cầu — không dùng lẫn

Luồng chính dùng file số cuộc gọi để hệ thống tự tính nhu cầu.

Một chế độ dành cho người phát triển có thể nhập thẳng số nhân viên cần theo từng khoảng giờ để test solver. Chế độ đó không xuất hiện mặc định và không được kết hợp âm thầm với file cuộc gọi.

## 5. Kiểm tra file và hướng dẫn lỗi

Khi người dùng tải file lên, giao diện nên báo lỗi bằng ngôn ngữ thông thường:

- “Thiếu cột ngày” thay vì JSON Schema error.
- “Số cuộc gọi phải là số từ 0 trở lên”.
- “Thời gian xử lý cần lớn hơn 0 phút khi có cuộc gọi”.
- “Mã nhân viên bị trùng”.
- “Giờ kết thúc phải sau giờ bắt đầu”.
- “NV002 có ngày nghỉ trong toàn bộ kỳ lập lịch”.
- “Không có nhân viên phù hợp cho nhóm Chat trong khoảng 10:00”.

Hệ thống tự chuyển những lỗi này sang diagnostics nội bộ có cấu trúc.

## 6. Phạm vi màn hình nhập liệu MVP

Màn hình chỉ cần ba bước:

1. **Chọn kỳ lập lịch:** ngày bắt đầu/kết thúc, giờ phục vụ.
2. **Tải dữ liệu:** file cuộc gọi và file nhân viên; có nút tải file mẫu.
3. **Chọn cách phục vụ:** mức Tiêu chuẩn/Cao và các ca mẫu muốn dùng.

Nút cuối: **Tạo lịch**.

Các tham số kỹ thuật như shrinkage, occupancy, quantile, solver time limit, số worker, seed, priority, objective weights chỉ để trong cấu hình nội bộ hoặc Advanced settings cho nhóm phát triển; không hỏi người dùng non-IT trong luồng chính.

## 7. Ranh giới MVP

MVP đơn giản nhất nên hỗ trợ:

- Một ngày lập lịch.
- Một nhóm hỗ trợ mặc định.
- Dữ liệu cuộc gọi tổng hợp theo từng 30 phút.
- Danh sách nhân viên với giờ sẵn sàng và ngày nghỉ.
- Ba ca mẫu cố định.
- Hai mức phục vụ dễ hiểu.

Sau khi luồng một ngày hoạt động ổn mới mở rộng lên nhiều nhóm hỗ trợ, lịch 7 ngày, dữ liệu log chi tiết và quy tắc tùy chỉnh.
