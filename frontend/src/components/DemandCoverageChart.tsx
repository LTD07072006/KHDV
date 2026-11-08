import { useId, useState } from 'react'
import type { CoverageItem } from '@/types/scheduling'
import { coverageOutcome, coverageOutcomes, displayCoverageStatus } from '@/lib/coverageDisplay'
import './CoverageChart.css'

type Props = { rows: CoverageItem[]; hasResult: boolean; onInspectSlot?: (row: CoverageItem, returnTo: string) => void }

export function DemandCoverageChart({ rows, hasResult, onInspectSlot }: Props) {
  const chartId = useId()
  const titleId = `${chartId}-title`
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [hoveredTime, setHoveredTime] = useState<string | null>(null)
  const selected = rows.find((row) => row.time === selectedTime)
  const inspected = rows.find((row) => row.time === hoveredTime) ?? selected
  const slotOutcomes = rows.map((row) => coverageOutcome(row, hasResult))
  const inspectedOutcome = inspected && coverageOutcome(inspected, hasResult)
  const peakDemand = hasResult ? undefined : rows.reduce<CoverageItem | undefined>((peak, row) =>
    !row.onBreak && (!peak || row.required > peak.required) ? row : peak, undefined)
  const maximum = rows.reduce((value, row) => Math.max(value, row.required, hasResult ? row.scheduled : 0), 0)
  const scale = Math.max(4, Math.ceil(maximum / 4) * 4)

  const selectSlot = (time: string) => {
    setSelectedTime(time)
    setHoveredTime(null)
  }

  return (
    <section className="roster-chart" data-result={hasResult} aria-labelledby={titleId}>
      <div className="roster-chart-heading">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 id={titleId}>{hasResult ? 'Độ phủ theo khung giờ' : 'Biểu đồ nhu cầu'}</h3>
          <span className="roster-chart-unit">Nhân sự / 30 phút</span>
        </div>
        <div className="roster-data-legend" role="group" aria-label="Chú giải">
          <span><i data-series="required" /> Nhu cầu</span>
          {hasResult && <span><i data-series="scheduled" /> Đã xếp</span>}
          {coverageOutcomes.filter((outcome) => slotOutcomes.includes(outcome)).map((outcome) => (
            <span key={outcome.id}>
              <b className="roster-chart-outcome" data-outcome={outcome.id} aria-hidden="true">{outcome.symbol}</b>
              {outcome.label}
            </span>
          ))}
          {rows.some((row) => row.onBreak) && <span><i data-series="pause" /> Giờ nghỉ</span>}
        </div>
      </div>
      <p className="roster-chart-scroll-hint print:hidden">Vuốt ngang để xem đủ khung giờ.</p>
      {rows.length ? (
        <div className="roster-chart-scroll" tabIndex={0} aria-label="Biểu đồ, cuộn ngang để xem thêm khung giờ">
          <div className="roster-chart-grid" style={{ minWidth: Math.max(360, rows.length * 23 + 36) }}>
            <div className="roster-chart-axis" aria-hidden="true">
              {[scale, scale * 0.75, scale * 0.5, scale * 0.25, 0].map((tick) => <span key={tick}>{tick}</span>)}
            </div>
            <div className="roster-chart-plot" role="group" aria-label="Chọn một khung giờ để xem số liệu"
              onPointerLeave={() => setHoveredTime(null)}>
              {rows.map((row, index) => {
                const required = (row.required / scale) * 100
                const scheduled = (row.scheduled / scale) * 100
                const outcome = slotOutcomes[index]
                const delta = outcome?.id === 'surplus' ? row.overstaff : row.shortage
                const deltaHeight = (delta / scale) * 100
                const describeResult = hasResult && !row.onBreak
                const descriptionId = `${chartId}-slot-${index}`
                return (
                  <button
                    id={`chart-slot-${row.time}`}
                    type="button"
                    key={row.time}
                    className="roster-chart-column"
                    data-break={Boolean(row.onBreak)}
                    data-hovered={hoveredTime === row.time}
                    aria-label={row.time}
                    aria-describedby={descriptionId}
                    aria-pressed={selectedTime === row.time}
                    tabIndex={(selected ? selectedTime === row.time : index === 0) ? 0 : -1}
                    onClick={() => selectSlot(row.time)}
                    onPointerMove={(event) => {
                      if (event.pointerType === 'mouse' && (event.movementX || event.movementY)) {
                        setHoveredTime(row.time)
                      }
                    }}
                    onFocus={() => selectSlot(row.time)}
                    onKeyDown={(event) => {
                      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                      event.preventDefault()
                      const column = event.currentTarget
                      const destinations = {
                        ArrowLeft: column.previousElementSibling,
                        ArrowRight: column.nextElementSibling,
                        Home: column.parentElement?.firstElementChild,
                        End: column.parentElement?.lastElementChild,
                      }
                      const next = destinations[event.key as keyof typeof destinations]
                      if (next instanceof HTMLButtonElement) next.focus()
                    }}
                  >
                    <span id={descriptionId} className="sr-only">
                      Cần {row.required} người.
                      {row.onBreak && ' Giờ nghỉ.'}
                      {describeResult && ` Đã xếp ${row.scheduled} người.`}
                      {describeResult && row.shortage > 0 && ` Thiếu ${row.shortage} người.`}
                      {describeResult && row.overstaff > 0 && ` Dư ${row.overstaff} người.`}
                      {outcome?.id === 'covered' && ' Đủ người.'}
                    </span>
                    <span className="roster-chart-required" style={{ bottom: `${required}%` }} />
                    {describeResult && (
                      <>
                        <span className="roster-chart-scheduled" style={{ height: `${Math.min(required, scheduled)}%` }} />
                        {outcome?.id === 'shortage' && (
                          <span className="roster-chart-shortage" style={{ bottom: `${scheduled}%`, height: `${deltaHeight}%` }} />
                        )}
                        {outcome?.id === 'surplus' && (
                          <span className="roster-chart-surplus" style={{ bottom: `${required}%`, height: `${deltaHeight}%` }} />
                        )}
                      </>
                    )}
                    {!hasResult && <span className="roster-chart-forecast" style={{ height: `${required}%` }} />}
                    {outcome && (
                      <span className="roster-chart-outcome roster-chart-slot-status" data-outcome={outcome.id} aria-hidden="true">
                        {outcome.symbol}{outcome.id === 'shortage' && row.shortage}
                      </span>
                    )}
                    {(index % 4 === 0 || (index === rows.length - 1 && index % 4 >= 2)) && (
                      <span className="roster-chart-time" aria-hidden="true">{row.time.slice(0, 5)}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : <p className="py-4 text-sm text-slate-600">Chưa có dữ liệu nhu cầu.</p>}
      {rows.length > 0 && (
        <div className="roster-chart-detail">
          {inspected ? (
            <>
              <strong>{inspected.time}</strong>
              <span>{inspected.calls.toLocaleString('vi-VN')} cuộc gọi</span>
              <span>AHT {inspected.aht.toLocaleString('vi-VN')} phút</span>
              <span>Cần {inspected.required} người</span>
              {inspected.onBreak ? <span>Giờ nghỉ</span> : hasResult && (
                <>
                  <span>Đã xếp {inspected.scheduled} người</span>
                  {inspectedOutcome && (
                    <strong className="roster-chart-detail-status" data-outcome={inspectedOutcome.id}>
                      {displayCoverageStatus(inspected, hasResult)}
                    </strong>
                  )}
                </>
              )}
            </>
          ) : peakDemand && peakDemand.required > 0 ? (
            <><strong>Nhu cầu cao nhất</strong><span>{peakDemand.time} · Cần {peakDemand.required} người</span></>
          ) : 'Chọn một khung giờ để xem số liệu.'}
          {hasResult && selected && !selected.onBreak && selected === inspected && onInspectSlot && (
            <button type="button" className="roster-link min-h-8" onClick={() => onInspectSlot(selected, `chart-slot-${selected.time}`)}>
              Xem người trực lúc {selected.time.slice(0, 5)}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
