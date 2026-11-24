import { useId, useState, type ReactNode } from 'react'
import { Button } from './ui/button'
import { rangeSlots, slotKey, timeText, type Interval, type Shift, type Slot, type TimeRange } from '@/services/scheduleV2'
import { blankEmployee, blankGroup, displayDate, isValidSlaPercent, numericError, type EmployeeDraft, type GroupDraft, type HistoryDraft } from '@/services/scheduleV2Form'

export function Field({ label, value, onChange, type = 'text', min, max, step, attempted, error, help }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; min?: number; max?: number; step?: number | 'any'; attempted?: boolean; error?: string; help?: string
}) {
  const id = useId()
  const [touched, touch] = useState(false)
  const issue = attempted || touched ? error : undefined
  return <div className="roster-field">
    <div className="v2-field-label"><label htmlFor={id}>{label}</label>{help && <details className="v2-field-help">
      <summary aria-label={`Giải thích: ${label}`}>?</summary><span>{help}</span>
    </details>}</div>
    <input id={id} type={type} aria-invalid={issue ? true : undefined} aria-describedby={issue ? `${id}-error` : undefined}
      value={value} min={min} max={max} step={step} onBlur={() => touch(true)} onChange={(event) => onChange(event.currentTarget.value)} />
    <span id={`${id}-error`} className="v2-field-error" aria-live="polite">{issue}</span>
  </div>
}

export function Choice({ label, value, options, onChange, attempted, error, emptyLabel = 'Chọn' }: {
  label: string; value: string; options: { value: string; label?: string }[]; onChange: (value: string) => void; attempted?: boolean; error?: string; emptyLabel?: string
}) {
  const id = useId()
  const [touched, touch] = useState(false)
  const issue = attempted || touched ? error : undefined
  return <div className="roster-field"><label htmlFor={id}>{label}</label><select id={id} value={value}
    aria-invalid={issue ? true : undefined} aria-describedby={issue ? `${id}-error` : undefined} onBlur={() => touch(true)} onChange={(event) => onChange(event.currentTarget.value)}>
    <option value="">{emptyLabel}</option>
    {value && !options.some((item) => item.value === value) && <option value={value}>{value} (ngoài danh sách)</option>}
    {options.map((item) => <option key={item.value} value={item.value}>{item.label ?? item.value}</option>)}
  </select><span id={`${id}-error`} className="v2-field-error" aria-live="polite">{issue}</span></div>
}

const startOptions = Array.from({ length: 48 }, (_, index) => ({ value: timeText(index * 30) }))
const endOptions = [...startOptions.slice(1), { value: '24:00' }]
export function Check({ label, checked, onChange, disabled = false }: {
  label: ReactNode; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean
}) {
  return <label className="v2-checkbox"><input type="checkbox" checked={checked} disabled={disabled}
    onChange={(event) => onChange(event.currentTarget.checked)} />{label}</label>
}
const replace = <T,>(items: T[], index: number, item: T) => items.map((old, i) => i === index ? item : old)
const remove = <T,>(items: T[], index: number) => items.filter((_, i) => i !== index)
const toggle = (values: string[], value: string, on: boolean) => on ? [...new Set([...values, value])] : values.filter((item) => item !== value)

export function GroupEditor({ groups, onChange, attempted }: { groups: GroupDraft[]; attempted: boolean; onChange: (groups: GroupDraft[]) => void }) {
  return <>
    <p>Thêm các nhóm tiếp nhận cuộc gọi. Dùng cùng mã nhóm trong tệp cuộc gọi.</p>
    {attempted && !groups.length && <p className="v2-field-error">Thêm ít nhất một nhóm để xếp lịch.</p>}
    {groups.map((group, index) => {
      const edit = (key: keyof GroupDraft) => (value: string) => onChange(replace(groups, index, { ...group, [key]: value }))
      return <fieldset className="v2-editor" key={index}><legend>Nhóm {index + 1}</legend>
        <div className="v2-field-grid">
          <Field label="Mã nhóm" value={group.id} onChange={edit('id')} attempted={attempted}
            error={!group.id.trim() || group.id.trim().length > 100 ? 'Nhập mã nhóm, tối đa 100 ký tự.' : groups.some((other, i) => i !== index && other.id.trim() === group.id.trim()) ? 'Mã này đã được dùng. Hãy chọn mã khác.' : undefined} />
          <Field label="Tên nhóm" value={group.name} onChange={edit('name')} attempted={attempted}
            error={!group.name.trim() || group.name.trim().length > 100 ? 'Nhập tên nhóm, tối đa 100 ký tự.' : undefined} />
        </div>
        <Button onClick={() => onChange(remove(groups, index))} aria-label={`Xóa nhóm ${index + 1}`}>Xóa nhóm</Button>
      </fieldset>
    })}
    <div><Button disabled={groups.length >= 10} onClick={() => onChange([...groups, blankGroup()])}>Thêm nhóm</Button></div>
  </>
}

