// Match the search limit in the backend's minimum_agents calculation.
const maxAgents = 10_000
const staffingLimitMessage = 'Không tính được số người đáp ứng SLA trong phạm vi 10.000 người mỗi khung giờ.'

/** Small, deterministic Erlang C calculation for the frontend preview. */
export function requiredAgentsByErlangC(
  calls: number,
  ahtMinutes: number,
  serviceTarget = 0.8,
  answerWithinSeconds = 20,
) {
  if (!Number.isFinite(calls) || !Number.isFinite(ahtMinutes)) {
    throw new RangeError('Số cuộc gọi và AHT phải là số hữu hạn.')
  }
  if (calls <= 0 || ahtMinutes <= 0) return 0
  const load = (calls * ahtMinutes) / 30
  const target = Math.min(0.999, Math.max(0, serviceTarget))
  const answerSeconds = Math.max(1, answerWithinSeconds)
  const ahtSeconds = Math.max(1, ahtMinutes * 60)
  if (load >= maxAgents) throw new RangeError(staffingLimitMessage)
  let blockingProbability = 1
  for (let agents = 1; agents <= maxAgents; agents += 1) {
    // Compute Erlang B by recurrence, then convert it to Erlang C for stable queues.
    const traffic = load * blockingProbability
    blockingProbability = traffic / (agents + traffic)
    if (agents <= load) continue
    const occupancy = load / agents
    const waitProbability = blockingProbability / (1 - occupancy + occupancy * blockingProbability)
    const serviceLevel = 1 - waitProbability * Math.exp(-(agents - load) * (answerSeconds / ahtSeconds))
    if (serviceLevel >= target) return agents
  }
  throw new RangeError(staffingLimitMessage)
}
