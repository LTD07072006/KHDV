/** Backend boundary reserved for B2.2. Keep workbook parsing and solver calls out of UI components. */
export type GenerateSchedulePayload = { planningDate: string; workbook: File }

export async function generateSchedule(_payload: GenerateSchedulePayload) {
  throw new Error('Backend adapter chưa được nối; B1.2 đang dùng dữ liệu mẫu.')
}
