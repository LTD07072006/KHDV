import type { ScheduleV2Mode, ScheduleV2Request } from '@/services/scheduleV2'
import history from './schedule-v2/pipeline-history-request.json'
import planned from './schedule-v2/pipeline-planned-calls-request.json'

// Synthetic contract fixtures from SkyAnzu/backend_khdv at 3af5b9b.
export const scheduleV2Samples: Record<ScheduleV2Mode, ScheduleV2Request> = {
  history: { ...history, mode: 'history' },
  planned_calls: { ...planned, mode: 'planned_calls' },
}
