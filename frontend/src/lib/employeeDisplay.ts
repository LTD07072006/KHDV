import type { Employee, ShiftId } from '@/types/scheduling'

function shiftFor(id: ShiftId) {
  return id === 'ca_ngay'
    ? { label: 'Ca ngày · 08:00–20:00', breakTime: '12:00–13:00', type: 'ca_ngay' }
    : { label: 'Ca đêm · 20:00–08:00', breakTime: '00:00–01:00', type: 'ca_dem' }
}

export function displayShift(employee: Employee, hasResult: boolean) {
  if (hasResult && (employee.status === 'Đã xếp' || employee.status === 'Có trong bản xem trước') && employee.shift) {
    const isNight = employee.shift.includes('Ca đêm')
    return isNight
      ? {
          label: 'Ca đêm · 20:00–08:00',
          breakTime: employee.breakTime || '00:00–01:00',
          type: 'ca_dem',
        }
      : {
          label: 'Ca ngày · 08:00–20:00',
          breakTime: employee.breakTime || '12:00–13:00',
          type: 'ca_ngay',
        }
  }
  const selected = employee.allowedShifts[0]
  return selected ? shiftFor(selected) : { label: 'Chưa chọn ca', breakTime: '—', type: 'none' }
}

export function displayStatus(employee: Employee, hasResult: boolean) {
  if (!employee.working) return 'Nghỉ'
  if (!employee.allowedShifts.length) return 'Chưa chọn ca'
  return hasResult ? employee.status || 'Có trong bản xem trước' : 'Có thể nhận ca'
}
