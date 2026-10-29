"""Generate the 4 official test and demo fixtures for Day 8 of Contact Center Scheduling."""

from __future__ import annotations

from pathlib import Path
import pandas as pd
from erlang_c import minimum_agents

FIXTURES_DIR = Path("fixtures")
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

# 24 standard 30-minute slots from 08:00 to 20:00
SLOTS = [
    f"{h:02d}:{m:02d}–{h + (1 if m == 30 else 0):02d}:{(0 if m == 30 else 30):02d}"
    for h in range(8, 20)
    for m in (0, 30)
]

HUONG_DAN_ROWS = [
    {"Muc": "MẪU XẾP LỊCH NHÂN VIÊN", "NoiDung": "Dùng cho hệ thống xếp lịch Contact Center tự động"},
    {"Muc": "Quy tắc 1", "NoiDung": "Giữ nguyên 3 sheet: HuongDan, NhuCau, NhanVien."},
    {"Muc": "Quy tắc 2", "NoiDung": "Sheet NhuCau điền khung giờ (HH:MM–HH:MM), số cuộc gọi và AHT (phút)."},
    {"Muc": "Quy tắc 3", "NoiDung": "Sheet NhanVien điền mã nhân viên, họ tên và chọn Có/Không cho các ca."},
]


def write_excel(file_path: Path, df_huongdan: pd.DataFrame, df_nhucau: pd.DataFrame, df_nhanvien: pd.DataFrame):
    with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
        df_huongdan.to_excel(writer, sheet_name="HuongDan", index=False)
        df_nhucau.to_excel(writer, sheet_name="NhuCau", index=False)
        df_nhanvien.to_excel(writer, sheet_name="NhanVien", index=False)
    print(f"Created: {file_path}")


