import { describe, expect, it } from 'vitest'
import { validateScheduleInput, validateWorkbookName } from './validation'

describe('validation', () => {
  it('accepts xlsx and rejects other extensions', () => {
    expect(validateWorkbookName('demo.xlsx').valid).toBe(true)
    expect(validateWorkbookName('demo.csv').valid).toBe(false)
  })

  it('requires a shift for working employees', () => {
    const result = validateScheduleInput('2026-11-02', [{ id: '1', name: 'A', shift: '', breakTime: '', status: 'Chưa chọn ca', working: true, allowedShifts: [] }])
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('chưa chọn ca')
  })
})