export function GroupTargets({ group, week, attempted, onChange }: { group: GroupDraft; week: string; attempted: boolean; onChange: (group: GroupDraft) => void }) {
  const edit = (key: keyof GroupDraft) => (value: string) => onChange({ ...group, [key]: value })
  const measured = !!(group.samples || group.cutoff)
  return <div className="v2-field-grid">
    <Field label="Mục tiêu trả lời (%)" help="Tỷ lệ cuộc gọi cần được trả lời trong thời gian chờ mục tiêu. Ví dụ: 80% trong 20 giây."
      type="number" min={0} max={100} step="any" value={group.sla} attempted={attempted} onChange={edit('sla')}
      error={!isValidSlaPercent(group.sla) ? 'Nhập tỷ lệ lớn hơn 0% và nhỏ hơn 100%.' : undefined} />
    <Field label="Thời gian chờ mục tiêu (giây)" help="Số giây khách có thể chờ để một cuộc gọi được tính là trả lời đúng mục tiêu."
      type="number" min={0} step="any" value={group.wait} attempted={attempted} onChange={edit('wait')} error={numericError(group.wait, 0)} />
    <Field label="Thời gian xử lý một cuộc gọi (giây)" help="Thời gian trung bình cho một cuộc gọi. Nếu chưa có số đo, dùng ước tính 300 giây (5 phút)."
      type="number" min={0} step="any" value={group.aht} attempted={attempted} onChange={edit('aht')}
      error={!group.aht.trim() || !Number.isFinite(Number(group.aht)) || Number(group.aht) <= 0 ? 'Nhập số giây lớn hơn 0.' : undefined} />
    <Field label="Số cuộc gọi đã đo (nếu có)" help="Bỏ trống cùng ngày chốt nếu thời gian xử lý chỉ là ước tính."
      type="number" min={1} value={group.samples} attempted={attempted} onChange={edit('samples')}
      error={measured ? numericError(group.samples, 1, Infinity, true) : undefined} />
    <Field label="Ngày chốt số liệu (nếu có)" help="Chỉ dùng số liệu trước ngày này để tính thời gian xử lý trung bình."
      type="date" value={group.cutoff} attempted={attempted} onChange={edit('cutoff')}
      error={measured && (!group.cutoff || group.cutoff > week) ? 'Chọn ngày chốt không sau thứ Hai đầu tuần xếp lịch.' : undefined} />
  </div>
}

function RangeFields({ value, onChange, attempted }: { value: TimeRange; onChange: (value: TimeRange) => void; attempted?: boolean }) {
  return <>
    <Choice label="Bắt đầu" value={value.start} options={startOptions} attempted={attempted} error={!value.start ? 'Chọn giờ bắt đầu.' : undefined} onChange={(start) => onChange({ start, end: value.end })} />
    <Choice label="Kết thúc" value={value.end} options={endOptions} attempted={attempted}
      error={!value.end ? 'Chọn giờ kết thúc.' : value.start && value.end <= value.start ? 'Giờ kết thúc phải sau giờ bắt đầu.' : undefined} onChange={(end) => onChange({ start: value.start, end })} />
  </>
}