# ==============================================================================
# Fixture 1: 01_normal.xlsx (Bình thường - Đủ người, 100% độ phủ)
# ==============================================================================
# 6 nhân viên đi làm ca ngày. Nhu cầu dao động 3 - 5 người, giờ nghỉ trưa 12:00-13:00 không có cuộc gọi (0 cuộc gọi -> 0 người cần).
# Đảm bảo solver giải ra OPTIMAL, shortage = 0, phủ 100%.
def create_fixture_1():
    demand_data = []
    for slot in SLOTS:
        if slot in ("12:00–12:30", "12:30–13:00"):
            calls, aht = 0, 5.0
        else:
            calls, aht = 14, 5.0  # 14 calls in 30 mins with 5 min AHT -> Erlang C ~ 4 agents
        demand_data.append({
            "khung_gio": slot,
            "so_cuoc_goi_du_kien": calls,
            "thoi_gian_xu_ly_trung_binh_phut": aht,
        })

    employees_data = [
        {"ma_nhan_vien": "NV001", "ho_ten": "Nguyễn Văn An", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV002", "ho_ten": "Trần Thị Bình", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV003", "ho_ten": "Lê Văn Cường", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV004", "ho_ten": "Phạm Thị Dung", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV005", "ho_ten": "Hoàng Văn Em", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV006", "ho_ten": "Võ Thị Phương", "di_lam": "Không", "ca_ngay": "Không", "ca_dem": "Không"},
    ]

    write_excel(
        FIXTURES_DIR / "01_normal.xlsx",
        pd.DataFrame(HUONG_DAN_ROWS),
        pd.DataFrame(demand_data),
        pd.DataFrame(employees_data),
    )


# ==============================================================================
# Fixture 2: 02_peak_demand.xlsx (Giờ cao điểm - Tăng vọt lúc 09:30-11:30 & 14:00-15:30)
# ==============================================================================
# Giờ bình thường cần 4 người, nhưng giờ cao điểm tăng lên 40-50 cuộc gọi (cần 10-12 người).
# Có 6 nhân viên đi làm -> Xuất hiện cảnh báo thiếu người (Shortage) ở các khung giờ cao điểm.
def create_fixture_2():
    demand_data = []
    for slot in SLOTS:
        if slot in ("12:00–12:30", "12:30–13:00"):
            calls, aht = 2, 5.0
        elif slot in ("09:30–10:00", "10:00–10:30", "10:30–11:00", "14:00–14:30", "14:30–15:00"):
            calls, aht = 45, 6.0  # Peak calls -> Erlang C ~ 11-12 agents
        else:
            calls, aht = 15, 5.0  # Normal calls -> Erlang C ~ 4 agents
        demand_data.append({
            "khung_gio": slot,
            "so_cuoc_goi_du_kien": calls,
            "thoi_gian_xu_ly_trung_binh_phut": aht,
        })

    employees_data = [
        {"ma_nhan_vien": "NV001", "ho_ten": "Nguyễn Văn An", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV002", "ho_ten": "Trần Thị Bình", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV003", "ho_ten": "Lê Văn Cường", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV004", "ho_ten": "Phạm Thị Dung", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV005", "ho_ten": "Hoàng Văn Em", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV006", "ho_ten": "Đỗ Văn Hưng", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
    ]

    write_excel(
        FIXTURES_DIR / "02_peak_demand.xlsx",
        pd.DataFrame(HUONG_DAN_ROWS),
        pd.DataFrame(demand_data),
        pd.DataFrame(employees_data),
    )


# ==============================================================================
# Fixture 3: 03_understaffed.xlsx (Thiếu nhân viên - Nhu cầu bình thường nhưng chỉ 2 người đi làm)
# ==============================================================================
# Nhu cầu cần 5-6 người mỗi slot. Nhưng chỉ có 2 nhân viên đi làm (NV001 ca ngày, NV002 ca đêm).
# Solver vẫn tạo lịch thành công cho 2 nhân viên và đưa ra cảnh báo thiếu người diện rộng.
def create_fixture_3():
    demand_data = []
    for slot in SLOTS:
        demand_data.append({
            "khung_gio": slot,
            "so_cuoc_goi_du_kien": 20,
            "thoi_gian_xu_ly_trung_binh_phut": 5.5,
        })

    employees_data = [
        {"ma_nhan_vien": "NV001", "ho_ten": "Nguyễn Văn An", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV002", "ho_ten": "Trần Thị Bình", "di_lam": "Có", "ca_ngay": "Không", "ca_dem": "Có"},
        {"ma_nhan_vien": "NV003", "ho_ten": "Lê Văn Cường", "di_lam": "Không", "ca_ngay": "Không", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV004", "ho_ten": "Phạm Thị Dung", "di_lam": "Không", "ca_ngay": "Không", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV005", "ho_ten": "Hoàng Văn Em", "di_lam": "Không", "ca_ngay": "Không", "ca_dem": "Không"},
    ]

    write_excel(
        FIXTURES_DIR / "03_understaffed.xlsx",
        pd.DataFrame(HUONG_DAN_ROWS),
        pd.DataFrame(demand_data),
        pd.DataFrame(employees_data),
    )


# ==============================================================================
# Fixture 4: 04_invalid_data.xlsx (Dữ liệu lỗi - Kiểm tra validation)
# ==============================================================================
# Chứa lỗi nghiệp vụ rõ ràng:
# 1. Nhân viên NV002 đi làm ("Có") nhưng cả 2 ca đều để "Không" (chưa chọn ca).
# 2. Nhân viên NV004 bị trùng lặp mã nhân viên với NV001.
# Khi tải lên, hệ thống sẽ chặn và đưa ra cảnh báo lỗi validation rõ ràng.
def create_fixture_4():
    demand_data = [
        {"khung_gio": "08:00–08:30", "so_cuoc_goi_du_kien": 15, "thoi_gian_xu_ly_trung_binh_phut": 5.0},
        {"khung_gio": "08:30–09:00", "so_cuoc_goi_du_kien": 18, "thoi_gian_xu_ly_trung_binh_phut": 5.0},
    ]

    employees_data = [
        {"ma_nhan_vien": "NV001", "ho_ten": "Nguyễn Văn An", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV002", "ho_ten": "Trần Thị Bình (Lỗi: Chưa chọn ca)", "di_lam": "Có", "ca_ngay": "Không", "ca_dem": "Không"},
        {"ma_nhan_vien": "NV001", "ho_ten": "Lê Văn Cường (Lỗi: Trùng mã NV001)", "di_lam": "Có", "ca_ngay": "Có", "ca_dem": "Không"},
    ]

    write_excel(
        FIXTURES_DIR / "04_invalid_data.xlsx",
        pd.DataFrame(HUONG_DAN_ROWS),
        pd.DataFrame(demand_data),
        pd.DataFrame(employees_data),
    )


if __name__ == "__main__":
    create_fixture_1()
    create_fixture_2()
    create_fixture_3()
    create_fixture_4()
    print("All 4 fixtures created successfully in ./fixtures/")
