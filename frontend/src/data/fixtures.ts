import { demandRows, employees } from './largeFixture'
import type { DemandRow, Employee, FixtureScenario, ShiftId } from '@/types/scheduling'

const cloneEmployees = (source: Employee[]) => source.map((employee) => ({ ...employee, allowedShifts: [...employee.allowedShifts] }))
const scaleDemand = (source: DemandRow[], factor: number) => source.map((row) => ({ ...row, calls: Math.round(row.calls * factor), required: Math.max(0, Math.round(row.required * factor)) }))

const normalEmployees = cloneEmployees(employees).map((employee, index) => ({
  ...employee,
  working: true,
  allowedShifts: (index < 14 ? ['ca_ngay'] : ['ca_dem']) as ShiftId[],
}))
const peakEmployees = cloneEmployees(normalEmployees)
const understaffedEmployees = cloneEmployees(employees).map((employee, index) => ({ ...employee, working: index < 6, allowedShifts: index < 6 ? employee.allowedShifts : [] }))
const invalidEmployees = cloneEmployees(employees).map((employee, index) => index === 0 ? { ...employee, working: true, allowedShifts: [] } : employee)

export const fixtureScenarios: FixtureScenario[] = [
  { id: 'normal', label: '1. Bình thường', description: 'Đủ người, nhu cầu ổn định.', demand: demandRows, employees: normalEmployees },
  { id: 'peak', label: '2. Giờ cao điểm', description: 'Nhu cầu tăng mạnh ở các slot.', demand: scaleDemand(demandRows, 1.7), employees: peakEmployees },
  { id: 'understaffed', label: '3. Thiếu nhân viên', description: 'Chỉ còn một nhóm nhỏ đăng ký đi làm.', demand: demandRows, employees: understaffedEmployees },
  { id: 'invalid', label: '4. Dữ liệu lỗi', description: 'Có người đi làm nhưng chưa chọn ca.', demand: demandRows, employees: invalidEmployees, invalidReason: 'Có nhân viên được đánh dấu “Đi làm” nhưng chưa chọn ca.' },
]

export function getFixture(id: FixtureScenario['id']) {
  const fixture = fixtureScenarios.find((item) => item.id === id) ?? fixtureScenarios[0]
  return { ...fixture, demand: fixture.demand.map((row) => ({ ...row })), employees: cloneEmployees(fixture.employees) }
}
