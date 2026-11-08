import { ChevronDown } from 'lucide-react'
import type { SchedulingResult } from '@/types/scheduling'

export function SolverTelemetryCard({ result }: { result: SchedulingResult | null }) {
  if (!result?.metrics) return null

  const { metrics, solver_status, diagnostics, solution_source } = result
  const isLocalPreview = solution_source === 'BASELINE'
  const objective = metrics.objective_components
  const details = [
    ['Thời gian tính', `${metrics.wall_time_seconds.toFixed(4)} giây`],
    ['Vi phạm ràng buộc cứng', metrics.hard_constraint_violations],
    ['Tổng số ca đã phân bổ', metrics.total_assignments],
    ['Giá trị hàm mục tiêu', metrics.objective_value.toFixed(0)],
    ['Phạt thiếu hụt', `${objective.shortage} (${metrics.shortage_agent_slots} lượt)`],
    ['Chi phí thừa', `${objective.overstaff} (${metrics.overstaff_agent_slots} lượt)`],
    ['Phân bổ ca', objective.assignment + objective.preference],
    ['Cân bằng ca', objective.fairness],
  ]

  return (
    <details className="roster-telemetry">
      <summary>
        <span className="font-semibold">{isLocalPreview ? 'Xem cách tính mô phỏng' : 'Xem chi tiết kỹ thuật'}</span>
        <span>{isLocalPreview ? 'Mô phỏng trên trình duyệt' : solver_status} · {metrics.wall_time_seconds.toFixed(3)} giây</span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="roster-telemetry-body">
        <dl className="roster-telemetry-metrics">
          {details.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <div>
          <h3 className="font-semibold">Quy tắc tham chiếu</h3>
          <ul className="mt-1 list-disc pl-5">
            <li>Mỗi nhân sự tối đa một ca mỗi ngày, theo ca đã đăng ký.</li>
            <li>Giờ nghỉ không tính vào độ phủ.</li>
            <li>Độ phủ được đối chiếu với nhu cầu để ghi nhận số thiếu hoặc dư.</li>
            {!isLocalPreview && <li>Kỹ năng của nhân sự phải phù hợp với kỹ năng yêu cầu của ca.</li>}
          </ul>
          {diagnostics.length > 0 && (
            <>
              <h3 className="mt-3 font-semibold">Ghi chú kỹ thuật</h3>
              <ul className="mt-1 list-disc pl-5">
                {diagnostics.map((diag, index) => (
                  <li key={index} className={diag.severity === 'WARNING' ? 'roster-text-warning' : undefined}>
                    <strong>{diag.code}</strong> · {diag.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </details>
  )
}
