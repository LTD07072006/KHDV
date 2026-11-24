import {
  identifier, isDate, isSlotStart, MAX_EMPLOYEES, rangeSlots, slotKey,
  type Interval, type Shift, type Slot, type TimeRange,
} from '@/services/scheduleV2'
import { blankGroup, type EmployeeDraft, type GroupDraft } from '@/services/scheduleV2Form'

const MAX_CSV_BYTES = 2 * 1024 * 1024
const UTF8_BOM = '\ufeff'

export type ConfigCsvKind = 'groups' | 'operating' | 'employees' | 'shifts'

export function parseCsvTable(rawText: string): string[][] {
  const text = rawText.startsWith(UTF8_BOM) ? rawText.slice(1) : rawText
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field.trim())
      field = ''
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(field.trim())
      if (row.some((cell) => cell !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (inQuotes) throw new Error('Tệp CSV có dấu ngoặc kép chưa đóng.')
  row.push(field.trim())
  if (row.some((cell) => cell !== '')) rows.push(row)
  return rows
}

function readHeaderMap(rows: string[][], required: string[]): Map<string, number> {
  if (rows.length < 2) throw new Error('Tệp CSV cần có hàng tiêu đề và ít nhất 1 dòng dữ liệu.')
  const headers = rows[0].map((h) => h.toLowerCase().trim())
  const map = new Map<string, number>()
  for (let i = 0; i < headers.length; i += 1) {
    const h = headers[i]
    if (!h) continue
    if (map.has(h)) throw new Error(`Cột "${h}" bị trùng trong hàng tiêu đề CSV.`)
    map.set(h, i)
  }
  for (const col of required) {
    if (!map.has(col)) throw new Error(`Thiếu cột bắt buộc "${col}" trong tệp CSV.`)
  }
  return map
}

function cell(row: string[], map: Map<string, number>, col: string): string {
  const index = map.get(col)
  return index === undefined ? '' : (row[index] ?? '').trim()
}

function parseTimeRangeToken(token: string, rowNum: number, label: string): TimeRange {
  const match = /^(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})$/.exec(token.trim())
  if (!match) throw new Error(`Dòng ${rowNum}: ${label} "${token}" cần dạng HH:MM-HH:MM.`)
  const [, start, end] = match
  if (!rangeSlots({ start, end }).length) {
    throw new Error(`Dòng ${rowNum}: ${label} "${token}" phải theo mốc 30 phút và giờ kết thúc sau giờ bắt đầu.`)
  }
  return { start, end }
}

export function parseGroupsCsv(text: string): GroupDraft[] {
  const rows = parseCsvTable(text)
  const map = readHeaderMap(rows, ['id', 'name'])
  const dataRows = rows.slice(1)
  if (dataRows.length > 10) throw new Error('Khai báo tối đa 10 nhóm trong tệp CSV.')

  const seen = new Set<string>()
  return dataRows.map((row, index) => {
    const rowNum = index + 2
    const id = cell(row, map, 'id')
    const name = cell(row, map, 'name')
    if (!identifier(id) || !identifier(name)) {
      throw new Error(`Dòng ${rowNum}: Mã nhóm và tên nhóm không được trống (tối đa 100 ký tự).`)
    }
    if (seen.has(id)) throw new Error(`Dòng ${rowNum}: Mã nhóm "${id}" bị trùng.`)
    seen.add(id)

    const defaults = blankGroup()
    const sla = cell(row, map, 'target_sla_percent') || defaults.sla
    const wait = cell(row, map, 'waiting_seconds') || defaults.wait
    const aht = cell(row, map, 'aht_seconds') || defaults.aht
    const samples = cell(row, map, 'sample_count')
    const cutoff = cell(row, map, 'cutoff_before')
    return { id, name, sla, wait, aht, samples, cutoff }
  })
}

