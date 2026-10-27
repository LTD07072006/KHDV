# Contract đang dùng trong KHDV

```text
Excel NhuCau + NhanVien
  → workbook_adapter.build_request_from_workbook()
  → SchedulingRequest v1.0.0
  → solver.solve_contract() / scheduling_solver.solve_request()
  → SchedulingResult v1.0.0
```

Mã nguồn chính:

- `workbook_adapter.py`: đọc workbook và tính demand bằng Erlang C.
- `scheduling_contract.py`: kiểm tra request/result theo JSON Schema.
- `scheduling_solver.py`: CP-SAT consumer của request v1.0.0.
- `solver.py`: entry point công khai, chỉ ủy quyền cho solver mới.
- `docs/contracts/scheduling-request.schema.json` và `scheduling-result.schema.json`.
- `app.py`: UI Streamlit cũ, chỉ giữ tham khảo; chưa thuộc đường chạy MVP v1.0.0.

Người dùng chỉ nhập workbook đơn giản. `required_agents`, Erlang C và trọng số
CP-SAT do backend tạo. `intervals`, `roster`, `understaffed` là contract cũ và
không còn được `solver.py` nhận.
