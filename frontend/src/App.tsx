import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  LayoutDashboard,
  Play,
  Printer,
  RotateCcw,
  ShieldCheck,
  Table,
  Upload,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  demandRows as initialDemandRows,
  employees as initialEmployees,
  type DemandRow,
  type Employee,
  type ShiftId,
} from '@/data/largeFixture'
import { createMockSchedule, isBreakSlot } from '@/services/mockSchedule'
import { validateScheduleInput, validateWorkbookName } from '@/services/validation'
import { parseWorkbook } from '@/services/workbookParser'
import { getFixture } from '@/data/fixtures'
import { DemandCoverageChart } from '@/components/DemandCoverageChart'
import { ScheduleGanttView } from '@/components/ScheduleGanttView'
import { SolverTelemetryCard } from '@/components/SolverTelemetryCard'
import { SlaConfigBox } from '@/components/SlaConfigBox'
import { StepIndicator } from '@/components/StepIndicator'
import { NoticeBox, type Notice } from '@/components/NoticeBox'
import { DemandTable } from '@/components/DemandTable'
import { EmployeeInputTable } from '@/components/EmployeeInputTable'
import { ScheduleTable } from '@/components/ScheduleTable'
import { displayStatus } from '@/lib/employeeDisplay'
import { clearFrontendSession, loadFrontendSession, saveFrontendSession } from '@/services/frontendSession'
import './App.css'

type EmployeeFilter = 'all' | 'working' | 'off'
type ScheduleFilter = 'all' | 'ca_ngay' | 'ca_dem' | 'off'
type DemandViewMode = 'both' | 'chart' | 'table'
type ScheduleViewMode = 'table' | 'gantt'

import type { CoverageItem, SchedulingResult } from '@/types/scheduling'

