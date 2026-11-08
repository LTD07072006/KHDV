import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseWorkbook } from './workbookParser'

function fixture(name: string) {
  const path = resolve(process.cwd(), 'public', 'fixtures', name)
  return new File([readFileSync(path)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

describe('parseWorkbook', () => {
  it('reads a valid workbook into demand and employees', async () => {
    const parsed = await parseWorkbook(fixture('01_normal.xlsx'))
    expect(parsed.demand.length).toBeGreaterThan(0)
    expect(parsed.employees.length).toBe(6)
    expect(parsed.warnings).toHaveLength(0)
    expect(parsed.demand[0].required).toBeGreaterThan(0)
  })

  it('reads values under headers with surrounding whitespace on both sheets', async () => {
    const xlsx = await import('xlsx')
    const workbook = xlsx.read(await fixture('01_normal.xlsx').arrayBuffer())
    workbook.Sheets.NhuCau.A1.v = ' khung_gio '
    workbook.Sheets.NhanVien.A1.v = ' ma_nhan_vien '
    const bytes = xlsx.write(workbook, { type: 'array', bookType: 'xlsx' })
    const parsed = await parseWorkbook(new File([bytes], 'trimmed-headers.xlsx'))
    expect(parsed.demand[0].time).toBe('08:00–08:30')
    expect(parsed.employees).toHaveLength(6)
  })

  it('rejects duplicate employee ids before preview', async () => {
    await expect(parseWorkbook(fixture('04_invalid_data.xlsx'))).rejects.toThrow('bị trùng')
  })

  it('rejects overlapping demand slots even when they appear out of order', async () => {
    const xlsx = await import('xlsx')
    const workbook = xlsx.read(await fixture('01_normal.xlsx').arrayBuffer())
    workbook.Sheets.NhuCau = xlsx.utils.aoa_to_sheet([
      ['khung_gio', 'so_cuoc_goi_du_kien', 'thoi_gian_xu_ly_trung_binh_phut'],
      ['08:15–08:45', 18, 5],
      ['08:00–08:30', 24, 6],
    ])
    const bytes = xlsx.write(workbook, { type: 'array', bookType: 'xlsx' })
    await expect(parseWorkbook(new File([bytes], 'overlap.xlsx'))).rejects.toThrow('bị chồng lấn')
  })

  it('rejects a demand slot outside operating hours', async () => {
    const xlsx = await import('xlsx')
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ['khung_gio', 'so_cuoc_goi_du_kien', 'thoi_gian_xu_ly_trung_binh_phut'],
      ['07:30–08:00', 10, 6],
    ]), 'NhuCau')
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ['ma_nhan_vien', 'ho_ten', 'di_lam', 'ca_ngay', 'ca_dem'],
      ['NV001', 'A', 'Có', 'Có', 'Không'],
    ]), 'NhanVien')
    const bytes = xlsx.write(workbook, { type: 'array', bookType: 'xlsx' })
    await expect(parseWorkbook(new File([bytes], 'outside.xlsx'))).rejects.toThrow('08:00–20:00')
  })

  it('rejects missing AHT when there are calls', async () => {
    const xlsx = await import('xlsx')
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ['khung_gio', 'so_cuoc_goi_du_kien', 'thoi_gian_xu_ly_trung_binh_phut'],
      ['08:00–08:30', 10, ''],
    ]), 'NhuCau')
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ['ma_nhan_vien', 'ho_ten', 'di_lam', 'ca_ngay', 'ca_dem'],
      ['NV001', 'A', 'Có', 'Có', 'Không'],
    ]), 'NhanVien')
    const bytes = xlsx.write(workbook, { type: 'array', bookType: 'xlsx' })
    await expect(parseWorkbook(new File([bytes], 'missing-aht.xlsx'))).rejects.toThrow('không được để trống')
  })
})
