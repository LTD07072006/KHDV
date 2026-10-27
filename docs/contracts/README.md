# Scheduling contract v1.0.0

Đây là biên dữ liệu duy nhất của hệ thống:

- `scheduling-request.schema.json`: adapter phát hành, solver nhận.
- `scheduling-result.schema.json`: solver phát hành, UI/API nhận.

Luồng đang áp dụng:

```text
Workbook NhuCau + NhanVien
        ↓
workbook_adapter.build_request_from_workbook()
        ↓
SchedulingRequest v1.0.0
        ↓
scheduling_solver.solve_request()
        ↓
SchedulingResult v1.0.0
```

Người dùng không nhập JSON, `required_agents`, Erlang C hay trọng số CP-SAT.
Các giá trị đó được adapter và backend tạo ra. Các module cũ dùng
`intervals`/`roster` chỉ được giữ để tham khảo lịch sử và không thuộc đường
chạy MVP mới.
