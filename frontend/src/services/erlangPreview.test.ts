import { describe, expect, it } from 'vitest'
import { requiredAgentsByErlangC } from './erlangPreview'

describe('requiredAgentsByErlangC', () => {
  it('returns zero for empty demand', () => {
    expect(requiredAgentsByErlangC(0, 6)).toBe(0)
  })

  it('requires at least as many agents when the target is stricter', () => {
    const standard = requiredAgentsByErlangC(30, 6, 0.8, 20)
    const high = requiredAgentsByErlangC(30, 6, 0.9, 20)
    expect(high).toBeGreaterThanOrEqual(standard)
  })
})