export function parseOperatingCsv(text: string): Interval[] {
  const rows = parseCsvTable(text)
  const map = readHeaderMap(rows, ['date', 'start', 'end'])
  const dataRows = rows.slice(1)
  if (dataRows.length > 336) throw new Error('Tối đa 336 khoảng hoạt động trong một tuần.')

  return dataRows.map((row, index) => {
    const rowNum = index + 2
    const date = cell(row, map, 'date')
    const start = cell(row, map, 'start')
    const end = cell(row, map, 'end')
    if (!isDate(date)) throw new Error(`Dòng ${rowNum}: Ngày "${date}" phải theo định dạng YYYY-MM-DD.`)
    if (!isSlotStart(start) || !(isSlotStart(end) || end === '24:00') || !rangeSlots({ start, end }).length) {
      throw new Error(`Dòng ${rowNum}: Khoảng giờ "${start}–${end}" phải theo mốc 30 phút và giờ kết thúc sau giờ bắt đầu.`)
    }
    return { date, start, end }
  })
}

export function parseShiftsCsv(text: string): Shift[] {
  const rows = parseCsvTable(text)
  const map = readHeaderMap(rows, ['date', 'start', 'end'])
  const dataRows = rows.slice(1)
  if (dataRows.length > 200) throw new Error('Khai báo tối đa 200 ca trong tệp CSV.')

  return dataRows.map((row, index) => {
    const rowNum = index + 2
    const date = cell(row, map, 'date')
    const start = cell(row, map, 'start')
    const end = cell(row, map, 'end')
    if (!isDate(date)) throw new Error(`Dòng ${rowNum}: Ngày "${date}" phải theo định dạng YYYY-MM-DD.`)
    if (!isSlotStart(start) || !(isSlotStart(end) || end === '24:00') || !rangeSlots({ start, end }).length) {
      throw new Error(`Dòng ${rowNum}: Ca "${start}–${end}" phải theo mốc 30 phút và giờ kết thúc sau giờ bắt đầu.`)
    }
    const rawBreaks = cell(row, map, 'breaks')
    const breaks = rawBreaks
      ? rawBreaks.split(';').map((token) => token.trim()).filter(Boolean)
        .map((token) => parseTimeRangeToken(token, rowNum, 'Khoảng nghỉ'))
      : []
    return { date, start, end, breaks }
  })
}

export function parseEmployeesCsv(text: string, operatingSlots: Slot[]): EmployeeDraft[] {
  const rows = parseCsvTable(text)
  const map = readHeaderMap(rows, ['id', 'skills', 'max_shift_minutes_per_week'])
  const dataRows = rows.slice(1)
  if (dataRows.length > MAX_EMPLOYEES) throw new Error(`Khai báo tối đa ${MAX_EMPLOYEES} nhân viên trong tệp CSV.`)

  const seen = new Set<string>()
  return dataRows.map((row, index) => {
    const rowNum = index + 2
    const id = cell(row, map, 'id')
    if (!identifier(id)) throw new Error(`Dòng ${rowNum}: Mã nhân viên không được trống.`)
    if (seen.has(id)) throw new Error(`Dòng ${rowNum}: Mã nhân viên "${id}" bị trùng.`)
    seen.add(id)

    const skills = [...new Set(cell(row, map, 'skills').split(';').map((s) => s.trim()).filter(Boolean))]
    const cap = cell(row, map, 'max_shift_minutes_per_week')
    const daysOff = cell(row, map, 'min_days_off_per_week')

    const rawOff = cell(row, map, 'unavailable_dates')
    const unavailable_dates = rawOff
      ? [...new Set(rawOff.split(';').map((d) => d.trim()).filter(Boolean))]
      : []
    for (const d of unavailable_dates) {
      if (!isDate(d)) throw new Error(`Dòng ${rowNum}: Ngày nghỉ "${d}" phải theo định dạng YYYY-MM-DD.`)
    }
    const offSet = new Set(unavailable_dates)

    const rawAvail = cell(row, map, 'available_intervals')
    const allAvailable = !rawAvail || rawAvail === '*'
    const slotMap = new Map<string, Slot>()
    if (allAvailable) {
      for (const slot of operatingSlots) {
        if (!offSet.has(slot.date)) slotMap.set(slotKey(slot), slot)
      }
    } else {
      const tokens = rawAvail.split(';').map((t) => t.trim()).filter(Boolean)
      for (const token of tokens) {
        const match = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})$/.exec(token)
        if (!match) {
          throw new Error(`Dòng ${rowNum}: Giờ rảnh "${token}" cần dạng "YYYY-MM-DD HH:MM-HH:MM" hoặc "*".`)
        }
        const [, date, start, end] = match
        if (!isDate(date)) throw new Error(`Dòng ${rowNum}: Ngày "${date}" trong giờ rảnh không hợp lệ.`)
        const expanded = rangeSlots({ start, end })
        if (!expanded.length) {
          throw new Error(`Dòng ${rowNum}: Khoảng giờ rảnh "${start}-${end}" không hợp lệ theo mốc 30 phút.`)
        }
        if (offSet.has(date)) continue
        for (const s of expanded) {
          const slot = { date, start: s }
          slotMap.set(slotKey(slot), slot)
        }
      }
    }

    return {
      id,
      skills,
      available_slots: [...slotMap.values()].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
      unavailable_dates,
      cap,
      daysOff,
      allAvailable,
    }
  })
}

