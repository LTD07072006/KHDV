import type { DemandRow, FixtureScenario } from '@/types/scheduling'
import { PlanningSummary } from './PlanningSummary'
import { SlaConfigBox } from './SlaConfigBox'
import { WorkbookSourcePanel, WorkbookSourceToggle, type WorkbookSourceState } from './WorkbookSource'
import { Button } from './ui/button'
import './SchedulingSetup.css'

type Props = {
  date: string
  formattedDate: string
  serviceTarget: number
  answerWithinSeconds: number
  demand: DemandRow[]
  workingCount: number
  employeeCount: number
  source: WorkbookSourceState
  busy: boolean
  processingLabel: string
  previewReady: boolean
  previewIsPrimary: boolean
  onDateChange: (date: string) => void
  onSlaChange: (target: number, seconds: number) => void
  onToggleSource: () => void
  onFile: (file?: File) => void
  onDownloadTemplate: () => void
  onSelectFixture: (id: FixtureScenario['id']) => void
  onResetFixture: () => void
  onClearData?: () => void
  onGenerate: () => void
}

export function SchedulingSetup({
  date, formattedDate, serviceTarget, answerWithinSeconds, demand, workingCount, employeeCount,
  source, busy, processingLabel, previewReady, previewIsPrimary,
  onDateChange, onSlaChange, onToggleSource, onFile, onDownloadTemplate, onSelectFixture, onResetFixture, onClearData, onGenerate,
}: Props) {
  return (
    <section className="roster-surface roster-setup print:hidden" aria-label="Thiết lập lịch">
      <div className="roster-toolbar">
        <label className="roster-field" htmlFor="planning-date">
          <span>Ngày lập lịch</span>
          <span className="roster-date">
            <input
              id="planning-date"
              type="date"
              lang="vi"
              value={date}
              disabled={busy}
              onChange={(event) => onDateChange(event.target.value)}
            />
            {date && <span className="roster-date-value" aria-hidden="true">{formattedDate}</span>}
          </span>
        </label>
        <SlaConfigBox
          serviceTarget={serviceTarget}
          answerWithinSeconds={answerWithinSeconds}
          onChange={onSlaChange}
          disabled={busy}
        />
        <WorkbookSourceToggle source={source} onToggle={onToggleSource} />
        <div className="roster-actions">
          <Button variant={previewIsPrimary ? 'primary' : 'secondary'} onClick={onGenerate} disabled={busy || !previewReady || !date}>
            {busy ? processingLabel : 'Tạo bản xem trước'}
          </Button>
        </div>
      </div>
      <PlanningSummary demand={demand} workingCount={workingCount} employeeCount={employeeCount} />
      <WorkbookSourcePanel
        source={source}
        disabled={busy}
        onFile={onFile}
        onDownloadTemplate={onDownloadTemplate}
        onSelectFixture={onSelectFixture}
        onResetFixture={onResetFixture}
        onClearData={onClearData}
      />
    </section>
  )
}