export function OperatingEditor({ dates, intervals, onChange, attempted }: {
  dates: string[]; intervals: Interval[]; onChange: (intervals: Interval[]) => void; attempted?: boolean
}) {
  return <>
    <p>Thêm nhiều khoảng trong cùng ngày để ngắt quãng giờ hoạt động. Mốc kết thúc là mốc loại trừ và có thể là 24:00.</p>
    {intervals.map((interval, index) => <fieldset className="v2-editor" key={index}><legend>Khoảng hoạt động {index + 1}</legend>
      <div className="v2-field-grid">
        <Choice label="Ngày hoạt động" value={interval.date} attempted={attempted} error={!dates.includes(interval.date) ? 'Chọn ngày trong tuần xếp lịch.' : undefined} options={dates.map((date) => ({ value: date, label: displayDate(date) }))}
          onChange={(date) => onChange(replace(intervals, index, { ...interval, date }))} />
        <RangeFields value={interval} attempted={attempted} onChange={(range) => onChange(replace(intervals, index, { ...interval, ...range }))} />
        <Button onClick={() => onChange(remove(intervals, index))} aria-label={`Xóa khoảng hoạt động ${index + 1}`}>Xóa khoảng</Button>
      </div>
    </fieldset>)}
    <div><Button disabled={!dates.length || intervals.length >= 336} onClick={() => onChange([...intervals, { date: dates[0], start: '', end: '' }])}>Thêm khoảng hoạt động</Button></div>
  </>
}

export function ShiftEditor({ dates, shifts, onChange, attempted }: { dates: string[]; shifts: Shift[]; onChange: (shifts: Shift[]) => void; attempted?: boolean }) {
  return <>
    <p>Ca phải nằm trọn trong giờ hoạt động. Khoảng nghỉ tính vào thời lượng ca và giới hạn tuần. Solver chỉ phân nhóm trong khung làm việc.</p>
    {shifts.map((shift, index) => {
      const edit = (changes: Partial<Shift>) => onChange(replace(shifts, index, { ...shift, ...changes }))
      return <fieldset className="v2-editor" key={index}><legend>Ca ứng viên {index + 1}</legend>
        <div className="v2-field-grid">
          <Choice label="Ngày của ca" value={shift.date} attempted={attempted} error={!dates.includes(shift.date) ? 'Chọn ngày trong tuần xếp lịch.' : undefined}
            options={dates.map((date) => ({ value: date, label: displayDate(date) }))} onChange={(date) => edit({ date })} />
          <RangeFields value={shift} attempted={attempted} onChange={edit} />
          <Button onClick={() => onChange(remove(shifts, index))} aria-label={`Xóa ca ${index + 1}`}>Xóa ca</Button>
        </div>
        {shift.breaks.map((pause, pauseIndex) => <fieldset className="v2-editor v2-pause" key={pauseIndex}><legend>Khoảng nghỉ {pauseIndex + 1}</legend>
          <div className="v2-field-grid">
            <RangeFields value={pause} attempted={attempted} onChange={(value) => edit({ breaks: replace(shift.breaks, pauseIndex, value) })} />
            <Button aria-label={`Xóa khoảng nghỉ ${pauseIndex + 1} của ca ${index + 1}`} onClick={() => edit({ breaks: remove(shift.breaks, pauseIndex) })}>Xóa khoảng nghỉ</Button>
          </div>
        </fieldset>)}
        <Button disabled={shift.breaks.length >= 48} onClick={() => edit({ breaks: [...shift.breaks, { start: '', end: '' }] })}>Thêm khoảng nghỉ</Button>
      </fieldset>
    })}
    <div><Button disabled={!dates.length || shifts.length >= 200} onClick={() => onChange([...shifts, { date: dates[0], start: '', end: '', breaks: [] }])}>Thêm ca</Button></div>
  </>
}

