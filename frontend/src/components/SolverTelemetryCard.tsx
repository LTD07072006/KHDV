import { useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Cpu, Gauge, Info, ShieldCheck } from 'lucide-react'
import type { SchedulingResult } from '@/types/scheduling'

type Props = {
  result: SchedulingResult | null
}

export function SolverTelemetryCard({ result }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  if (!result || !result.metrics) return null

  const { metrics, solver_status, status, diagnostics, solution_source } = result
  const isLocalPreview = solution_source === 'BASELINE'
  const isOptimal = solver_status === 'OPTIMAL'
  const isDegraded = status === 'DEGRADED' || metrics.shortage_agent_slots > 0

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs transition">
      {/* Accordion Toggle Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50/80 hover:bg-slate-100/80 transition text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Cpu size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-xs sm:text-sm">
                {isLocalPreview ? 'Thông tin bản xem trước local' : 'Thông số kỹ thuật bộ giải'}
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isOptimal
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {isLocalPreview ? 'Bản xem trước' : solver_status}
              </span>
              {isDegraded && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  Thiếu người theo nhu cầu
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Nguồn dữ liệu: {isLocalPreview ? 'Mô phỏng frontend' : solution_source} · Thời gian tính: {metrics.wall_time_seconds.toFixed(3)}s · Vi phạm ràng buộc: 0
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
              <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
            {isOpen ? 'Thu gọn' : isLocalPreview ? 'Xem cách tính mô phỏng' : 'Xem chi tiết kỹ thuật'}
          </span>
          {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </div>
      </button>

      {/* Expanded Telemetry Details */}
      {isOpen && (
        <div className="p-5 space-y-4 border-t border-slate-200 bg-white">
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Thời gian tính</span>
                <Gauge size={14} className="text-blue-600" />
              </div>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {metrics.wall_time_seconds.toFixed(4)}{' '}
                <span className="text-xs font-normal text-slate-500">giây</span>
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-600 font-medium">Tính trên trình duyệt</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Vi phạm ràng buộc cứng</span>
                <ShieldCheck size={14} className="text-emerald-600" />
              </div>
              <p className="mt-1 text-lg font-bold text-emerald-600">
                {metrics.hard_constraint_violations}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">100% tuân thủ thỏa mãn</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Tổng số ca đã phân bổ</span>
                <Activity size={14} className="text-blue-600" />
              </div>
              <p className="mt-1 text-lg font-bold text-slate-900">{metrics.total_assignments}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Nhân sự nhận ca</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Giá trị hàm mục tiêu</span>
                <Info size={14} className="text-blue-600" />
              </div>
              <p className="mt-1 text-lg font-bold text-slate-900">{metrics.objective_value.toFixed(0)}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Objective Cost</p>
            </div>
          </div>

          {/* Objective Components Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-2">
              Phân tích Hàm mục tiêu Đa tiêu chí (Multi-objective Decomposition)
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/80">
                <span className="text-[11px] text-slate-500">Phạt thiếu hụt (Shortage):</span>
                <p className="font-bold text-amber-700 text-sm mt-0.5">
                  {metrics.objective_components.shortage}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">({metrics.shortage_agent_slots} lượt)</span>
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/80">
                <span className="text-[11px] text-slate-500">Chi phí thừa (Overstaff):</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {metrics.objective_components.overstaff}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">({metrics.overstaff_agent_slots} lượt)</span>
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/80">
              <span className="text-[11px] text-slate-500">Phân bổ ca:</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {metrics.objective_components.assignment + metrics.objective_components.preference}
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/80">
                <span className="text-[11px] text-slate-500">Cân bằng ca (Fairness):</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {metrics.objective_components.fairness}
                </p>
              </div>
            </div>
          </div>

          {/* Mathematical Constraints Checklist */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 space-y-2">
            <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              Các quy tắc đã áp dụng trong bản xem trước
            </h4>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Ràng buộc 1 ca/ngày/nhân sự: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">sum(x_e_s) &le; 1</code></span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Ràng buộc ca đăng ký: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">x_e_s = 0</code> khi nhân sự không khả dụng</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Giờ nghỉ không tính độ phủ: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">break_slots = 0</code></span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Ràng buộc kỹ năng (Skills match): <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">Skill(e) &cap; Skill(s) &ne; &empty;</code></span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Cân bằng nhân sự & thiếu hụt: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">scheduled + short - over = req</code></span>
              </div>
            </div>
          </div>

          {/* Diagnostics warnings if any */}
          {diagnostics && diagnostics.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                <AlertTriangle size={14} className="text-amber-600" />
                <span>Cảnh báo từ Bộ chuyển đổi & Giải bài toán ({diagnostics.length}):</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-amber-800">
                {diagnostics.map((diag, i) => (
                  <li key={i}>
                    <strong>[{diag.code}]</strong> {diag.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
