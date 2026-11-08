import { Search } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Employee, ShiftId } from '@/types/scheduling'
import { DisclosureMenu } from './ui/DisclosureMenu'
import './WorkspaceTables.css'
import './EmployeeInputTable.css'

export type EmployeeFilter = 'all' | 'working' | 'off'
export type EmployeeAction = 'work' | 'off' | ShiftId | 'both'
type EmployeeChange = Partial<Pick<Employee, 'working' | 'allowedShifts'>>

const shiftOptions = [
  { id: 'ca_ngay', label: 'Ca ngày' },
  { id: 'ca_dem', label: 'Ca đêm' },
] as const

const actions: { id: EmployeeAction; label: string; message: string; requiresWorking?: boolean }[] = [
  { id: 'work', label: 'Đánh dấu đi làm', message: 'Đã đánh dấu đi làm cho' },
  { id: 'off', label: 'Cho nghỉ', message: 'Đã cho nghỉ' },
  { id: 'ca_ngay', label: 'Chỉ nhận ca ngày', message: 'Đã chọn ca ngày cho', requiresWorking: true },
  { id: 'ca_dem', label: 'Chỉ nhận ca đêm', message: 'Đã chọn ca đêm cho', requiresWorking: true },
  { id: 'both', label: 'Có thể nhận cả hai ca', message: 'Đã mở cả hai ca cho', requiresWorking: true },
]

