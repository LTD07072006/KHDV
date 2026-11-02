import type * as XLSXTypes from 'xlsx'
import type { DemandRow, Employee, ShiftId } from '@/types/scheduling'
import { requiredAgentsByErlangC } from './erlangPreview'

export type ParsedWorkbook = {
  demand: DemandRow[]
  employees: Employee[]
  warnings: string[]
}

const demandHeaders = ['khung_gio', 'so_cuoc_goi_du_kien', 'thoi_gian_xu_ly_trung_binh_phut']
const employeeHeaders = ['ma_nhan_vien', 'ho_ten', 'di_lam', 'ca_ngay', 'ca_dem']

function text(value: unknown) {
  return String(value ?? '').trim()
}

function number(value: unknown, label: string, row: number) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} ở dòng ${row} phải là số không âm.`)
  return parsed
}

function booleanValue(value: unknown, field: string, row: number) {
  const normalized = text(value).toLowerCase()
  if (['có', 'co', 'yes', 'y', '1', 'true', 'x'].includes(normalized)) return true
  if (['không', 'khong', 'no', 'n', '0', 'false', ''].includes(normalized)) return false
  throw new Error(`${field} ở dòng ${row} chỉ nhận “Có” hoặc “Không”.`)
}

function isThirtyMinuteSlot(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})[–-](\d{2}):(\d{2})$/)
  if (!match) return false
  const [, startHour, startMinute, endHour, endMinute] = match
  if ([startHour, endHour].some((hour) => Number(hour) > 23) || [startMinute, endMinute].some((minute) => Number(minute) > 59)) return false
  const start = Number(startHour) * 60 + Number(startMinute)
  const end = Number(endHour) * 60 + Number(endMinute)
  return Number.isInteger(start) && Number.isInteger(end) && (end - start + 1440) % 1440 === 30
}

function readSheetRows(
  xlsx: typeof import('xlsx'),
  workbook: XLSXTypes.WorkBook,
  sheetName: string,
  headers: string[],
) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`File cần có sheet “${sheetName}”. Hãy dùng workbook mẫu.`)
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (!rows.length) throw new Error(`Sheet “${sheetName}” chưa có dòng dữ liệu.`)
  const actualHeaders = Object.keys(rows[0]).map((header) => header.trim())
  const missing = headers.filter((header) => !actualHeaders.includes(header))
  if (missing.length) throw new Error(`Sheet “${sheetName}” thiếu cột: ${missing.join(', ')}.`)
  return rows.filter((row) => headers.some((header) => text(row[header]) !== ''))
}

export async function parseWorkbook(file: File, options?: { serviceTarget?: number; answerWithinSeconds?: number }): Promise<ParsedWorkbook> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: false })
  const demandRows = readSheetRows(XLSX, workbook, 'NhuCau', demandHeaders)
  const employeeRows = readSheetRows(XLSX, workbook, 'NhanVien', employeeHeaders)
  const warnings: string[] = []
  const demand: DemandRow[] = demandRows.map((row, index) => {
    const rowNumber = index + 2
    const time = text(row.khung_gio)
    if (!isThirtyMinuteSlot(time)) throw new Error(`Khung giờ ở dòng ${rowNumber} phải là một slot 30 phút dạng HH:MM–HH:MM.`)
    const normalizedTime = time.replace('-', '–')
    const [start, end] = normalizedTime.split('–').map((part) => {
      const [hour, minute] = part.split(':').map(Number)
      return hour * 60 + minute
    })
    if (start < 8 * 60 || end > 20 * 60) throw new Error(`Khung giờ ở dòng ${rowNumber} phải nằm trong 08:00–20:00.`)
    if (demandRows.slice(0, index).some((previous) => text(previous.khung_gio).replace('-', '–') === normalizedTime)) {
      throw new Error(`Khung giờ “${normalizedTime}” bị trùng ở dòng ${rowNumber}.`)
    }
    const calls = number(row.so_cuoc_goi_du_kien, 'Số cuộc gọi dự kiến', rowNumber)
    const rawAht = text(row.thoi_gian_xu_ly_trung_binh_phut)
    if (!rawAht && calls > 0) throw new Error(`Thời gian xử lý trung bình ở dòng ${rowNumber} không được để trống khi có cuộc gọi.`)
    const aht = rawAht ? number(rawAht, 'Thời gian xử lý trung bình', rowNumber) : 0
    return {
      time: normalizedTime,
      calls,
      aht,
      required: requiredAgentsByErlangC(
        calls,
        aht,
        options?.serviceTarget,
        options?.answerWithinSeconds,
      ),
    }
  })
  if (!demand.length) throw new Error('Sheet “NhuCau” chưa có dữ liệu nhu cầu.')
  const sortedDemand = [...demand].sort((left, right) => left.time.localeCompare(right.time))
  for (let index = 1; index < sortedDemand.length; index += 1) {
    const previousEnd = sortedDemand[index - 1].time.slice(6, 11)
    const currentStart = sortedDemand[index].time.slice(0, 5)
    if (previousEnd !== currentStart) warnings.push(`Chưa có dữ liệu nhu cầu giữa ${previousEnd} và ${currentStart}.`)
  }

  const ids = new Set<string>()
  const employees: Employee[] = employeeRows.map((row, index) => {
    const rowNumber = index + 2
    const id = text(row.ma_nhan_vien)
    const name = text(row.ho_ten)
    if (!id || !name) throw new Error(`Sheet “NhanVien” thiếu mã hoặc họ tên ở dòng ${rowNumber}.`)
    if (ids.has(id)) throw new Error(`Mã nhân viên “${id}” bị trùng ở dòng ${rowNumber}.`)
    ids.add(id)
    const working = booleanValue(row.di_lam, 'Đi làm', rowNumber)
    const allowedShifts: ShiftId[] = []
    if (booleanValue(row.ca_ngay, 'Ca ngày', rowNumber)) allowedShifts.push('ca_ngay')
    if (booleanValue(row.ca_dem, 'Ca đêm', rowNumber)) allowedShifts.push('ca_dem')
    if (working && !allowedShifts.length) warnings.push(`${name} đang đi làm nhưng chưa chọn ca.`)
    return {
      id,
      name,
      shift: '',
      breakTime: '',
      status: !working ? 'Nghỉ' : allowedShifts.length ? 'Có thể nhận ca' : 'Chưa chọn ca',
      working,
      allowedShifts,
    }
  })
  if (!employees.some((employee) => employee.working)) throw new Error('Không có nhân viên nào được đánh dấu “Đi làm”.')
  return { demand: sortedDemand, employees, warnings }
}
