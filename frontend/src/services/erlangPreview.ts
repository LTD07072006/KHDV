/** Small, deterministic Erlang C calculation for the frontend preview. */
function factorial(value: number) {
  let result = 1
  for (let i = 2; i <= value; i += 1) result *= i
  return result
}

function erlangC(agents: number, load: number) {
  if (agents <= load) return 1
  let sum = 0
  for (let k = 0; k < agents; k += 1) sum += load ** k / factorial(k)
  const last = load ** agents / factorial(agents)
  return last / (sum + last * (agents / (agents - load)))
}

export function requiredAgentsByErlangC(
  calls: number,
  ahtMinutes: number,
  serviceTarget = 0.8,
  answerWithinSeconds = 20,
) {
  if (calls <= 0 || ahtMinutes <= 0) return 0
  const load = (calls * ahtMinutes) / 30
  const target = Math.min(0.999, Math.max(0, serviceTarget))
  const answerSeconds = Math.max(1, answerWithinSeconds)
  const ahtSeconds = Math.max(1, ahtMinutes * 60)
  for (let agents = Math.max(1, Math.ceil(load)); agents <= 200; agents += 1) {
    const waitProbability = erlangC(agents, load)
    const serviceLevel = 1 - waitProbability * Math.exp(-(agents - load) * (answerSeconds / ahtSeconds))
    if (serviceLevel >= target) return agents
  }
  return Math.ceil(load)
}
