import type { Employee, ShiftId } from '@/types/scheduling'

function shiftFor(id: ShiftId) {
  return id === 'ca_ngay'
    ? {
        label: 'Ca ngày · 08:00–20:00',
        start: '08:00',
        end: '20:00',
        breakTime: '12:00–13:00',
        type: 'ca_ngay',
      }
    : {
        label: 'Ca đêm · 20:00–08:00',
        start: '20:00',
        end: '08:00',
        breakTime: '00:00–01:00',
        type: 'ca_dem',
      }
}

export function displayShift(employee: Employee, hasResult: boolean) {
  if (hasResult && (employee.status === 'Đã xếp' || employee.status === 'Có trong bản xem trước') && employee.shift) {
    const shift = shiftFor(employee.shift.includes('Ca đêm') ? 'ca_dem' : 'ca_ngay')
    return { ...shift, breakTime: employee.breakTime || shift.breakTime }
  }
  const selected = employee.allowedShifts[0]
  return selected ? shiftFor(selected) : { label: 'Chưa chọn ca', start: '—', end: '—', breakTime: '—', type: 'none' }
}

export function displayStatus(employee: Employee, hasResult: boolean) {
  if (!employee.working) return 'Nghỉ'
  if (!employee.allowedShifts.length) return 'Chưa chọn ca'
  return hasResult ? employee.status || 'Có trong bản xem trước' : 'Có thể nhận ca'
}

export function isEmployeeAssigned(employee: Employee, hasResult: boolean) {
  const status = displayStatus(employee, hasResult)
  return status === 'Đã xếp' || status === 'Có trong bản xem trước'
}
