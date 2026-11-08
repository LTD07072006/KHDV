import { useRef, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react'
import type { FixtureScenario } from '@/types/scheduling'
import { Button } from './ui/button'

export type WorkbookSourceState = {
  fileName: string
  isFixtureMode: boolean
  invalid: boolean
  expanded: boolean
}

const demoOptions = [
  ['normal', 'Bình thường'],
  ['peak', 'Cao điểm'],
  ['understaffed', 'Thiếu người'],
  ['invalid', 'Dữ liệu lỗi'],
] as const

export function WorkbookSourceToggle({ source, onToggle }: {
  source: WorkbookSourceState
  onToggle: () => void
}) {
  return (
    <div className="roster-field roster-source">
      <span>Nguồn dữ liệu</span>
      <Button
        className="roster-source-button"
        aria-label="Dữ liệu Excel"
        aria-describedby="current-workbook"
        aria-controls="workbook-controls"
        aria-expanded={source.expanded}
        data-invalid={source.invalid}
        onClick={onToggle}
      >
        <FileSpreadsheet size={15} aria-hidden="true" />
        <span id="current-workbook" className="roster-source-name" title={source.fileName}>{source.fileName}</span>
        <span className="roster-source-type">{source.invalid ? 'Tệp chưa hợp lệ' : source.isFixtureMode ? 'Dữ liệu mẫu' : 'Tệp Excel'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </Button>
    </div>
  )
}

export function WorkbookSourcePanel({ source, disabled, onFile, onDownloadTemplate, onSelectFixture, onResetFixture }: {
  source: WorkbookSourceState
  disabled: boolean
  onFile: (file?: File) => void
  onDownloadTemplate: () => void
  onSelectFixture: (id: FixtureScenario['id']) => void
  onResetFixture: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div id="workbook-controls" hidden={!source.expanded} className="roster-data-panel">
      <div className="min-w-0">
        <h2 className="mb-2 text-sm font-semibold">Nhập dữ liệu</h2>
        <p className="mb-2 break-all text-xs text-slate-600">{source.fileName}</p>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx"
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            onFile(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
        />
        <button
          type="button"
          className="roster-drop"
          data-dragging={dragging}
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (!disabled) onFile(event.dataTransfer.files?.[0])
          }}
        >
          <Upload size={18} aria-hidden="true" />
          <span><strong>Chọn tệp Excel</strong><small>Hoặc kéo tệp .xlsx vào đây</small></span>
        </button>
        <button type="button" className="roster-link mt-2" onClick={onDownloadTemplate} disabled={disabled}>
          <Download size={14} aria-hidden="true" /> Tải tệp mẫu
        </button>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">Thử với dữ liệu mẫu</h2>
        <div className="flex flex-wrap gap-2">
          {demoOptions.map(([id, label]) => (
            <Button key={id} disabled={disabled} onClick={() => onSelectFixture(id)}>{label}</Button>
          ))}
        </div>
        {!source.isFixtureMode && (
          <button type="button" className="roster-link mt-3" onClick={onResetFixture} disabled={disabled}>
            <RotateCcw size={14} aria-hidden="true" /> Khôi phục dữ liệu mẫu
          </button>
        )}
      </div>
    </div>
  )
}
