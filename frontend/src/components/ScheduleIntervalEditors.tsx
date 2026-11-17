import { useState, type ReactNode } from 'react'
import { Button } from './ui/button'
import { rangeSlots, slotKey, timeText, type Interval, type Shift, type Slot, type TimeRange } from '@/services/scheduleV2'
import { blankEmployee, blankGroup, displayDate, isValidSlaPercent, type EmployeeDraft, type GroupDraft, type HistoryDraft } from '@/services/scheduleV2Form'

export function Field({ label, value, onChange, type = 'text', min, max, step, invalid }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; min?: number; max?: number; step?: number | 'any'; invalid?: boolean
}) {
  return <label className="roster-field"><span>{label}</span>
    <input type={type} aria-invalid={invalid} value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.currentTarget.value)} />
  </label>
}

export function Choice({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label?: string }[]; onChange: (value: string) => void
}) {
  return <label className="roster-field"><span>{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
    <option value="">Chọn</option>
    {value && !options.some((item) => item.value === value) && <option value={value}>{value} (ngoài danh sách)</option>}
    {options.map((item) => <option key={item.value} value={item.value}>{item.label ?? item.value}</option>)}
  </select></label>
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
    <p>Đặt SLA và ngưỡng chờ cho từng nhóm. Khi có cuộc gọi, nhập AHT dương, số mẫu và ngày chốt mẫu. Tệp Database Sample cung cấp các giá trị AHT từ backend.</p>
    {groups.map((group, index) => {
      const edit = (key: keyof GroupDraft) => (value: string) => onChange(replace(groups, index, { ...group, [key]: value }))
      return <fieldset className="v2-editor" key={index}><legend>Nhóm {index + 1}</legend>
        <div className="v2-field-grid">
          <Field label="Mã nhóm" value={group.id} onChange={edit('id')} />
          <Field label="Tên nhóm" value={group.name} onChange={edit('name')} />
          <Field label="SLA mục tiêu (%)" type="number" min={0} max={100} step="any" value={group.sla} invalid={(attempted || group.sla !== "") && !isValidSlaPercent(group.sla)} onChange={edit('sla')} />
          <Field label="Ngưỡng chờ (giây)" type="number" min={0} step="any" value={group.wait} onChange={edit('wait')} />
          <Field label="AHT (giây)" type="number" min={0} step="any" value={group.aht} onChange={edit('aht')} />
          <Field label="Số mẫu AHT" type="number" min={1} value={group.samples} onChange={edit('samples')} />
          <Field label="Ngày chốt mẫu AHT" type="date" value={group.cutoff} onChange={edit('cutoff')} />
        </div>
        <Button onClick={() => onChange(remove(groups, index))} aria-label={`Xóa nhóm ${index + 1}`}>Xóa nhóm</Button>
      </fieldset>
    })}
    <div><Button disabled={groups.length >= 10} onClick={() => onChange([...groups, blankGroup()])}>Thêm nhóm</Button></div>
  </>
}

function RangeFields({ value, onChange }: { value: TimeRange; onChange: (value: TimeRange) => void }) {
  return <>
    <Choice label="Bắt đầu" value={value.start} options={startOptions} onChange={(start) => onChange({ start, end: value.end })} />
    <Choice label="Kết thúc" value={value.end} options={endOptions} onChange={(end) => onChange({ start: value.start, end })} />
  </>
}

export function OperatingEditor({ dates, intervals, onChange }: {
  dates: string[]; intervals: Interval[]; onChange: (intervals: Interval[]) => void
}) {
  return <>
    <p>Thêm nhiều khoảng trong cùng ngày để ngắt quãng giờ hoạt động. Mốc kết thúc là mốc loại trừ và có thể là 24:00.</p>
    {intervals.map((interval, index) => <fieldset className="v2-editor" key={index}><legend>Khoảng hoạt động {index + 1}</legend>
      <div className="v2-field-grid">
        <Choice label="Ngày hoạt động" value={interval.date} options={dates.map((date) => ({ value: date, label: displayDate(date) }))}
          onChange={(date) => onChange(replace(intervals, index, { ...interval, date }))} />
        <RangeFields value={interval} onChange={(range) => onChange(replace(intervals, index, { ...interval, ...range }))} />
        <Button onClick={() => onChange(remove(intervals, index))} aria-label={`Xóa khoảng hoạt động ${index + 1}`}>Xóa khoảng</Button>
      </div>
    </fieldset>)}
    <div><Button disabled={!dates.length || intervals.length >= 336} onClick={() => onChange([...intervals, { date: dates[0], start: '', end: '' }])}>Thêm khoảng hoạt động</Button></div>
  </>
}

export function ShiftEditor({ dates, shifts, onChange }: { dates: string[]; shifts: Shift[]; onChange: (shifts: Shift[]) => void }) {
  return <>
    <p>Ca phải nằm trọn trong giờ hoạt động. Khoảng nghỉ tính vào thời lượng ca và giới hạn tuần. Solver chỉ phân nhóm trong khung làm việc.</p>
    {shifts.map((shift, index) => {
      const edit = (changes: Partial<Shift>) => onChange(replace(shifts, index, { ...shift, ...changes }))
      return <fieldset className="v2-editor" key={index}><legend>Ca ứng viên {index + 1}</legend>
        <div className="v2-field-grid">
          <Choice label="Ngày của ca" value={shift.date} options={dates.map((date) => ({ value: date, label: displayDate(date) }))} onChange={(date) => edit({ date })} />
          <RangeFields value={shift} onChange={edit} />
          <Button onClick={() => onChange(remove(shifts, index))} aria-label={`Xóa ca ${index + 1}`}>Xóa ca</Button>
        </div>
        {shift.breaks.map((pause, pauseIndex) => <fieldset className="v2-editor v2-pause" key={pauseIndex}><legend>Khoảng nghỉ {pauseIndex + 1}</legend>
          <div className="v2-field-grid">
            <RangeFields value={pause} onChange={(value) => edit({ breaks: replace(shift.breaks, pauseIndex, value) })} />
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
  function setSlots(items: Slot[], checked: boolean) {
    const next = new Map(available)
    for (const slot of items) {
      const key = slotKey(slot)
      if (checked && !off.has(slot.date)) next.set(key, slot)
      else next.delete(key)
    }
    onChange({ available_slots: [...next.values()] })
  }
  return <details className="v2-disclosure"><summary>{available.size} khung rảnh · {off.size} ngày nghỉ</summary>
    <fieldset className="v2-choice-list"><legend>Ngày nghỉ</legend>
      {[...new Set([...dates, ...off])].map((date) => <Check key={date} label={displayDate(date) + (dates.includes(date) ? '' : ' (ngoài tuần)')}
        checked={off.has(date)} onChange={(checked) => onChange({
          unavailable_dates: toggle(employee.unavailable_dates, date, checked),
          ...(checked ? { available_slots: employee.available_slots.filter((slot) => slot.date !== date) } : {}),
        })} />)}
    </fieldset>
    <div className="v2-interval-actions">
      <Button disabled={!slots.some((slot) => !off.has(slot.date))} onClick={() => setSlots(slots.filter((slot) => !off.has(slot.date)), true)}>Chọn mọi khung mở ngoài ngày nghỉ</Button>
      <Button disabled={!available.size} onClick={() => onChange({ available_slots: [] })}>Bỏ chọn giờ rảnh</Button>
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

export function EmployeeEditor({ employees, onChange, groups, dates, slots, intervals }: {
  employees: EmployeeDraft[]; onChange: (employees: EmployeeDraft[]) => void
  groups: GroupDraft[]; dates: string[]; slots: Slot[]; intervals: Interval[]
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
            <th scope="row"><Field label={`Mã nhân viên ${index + 1}`} value={employee.id} onChange={(id) => edit({ id })} /></th>
            <td><fieldset className="v2-choice-list"><legend className="sr-only">Kỹ năng nhân viên {index + 1}</legend>
              {!groupIds.length && <p>Thêm nhóm để chọn kỹ năng.</p>}
              {[...new Set([...groupIds, ...employee.skills])].map((id) => <Check key={id} label={id + (groupIds.includes(id) ? '' : ' (đã bỏ nhóm)')}
                checked={employee.skills.includes(id)} onChange={(on) => edit({ skills: toggle(employee.skills, id, on) })} />)}
            </fieldset></td>
            <td><Field label="Tối đa phút ca" type="number" min={0} max={10080} value={employee.cap} onChange={(cap) => edit({ cap })} />
              <Field label="Ngày nghỉ tối thiểu" type="number" min={0} max={7} value={employee.daysOff} onChange={(daysOff) => edit({ daysOff })} /></td>
            <td><Availability employee={employee} dates={dates} slots={slots} intervals={intervals} onChange={edit} /></td>
            <td><Button aria-label={`Xóa nhân viên ${index + 1}`} onClick={() => onChange(remove(employees, index))}>Xóa</Button></td>
          </tr>
        })}</tbody>
      </table>
    </div>}
    <div><Button disabled={employees.length >= 50} onClick={() => onChange([...employees, blankEmployee()])}>Thêm nhân viên</Button></div>
  </>
}

export function HistoryEditor({ rows, groups, onChange }: {
  rows: HistoryDraft[]; groups: string[]; onChange: (rows: HistoryDraft[]) => void
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
          <Field label="Ngày quan sát" type="date" value={row.date} onChange={edit('date')} />
          <Choice label="Bắt đầu" value={row.start} options={startOptions} onChange={edit('start')} />
          <Choice label="Nhóm quan sát" value={row.group_id} options={groups.map((value) => ({ value }))} onChange={edit('group_id')} />
          <Field label="Số cuộc gọi" type="number" min={0} value={row.calls} onChange={edit('calls')} />
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