function Availability({ employee, dates, slots, intervals, onChange }: {
  employee: EmployeeDraft; dates: string[]; slots: Slot[]; intervals: Interval[]; onChange: (changes: Partial<EmployeeDraft>) => void
}) {
  const available = new Map(employee.available_slots.map((slot) => [slotKey(slot), slot]))
  const grid = new Set(slots.map(slotKey))
  const off = new Set(employee.unavailable_dates)
  const outside = employee.available_slots.filter((slot) => !grid.has(slotKey(slot)))
  function setSlots(items: Slot[], checked: boolean, keepWildcard = false) {
    const next = new Map(available)
    for (const slot of items) {
      const key = slotKey(slot)
      if (checked && !off.has(slot.date)) next.set(key, slot)
      else next.delete(key)
    }
    onChange({ available_slots: [...next.values()], allAvailable: keepWildcard })
  }
  return <details className="v2-disclosure"><summary>{available.size} khung rảnh · {off.size} ngày nghỉ{employee.allAvailable ? ' · theo giờ hoạt động' : ''}</summary>
    <fieldset className="v2-choice-list"><legend>Ngày nghỉ</legend>
      {[...new Set([...dates, ...off])].map((date) => <Check key={date} label={displayDate(date) + (dates.includes(date) ? '' : ' (ngoài tuần)')}
        checked={off.has(date)} onChange={(checked) => onChange({
          unavailable_dates: toggle(employee.unavailable_dates, date, checked),
          ...(checked ? { available_slots: employee.available_slots.filter((slot) => slot.date !== date) } : employee.allAvailable ? { available_slots: slots.filter((slot) => !new Set(toggle(employee.unavailable_dates, date, false)).has(slot.date)) } : {}),
        })} />)}
    </fieldset>
    <div className="v2-interval-actions">
      <Button disabled={!slots.some((slot) => !off.has(slot.date))} onClick={() => setSlots(slots.filter((slot) => !off.has(slot.date)), true, true)}>Chọn mọi khung mở ngoài ngày nghỉ</Button>
      <Button disabled={!available.size} onClick={() => onChange({ available_slots: [], allAvailable: false })}>Bỏ chọn giờ rảnh</Button>
    </div>
    {!slots.length && <p>Khai báo khoảng hoạt động để chọn giờ rảnh.</p>}
    {intervals.map((interval, index) => {
      const items = rangeSlots(interval).map((start) => ({ date: interval.date, start }))
      return items.length > 0 && dates.includes(interval.date) && <fieldset className="v2-choice-list" key={index} disabled={off.has(interval.date)}>
        <legend>{displayDate(interval.date)} · {interval.start}–{interval.end}{off.has(interval.date) ? ' · Nghỉ' : ''}</legend>
        <Check label="Cả khoảng" checked={items.every((slot) => available.has(slotKey(slot)))} onChange={(checked) => setSlots(items, checked)} />
        {items.map((slot) => <Check key={slot.start} label={slot.start} checked={available.has(slotKey(slot))} onChange={(checked) => setSlots([slot], checked)} />)}
      </fieldset>
    })}
    {!!outside.length && <fieldset className="v2-choice-list v2-inline-warning"><legend>Giờ rảnh ngoài lưới</legend>
      {outside.map((slot) => <Check key={slotKey(slot)} label={`${displayDate(slot.date)} · ${slot.start}`} checked onChange={() => setSlots([slot], false)} />)}
    </fieldset>}
  </details>
}

export function EmployeeEditor({ employees, onChange, groups, dates, slots, intervals, attempted }: {
  employees: EmployeeDraft[]; onChange: (employees: EmployeeDraft[]) => void
  groups: GroupDraft[]; dates: string[]; slots: Slot[]; intervals: Interval[]; attempted?: boolean
}) {
  const groupIds = [...new Set(groups.map((group) => group.id.trim()).filter(Boolean))]
  return <>
    <p>Chọn kỹ năng và từng khoảng rảnh bằng ô chọn. Đánh dấu ngày nghỉ sẽ bỏ các khung rảnh của ngày đó. Để nhận ca, nhân viên cần rảnh cả phần nghỉ trong ca.</p>
    {employees.length > 0 && <div className="roster-table-scroll v2-roster-scroll" role="region" aria-label="Bảng nhân viên" tabIndex={0}>
      <table className="roster-data-table v2-roster">
        <thead><tr><th scope="col">Nhân viên</th><th scope="col">Kỹ năng</th><th scope="col">Giới hạn tuần</th><th scope="col">Giờ rảnh và ngày nghỉ</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{employees.map((employee, index) => {
          const edit = (change: Partial<EmployeeDraft>) => onChange(replace(employees, index, { ...employee, ...change }))
          return <tr key={index}>
            <th scope="row"><Field label={`Mã nhân viên ${index + 1}`} value={employee.id} attempted={attempted} onChange={(id) => edit({ id })}
              error={!employee.id.trim() || employee.id.trim().length > 100 ? 'Nhập mã nhân viên, tối đa 100 ký tự.' : employees.some((other, i) => i !== index && other.id.trim() === employee.id.trim()) ? 'Mã nhân viên bị trùng.' : undefined} /></th>
            <td><fieldset className="v2-choice-list"><legend className="sr-only">Kỹ năng nhân viên {index + 1}</legend>
              {!groupIds.length && <p>Thêm nhóm để chọn kỹ năng.</p>}
              {[...new Set([...groupIds, ...employee.skills])].map((id) => <Check key={id} label={id + (groupIds.includes(id) ? '' : ' (đã bỏ nhóm)')}
                checked={employee.skills.includes(id)} onChange={(on) => edit({ skills: toggle(employee.skills, id, on) })} />)}
            </fieldset></td>
            <td><Field label="Số phút làm tối đa mỗi tuần" type="number" min={0} max={10080} value={employee.cap} attempted={attempted} error={numericError(employee.cap, 0, 10080, true)} onChange={(cap) => edit({ cap })} />
              <Field label="Số ngày nghỉ tối thiểu mỗi tuần" type="number" min={0} max={7} value={employee.daysOff} attempted={attempted} error={employee.daysOff ? numericError(employee.daysOff, 0, 7, true) : undefined} onChange={(daysOff) => edit({ daysOff })} /></td>
            <td><Availability employee={employee} dates={dates} slots={slots} intervals={intervals} onChange={edit} /></td>
            <td><Button aria-label={`Xóa nhân viên ${index + 1}`} onClick={() => onChange(remove(employees, index))}>Xóa</Button></td>
          </tr>
        })}</tbody>
      </table>
    </div>}
    <div><Button disabled={employees.length >= 50} onClick={() => onChange([...employees, blankEmployee()])}>Thêm nhân viên</Button></div>
  </>
}

