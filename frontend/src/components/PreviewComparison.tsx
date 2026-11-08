import { ChevronDown } from 'lucide-react'
import { comparePreviews, type PreviewRun } from '@/services/previewComparison'

const number = new Intl.NumberFormat('vi-VN')
const signed = new Intl.NumberFormat('vi-VN', { signDisplay: 'exceptZero' })

export function PreviewComparison({ previous, current }: { previous: PreviewRun; current: PreviewRun }) {
  const comparison = comparePreviews(previous, current)
  if (!comparison) return null

  const { before, after, changed } = comparison
  const shortageDelta = after.shortage - before.shortage
  const metrics = [
    { label: 'Lượt nhân sự cần', before: before.required, after: after.required },
    { label: 'Lượt nhân sự thiếu', before: before.shortage, after: after.shortage },
    { label: 'Khung giờ thiếu người', before: before.shortSlots, after: after.shortSlots },
  ]

  return (
    <details className="roster-comparison print:hidden">
      <summary>
        <span className="font-semibold">So sánh với lần trước</span>
        <span>{shortageDelta === 0
          ? 'Mức thiếu không đổi'
          : `${shortageDelta < 0 ? 'Giảm' : 'Tăng'} ${number.format(Math.abs(shortageDelta))} lượt thiếu`}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="roster-comparison-body">
        <table>
          <caption className="sr-only">So sánh tổng độ phủ</caption>
          <thead><tr><th scope="col">Chỉ số</th><th scope="col">Trước</th><th scope="col">Mới</th><th scope="col">Chênh</th></tr></thead>
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
              <thead><tr><th scope="col">Khung giờ</th><th scope="col">Trước</th><th scope="col">Mới</th><th scope="col">Chênh</th></tr></thead>
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
