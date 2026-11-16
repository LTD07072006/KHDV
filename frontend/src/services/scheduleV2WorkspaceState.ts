import { hasSchedule, type ScheduleV2Mode, type ScheduleV2Response } from './scheduleV2'
import { buildScheduleV2Request, callKey, parseGroups, type ScheduleV2Draft } from './scheduleV2Form'
import { importScheduleRows, type CallsFormat } from './scheduleV2Files'

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

export async function importCallsIntoScheduleDraft(file: File, format: CallsFormat, draft: ScheduleV2Draft, mode: ScheduleV2Mode) {
  const imported = await importScheduleRows(file, format, mode, parseGroups(draft.groups_text))
  if (imported.mode === 'planned_calls') {
    return { ...draft, mode, planned_calls: Object.fromEntries(imported.rows.map((row) => [
    callKey(row.date, row.hour, row.group_id), String(row.calls),
    ])) }
  }
  return { ...draft, mode, history: imported.rows.map((row, index) => ({
    id: `import-${index + 1}`, date: row.date, hour: String(row.hour), group_id: row.group_id, calls: String(row.calls),
  })) }
}
