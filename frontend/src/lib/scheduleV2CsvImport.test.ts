import { describe, expect, it } from 'vitest'
import { syncWildcardEmployees } from '@/services/scheduleV2Form'
import {
  buildConfigTemplateCsv, enrichExportCsvWithSkillStatus, parseCsvTable, parseEmployeesCsv,
  parseGroupsCsv, parseOperatingCsv, parseShiftsCsv,
} from './scheduleV2CsvImport'

describe('scheduleV2CsvImport', () => {
  it('parses RFC 4180 CSV with BOM, quoted commas, and escaped quotes', () => {
    const raw = '\ufeffid,name\r\nsales,"Bán hàng, ""VIP"""\r\nsupport,Hỗ trợ\r\n\r\n'
    expect(parseCsvTable(raw)).toEqual([
      ['id', 'name'],
      ['sales', 'Bán hàng, "VIP"'],
      ['support', 'Hỗ trợ'],
    ])
    expect(() => parseCsvTable('id,name\nsales,"unclosed')).toThrow('ngoặc kép')
  })

  it('parses groups CSV with defaults and rejects duplicate IDs', () => {
    const groups = parseGroupsCsv('id,name\nsales,Bán hàng\nsupport,Hỗ trợ')
    expect(groups).toEqual([
      { id: 'sales', name: 'Bán hàng', sla: '80', wait: '20', aht: '300', samples: '', cutoff: '' },
      { id: 'support', name: 'Hỗ trợ', sla: '80', wait: '20', aht: '300', samples: '', cutoff: '' },
    ])

    const full = parseGroupsCsv(
      'id,name,target_sla_percent,waiting_seconds,aht_seconds,sample_count,cutoff_before\n' +
      'vip,Khách VIP,90,15,240,50,2026-11-02',
    )
    expect(full[0]).toEqual({ id: 'vip', name: 'Khách VIP', sla: '90', wait: '15', aht: '240', samples: '50', cutoff: '2026-11-02' })
    expect(() => parseGroupsCsv('id,name\nsales,A\nsales,B')).toThrow('bị trùng')
  })

  it('parses operating intervals CSV including 24:00 end and validates 30-min grid', () => {
    const intervals = parseOperatingCsv('date,start,end\n2026-11-02,08:00,12:00\n2026-11-02,13:00,24:00')
    expect(intervals).toEqual([
      { date: '2026-11-02', start: '08:00', end: '12:00' },
      { date: '2026-11-02', start: '13:00', end: '24:00' },
    ])
    expect(() => parseOperatingCsv('date,start,end\n2026-11-02,08:15,12:00')).toThrow('mốc 30 phút')
  })

  it('parses shifts CSV with multiple breaks separated by semicolons', () => {
    const shifts = parseShiftsCsv('date,start,end,breaks\n2026-11-02,08:00,17:00,10:00-10:30;12:00-13:00\n2026-11-03,08:00,12:00,')
    expect(shifts).toEqual([
      { date: '2026-11-02', start: '08:00', end: '17:00', breaks: [{ start: '10:00', end: '10:30' }, { start: '12:00', end: '13:00' }] },
      { date: '2026-11-03', start: '08:00', end: '12:00', breaks: [] },
    ])
    expect(() => parseShiftsCsv('date,start,end,breaks\n2026-11-02,08:00,12:00,bad')).toThrow('HH:MM-HH:MM')
  })

  it('parses employees CSV with wildcard availability, explicit intervals, and unavailable dates', () => {
    const grid = [
      { date: '2026-11-02', start: '08:00' },
      { date: '2026-11-02', start: '08:30' },
      { date: '2026-11-03', start: '08:00' },
    ]
    const csv = [
      'id,skills,max_shift_minutes_per_week,min_days_off_per_week,unavailable_dates,available_intervals',
      'nv01,sales;support,2400,2,2026-11-03,*',
      'nv02,sales,1800,,,2026-11-02 08:00-09:00',
    ].join('\n')

    const employees = parseEmployeesCsv(csv, grid)
    expect(employees[0]).toEqual({
      id: 'nv01',
      skills: ['sales', 'support'],
      cap: '2400',
      daysOff: '2',
      unavailable_dates: ['2026-11-03'],
      available_slots: [
        { date: '2026-11-02', start: '08:00' },
        { date: '2026-11-02', start: '08:30' },
      ],
      allAvailable: true,
    })
    expect(employees[1].allAvailable).toBe(false)
    expect(employees[1].available_slots).toEqual([
      { date: '2026-11-02', start: '08:00' },
      { date: '2026-11-02', start: '08:30' },
    ])
  })

  it('accepts 100 distinct employees and rejects the 101st CSV row', () => {
    const csv = (count: number) => [
      'id,skills,max_shift_minutes_per_week',
      ...Array.from({ length: count }, (_, index) => `e${index + 1},sales,600`),
    ].join('\n')
    const employees = parseEmployeesCsv(csv(100), [])
    expect(employees).toHaveLength(100)
    expect(new Set(employees.map(({ id }) => id)).size).toBe(100)
    expect(() => parseEmployeesCsv(csv(101), [])).toThrow(/100/)
  })

  it('round-trips all generated CSV templates cleanly through their parsers', async () => {
    const sampleDate = '2026-11-09'
    const groupsText = await buildConfigTemplateCsv('groups', sampleDate).blob.text()
    const operatingText = await buildConfigTemplateCsv('operating', sampleDate).blob.text()
    const employeesText = await buildConfigTemplateCsv('employees', sampleDate).blob.text()
    const shiftsText = await buildConfigTemplateCsv('shifts', sampleDate).blob.text()

    expect(parseGroupsCsv(groupsText)).toHaveLength(2)
    expect(parseOperatingCsv(operatingText)).toHaveLength(2)
    expect(parseEmployeesCsv(employeesText, [{ date: sampleDate, start: '08:00' }])).toHaveLength(2)
    expect(parseShiftsCsv(shiftsText)).toHaveLength(2)
  })

  it('auto-syncs wildcard employees imported before operating hours arrive', () => {
    const csv = 'id,skills,max_shift_minutes_per_week,min_days_off_per_week,unavailable_dates,available_intervals\nnv01,sales,600,,2026-11-03,*'
    const beforeOperating = parseEmployeesCsv(csv, [])
    expect(beforeOperating[0].allAvailable).toBe(true)
    expect(beforeOperating[0].available_slots).toEqual([])

    const laterSlots = [
      { date: '2026-11-02', start: '08:00' },
      { date: '2026-11-02', start: '08:30' },
      { date: '2026-11-03', start: '08:00' },
    ]
    const synced = syncWildcardEmployees(beforeOperating, laterSlots)
    expect(synced[0].available_slots).toEqual([
      { date: '2026-11-02', start: '08:00' },
      { date: '2026-11-02', start: '08:30' },
    ])
  })

  it('enriches exported CSV with per-row skill status column', async () => {
    const rawCsv = '\ufeffMã nhân viên,Ngày,Bắt đầu khoảng,Kết thúc khoảng,Mã nhóm\r\nnv01,2026-11-02,08:00,08:30,sales\r\n\'=nv02,2026-11-02,08:00,08:30,support\r\n'
    const enriched = await enrichExportCsvWithSkillStatus(
      new Blob([rawCsv], { type: 'text/csv;charset=utf-8' }),
      { nv01: ['sales'], '=nv02': ['sales'] },
    )
    const rows = parseCsvTable(await enriched.text())
    expect(rows[0][rows[0].length - 1]).toBe('Trạng thái kỹ năng')
    expect(rows[1][rows[1].length - 1]).toBe('Đúng kỹ năng')
    expect(rows[2][rows[2].length - 1]).toBe('Lệch kỹ năng')
  })
})
