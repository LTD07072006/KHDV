import { describe, expect, it } from 'vitest'
import { requiredAgentsByErlangC } from './erlangPreview'

describe('requiredAgentsByErlangC', () => {
  it('returns zero for empty demand', () => {
    expect(requiredAgentsByErlangC(0, 6)).toBe(0)
  })

  it('matches the reference staffing counts at 150 Erlangs where powers overflow', () => {
    expect(requiredAgentsByErlangC(750, 6, 0.8, 20)).toBe(160)
    expect(requiredAgentsByErlangC(750, 6, 0.9, 20)).toBe(164)
  })

  it('includes the full waiting probability at ordinary demand', () => {
    expect(requiredAgentsByErlangC(24, 6, 0.8, 20)).toBe(8)
  })

  it('finds the minimum staffing above the old 200-agent ceiling', () => {
    expect(requiredAgentsByErlangC(999, 6, 0.9, 20)).toBe(215)
  })

  it('rejects demand when the search limit cannot satisfy the target', () => {
    expect(() => requiredAgentsByErlangC(50_000, 6, 0.9, 20)).toThrow('10.000 người')
    expect(() => requiredAgentsByErlangC(49_999, 6, 0.9, 20)).toThrow('10.000 người')
  })

  it('requires at least as many agents when the target is stricter', () => {
    const standard = requiredAgentsByErlangC(30, 6, 0.8, 20)
    const high = requiredAgentsByErlangC(30, 6, 0.9, 20)
    expect(high).toBeGreaterThanOrEqual(standard)
  })
})
