import {
  apiMessages, callKey, exact, hasSchedule, identifier, isDate, natural, post,
  validAht, validCallsRow, validGroup, type Aht, type CallsRow, type Group, type HistoryWindow,
  type ScheduleV2Mode, type ScheduleV2Response,
} from './scheduleV2'

export type CallsFormat = 'csv' | 'xlsx' | 'database_sample_bundle'
const formats = {
  csv: { extension: '.csv', media: 'text/csv' },
  xlsx: { extension: '.xlsx', media: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  database_sample_bundle: { extension: '.zip', media: 'application/zip' },
} satisfies Record<CallsFormat, { extension: string; media: string }>
export const fileExtension = (format: CallsFormat) => formats[format].extension
export const databaseSampleUrl = 'https://databasesample.com/datasets/call-centre-dataset-calls-agents-queues-and-abandonment'

type GenericImport = { mode: ScheduleV2Mode; rows: CallsRow[] }
export type SourceImport = {
  mode: 'history'; rows: CallsRow[]; groups: Group[]; aht_by_group: Aht[]; history_window: HistoryWindow
  source: {
    calls_sha256: string; queues_sha256: string; hashes_verified: true
    source_window: { start_date: string; end_date_exclusive: string }
    derived_zero_counts: { date_start_buckets: number; date_start_queue_cells: number }
  }
}
type SourceParams = { week: string; window: HistoryWindow }

function validRows(value: unknown, mode: ScheduleV2Mode, groups: Set<string>): value is CallsRow[] {
  if (!Array.isArray(value)) return false
  const keys = new Set<string>()
  return value.every((row: unknown) => {
    if (!validCallsRow(row, mode) || !groups.has(row.group_id)) return false
    const key = callKey(row)
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })
}

function validSource(value: unknown, params: SourceParams, requestedGroups: string[]): value is SourceImport {
  if (!exact(value, 'mode history_window groups rows aht_by_group source') || value.mode !== 'history' ||
      !Array.isArray(value.groups) || value.groups.length < 1 || value.groups.length > 10 || !value.groups.every(validGroup) ||
      !Array.isArray(value.aht_by_group) || !value.aht_by_group.every(validAht)) return false
  const groups = new Set(value.groups.map((group: Group) => group.id))
  if (groups.size !== value.groups.length || (requestedGroups.length > 0 &&
      (groups.size !== new Set(requestedGroups).size || !requestedGroups.every((id) => groups.has(id))))) return false
  const window = value.history_window
  if (!exact(window, 'start_date end_date') || window.start_date !== params.window.start_date || window.end_date !== params.window.end_date ||
      !validRows(value.rows, 'history', groups) || value.rows.some(({ date }) => date < params.window.start_date || date >= params.window.end_date) ||
      !value.aht_by_group.every((item: Aht) => groups.has(item.group_id) && item.cutoff_before === params.week) ||
      new Set(value.aht_by_group.map((item: Aht) => item.group_id)).size !== value.aht_by_group.length) return false
  const source = value.source
  return exact(source, 'calls_sha256 queues_sha256 hashes_verified source_window derived_zero_counts') &&
    source.calls_sha256 === 'aa80c8f88f3c2b7ec66e5b2eb440be5733447cb49ad4021da7b0baffdf9f71fd' &&
    source.queues_sha256 === 'c1d69085348c1eccd61c7e7a8dde199a354042be626f2f2f7eb448b6ca4a39d5' && source.hashes_verified === true &&
    exact(source.source_window, 'start_date end_date_exclusive') && isDate(source.source_window.start_date) &&
    isDate(source.source_window.end_date_exclusive) &&
    exact(source.derived_zero_counts, 'date_start_buckets date_start_queue_cells') &&
    natural(source.derived_zero_counts.date_start_buckets) && natural(source.derived_zero_counts.date_start_queue_cells)
}

export function importCalls(file: File, format: 'csv' | 'xlsx', mode: ScheduleV2Mode, groups: string[]): Promise<GenericImport>
export function importCalls(file: File, format: 'database_sample_bundle', mode: 'history', groups: string[], params: SourceParams): Promise<SourceImport>
export async function importCalls(file: File, format: CallsFormat, mode: ScheduleV2Mode, groups: string[], params?: SourceParams) {
  if (!file.size) throw new Error('Tệp cuộc gọi đang trống.')
  if (!file.name.toLowerCase().endsWith(fileExtension(format))) throw new Error(apiMessages.format)
  if ((format !== 'database_sample_bundle' && !groups.length) || groups.length > 10 ||
      new Set(groups).size !== groups.length || groups.some((group) => !identifier(group))) {
    throw new Error('Khai báo mã nhóm hợp lệ, duy nhất trước khi nạp.')
  }
  const query = new URLSearchParams({ file_format: format, mode })
  for (const group of groups) query.append('group_id', group)
  if (params) {
    query.set('week_start', params.week)
    query.set('history_start_date', params.window.start_date)
    query.set('history_end_date', params.window.end_date)
  }
  return post('/api/calls/import?' + query, file, formats[format].media, apiMessages.invalidFile, async (response) => {
    const value: unknown = await response.json()
    if (format === 'database_sample_bundle') {
      if (!params || !validSource(value, params, groups)) throw new Error(apiMessages.response)
      return value
    }
    if (!exact(value, 'mode rows') || value.mode !== mode || !validRows(value.rows, mode, new Set(groups))) {
      throw new Error(apiMessages.response)
    }
    return { mode, rows: value.rows }
  }, 30_000)
}

export async function exportScheduleCsv(result: ScheduleV2Response) {
  if (!hasSchedule(result.schedule.status)) throw new Error(apiMessages.invalidExport)
  return post('/api/schedule-v2/export', JSON.stringify(result), 'application/json', apiMessages.invalidExport, async (response) => {
    const media = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    const filename = /filename\s*=\s*"?([\w.-]+\.csv)"?(?:;|$)/i.exec(response.headers.get('Content-Disposition') ?? '')?.[1]
    const blob = await response.blob()
    const bom = new Uint8Array(await blob.slice(0, 3).arrayBuffer())
    if (media !== 'text/csv' || !filename || ![0xef, 0xbb, 0xbf].every((byte, index) => bom[index] === byte)) {
      throw new Error(apiMessages.response)
    }
    return { filename, blob }
  }, 30_000)
}