export async function readCsvFileText(file: File): Promise<string> {
  if (file.size === 0) throw new Error('Tệp CSV đang trống.')
  if (file.size > MAX_CSV_BYTES) throw new Error('Tệp CSV vượt giới hạn 2 MiB.')
  if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Vui lòng chọn tệp có phần mở rộng .csv.')
  return file.text()
}

export function buildConfigTemplateCsv(kind: ConfigCsvKind, sampleDate: string): { filename: string; blob: Blob } {
  const day = isDate(sampleDate) ? sampleDate : '2026-11-02'
  const templates: Record<ConfigCsvKind, { filename: string; lines: string[] }> = {
    groups: {
      filename: 'mau-nhom-cuoc-goi.csv',
      lines: [
        'id,name,target_sla_percent,waiting_seconds,aht_seconds,sample_count,cutoff_before',
        'sales,Bán hàng,80,20,300,,',
        'support,Hỗ trợ kỹ thuật,85,20,360,,',
      ],
    },
    operating: {
      filename: 'mau-gio-hoat-dong.csv',
      lines: [
        'date,start,end',
        `${day},08:00,12:00`,
        `${day},13:00,17:00`,
      ],
    },
    employees: {
      filename: 'mau-nhan-vien.csv',
      lines: [
        'id,skills,max_shift_minutes_per_week,min_days_off_per_week,unavailable_dates,available_intervals',
        `nv01,sales;support,2400,2,,*`,
        `nv02,sales,1800,2,,${day} 08:00-12:00`,
      ],
    },
    shifts: {
      filename: 'mau-ca-lam.csv',
      lines: [
        'date,start,end,breaks',
        `${day},08:00,12:00,10:00-10:30`,
        `${day},13:00,17:00,`,
      ],
    },
  }
  const { filename, lines } = templates[kind]
  return {
    filename,
    blob: new Blob([UTF8_BOM + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }),
  }
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export async function enrichExportCsvWithSkillStatus(
  blob: Blob,
  employeeSkills: Record<string, string[]>,
): Promise<Blob> {
  const rows = parseCsvTable(await blob.text())
  if (!rows.length) return blob
  const header = rows[0]
  const empIndex = header.indexOf('Mã nhân viên')
  const groupIndex = header.indexOf('Mã nhóm')
  if (empIndex < 0 || groupIndex < 0) return blob

  const stripGuard = (value: string) => value.startsWith("'") ? value.slice(1) : value
  const enriched = [
    [...header, 'Trạng thái kỹ năng'],
    ...rows.slice(1).map((row) => {
      const empId = stripGuard(row[empIndex] ?? '')
      const groupId = stripGuard(row[groupIndex] ?? '')
      const skills = employeeSkills[empId]
      const status = !skills ? '—' : skills.includes(groupId) ? 'Đúng kỹ năng' : 'Lệch kỹ năng'
      return [...row, status]
    }),
  ]
  const csvText = UTF8_BOM + enriched.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n'
  return new Blob([csvText], { type: 'text/csv;charset=utf-8' })
}