export function HistoryEditor({ rows, groups, window, attempted, onChange }: {
  rows: HistoryDraft[]; groups: string[]; window: { start_date: string; end_date: string }; attempted?: boolean; onChange: (rows: HistoryDraft[]) => void
}) {
  const [page, setPage] = useState(0)
  const limit = 25
  const last = Math.max(0, Math.ceil(rows.length / limit) - 1)
  const active = Math.min(page, last)
  return <>
    <p>{rows.length.toLocaleString('vi-VN')} quan sát. Mỗi thứ, giờ bắt đầu và nhóm cần ít nhất hai ngày có quan sát.</p>
    {rows.slice(active * limit, (active + 1) * limit).map((row, offset) => {
      const index = active * limit + offset
      const edit = (key: keyof HistoryDraft) => (value: string) => onChange(replace(rows, index, { ...row, [key]: value }))
      return <fieldset className="v2-editor" key={index}><legend>Quan sát {index + 1}</legend>
        <div className="v2-field-grid">
          <Field label="Ngày ghi nhận" type="date" value={row.date} attempted={attempted} error={!row.date || row.date < window.start_date || row.date >= window.end_date ? 'Chọn ngày nằm trong khoảng lịch sử đã khai báo.' : undefined} onChange={edit('date')} />
          <Choice label="Bắt đầu" value={row.start} options={startOptions} attempted={attempted} error={!startOptions.some(({ value }) => value === row.start) ? 'Chọn mốc giờ theo khung 30 phút.' : undefined} onChange={edit('start')} />
          <Choice label="Nhóm nhận cuộc gọi" value={row.group_id} options={groups.map((value) => ({ value }))} attempted={attempted} error={!groups.includes(row.group_id) ? 'Chọn một nhóm đã khai báo.' : undefined} onChange={edit('group_id')} />
          <Field label="Số cuộc gọi" type="number" min={0} value={row.calls} attempted={attempted} error={numericError(row.calls, 0, Infinity, true)} onChange={edit('calls')} />
          <Button aria-label={`Xóa quan sát ${index + 1}`} onClick={() => onChange(remove(rows, index))}>Xóa</Button>
        </div>
      </fieldset>
    })}
    <div className="v2-controls">
      <Button disabled={rows.length >= 100_000} onClick={() => {
        onChange([...rows, { date: '', start: '', group_id: '', calls: '' }])
        setPage(Math.floor(rows.length / limit))
      }}>Thêm quan sát</Button>
      {last > 0 && <>
        <Button disabled={active === 0} onClick={() => setPage(active - 1)}>Trang trước</Button>
        <span aria-live="polite">Trang {active + 1}/{last + 1}</span>
        <Button disabled={active === last} onClick={() => setPage(active + 1)}>Trang sau</Button>
      </>}
    </div>
  </>
}
