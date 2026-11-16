import { hasSchedule, type ScheduleV2Response } from './scheduleV2'
import { buildScheduleV2Request, type ScheduleV2Draft } from './scheduleV2Form'

export function markScheduleResultStale(hasResult: boolean, alreadyStale: boolean) {
  return alreadyStale || hasResult
}

export function canExportScheduleResult(result: ScheduleV2Response | undefined, stale: boolean, busy: boolean) {
  return !busy && !stale && result !== undefined && hasSchedule(result.schedule.status)
}

export function prepareScheduleRequest(draft: ScheduleV2Draft) {
  try {
    return { request: buildScheduleV2Request(draft), error: '' }
  } catch (reason) {
    return { request: undefined, error: reason instanceof Error ? reason.message : 'Kiểm tra lại các trường cấu hình.' }
  }
}
