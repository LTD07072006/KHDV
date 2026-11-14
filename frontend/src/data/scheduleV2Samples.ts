import type { ScheduleV2Mode, ScheduleV2Request } from '@/services/scheduleV2'
import history from './schedule-v2/pipeline-history-request.json'
import plannedCalls from './schedule-v2/pipeline-planned-calls-request.json'

// Synthetic samples from SkyAnzu/backend_khdv at daa7ac0c9c8e64d5848e84101199040faed0771b.
export const scheduleV2Samples: Record<ScheduleV2Mode, ScheduleV2Request> = {
  history: { ...history, mode: 'history' },
  planned_calls: { ...plannedCalls, mode: 'planned_calls' },
}
