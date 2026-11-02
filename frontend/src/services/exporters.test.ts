import { describe, expect, it } from 'vitest'
import { buildAuditJson, buildCsv, escapeCsvCell } from './exporters'

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
})
