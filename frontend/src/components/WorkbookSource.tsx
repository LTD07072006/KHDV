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
  const hasFile = Boolean(source.fileName)
  const sourceLabel = hasFile
    ? (source.invalid ? 'Tệp chưa hợp lệ' : source.isFixtureMode ? 'Dữ liệu mẫu' : 'Tệp Excel')
    : 'Chưa có dữ liệu'

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
        <span id="current-workbook" className="roster-source-name" title={source.fileName || 'Chưa chọn tệp'}>
          {source.fileName || 'Chưa chọn tệp'}
        </span>
        <span className="roster-source-type">{sourceLabel}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </Button>
    </div>
  )
}

export function WorkbookSourcePanel({ source, disabled, onFile, onDownloadTemplate, onSelectFixture, onResetFixture, onClearData }: {
  source: WorkbookSourceState
  disabled: boolean
  onFile: (file?: File) => void
  onDownloadTemplate: () => void
  onSelectFixture: (id: FixtureScenario['id']) => void
  onResetFixture: () => void
  onClearData?: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div id="workbook-controls" hidden={!source.expanded} className="roster-data-panel">
      <div className="min-w-0">
        <h2 className="mb-2 text-sm font-semibold">Nhập dữ liệu</h2>
        {source.fileName ? (
          <p className="mb-2 break-all text-xs text-slate-600">{source.fileName}</p>
        ) : (
          <p className="mb-2 text-xs text-slate-500 italic">Chưa nạp tệp Excel hoặc dữ liệu mẫu</p>
        )}
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
        <div className="mt-3 flex flex-wrap gap-3">
          {source.fileName && onClearData && (
            <button type="button" className="roster-link text-rose-600 hover:text-rose-700" onClick={onClearData} disabled={disabled}>
              <RotateCcw size={14} aria-hidden="true" /> Đưa về chưa nhập mẫu
            </button>
          )}
          <button type="button" className="roster-link" onClick={onResetFixture} disabled={disabled}>
            <RotateCcw size={14} aria-hidden="true" /> Nạp mẫu 20 NV
          </button>
        </div>
      </div>
    </div>
  )
}