function App() {
  const [date, setDate] = useState('2026-11-02')
  const [fileName, setFileName] = useState('mau_xep_lich.xlsx')
  const [workbookFile, setWorkbookFile] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [processingLabel, setProcessingLabel] = useState('Đang xử lý…')
  const [hasResult, setHasResult] = useState(false)
  const [previewStale, setPreviewStale] = useState(false)
  const [activeTab, setActiveTab] = useState<'demand' | 'schedule'>('demand')
  const [previewReady, setPreviewReady] = useState(true)
  const [isFixtureMode, setIsFixtureMode] = useState(true)
  const [serviceTarget, setServiceTarget] = useState(0.8)
  const [answerWithinSeconds, setAnswerWithinSeconds] = useState(20)
  const [demandViewMode, setDemandViewMode] = useState<DemandViewMode>('both')
  const [scheduleViewMode, setScheduleViewMode] = useState<ScheduleViewMode>('table')
  const [notice, setNotice] = useState<Notice>({
    tone: 'info',
    message: 'Bạn có thể tải workbook mẫu hoặc chọn file .xlsx để phân tích.',
  })

  const [demandList, setDemandList] = useState<DemandRow[]>(initialDemandRows)
  const [employeeInputs, setEmployeeInputs] = useState<Employee[]>(initialEmployees)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('all')
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all')
  const [rawResult, setRawResult] = useState<SchedulingResult | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [sessionSavedAt, setSessionSavedAt] = useState<string | null>(null)
  const [hasSavedSession, setHasSavedSession] = useState(false)
  const sessionHydrated = useRef(false)
  const skipInitialSessionSave = useRef(true)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = loadFrontendSession()
    skipInitialSessionSave.current = Boolean(saved)
    if (saved) {
      setDate(saved.date)
      setFileName(saved.fileName)
      setIsFixtureMode(saved.isFixtureMode)
      setServiceTarget(saved.serviceTarget)
      setAnswerWithinSeconds(saved.answerWithinSeconds)
      setDemandList(saved.demandList)
      setEmployeeInputs(saved.employeeInputs)
      setHasResult(saved.hasResult)
      setRawResult(saved.rawResult ?? null)
      setPreviewReady(saved.previewReady)
      setPreviewStale(saved.previewStale)
      setActiveTab(saved.activeTab)
      setDemandViewMode(saved.demandViewMode)
      setScheduleViewMode(saved.scheduleViewMode)
      setSessionSavedAt(saved.savedAt)
      setHasSavedSession(true)
      setNotice({ tone: saved.isFixtureMode ? 'success' : 'warning', message: saved.isFixtureMode ? `Đã khôi phục phiên làm việc từ ${new Date(saved.savedAt).toLocaleString('vi-VN')}.` : `Đã khôi phục dữ liệu đã đọc từ ${new Date(saved.savedAt).toLocaleString('vi-VN')}. Nếu đổi mức phục vụ, hãy chọn lại workbook để tính lại nhu cầu.` })
    }
    sessionHydrated.current = true
  }, [])

  useEffect(() => {
    if (!sessionHydrated.current || isGenerating) return
    if (skipInitialSessionSave.current) {
      skipInitialSessionSave.current = false
      return
    }
    const saved = saveFrontendSession({
      date,
      fileName,
      isFixtureMode,
      serviceTarget,
      answerWithinSeconds,
      demandList,
      employeeInputs,
      hasResult,
      rawResult,
      previewReady,
      previewStale,
      activeTab,
      demandViewMode,
      scheduleViewMode,
    })
    if (saved) {
      setSessionSavedAt(saved.savedAt)
      setHasSavedSession(true)
    }
  }, [date, fileName, isFixtureMode, serviceTarget, answerWithinSeconds, demandList, employeeInputs, hasResult, rawResult, previewReady, previewStale, activeTab, demandViewMode, scheduleViewMode, isGenerating])

  const workingCount = employeeInputs.filter((employee) => employee.working).length
  const dayCount = employeeInputs.filter(
    (employee) => employee.working && employee.allowedShifts.includes('ca_ngay')
  ).length
  const nightCount = employeeInputs.filter(
    (employee) => employee.working && employee.allowedShifts.includes('ca_dem')
  ).length
  const summary = useMemo(
    () => ({
      totalCalls: demandList.reduce((sum, row) => sum + row.calls, 0),
      maxRequired: Math.max(...demandList.map((row) => row.required), 0),
    }),
    [demandList]
  )

  // Coverage calculation: If we have real solver results, use them; otherwise use local preview calculation
  const coverageRows: CoverageItem[] = useMemo(() => {
    if (hasResult && rawResult && rawResult.coverage && rawResult.coverage.length > 0) {
      return demandList.map((row, idx) => {
        const slotCov = rawResult.coverage[idx]
        const scheduled = slotCov ? slotCov.scheduled_agents : 0
        const shortage = slotCov ? slotCov.shortage_agents : Math.max(0, row.required - scheduled)
        const overstaff = slotCov ? slotCov.overstaff_agents : Math.max(0, scheduled - row.required)
        return {
          ...row,
          scheduled,
          shortage,
          overstaff,
          onBreak: isBreakSlot(row.time),
        }
      })
    }

    // Local preview logic
    return demandList.map((row) => {
      const startsAt = Number(row.time.slice(0, 2)) * 60 + Number(row.time.slice(3, 5))
      const onDayBreak = startsAt >= 12 * 60 && startsAt < 13 * 60
      const isNightTime = startsAt >= 20 * 60 || startsAt < 8 * 60
      const onNightBreak = startsAt >= 0 && startsAt < 1 * 60

      let scheduled = 0
      if (!isNightTime && !onDayBreak) scheduled += dayCount
      if (isNightTime && !onNightBreak) scheduled += nightCount

      const onBreak = (!isNightTime && onDayBreak) || (isNightTime && onNightBreak)
      return {
        ...row,
        scheduled: onBreak ? 0 : scheduled,
        shortage: onBreak ? 0 : Math.max(0, row.required - scheduled),
        overstaff: onBreak ? 0 : Math.max(0, scheduled - row.required),
        onBreak,
      }
    })
  }, [hasResult, rawResult, demandList, dayCount, nightCount])

  const resultSummary = useMemo(() => {
    const activeRows = coverageRows.filter((row) => !row.onBreak)
    const coveredSlots = activeRows.filter((row) => row.shortage === 0).length
    const totalSlots = activeRows.length || 1
    const fulfillmentRate = Math.round((coveredSlots / totalSlots) * 100)
    return {
      shortage: activeRows.reduce((sum, row) => sum + row.shortage, 0),
      uncoveredSlots: activeRows.filter((row) => row.shortage > 0).length,
      maxShortage: Math.max(...activeRows.map((row) => row.shortage), 0),
      fulfillmentRate,
      coveredSlots,
      totalSlots,
    }
  }, [coverageRows])

  const visibleEmployees = useMemo(
    () =>
      employeeInputs.filter((employee) => {
        const matchesSearch = `${employee.name} ${employee.id}`
          .toLowerCase()
          .includes(employeeSearch.toLowerCase().trim())
        const matchesFilter =
          employeeFilter === 'all' ||
          (employeeFilter === 'working' ? employee.working : !employee.working)
        return matchesSearch && matchesFilter
      }),
    [employeeFilter, employeeInputs, employeeSearch]
  )

  const visibleScheduleEmployees = useMemo(
    () =>
      employeeInputs.filter((employee) => {
        if (scheduleFilter === 'all') return true
        if (scheduleFilter === 'off') return !employee.working
        const isNight = hasResult && (employee.status === 'Đã xếp' || employee.status === 'Có trong bản xem trước') && employee.shift
          ? employee.shift.includes('Ca đêm')
          : employee.allowedShifts[0] === 'ca_dem'
        if (scheduleFilter === 'ca_ngay') return employee.working && !isNight
        if (scheduleFilter === 'ca_dem') return employee.working && isNight
        return true
      }),
    [employeeInputs, hasResult, scheduleFilter]
  )

  const updateEmployee = (
    id: string,
    change: Partial<Pick<Employee, 'working' | 'allowedShifts'>>
  ) => {
    const hadResult = hasResult
    setEmployeeInputs((current) => {
      const next = current.map((employee) =>
        employee.id === id ? { ...employee, ...change } : employee
      )
      setPreviewReady(!next.some((employee) => employee.working && employee.allowedShifts.length === 0))
      return next
    })
    setHasResult(false)
    if (hadResult) setPreviewStale(true)
  }

  const setAllShift = (shift: ShiftId) => {
    const hadResult = hasResult
    setEmployeeInputs((current) =>
      current.map((employee) =>
        employee.working
          ? {
              ...employee,
              allowedShifts: [shift],
            }
          : employee
      )
    )
    setPreviewReady(true)
    setHasResult(false)
    if (hadResult) setPreviewStale(true)
  }

  const setFlexibleAll = () => {
    const hadResult = hasResult
    setEmployeeInputs((current) =>
      current.map((employee) =>
        employee.working
          ? {
              ...employee,
              allowedShifts: ['ca_ngay', 'ca_dem'],
            }
          : employee
      )
    )
    setPreviewReady(true)
    setHasResult(false)
    if (hadResult) setPreviewStale(true)
    setNotice({
      tone: 'info',
      message: 'Đã mở linh hoạt cả 2 ca (Ca ngày & Ca đêm) cho tất cả nhân viên đi làm.',
    })
  }

  const toggleAllWorking = (workingStatus: boolean) => {
    const hadResult = hasResult
    setEmployeeInputs((current) =>
      current.map((employee) => ({
        ...employee,
        working: workingStatus,
        allowedShifts: workingStatus
          ? employee.allowedShifts.length
            ? employee.allowedShifts
            : ['ca_ngay']
          : [],
      }))
    )
    setPreviewReady(true)
    setHasResult(false)
    if (hadResult) setPreviewStale(true)
  }

  const handleFile = async (file?: File) => {
    if (!file) return
    const fileValidation = validateWorkbookName(file.name)
    const valid = fileValidation.valid
    setFileName(file.name)
    setHasResult(false)
    setPreviewStale(false)

    if (!valid) {
      setWorkbookFile(null)
      setPreviewReady(false)
      setNotice({
        tone: 'error',
        message: fileValidation.message,
      })
      return
    }

    setProcessingLabel('Đang đọc workbook và kiểm tra dữ liệu…')
    setIsGenerating(true)
    try {
      const parsed = await parseWorkbook(file, { serviceTarget, answerWithinSeconds })
      setWorkbookFile(file)
      setDemandList(parsed.demand)
      setEmployeeInputs(parsed.employees)
      // A missing demand gap is reviewable, while a working employee without
      // a selected shift must be fixed before the preview can run.
      setPreviewReady(!parsed.employees.some((employee) => employee.working && employee.allowedShifts.length === 0))
      setIsFixtureMode(false)
      setIsGenerating(false)
      setNotice({
        tone: parsed.warnings.length ? 'warning' : 'success',
        message: parsed.warnings.length
          ? `Đã đọc file nhưng cần xem lại: ${parsed.warnings.join(' ')}`
          : `Đã đọc ${file.name}: ${parsed.demand.length} slot và ${parsed.employees.length} nhân viên.`,
      })
    } catch (error) {
      setWorkbookFile(null)
      setIsGenerating(false)
      setPreviewReady(false)
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Không thể đọc workbook.' })
    }
  }

  const handleSlaChange = async (target: number, seconds: number) => {
    const hadResult = hasResult
    setServiceTarget(target)
    setAnswerWithinSeconds(seconds)
    setHasResult(false)
    if (hadResult) setPreviewStale(true)

    if (!workbookFile) {
      setNotice({
        tone: isFixtureMode ? 'info' : 'warning',
        message: isFixtureMode
          ? `Đã lưu mức phục vụ ${(target * 100).toFixed(0)}% trong ${seconds}s cho bản xem trước local.`
          : `Đã lưu mức phục vụ mới. Hãy chọn lại workbook để tính lại nhu cầu theo mức này.`,
      })
      return
    }
    setProcessingLabel('Đang tính lại nhu cầu theo mục tiêu SLA…')
    setIsGenerating(true)
    try {
      const parsed = await parseWorkbook(workbookFile, { serviceTarget: target, answerWithinSeconds: seconds })
      setDemandList(parsed.demand)
      setPreviewReady(!parsed.employees.some((employee) => employee.working && employee.allowedShifts.length === 0))
      setIsGenerating(false)
      setNotice({ tone: parsed.warnings.length ? 'warning' : 'success', message: parsed.warnings.length ? `Đã tính lại nhu cầu theo mục tiêu ${(target * 100).toFixed(0)}% trong ${seconds}s. ${parsed.warnings.join(' ')}` : `Đã tính lại nhu cầu theo mục tiêu ${(target * 100).toFixed(0)}% trong ${seconds}s.` })
    } catch (error) {
      setIsGenerating(false)
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Không thể tính lại nhu cầu theo mục tiêu mới.' })
    }
  }

  const resetToFixture = () => {
    setDemandList(initialDemandRows)
    setEmployeeInputs(initialEmployees)
    setFileName('mau_xep_lich.xlsx')
    setWorkbookFile(null)
    setIsFixtureMode(true)
    setPreviewReady(true)
    setHasResult(false)
    setPreviewStale(false)
    setNotice({ tone: 'info', message: 'Đã khôi phục dữ liệu mẫu chuẩn (B1.1 Fixture).' })
  }

  const clearSavedSession = () => {
    clearFrontendSession()
    setHasSavedSession(false)
    setSessionSavedAt(null)
    setNotice({ tone: 'info', message: 'Đã xóa phiên đã lưu trên trình duyệt. Dữ liệu đang mở vẫn được giữ nguyên.' })
  }

  const downloadTemplate = () => {
    const link = document.createElement('a')
    link.href = '/mau_xep_lich.xlsx'
    link.download = 'mau_xep_lich.xlsx'
    link.click()
  }

  const loadDemoFixture = (fixtureId: 'normal' | 'peak' | 'understaffed' | 'invalid') => {
    const fixture = getFixture(fixtureId)
    setDemandList(fixture.demand)
    setEmployeeInputs(fixture.employees)
    setFileName(`fixture_${fixtureId}.xlsx`)
    setWorkbookFile(null)
    setIsFixtureMode(true)
    setPreviewReady(!fixture.invalidReason)
    setHasResult(false)
    setPreviewStale(false)
    setNotice({
      tone: fixture.invalidReason ? 'error' : 'success',
      message: fixture.invalidReason ?? `Đã nạp kịch bản “${fixture.label}”. Kiểm tra nhân viên trước khi tạo lịch.`,
    })
  }

  const downloadCsv = () => {
    const headers =
      'employee_id,employee_name,date,shift,shift_start,shift_end,break_start,break_end,status'
    const rows = employeeInputs.map((emp) => {
      const isNight = emp.shift
        ? emp.shift.includes('Ca đêm')
        : emp.allowedShifts[0] === 'ca_dem'
      const shiftName = isNight ? 'Ca đêm' : 'Ca ngày'
      const sStart = isNight ? '20:00' : '08:00'
      const sEnd = isNight ? '08:00' : '20:00'
      const bStart = isNight ? '00:00' : '12:00'
      const bEnd = isNight ? '01:00' : '13:00'
      const statusStr = displayStatus(emp, hasResult)
      const isAssigned = statusStr === 'Đã xếp' || statusStr === 'Có trong bản xem trước'

      return `${emp.id},"${emp.name}",${date},${isAssigned ? shiftName : '—'},${
        isAssigned ? sStart : '—'
      },${isAssigned ? sEnd : '—'},${isAssigned ? bStart : '—'},${
        isAssigned ? bEnd : '—'
      },${statusStr}`
    })

    const csvContent = [headers, ...rows].join('\n')
    const link = document.createElement('a')
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(`\ufeff${csvContent}`)}`
    link.download = `lich_${date}.csv`
    link.click()
  }

  const downloadCoverageCsv = () => {
    const headers =
      'Khung_gio,Cuoc_goi,AHT_phut,Can_ErlangC,Da_xep,Thieu,Thua,Trang_thai'
    const rows = coverageRows.map((r) => {
      const status = r.onBreak
        ? 'Giờ nghỉ'
        : r.shortage
        ? `Thiếu ${r.shortage}`
        : 'Đủ người'
      return `${r.time},${r.calls},${r.aht},${r.required},${r.scheduled},${r.shortage},${r.overstaff},${status}`
    })
    const csvContent = [headers, ...rows].join('\n')
    const link = document.createElement('a')
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(`\ufeff${csvContent}`)}`
    link.download = `do_phu_${date}.csv`
    link.click()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleGenerate = async () => {
    const inputValidation = validateScheduleInput(date, employeeInputs)
    if (!inputValidation.valid) return setNotice({ tone: 'error', message: inputValidation.message })
    if (!previewReady)
      return setNotice({
        tone: 'error',
        message: 'Hãy chọn một workbook .xlsx hợp lệ trước khi tạo lịch.',
      })

    setProcessingLabel('Đang tạo bản xem trước lịch local…')
    setIsGenerating(true)
    setNotice({ tone: 'info', message: 'Đang tạo bản xem trước lịch bằng engine local…' })

    try {
      const result = createMockSchedule(date, demandList, employeeInputs)

      setRawResult(result)

      // Map local preview assignments to employeeInputs
      const assignedMap = new Map<string, (typeof result.assignments)[number]>()
      for (const a of result.assignments) {
        assignedMap.set(a.employee_id, a)
      }

      setEmployeeInputs((current) =>
        current.map((emp) => {
          const assigned = assignedMap.get(emp.id)
          if (assigned) {
            return {
              ...emp,
              shift:
                assigned.template_id === 'night_2000'
                  ? 'Ca đêm · 20:00–08:00'
                  : 'Ca ngày · 08:00–20:00',
              breakTime: assigned.breaks[0]
                ? `${assigned.breaks[0].start.slice(11, 16)}–${assigned.breaks[0].end.slice(
                    11,
                    16
                  )}`
                : '—',
              status: 'Có trong bản xem trước',
            }
          }
          return {
            ...emp,
            status: emp.working ? 'Chưa xếp' : 'Nghỉ',
          }
        })
      )

      setIsGenerating(false)
      setHasResult(true)
      setPreviewStale(false)
      setActiveTab('schedule')

      const shortageCount = result.metrics ? result.metrics.shortage_agent_slots : 0
      if (shortageCount > 0) {
        setNotice({
          tone: 'warning',
          message: `Bản xem trước đã tạo. Còn thiếu ${shortageCount} lượt nhân sự theo nhu cầu.`,
        })
      } else {
        setNotice({
          tone: 'success',
          message: 'Bản xem trước đã tạo và phủ đủ nhu cầu trong các slot khả dụng.',
        })
      }
    } catch (err: any) {
      setIsGenerating(false)
      setNotice({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Không thể tạo bản xem trước local.',
      })
    }
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDraggingFile(false)
    void handleFile(event.dataTransfer.files?.[0])
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900 font-sans print:bg-white print:p-0">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs print:hidden">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <LayoutDashboard size={21} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-bold tracking-tight text-slate-950">Xếp lịch CSKH</p>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  WFM Service
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Call Center Scheduling · Demo frontend
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center rounded-full border border-blue-200/60 bg-blue-50 px-3 py-1 text-blue-700 shadow-2xs">
              <ShieldCheck size={13} className="mr-1.5 text-blue-600" /> Demo frontend · Bản xem trước local
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 border border-slate-200">
              {isFixtureMode ? 'Mẫu B1.1' : 'Excel người dùng'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 sm:py-7 print:p-0" aria-busy={isGenerating}>
        <section className="mb-6 flex flex-wrap items-end justify-between gap-4 print:mb-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Trung tâm Điều hành Phân ca & Tối ưu hóa Nhu cầu
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Tạo lịch nhân viên tự động theo SLA viễn thông
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
              Nhu cầu và phân ca được mô phỏng ngay trên trình duyệt để bạn kiểm tra luồng thao tác.
            </p>
          </div>
          {!isFixtureMode && (
            <button
              onClick={resetToFixture}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-2xs transition print:hidden"
            >
              <RotateCcw size={14} /> Khôi phục dữ liệu mẫu
            </button>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs print:hidden">
            <span className="text-slate-500">
              {hasSavedSession && sessionSavedAt ? `Đã lưu ${new Date(sessionSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Chưa có phiên lưu'}
            </span>
            <button
              type="button"
              onClick={clearSavedSession}
              disabled={!hasSavedSession}
              className="font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Xóa phiên
            </button>
          </div>
        </section>

        {/* 3 Steps indicator */}
        <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs print:hidden">
          <StepIndicator number="1" label="Nhập dữ liệu (.xlsx)" active={false} done={previewReady} />
          <StepIndicator number="2" label="Kiểm tra nhân viên" active={!hasResult} done={hasResult} />
          <StepIndicator number="3" label="Xem lịch & Độ phủ" active={hasResult} done={hasResult} />
        </div>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Left Sidebar Controls */}
          <aside className="space-y-5 print:hidden">
            {/* Planning Date Box */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays size={18} className="text-blue-600" />
                <h2 className="font-semibold text-slate-900 text-sm">Thông tin lập lịch</h2>
              </div>
              <label
                className="mb-1.5 block text-xs font-semibold text-slate-600"
                htmlFor="planning-date"
              >
                Ngày cần lập lịch
              </label>
              <input
                id="planning-date"
                type="date"
                value={date}
                onChange={(event) => {
                  const hadResult = hasResult
                  setDate(event.target.value)
                  setHasResult(false)
                  if (hadResult) setPreviewStale(true)
                }}
                className="mb-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <div className="rounded-xl bg-blue-50/80 border border-blue-100 p-3 text-xs leading-5 text-blue-900">
                <div className="flex gap-2">
                  <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
                  <p>Slot 30 phút, nhóm Hỗ trợ chung. Ca ngày (08:00–20:00) & Ca đêm (20:00–08:00).</p>
                </div>
              </div>
            </div>

            {/* SLA Configuration Box */}
            <SlaConfigBox
              serviceTarget={serviceTarget}
              answerWithinSeconds={answerWithinSeconds}
              onChange={handleSlaChange}
              disabled={isGenerating}
            />

            {/* Workbook Upload & Fixtures */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-emerald-600" />
                  <h2 className="font-semibold text-slate-900 text-sm">Dữ liệu đầu vào</h2>
                </div>
                <span className="text-[11px] font-medium text-slate-400">.xlsx</span>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(event) => {
                  void handleFile(event.target.files?.[0])
                  event.currentTarget.value = ''
                }}
              />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={isGenerating}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDraggingFile(true)
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleDrop}
                aria-label="Chọn hoặc thả workbook Excel .xlsx"
                className={`group flex w-full items-center gap-3 rounded-xl border border-dashed p-3.5 text-left transition disabled:cursor-wait disabled:opacity-60 ${isDraggingFile ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/60'}`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-blue-600 shadow-2xs">
                  <Upload size={17} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{fileName}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{isDraggingFile ? 'Thả file .xlsx vào đây' : 'Bấm để chọn hoặc kéo thả file .xlsx'}</p>
                </div>
              </button>
              {isGenerating && (
                <p role="status" aria-live="polite" className="mt-2 flex items-center gap-2 text-[11px] font-medium text-blue-700">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" aria-hidden="true" />
                  {processingLabel}
                </p>
              )}
              <button
                onClick={downloadTemplate}
                className="mt-2.5 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 shadow-2xs"
              >
                <Download size={14} className="mr-1.5 inline text-slate-500" /> Tải workbook mẫu
                Excel
              </button>

              {/* 4 Demo Fixtures */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Kịch bản thử nghiệm nhanh:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    disabled={isGenerating}
                    onClick={() => loadDemoFixture('normal')}
                    className="truncate text-left rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition border border-emerald-200/50"
                    title="01_normal.xlsx: Đủ nhân sự, 100% độ phủ"
                  >
                    1. Bình thường
                  </button>
                  <button
                    disabled={isGenerating}
                    onClick={() => loadDemoFixture('peak')}
                    className="truncate text-left rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition border border-amber-200/50"
                    title="02_peak_demand.xlsx: Giờ cao điểm, soft shortage"
                  >
                    2. Cao điểm
                  </button>
                  <button
                    disabled={isGenerating}
                    onClick={() => loadDemoFixture('understaffed')}
                    className="truncate text-left rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 transition border border-violet-200/50"
                    title="03_understaffed.xlsx: Thiếu người diện rộng"
                  >
                    3. Thiếu người
                  </button>
                  <button
                    disabled={isGenerating}
                    onClick={() => loadDemoFixture('invalid')}
                    className="truncate text-left rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition border border-rose-200/50"
                    title="04_invalid_data.xlsx: Dữ liệu lỗi (Validation)"
                  >
                    4. Dữ liệu lỗi
                  </button>
                </div>
              </div>

              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-4 text-slate-500">
                Mức phục vụ dùng cho bản xem trước local: {serviceTarget >= 0.9 ? 'Cao' : 'Tiêu chuẩn'} ({(serviceTarget * 100).toFixed(0)}% trong {answerWithinSeconds} giây).
              </p>
              <NoticeBox notice={notice} />
              {previewStale && (
                <p role="status" aria-live="polite" className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  <span>Dữ liệu đã thay đổi sau lần xem trước. Bấm <strong>Tạo bản xem trước</strong> để cập nhật kết quả.</span>
                </p>
              )}
            </div>

            {/* Run Solver Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !previewReady}
              className={`w-full py-3.5 shadow-md transition-all active:scale-[0.98] ${
                isGenerating ? 'opacity-80 cursor-wait' : ''
              }`}
            >
              <Play size={17} fill="currentColor" />
              <span className="ml-2 font-semibold">
                {isGenerating ? 'Đang xử lý…' : 'Tạo bản xem trước'}
              </span>
            </Button>
          </aside>

          {/* Right Main Content */}
          <div className="space-y-5">
            {/* Top Metric Cards */}
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Metric
                icon={<Clock3 size={18} />}
                label="Tổng số khung giờ"
                value={`${demandList.length} slot`}
                detail="30 phút mỗi slot (08:00–20:00)"
                color="blue"
              />
              <Metric
                icon={<Users size={18} />}
                label="Cuộc gọi dự kiến"
                value={summary.totalCalls.toLocaleString()}
                detail={`${workingCount}/${employeeInputs.length} nhân sự đăng ký đi làm`}
                color="violet"
              />
              <Metric
                icon={<AlertCircle size={18} />}
                label="Nhu cầu cao nhất"
                value={`${summary.maxRequired} người/slot`}
                detail={`${dayCount} ca ngày · ${nightCount} ca đêm`}
                color="amber"
              />
            </div>

            {/* Employee Input Management Table */}
            <div className="print:hidden">
              <EmployeeInputTable
                employees={visibleEmployees}
                total={employeeInputs.length}
                workingCount={workingCount}
                search={employeeSearch}
                filter={employeeFilter}
                onSearch={setEmployeeSearch}
                onFilter={setEmployeeFilter}
                onSetAll={setAllShift}
                onSetFlexibleAll={setFlexibleAll}
                onToggleAllWorking={toggleAllWorking}
                onUpdate={updateEmployee}
                disabled={isGenerating}
              />
            </div>

            {/* Main Result & Table View */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Kết quả phân ca & Độ phủ thực tế</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Ngày {date ? date.split('-').reverse().join('/') : 'chưa chọn'} ·{' '}
                    {hasResult
                      ? rawResult
                        ? rawResult.solution_source === 'BASELINE'
                          ? `Bản xem trước local (${rawResult.status})`
                          : `Kết quả solver (${rawResult.solution_source}, ${rawResult.status})`
                        : 'Bản xem trước local'
                      : 'Chưa tạo lịch'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      hasResult
                        ? resultSummary.shortage
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {hasResult
                      ? resultSummary.shortage
                        ? `Thiếu ${resultSummary.shortage} lượt`
                        : 'Đủ độ phủ 100%'
                      : 'Chưa chạy'}
                  </span>
                  {hasResult && (
                    <div className="flex items-center gap-1.5 print:hidden">
                      <button
                        onClick={downloadCsv}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                        title="Tải CSV danh sách phân công lịch"
                      >
                        <Download size={14} /> Lịch (CSV)
                      </button>
                      <button
                        onClick={downloadCoverageCsv}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                        title="Tải CSV độ phủ từng slot 30 phút"
                      >
                        <FileText size={14} /> Độ phủ (CSV)
                      </button>
                      <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                        title="In báo cáo phân ca"
                      >
                        <Printer size={14} /> In
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs Switcher and View Sub-Mode Toggle */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/40 px-5">
                <div role="tablist" aria-label="Các nhóm kết quả" className="flex min-w-max overflow-x-auto">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'demand'}
                    onClick={() => setActiveTab('demand')}
                    className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${
                      activeTab === 'demand'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Nhu cầu và độ phủ ({demandList.length} slot)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'schedule'}
                    onClick={() => setActiveTab('schedule')}
                    className={`ml-6 border-b-2 px-1 py-3 text-sm font-semibold transition ${
                      activeTab === 'schedule'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Lịch nhân viên ({employeeInputs.length} người)
                  </button>
                </div>

                {/* Sub-view switcher buttons */}
                <div className="py-2 print:hidden">
                  {activeTab === 'demand' ? (
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold text-slate-600">
                      <button
                        onClick={() => setDemandViewMode('both')}
                        className={`rounded px-2 py-1 transition ${
                          demandViewMode === 'both' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'hover:text-slate-900'
                        }`}
                        title="Hiển thị cả Biểu đồ & Bảng"
                      >
                        Cả hai
                      </button>
                      <button
                        onClick={() => setDemandViewMode('chart')}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 transition ${
                          demandViewMode === 'chart' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'hover:text-slate-900'
                        }`}
                        title="Chỉ hiển thị Biểu đồ"
                      >
                        <BarChart3 size={13} /> Biểu đồ
                      </button>
                      <button
                        onClick={() => setDemandViewMode('table')}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 transition ${
                          demandViewMode === 'table' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'hover:text-slate-900'
                        }`}
                        title="Chỉ hiển thị Bảng"
                      >
                        <Table size={13} /> Bảng
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold text-slate-600">
                      <button
                        onClick={() => setScheduleViewMode('table')}
                        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 transition ${
                          scheduleViewMode === 'table'
                            ? 'bg-blue-50 text-blue-700 shadow-2xs'
                            : 'hover:text-slate-900'
                        }`}
                      >
                        <Table size={13} /> Dạng bảng
                      </button>
                      <button
                        onClick={() => setScheduleViewMode('gantt')}
                        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 transition ${
                          scheduleViewMode === 'gantt'
                            ? 'bg-blue-50 text-blue-700 shadow-2xs'
                            : 'hover:text-slate-900'
                        }`}
                      >
                        <Layers size={13} /> Sơ đồ Gantt
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab 1: Demand & Coverage */}
              {activeTab === 'demand' ? (
                <div className="space-y-4">
                  {(demandViewMode === 'both' || demandViewMode === 'chart') && (
                    <DemandCoverageChart
                      rows={coverageRows}
                      hasResult={hasResult}
                      serviceTarget={serviceTarget}
                      answerWithinSeconds={answerWithinSeconds}
                    />
                  )}
                  {(demandViewMode === 'both' || demandViewMode === 'table') && (
                    <DemandTable rows={coverageRows} hasResult={hasResult} />
                  )}
                </div>
              ) : (
                /* Tab 2: Schedule View */
                scheduleViewMode === 'table' ? (
                  <ScheduleTable
                    employees={visibleScheduleEmployees}
                    total={employeeInputs.length}
                    filter={scheduleFilter}
                    onFilter={setScheduleFilter}
                    hasResult={hasResult}
                  />
                ) : (
                  <ScheduleGanttView
                    employees={visibleScheduleEmployees}
                    total={employeeInputs.length}
                    hasResult={hasResult}
                    filter={scheduleFilter}
                    onFilter={setScheduleFilter}
                  />
                )
              )}
            </div>

            {/* Solver Telemetry & Mathematics Card */}
            {hasResult && <SolverTelemetryCard result={rawResult} />}

            {/* Result KPI Metrics Summary */}
            {hasResult && (
              <div className="grid gap-3.5 sm:grid-cols-4">
                <ResultMetric
                  label="Tỉ lệ đáp ứng SLA"
                  value={`${resultSummary.fulfillmentRate}%`}
                  tone={resultSummary.fulfillmentRate === 100 ? 'success' : 'warning'}
                />
                <ResultMetric
                  label="Slot đủ người"
                  value={`${resultSummary.coveredSlots}/${resultSummary.totalSlots} slot`}
                />
                <ResultMetric
                  label="Thiếu tổng cộng"
                  value={`${resultSummary.shortage} lượt`}
                  tone={resultSummary.shortage ? 'warning' : 'success'}
                />
                <ResultMetric
                  label="Thiếu lớn nhất 1 slot"
                  value={`${resultSummary.maxShortage} người`}
                  tone={resultSummary.maxShortage ? 'warning' : 'success'}
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
  color: 'blue' | 'violet' | 'amber'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[color]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  )
}

function ResultMetric({
  label,
  value,
  tone = 'normal',
}: {
  label: string
  value: string
  tone?: 'normal' | 'warning' | 'success'
}) {
  const color =
    tone === 'warning'
      ? 'text-amber-700'
      : tone === 'success'
      ? 'text-emerald-700'
      : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}





export default App
