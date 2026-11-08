import type { DemandRow } from '@/types/scheduling'

type Props = {
  demand: DemandRow[]
  workingCount: number
  employeeCount: number
}

const formatCount = new Intl.NumberFormat('vi-VN')

export function PlanningSummary({ demand, workingCount, employeeCount }: Props) {
  const totalCalls = demand.reduce((sum, row) => sum + row.calls, 0)

  return (
    <dl className="roster-summary" aria-label="Tóm tắt dữ liệu">
      <div><dt>Nhân sự đi làm</dt><dd>{formatCount.format(workingCount)}/{formatCount.format(employeeCount)}</dd></div>
      <div><dt>Cuộc gọi dự kiến</dt><dd>{formatCount.format(totalCalls)}</dd></div>
      <div><dt>Khung giờ 30 phút</dt><dd>{formatCount.format(demand.length)}</dd></div>
    </dl>
  )
}
