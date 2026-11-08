import { describe, expect, it } from 'vitest'
import type { CoverageItem, Employee } from '@/types/scheduling'
import { buildAuditJson, buildCoverageCsv, buildCsv, buildScheduleCsv, escapeCsvCell } from './exporters'

describe('frontend exports', () => {
  it('escapes commas, quotes and new lines for Excel CSV', () => {
    expect(escapeCsvCell('Nguyễn, "A"\n')).toBe('"Nguyễn, ""A""\n"')
  })

  it('adds UTF-8 BOM and keeps every CSV value quoted', () => {
    expect(buildCsv(['Tên', 'Số'], [['A, B', 2]])).toBe('\ufeff"Tên","Số"\n"A, B","2"')
  })

  it('serializes audit data as readable JSON', () => {
    expect(buildAuditJson({ status: 'SUCCESS', count: 2 })).toContain('\n  "status": "SUCCESS"')
  })

  it('exports the displayed break for assigned staff and keeps off staff unassigned', () => {
    const assigned: Employee = {
      id: 'NV001', name: 'Nhân viên A', working: true, allowedShifts: ['ca_ngay'],
      shift: 'Ca ngày · 08:00–20:00', breakTime: '12:15–13:15', status: 'Có trong bản xem trước',
    }
    const off: Employee = { ...assigned, id: 'NV002', working: false }
    const lines = buildScheduleCsv('2026-11-02', [assigned, off], true).split('\n')
    expect(lines[1]).toContain('"Ca ngày","08:00","20:00","12:15","13:15"')
    expect(lines[2]).toContain('"—","—","—","—","—","Nghỉ"')
  })

  it('keeps overnight shift hours and reads legacy break separators', () => {
    const employee: Employee = {
      id: 'NV001', name: 'Nhân viên A', working: true, allowedShifts: ['ca_dem'],
      shift: 'Ca đêm · 20:00–08:00', breakTime: '00:15 - 01:15', status: 'Đã xếp',
    }
    expect(buildScheduleCsv('2026-11-02', [employee], true)).toContain('"Ca đêm","20:00","08:00","00:15","01:15"')
  })

  it('distinguishes surplus, shortage, covered slots and breaks in coverage CSV', () => {
    const row: CoverageItem = { time: '08:00–08:30', calls: 24, aht: 6, required: 5, scheduled: 8, shortage: 0, overstaff: 3, onBreak: false }
    const rows = [row, { ...row, scheduled: 3, shortage: 2, overstaff: 0 },
      { ...row, scheduled: 5, overstaff: 0 }, { ...row, onBreak: true }]
    const lines = buildCoverageCsv(rows, true).split('\n')
    expect(lines[1]).toContain('"5","8","0","3","Dư 3 người"')
    expect(lines[2]).toContain('"5","3","2","0","Thiếu 2 người"')
    expect(lines[3]).toContain('"5","5","0","0","Đủ người"')
    expect(lines[4]).toContain('"Giờ nghỉ"')
    expect(buildCoverageCsv([row], false)).toContain('"5","—","—","—","Chưa tạo"')
  })
})
