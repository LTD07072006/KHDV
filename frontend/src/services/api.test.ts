import { describe, expect, it, vi } from 'vitest'
import { checkBackendHealth, generateSchedule } from './api'

describe('api client', () => {
  it('reports backend offline when health request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(checkBackendHealth()).resolves.toBe(false)
  })

  it('sends workbook and overrides to schedule endpoint', async () => {
    const response = {
      contract_version: '1.0.0',
      request_id: 'req_test',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'SUCCESS',
      solver_status: 'OPTIMAL',
      solution_source: 'SOLVER',
      has_solution: true,
      optimality_proven: true,
      assignments: [],
      coverage: [],
      metrics: null,
      diagnostics: [],
      carry_out: [],
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    vi.stubGlobal('fetch', fetchMock)
    const workbook = new File(['demo'], 'demo.xlsx')
    await generateSchedule({ planningDate: '2026-11-02', workbook, employeeOverrides: [{ employee_id: 'NV001', working: true, allowed_shifts: ['ca_ngay'] }] })
    expect(fetchMock).toHaveBeenCalledWith('/api/schedule', expect.objectContaining({ method: 'POST', body: expect.any(FormData) }))
  })
})
