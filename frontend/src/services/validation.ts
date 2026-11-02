import type { Employee } from '@/types/scheduling'

export type ValidationResult = { valid: true } | { valid: false; message: string }

export function validateWorkbookName(fileName: string): ValidationResult {
  return fileName.toLowerCase().endsWith('.xlsx')
    ? { valid: true }
    : { valid: false, message: 'File chưa đúng định dạng. Hãy chọn workbook Excel có đuôi .xlsx.' }
}

export function validateScheduleInput(date: string, employees: Employee[]): ValidationResult {
  if (!date) return { valid: false, message: 'Bạn cần chọn ngày lập lịch.' }
  if (!employees.some((employee) => employee.working)) {
    return { valid: false, message: 'Cần ít nhất một nhân viên được đánh dấu “Đi làm”.' }
  }
  const withoutShift = employees.filter((employee) => employee.working && employee.allowedShifts.length === 0)
  if (withoutShift.length) {
    return { valid: false, message: `${withoutShift.length} nhân viên đang đi làm nhưng chưa chọn ca.` }
  }
  return { valid: true }
}
