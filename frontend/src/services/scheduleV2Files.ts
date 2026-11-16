import { hasSchedule, type ScheduleV2Request, type ScheduleV2Response } from './scheduleV2'

export type CallsFormat = 'csv' | 'xlsx'

const fileTypes: Record<CallsFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
const maxFileBytes = 2 * 1024 * 1024

export const fileMessages = {
  empty: 'Tệp cuộc gọi đang trống.',
  size: 'Tệp vượt giới hạn 2 MiB. Hãy chọn tệp nhỏ hơn.',
  busy: 'Dịch vụ đang đọc một tệp khác. Hãy thử lại sau ít nhất một giây.',
  format: 'Định dạng tệp không khớp. Hãy chọn đúng CSV hoặc XLSX.',
  invalid: 'Tệp không hợp lệ. Kiểm tra thứ tự cột, định dạng ngày, số cuộc gọi và các dòng trùng.',
  planned: 'Tệp phải có đúng một dòng cho mỗi ngày, giờ và nhóm của kịch bản. Nhập 0 cho giờ không có cuộc gọi.',
  history: 'Mỗi thứ, giờ và nhóm của kịch bản cần ít nhất hai quan sát trước tuần xếp lịch.',
  historyKeys: 'Các dòng lịch sử phải dùng đúng thứ, giờ và nhóm của kịch bản, có ngày trước tuần xếp lịch và không trùng.',
  network: 'Không kết nối được dịch vụ tệp. Kiểm tra backend rồi thử lại.',
  timeout: 'Dịch vụ tệp phản hồi quá lâu. Vui lòng thử lại.',
  import: 'Không đọc được tệp cuộc gọi. Vui lòng thử lại.',
  export: 'Không xuất được lịch CSV. Vui lòng thử lại.',
  noSchedule: 'Cần có kết quả xếp lịch khả thi để xuất CSV.',
} as const

const statusMessages: Partial<Record<number, string>> = {
  429: fileMessages.busy,
  413: fileMessages.size,
  415: fileMessages.format,
  422: fileMessages.invalid,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const validCalls = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const key = (day: string | number, hour: number, group: string) => JSON.stringify([day, hour, group])

function weekday(date: string) {
  const day = new Date(date + 'T00:00:00Z')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day.valueOf()) || day.toISOString().slice(0, 10) !== date) {
    return null
  }
  return day.getUTCDay()
}

function applyImportedRows(payload: unknown, sample: ScheduleV2Request): ScheduleV2Request {
  if (!isRecord(payload) || payload.mode !== sample.mode || !Array.isArray(payload.rows)) {
    throw new Error(fileMessages.import)
  }
  const rows = payload.rows.map((row: unknown) => {
    if (!isRecord(row) || typeof row.date !== 'string' || typeof row.group_id !== 'string' ||
        typeof row.hour !== 'number' || !Number.isInteger(row.hour) || row.hour < 0 || row.hour > 22) {
      throw new Error(fileMessages.import)
    }
    const calls = sample.mode === 'history' ? row.calls : row.calls_per_hour
    if (!validCalls(calls) || (sample.mode === 'history' && !Number.isSafeInteger(calls))) {
      throw new Error(fileMessages.invalid)
    }
    return { date: row.date, hour: row.hour, group_id: row.group_id, calls }
  })
  const expectedKeys = new Set(sample.operating_hours.flatMap(({ date, hour }) =>
    sample.groups.map((group) => key(sample.mode === 'history' ? weekday(date)! : date, hour, group)),
  ))
  const seen = new Set<string>()
  if (sample.mode === 'planned_calls') {
    for (const row of rows) {
      const rowKey = key(row.date, row.hour, row.group_id)
      if (!expectedKeys.has(rowKey) || seen.has(rowKey)) throw new Error(fileMessages.planned)
      seen.add(rowKey)
    }
    if (seen.size !== expectedKeys.size) throw new Error(fileMessages.planned)
    return { ...sample, planned_calls: rows.map(({ calls, ...row }) => ({ ...row, calls_per_hour: calls })) }
  }

  const sampleCounts = new Map<string, number>()
  for (const row of rows) {
    const day = weekday(row.date)
    const uniqueKey = key(row.date, row.hour, row.group_id)
    const target = day === null ? '' : key(day, row.hour, row.group_id)
    if (row.date >= sample.week_start || seen.has(uniqueKey) || !expectedKeys.has(target)) {
      throw new Error(fileMessages.historyKeys)
    }
    seen.add(uniqueKey)
    sampleCounts.set(target, (sampleCounts.get(target) ?? 0) + 1)
  }
  if ([...expectedKeys].some((target) => (sampleCounts.get(target) ?? 0) < 2)) {
    throw new Error(fileMessages.history)
  }
  return { ...sample, history: rows }
}

async function fileRequest<T>(
  url: string,
  body: BodyInit,
  contentType: string,
  failureMessage: string,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  const signal = AbortSignal.timeout(30_000)
  let response: Response
  try {
    response = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': contentType }, signal })
  } catch {
    throw new Error(signal.aborted ? fileMessages.timeout : fileMessages.network)
  }
  if (!response.ok) throw new Error(statusMessages[response.status] ?? failureMessage)
  try {
    const output = await read(response)
    if (!signal.aborted) return output
  } catch {
    if (!signal.aborted) throw new Error(failureMessage)
  }
  throw new Error(fileMessages.timeout)
}

export async function importScheduleCalls(file: File, format: CallsFormat, sample: ScheduleV2Request) {
  if (file.size === 0) throw new Error(fileMessages.empty)
  if (file.size > maxFileBytes) throw new Error(fileMessages.size)
  if (!file.name.toLowerCase().endsWith('.' + format)) throw new Error(fileMessages.format)

  const query = new URLSearchParams({ file_format: format, mode: sample.mode })
  for (const group of new Set(sample.groups)) query.append('group_id', group)
  const payload = await fileRequest<unknown>(
    '/api/calls/import?' + query,
    file,
    fileTypes[format],
    fileMessages.import,
    (response) => response.json(),
  )
  return applyImportedRows(payload, sample)
}

export async function exportScheduleCsv(result: ScheduleV2Response) {
  if (!hasSchedule(result.schedule.status)) throw new Error(fileMessages.noSchedule)
  return fileRequest(
    '/api/schedule-v2/export',
    JSON.stringify(result),
    'application/json',
    fileMessages.export,
    async (response) => {
      const mediaType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
      const disposition = response.headers.get('Content-Disposition')
      const match = disposition?.match(/(?:^|;)\s*filename\s*=\s*(?:"([^"]+)"|([^;]+))/i)
      const filename = (match?.[1] ?? match?.[2])?.trim()
      if (mediaType !== 'text/csv' || !filename?.toLowerCase().endsWith('.csv') ||
          /[/\\:]/.test(filename) || [...filename].some((char) => char.charCodeAt(0) < 32)) {
        throw new Error(fileMessages.export)
      }
      const blob = await response.blob()
      const bom = new Uint8Array(await blob.slice(0, 3).arrayBuffer())
      if (bom[0] !== 0xef || bom[1] !== 0xbb || bom[2] !== 0xbf) throw new Error(fileMessages.export)
      return { filename, blob }
    },
  )
}
