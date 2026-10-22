export type DemandRow = { time: string; calls: number; aht: number; required: number }
export type Employee = { id: string; name: string; shift: string; breakTime: string; status: 'Đã xếp' | 'Chưa xếp' }

const times = Array.from({ length: 24 }, (_, index) => {
  const minutes = 8 * 60 + index * 30
  const end = minutes + 30
  const format = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  return `${format(minutes)}–${format(end)}`
})

const calls = [24, 18, 31, 27, 22, 25, 30, 28, 14, 16, 20, 24, 32, 29, 26, 21, 18, 15, 19, 23, 35, 33, 27, 21]
const aht = [6, 5, 7, 6, 6, 6, 7, 6, 5, 5, 6, 6, 7, 6, 6, 5, 5, 5, 6, 6, 8, 7, 6, 5]
const required = [8, 6, 11, 9, 8, 9, 11, 10, 5, 6, 7, 9, 12, 11, 9, 8, 6, 5, 7, 8, 14, 13, 10, 8]

export const demandRows: DemandRow[] = times.map((time, index) => ({ time, calls: calls[index], aht: aht[index], required: required[index] }))

const names = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm Thị D', 'Hoàng Văn E', 'Võ Thị F', 'Đặng Văn G', 'Bùi Thị H', 'Đỗ Văn I', 'Phan Thị K', 'Ngô Văn L', 'Mai Thị M', 'Huỳnh Văn N', 'Đinh Thị O', 'Trương Văn P', 'Vũ Thị Q', 'Cao Văn R', 'Lý Thị S', 'Tạ Văn T', 'Đoàn Thị U']
const shifts = ['Ca sáng · 08:00–17:00', 'Ca giữa · 09:00–18:00', 'Ca muộn · 11:00–20:00']
const breaks = ['12:00–13:00', '13:00–14:00', '15:00–16:00']

export const employees: Employee[] = names.map((name, index) => ({
  id: `NV${String(index + 1).padStart(3, '0')}`,
  name,
  shift: shifts[index % shifts.length],
  breakTime: breaks[index % breaks.length],
  status: index < 16 ? 'Đã xếp' : 'Chưa xếp',
}))
