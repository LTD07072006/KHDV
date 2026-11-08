import type { ReactNode, Ref } from 'react'
import { AlertCircle, ArrowDown, Download, Printer } from 'lucide-react'
import type { CoverageSummary } from '@/lib/coverageDisplay'
import type { CoverageItem } from '@/types/scheduling'
import { Button } from './ui/button'
import { DisclosureMenu } from './ui/DisclosureMenu'
import './ScheduleWorkspace.css'

const workspaceTabs = [
  { id: 'demand', label: 'Nhu cầu và độ phủ' },
  { id: 'schedule', label: 'Lịch theo ca' },
  { id: 'employees', label: 'Nhân sự đầu vào' },
] as const

const demandViews = [
  { id: 'both', label: 'Cả hai' },
  { id: 'chart', label: 'Biểu đồ' },
  { id: 'table', label: 'Bảng' },
] as const

const scheduleViews = [
  { id: 'gantt', label: 'Dòng thời gian' },
  { id: 'table', label: 'Danh sách' },
] as const

type WorkspaceTab = typeof workspaceTabs[number]['id']
export type DemandViewMode = typeof demandViews[number]['id']
export type ScheduleViewMode = typeof scheduleViews[number]['id']

export function ScheduleWorkspace({ activeTab, onTabChange, demandMode, onDemandModeChange, scheduleMode, onScheduleModeChange, inspectingSlot, header, coverage, panels, printSchedule }: {
  activeTab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
  demandMode: DemandViewMode
  onDemandModeChange: (mode: DemandViewMode) => void
  scheduleMode: ScheduleViewMode
  onScheduleModeChange: (mode: ScheduleViewMode) => void
  inspectingSlot: boolean
  header: ReactNode
  coverage: ReactNode
  panels: Record<WorkspaceTab, ReactNode>
  printSchedule: ReactNode
}) {
  return (
    <section className="roster-surface roster-workspace" aria-labelledby="workspace-heading">
      {header}
      {coverage}
      <div className="roster-viewbar print:hidden">
        <div
          className="roster-tabs"
          role="tablist"
          aria-label="Các chế độ xem bảng điều phối"
          onKeyDown={(event) => {
            const index = workspaceTabs.findIndex((tab) => tab.id === activeTab)
            const destinations = {
              ArrowLeft: (index + workspaceTabs.length - 1) % workspaceTabs.length,
              ArrowRight: (index + 1) % workspaceTabs.length,
              Home: 0,
              End: workspaceTabs.length - 1,
            }
            if (!Object.hasOwn(destinations, event.key)) return
            event.preventDefault()
            const next = workspaceTabs[destinations[event.key as keyof typeof destinations]].id
            onTabChange(next)
            document.getElementById(`${next}-tab`)?.focus()
          }}
        >
          {workspaceTabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              id={`${id}-tab`}
              role="tab"
              aria-controls={`${id}-panel`}
              aria-selected={activeTab === id}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => onTabChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab === 'demand' && (
          <ViewOptions label="Cách xem độ phủ" options={demandViews} value={demandMode} onChange={onDemandModeChange} />
        )}
        {activeTab === 'schedule' && !inspectingSlot && (
          <ViewOptions label="Cách xem lịch theo ca" options={scheduleViews} value={scheduleMode} onChange={onScheduleModeChange} />
        )}
      </div>
      {workspaceTabs.map(({ id }) => (
        <div key={id} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab`} tabIndex={0}
          hidden={activeTab !== id} className={id === 'employees' ? 'print:hidden' : undefined}>
          {activeTab === id && panels[id]}
        </div>
      ))}
      {printSchedule}
    </section>
  )
}

function ViewOptions<Mode extends string>({ label, options, value, onChange }: {
  label: string
  options: readonly { id: Mode; label: string }[]
  value: Mode
  onChange: (value: Mode) => void
}) {
  return (
    <div className="roster-view-options" role="group" aria-label={label}>
      {options.map(({ id, label }) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  )
}

type ResultActions = {
  onSave: () => void
  onExportSchedule: () => void
  onExportCoverage: () => void
  onExportAudit: () => void
  onPrint: () => void
}

export function ScheduleResultHeader({ headingRef, formattedDate, isCurrentFinal, previewStale, busy, actions, onRegenerate, regenerateBlockReason }: {
  headingRef: Ref<HTMLHeadingElement>
  formattedDate: string
  isCurrentFinal: boolean
  previewStale: boolean
  busy: boolean
  actions?: ResultActions
  onRegenerate: () => void
  regenerateBlockReason?: string
}) {
  const state = isCurrentFinal ? 'Đã chốt trên trình duyệt'
    : actions ? 'Lịch mô phỏng'
    : previewStale ? 'Dữ liệu đã đổi · Cần xếp lại ca'
    : 'Chờ xếp ca'

  return (
    <div className="roster-section-heading roster-result-heading" data-stale={previewStale}>
      <div className="roster-result-context">
        <h2 id="workspace-heading" ref={headingRef} tabIndex={-1} aria-describedby="workspace-state">Bảng điều phối</h2>
        <p id="workspace-state" className="roster-result-state" role="status">
          {state}{formattedDate && ` · ${formattedDate}`}
          {previewStale && regenerateBlockReason && <span> · {regenerateBlockReason}</span>}
        </p>
      </div>
      {previewStale ? (
        <div className="roster-result-actions print:hidden">
          <Button variant="primary" disabled={busy || Boolean(regenerateBlockReason)} onClick={onRegenerate}>
            {busy ? 'Đang xử lý…' : 'Xếp lại ca'}
          </Button>
        </div>
      ) : actions && (
        <div className="roster-result-actions print:hidden">
          <Button variant={isCurrentFinal ? 'secondary' : 'primary'} disabled={busy} onClick={actions.onSave}>Lưu lịch</Button>
          <DisclosureMenu className="roster-export" label={<><Download size={14} aria-hidden="true" /> Xuất / in</>}>
            <button type="button" onClick={actions.onExportSchedule}>Tải lịch (CSV)</button>
            <button type="button" onClick={actions.onExportCoverage}>Tải độ phủ (CSV)</button>
            <button type="button" onClick={actions.onExportAudit}>Tải bản đối chiếu (JSON)</button>
            <button type="button" onClick={actions.onPrint}><Printer size={14} aria-hidden="true" /> In báo cáo</button>
          </DisclosureMenu>
        </div>
      )}
    </div>
  )
}

export function CoverageStatus({ summary, onInspectShortage, onInspectSlot }: {
  summary: CoverageSummary
  onInspectShortage: () => void
  onInspectSlot: (row: CoverageItem, returnTo: string) => void
}) {
  const { worst, uncoveredSlots, shortage, coveredSlots, totalSlots } = summary

  if (totalSlots === 0) {
    return <p className="roster-coverage-strip" data-empty="true" role="status">Dữ liệu chỉ có khung giờ nghỉ.</p>
  }

  return (
    <div className="roster-coverage-strip" data-shortage={Boolean(worst)}>
      <div role="status">
        {worst ? (
          <>
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              Thiếu nhiều nhất {worst.time} · Cần thêm {worst.shortage} người
            </p>
            <p className="roster-coverage-detail">
              Đủ {coveredSlots}/{totalSlots} khung giờ · {uncoveredSlots} khung giờ thiếu người · Tổng thiếu {shortage.toLocaleString('vi-VN')} lượt nhân sự
            </p>
          </>
        ) : (
          <p className="font-semibold">Đủ người trong {coveredSlots}/{totalSlots} khung giờ làm việc</p>
        )}
      </div>
      {worst && (
        <div className="roster-coverage-actions print:hidden">
          <Button onClick={onInspectShortage}>
            Xem giờ thiếu người <ArrowDown size={14} aria-hidden="true" />
          </Button>
          <Button id="inspect-worst-slot" onClick={(event) => onInspectSlot(worst, event.currentTarget.id)}>
            Ai trực lúc {worst.time.slice(0, 5)}?
          </Button>
        </div>
      )}
    </div>
  )
}