export function EmployeeInputTable({
  employees,
  total,
  workingCount,
  search,
  filter,
  onSearch,
  onFilter,
  onApply,
  onUpdate,
  disabled = false,
}: {
  employees: Employee[]
  total: number
  workingCount: number
  search: string
  filter: EmployeeFilter
  onSearch: (value: string) => void
  onFilter: (value: EmployeeFilter) => void
  onApply: (ids: string[] | null, action: EmployeeAction) => void
  onUpdate: (id: string, change: EmployeeChange) => void
  disabled?: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [message, setMessage] = useState('')
  const selectAllInput = useRef<HTMLInputElement>(null)
  const selected = employees.filter((employee) => selectedIds.has(employee.id))
  const selectedWorking = selected.filter((employee) => employee.working).length
  const allVisibleSelected = employees.length > 0 && selected.length === employees.length
  const filters = [
    { id: 'all', label: 'Tất cả', count: total },
    { id: 'working', label: 'Đi làm', count: workingCount },
    { id: 'off', label: 'Nghỉ', count: total - workingCount },
  ] as const

  const clearSelection = () => setSelectedIds(new Set())

  const toggleSelection = (employeeId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(employeeId)
      else next.delete(employeeId)
      return next
    })
    setMessage('')
  }

  const updateEmployee = (id: string, change: EmployeeChange) => {
    if (change.working !== undefined && filter !== 'all') toggleSelection(id, false)
    setMessage('')
    onUpdate(id, change)
  }

  const apply = (action: typeof actions[number], wholeTeam: boolean, count: number) => {
    onApply(wholeTeam ? null : selected.map((employee) => employee.id), action.id)
    setMessage(`${action.message} ${count} nhân viên.`)
    clearSelection()
    if (!wholeTeam) selectAllInput.current?.focus()
  }

  const renderActions = (wholeTeam: boolean) => actions.map((action) => {
    const count = action.requiresWorking
      ? (wholeTeam ? workingCount : selectedWorking)
      : (wholeTeam ? total : selected.length)

    return (
      <button key={action.id} type="button" disabled={disabled || count === 0} onClick={() => apply(action, wholeTeam, count)}>
        {action.label}{wholeTeam && ` · ${count} người${action.requiresWorking ? ' đi làm' : ''}`}
      </button>
    )
  })

  return (
    <div className="employee-editor roster-work-table">
      <div className="roster-work-table-heading">
        <h3>Nhân viên và ca có thể nhận</h3>
      </div>
      <div className="employee-toolbar roster-work-table-toolbar">
        <label className="employee-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Tìm nhân viên"
            placeholder="Tìm theo tên hoặc mã"
            value={search}
            onChange={(event) => {
              clearSelection()
              setMessage('')
              onSearch(event.target.value)
            }}
          />
        </label>
        <div className="roster-view-options roster-work-table-filters employee-filters" role="group" aria-label="Lọc nhân viên">
          {filters.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => {
                if (filter !== id) clearSelection()
                setMessage('')
                onFilter(id)
              }}
            >
              {label} <span className="employee-filter-count">({count})</span>
            </button>
          ))}
        </div>
        <DisclosureMenu className="employee-team-menu" label="Cả đội">
          <p>Áp dụng cho toàn đội, kể cả ngoài bộ lọc.</p>
          {renderActions(true)}
        </DisclosureMenu>
      </div>

      <div className="employee-selection" data-active={selected.length > 0}>
        <p role="status">
          {selected.length ? <strong>Đã chọn {selected.length} người</strong> : `Đang xem ${employees.length}/${total} nhân viên`}
        </p>
        {selected.length > 0 && (
          <div className="employee-batch-actions">
            <DisclosureMenu className="employee-batch-menu" label="Thao tác với nhóm đã chọn">
              {selectedWorking < selected.length && (
                <p>Lệnh đổi ca áp dụng cho {selectedWorking}/{selected.length} người đang đi làm.</p>
              )}
              {renderActions(false)}
            </DisclosureMenu>
            <button type="button" className="employee-clear-selection" onClick={() => {
              clearSelection()
              selectAllInput.current?.focus()
            }}>Bỏ chọn</button>
          </div>
        )}
      </div>
      {message && <p className="employee-action-message" role="status">{message}</p>}

      {employees.length ? (
        <div className="employee-table-scroll" role="region" aria-label="Danh sách nhân viên và ca có thể nhận">
          <table className="employee-table" role="table">
            <caption className="sr-only">Nhân viên và ca có thể nhận</caption>
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  <label className="employee-choice">
                    <input
                      ref={(input) => {
                        selectAllInput.current = input
                        if (input) input.indeterminate = selected.length > 0 && !allVisibleSelected
                      }}
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={disabled}
                      onChange={() => {
                        setSelectedIds(allVisibleSelected ? new Set() : new Set(employees.map((employee) => employee.id)))
                        setMessage('')
                      }}
                    />
                    <span className="employee-select-all-label">Chọn kết quả đang xem</span>
                  </label>
                </th>
                <th scope="col" role="columnheader">Nhân viên</th>
                <th scope="col" role="columnheader">Đi làm</th>
                <th scope="col" role="columnheader">Ca ngày</th>
                <th scope="col" role="columnheader">Ca đêm</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {employees.map((employee) => (
                <tr key={employee.id} role="row" data-selected={selectedIds.has(employee.id)}>
                  <td role="cell" className="employee-row-selection">
                    <EmployeeCheckbox
                      label="Chọn"
                      name={`Chọn ${employee.name}`}
                      checked={selectedIds.has(employee.id)}
                      disabled={disabled}
                      onChange={(checked) => toggleSelection(employee.id, checked)}
                    />
                  </td>
                  <th scope="row" role="rowheader" className="employee-identity">
                    <span className="employee-name">{employee.name}</span>
                    <span className="employee-meta">{employee.id} · {employee.skill || 'Hỗ trợ chung'}</span>
                    {employee.working && !employee.allowedShifts.length && <span className="employee-shift-warning">Chưa chọn ca</span>}
                  </th>
                  <td role="cell">
                    <EmployeeCheckbox
                      label="Đi làm"
                      name={`${employee.name} đi làm`}
                      checked={employee.working}
                      disabled={disabled}
                      onChange={(checked) => updateEmployee(employee.id, { working: checked })}
                    />
                  </td>
                  {shiftOptions.map(({ id, label }) => (
                    <td role="cell" key={id}>
                      <EmployeeCheckbox
                        label={label}
                        name={`${employee.name} ${label.toLowerCase()}`}
                        checked={employee.allowedShifts.includes(id)}
                        disabled={disabled || !employee.working}
                        onChange={(checked) => updateEmployee(employee.id, {
                          allowedShifts: checked
                            ? [...employee.allowedShifts, id]
                            : employee.allowedShifts.filter((shift) => shift !== id),
                        })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="employee-empty">
          <p className="font-semibold">{total ? 'Không có nhân viên khớp với bộ lọc' : 'Chưa có nhân viên'}</p>
          {total ? (
            <button type="button" className="roster-link" onClick={() => {
              onSearch('')
              onFilter('all')
            }}>Xóa bộ lọc</button>
          ) : <p>Nhập tệp Excel có danh sách nhân viên để bắt đầu.</p>}
        </div>
      )}
    </div>
  )
}

function EmployeeCheckbox({ label, name, checked, disabled, onChange }: {
  label: string
  name: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="employee-choice">
      <input
        type="checkbox"
        aria-label={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="employee-choice-caption" aria-hidden="true">{label}</span>
    </label>
  )
}
