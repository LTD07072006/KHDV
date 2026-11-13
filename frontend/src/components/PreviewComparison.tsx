import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { comparePreviews, type PreviewRun } from '@/services/previewComparison'

const number = new Intl.NumberFormat('vi-VN')
const signed = new Intl.NumberFormat('vi-VN', { signDisplay: 'exceptZero' })

export function PreviewComparison({ previous, finalized, current }: {
  previous?: PreviewRun
  finalized?: PreviewRun
  current: PreviewRun
}) {
  const [baseline, setBaseline] = useState('previous')
  const options = [
    { id: 'previous', label: 'Lần xếp trước', run: previous },
    { id: 'final', label: 'Lịch đã chốt', run: finalized },
  ].flatMap(({ id, label, run }) => {
    const comparison = run && comparePreviews(run, current)
    return comparison ? [{ id, label, comparison }] : []
  })
  const selected = options.find(({ id }) => id === baseline) ?? options[0]
  if (!selected) return null

  const { before, after, changed } = selected.comparison
  const shortageDelta = after.shortage - before.shortage
  const metrics = [
    { label: 'Lượt nhân sự cần', before: before.required, after: after.required },
    { label: 'Lượt nhân sự thiếu', before: before.shortage, after: after.shortage },
    { label: 'Khung giờ thiếu người', before: before.shortSlots, after: after.shortSlots },
  ]

  return (
    <details className="roster-comparison print:hidden">
      <summary>
        <span className="font-semibold">So sánh độ phủ</span>
        <span>{selected.label}</span>
        <span>{shortageDelta === 0
          ? 'Tổng thiếu không đổi'
          : `${shortageDelta < 0 ? 'Giảm' : 'Tăng'} ${number.format(Math.abs(shortageDelta))} lượt thiếu`}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      {options.length > 1 && (
        <label className="roster-field roster-comparison-baseline">
          <span>Mốc so sánh</span>
          <select value={selected.id} onChange={(event) => setBaseline(event.currentTarget.value)}>
            {options.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      )}
      <div className="roster-comparison-body">
        <table>
          <caption className="sr-only">So sánh tổng độ phủ</caption>
          <thead><tr><th scope="col">Chỉ số</th><th scope="col">Mốc</th><th scope="col">Hiện tại</th><th scope="col">Chênh</th></tr></thead>
          <tbody>{metrics.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th><td>{number.format(row.before)}</td>
              <td>{number.format(row.after)}</td><td>{signed.format(row.after - row.before)}</td>
            </tr>
          ))}</tbody>
        </table>
        {changed.length > 0 && (
          <div className="roster-comparison-slots" role="region" aria-label="Chi tiết thay đổi theo khung giờ" tabIndex={0}>
            <table>
              <caption>Khung giờ có thay đổi về số người thiếu</caption>
              <thead><tr><th scope="col">Khung giờ</th><th scope="col">Mốc</th><th scope="col">Hiện tại</th><th scope="col">Chênh</th></tr></thead>
              <tbody>{changed.map((row) => (
                <tr key={row.time}>
                  <th scope="row">{row.time}</th><td>{number.format(row.before)}</td>
                  <td>{number.format(row.after)}</td><td>{signed.format(row.after - row.before)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  )
}
