import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DemandCoverageView } from '@/components/DemandCoverageView'
import type { DemandFilter } from '@/components/DemandTable'
import { EmployeeInputTable, type EmployeeAction, type EmployeeFilter } from '@/components/EmployeeInputTable'
import { NoticeBox, type Notice } from '@/components/NoticeBox'
import { PreviewComparison } from '@/components/PreviewComparison'
import { SavedSchedules } from '@/components/SavedSchedules'
import type { ScheduleFilter } from '@/components/ScheduleFilters'
import { ScheduleTable } from '@/components/ScheduleTable'
import {
  CoverageStatus,
  ScheduleResultHeader,
  ScheduleWorkspace,
  type DemandViewMode,
  type ScheduleViewMode,
} from '@/components/ScheduleWorkspace'
import { SchedulingMasthead, SchedulingPageHeading } from '@/components/SchedulingHeader'
import { SchedulingSetup } from '@/components/SchedulingSetup'
import { ShiftScheduleView } from '@/components/ShiftScheduleView'
import {
  demandRows as initialDemandRows,
  employees as initialEmployees,
  type DemandRow,
  type Employee,
} from '@/data/largeFixture'
import { createMockSchedule, isBreakSlot } from '@/services/mockSchedule'
import { validateScheduleInput, validateWorkbookName } from '@/services/validation'
import { parseWorkbook } from '@/services/workbookParser'
import { getFixture } from '@/data/fixtures'
import { displayShift, isEmployeeAssigned } from '@/lib/employeeDisplay'
import { isShortageSlot, summarizeCoverage } from '@/lib/coverageDisplay'
import { employeeIdsOnDuty } from '@/lib/slotRoster'
import { downloadTextFile } from '@/lib/downloadFile'
import { clearFrontendSession, loadFrontendSession, saveFrontendSession, type FrontendSession } from '@/services/frontendSession'
import { summarizePreview, type PreviewRun } from '@/services/previewComparison'
import { loadSavedSchedules, saveSchedule, SAVED_SCHEDULE_PREFIX, type SavedSchedule, type SavedScheduleKind } from '@/services/savedSchedules'
import { requiredAgentsByErlangC } from '@/services/erlangPreview'
import { buildAuditJson, buildCoverageCsv, buildScheduleCsv } from '@/services/exporters'
import type { CoverageItem, FixtureScenario, SchedulingResult } from '@/types/scheduling'
import './App.css'

const defaultServiceTarget = 0.8
const defaultAnswerWithinSeconds = 20

function recalculateDemand(rows: DemandRow[], target: number, seconds: number) {
  return rows.map((row) => ({
    ...row,
    required: requiredAgentsByErlangC(row.calls, row.aht, target, seconds),
  }))
}

function App() {
  const [date, setDate] = useState('2026-11-02')
  const [fileName, setFileName] = useState('')
  const [operation, setOperation] = useState<'workbook' | 'preview' | null>(null)
  const isGenerating = operation !== null
  const [hasResult, setHasResult] = useState(false)
  const [previewStale, setPreviewStale] = useState(false)
  const [activeTab, setActiveTab] = useState<FrontendSession['activeTab']>('demand')
  const [workbookInvalid, setWorkbookInvalid] = useState(false)
  const [isFixtureMode, setIsFixtureMode] = useState(false)
  const [serviceTarget, setServiceTarget] = useState(defaultServiceTarget)
  const [answerWithinSeconds, setAnswerWithinSeconds] = useState(defaultAnswerWithinSeconds)
  const [demandViewMode, setDemandViewMode] = useState<DemandViewMode>('both')
  const [scheduleViewMode, setScheduleViewMode] = useState<ScheduleViewMode>('gantt')
  const [demandFilter, setDemandFilter] = useState<DemandFilter>('all')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [showData, setShowData] = useState(true)
  const [showArchive, setShowArchive] = useState(false)
  const [savedSchedules, setSavedSchedules] = useState(loadSavedSchedules)
  const [latestPreview, setLatestPreview] = useState<PreviewRun>()
  const [previousPreview, setPreviousPreview] = useState<PreviewRun>()

  const [sourceDemand, setSourceDemand] = useState<DemandRow[]>([])
  const [demandList, setDemandList] = useState<DemandRow[]>([])
  const [employeeInputs, setEmployeeInputs] = useState<Employee[]>([])
  const [inputSourceVersion, setInputSourceVersion] = useState(0)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('all')
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all')
  const [inspectedSlot, setInspectedSlot] = useState<string | null>(null)
  const [rawResult, setRawResult] = useState<SchedulingResult | null>(null)
  useEffect(() => setInspectedSlot(null), [rawResult])
  const [inputWarnings, setInputWarnings] = useState<string[]>([])
  const [hasSavedSession, setHasSavedSession] = useState(false)
  const sessionHydrated = useRef(false)
  const skipInitialSessionSave = useRef(false)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const archiveHeading = useRef<HTMLHeadingElement>(null)
  const slotReturnTarget = useRef('')
  const scheduleValidation = validateScheduleInput(date, employeeInputs)
  const previewBlockReason = workbookInvalid ? 'Hãy chọn lại tệp Excel hợp lệ.'
    : !employeeInputs.length ? 'Chưa có dữ liệu nhân sự. Hãy tải tệp Excel hoặc chọn dữ liệu mẫu.'
    : scheduleValidation.valid ? undefined : scheduleValidation.message
  const previewReady = !previewBlockReason
  const formattedDate = date.split('-').reverse().join('/')

  const restoreWorkspace = useCallback((saved: FrontendSession) => {
    setDate(saved.date)
    setFileName(saved.fileName)
    setIsFixtureMode(saved.isFixtureMode)
    setServiceTarget(saved.serviceTarget)
    setAnswerWithinSeconds(saved.answerWithinSeconds)
    setDemandList(saved.demandList)
    setSourceDemand(saved.sourceDemand ?? saved.demandList)
    setEmployeeInputs(saved.employeeInputs)
    setHasResult(saved.hasResult)
    setRawResult(saved.rawResult)
    setWorkbookInvalid(saved.workbookInvalid ?? (
      !saved.previewReady && !saved.employeeInputs.some((employee) => employee.working && !employee.allowedShifts.length)
    ))
    setPreviewStale(saved.previewStale)
    setActiveTab(saved.activeTab)
    setDemandViewMode(saved.demandViewMode)
    setScheduleViewMode(saved.scheduleViewMode)
    setDemandFilter(saved.demandFilter ?? 'all')
    setInputWarnings(saved.inputWarnings ?? [])
    setLatestPreview(saved.latestPreview ?? (saved.hasResult && saved.rawResult?.has_solution
      ? summarizePreview(saved.date, saved.demandList, saved.rawResult)
      : undefined))
    setPreviousPreview(saved.previousPreview)
    setHasSavedSession(true)
  }, [])

  useEffect(() => {
    const saved = loadFrontendSession()
    skipInitialSessionSave.current = Boolean(saved)
    if (saved) restoreWorkspace(saved)
    sessionHydrated.current = true
  }, [restoreWorkspace])

  useEffect(() => {
    const refreshArchive = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(SAVED_SCHEDULE_PREFIX)) setSavedSchedules(loadSavedSchedules())
    }
    window.addEventListener('storage', refreshArchive)
    return () => window.removeEventListener('storage', refreshArchive)
  }, [])

  const sessionSnapshot = useMemo((): Omit<FrontendSession, 'version' | 'savedAt'> => ({
    date,
    fileName,
    isFixtureMode,
    serviceTarget,
    answerWithinSeconds,
    demandList,
    sourceDemand,
    employeeInputs,
    hasResult,
    rawResult,
    previewReady,
    workbookInvalid,
    previewStale,
    activeTab,
    demandViewMode,
    scheduleViewMode,
    demandFilter,
    inputWarnings,
    latestPreview,
    previousPreview,
  }), [
    activeTab,
    answerWithinSeconds,
    date,
    demandList,
    sourceDemand,
    demandViewMode,
    employeeInputs,
    fileName,
    hasResult,
    isFixtureMode,
    previewReady,
    workbookInvalid,
    previewStale,
    rawResult,
    scheduleViewMode,
    serviceTarget,
    demandFilter,
    inputWarnings,
    latestPreview,
    previousPreview,
  ])

  useEffect(() => {
    if (!sessionHydrated.current || isGenerating) return
    if (skipInitialSessionSave.current) {
      skipInitialSessionSave.current = false
      return
    }
    const saved = saveFrontendSession(sessionSnapshot)
    if (saved) {
      setHasSavedSession(true)
    }
  }, [isGenerating, sessionSnapshot])

  const workingCount = employeeInputs.filter((employee) => employee.working).length
  const coverageResult = hasResult && rawResult?.has_solution &&
    demandList.length > 0 && rawResult.coverage.length === demandList.length ? rawResult.coverage : null
  const hasCoverageResult = coverageResult !== null

  const coverageRows = useMemo<CoverageItem[]>(() => demandList.map((row, index) => {
    const result = coverageResult?.[index]
    return {
      ...row,
      required: result?.required_agents ?? row.required,
      scheduled: result?.scheduled_agents ?? 0,
      shortage: result?.shortage_agents ?? 0,
      overstaff: result?.overstaff_agents ?? 0,
      onBreak: isBreakSlot(row.time),
    }
  }), [coverageResult, demandList])

  const resultSummary = useMemo(() => summarizeCoverage(coverageRows), [coverageRows])
  const slotRow = hasCoverageResult ? coverageRows.find((row) => row.time === inspectedSlot && !row.onBreak) : undefined

  const finalizedSession = savedSchedules.find(({ kind, session }) =>
    kind === 'final' && session.date === date)?.session
  const finalizedResult = finalizedSession?.rawResult
  const isCurrentFinal = Boolean(hasResult && rawResult && finalizedResult?.request_id === rawResult.request_id)
  const finalizedPreview = hasCoverageResult && !isCurrentFinal && finalizedSession?.hasResult &&
    finalizedResult?.has_solution && finalizedResult.coverage.length === finalizedSession.demandList.length
    ? summarizePreview(date, finalizedSession.demandList, finalizedResult)
    : undefined

  const openArchive = () => {
    setShowArchive(true)
    requestAnimationFrame(() => archiveHeading.current?.focus())
  }

  const saveToArchive = (kind: SavedScheduleKind, expectedFinalSavedAt?: string) => {
    if (isGenerating || workbookInvalid || !date || (kind === 'final' && !hasCoverageResult)) return
    const outcome = saveSchedule(sessionSnapshot, kind, expectedFinalSavedAt)
    if (outcome === 'unavailable') {
      setNotice({ tone: 'error', message: 'Không thể lưu lịch trên trình duyệt này.' })
      return
    }
    setSavedSchedules(loadSavedSchedules())
    if (outcome === 'conflict') {
      setNotice({ tone: 'warning', message: 'Bản đã chốt vừa thay đổi ở tab khác. Kiểm tra lịch đã lưu rồi thử lại.' })
      return
    }
    setNotice({
      tone: 'success',
      message: kind === 'final' ? `Đã chốt lịch ngày ${formattedDate} trên trình duyệt.` : `Đã lưu bản nháp ngày ${formattedDate}.`,
    })
  }

  const openSavedSchedule = ({ kind, session }: SavedSchedule) => {
    if (isGenerating) return
    restoreWorkspace(session)
    setInputSourceVersion((source) => source + 1)
    setEmployeeSearch('')
    setEmployeeFilter('all')
    setScheduleFilter('all')
    setShowArchive(false)
    setShowData(false)
    setNotice({ tone: 'info', message: kind === 'final' ? 'Đã mở lịch đã chốt.' : 'Đã mở bản nháp.' })
    requestAnimationFrame(() => resultHeading.current?.focus())
  }

  const visibleEmployees = useMemo(
    () =>
      employeeInputs.filter((employee) => {
        const matchesSearch = `${employee.name} ${employee.id} ${employee.skill || ''}`
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
        if (!employee.working) return false
        if (!hasResult) return employee.allowedShifts.includes(scheduleFilter)
        return isEmployeeAssigned(employee, true) &&
          displayShift(employee, true).type === scheduleFilter
      }),
    [employeeInputs, hasResult, scheduleFilter]
  )

  const changeEmployees = (update: (employee: Employee) => Employee) => {
    setEmployeeInputs((current) => current.map(update))
    setHasResult(false)
    setRawResult(null)
    if (hasResult) setPreviewStale(true)
    if (!workbookInvalid && notice?.tone === 'error') setNotice(null)
  }

  const updateEmployee = (id: string, change: Partial<Pick<Employee, 'working' | 'allowedShifts'>>) => {
    changeEmployees((employee) => employee.id === id ? { ...employee, ...change } : employee)
  }

  const applyEmployeeAction = (ids: string[] | null, action: EmployeeAction) => {
    const selected = ids && new Set(ids)
    changeEmployees((employee) => {
      if (selected && !selected.has(employee.id)) return employee
      if (action === 'work') {
        return { ...employee, working: true, allowedShifts: employee.allowedShifts.length ? employee.allowedShifts : ['ca_ngay'] }
      }
      if (action === 'off') return { ...employee, working: false, allowedShifts: [] }
      if (!employee.working) return employee
      return { ...employee, allowedShifts: action === 'both' ? ['ca_ngay', 'ca_dem'] : [action] }
    })
  }

  const updateDemand = (calculate: () => DemandRow[]) => {
    try {
      setDemandList(calculate())
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Không tính được nhu cầu nhân sự.' })
      return false
    }
    setHasResult(false)
    setRawResult(null)
    if (hasResult) setPreviewStale(true)
    return true
  }

  const handleUpdateDemandRow = (time: string, calls: number, aht: number) => {
    const updated = updateDemand(() => demandList.map((row) => row.time === time ? {
      ...row,
      calls,
      aht,
      required: requiredAgentsByErlangC(calls, aht, serviceTarget, answerWithinSeconds),
    } : row))
    if (!updated) return false
    setNotice({
      tone: 'info',
      message: `Đã cập nhật khung giờ ${time}: ${calls} cuộc, AHT ${aht} phút.`,
    })
    return true
  }

  const handleScaleDemand = (factor: number) => {
    const updated = updateDemand(() => demandList.map((row) => {
      const calls = Math.round(row.calls * factor)
      return {
        ...row,
        calls,
        required: requiredAgentsByErlangC(calls, row.aht, serviceTarget, answerWithinSeconds),
      }
    }))
    if (!updated) return
    setNotice({
      tone: 'info',
      message: `Đã mô phỏng điều chỉnh lưu lượng ${
        factor > 1 ? `+${Math.round((factor - 1) * 100)}%` : `-${Math.round((1 - factor) * 100)}%`
      } cho tất cả các khung giờ.`,
    })
  }

  const handleResetDemand = () => {
    if (!updateDemand(() => recalculateDemand(sourceDemand, serviceTarget, answerWithinSeconds))) return
    setNotice({
      tone: 'info',
      message: 'Đã khôi phục lưu lượng cuộc gọi dự kiến ban đầu.',
    })
  }

  const handleFile = async (file?: File) => {
    if (!file) return
    setInputSourceVersion((source) => source + 1)
    const fileValidation = validateWorkbookName(file.name)
    const valid = fileValidation.valid
    setFileName(file.name)
    setIsFixtureMode(false)
    setHasResult(false)
    setRawResult(null)
    setPreviewStale(false)
    setDemandFilter('all')
    setInputWarnings([])

    if (!valid) {
      setWorkbookInvalid(true)
      setNotice({
        tone: 'error',
        message: fileValidation.message,
      })
      return
    }

    setOperation('workbook')
    setNotice(null)
    try {
      const parsed = await parseWorkbook(file, { serviceTarget, answerWithinSeconds })
      setDemandList(parsed.demand)
      setSourceDemand(parsed.demand)
      setEmployeeInputs(parsed.employees)
      setInputWarnings(parsed.warnings)
      setWorkbookInvalid(false)
      setOperation(null)
      setNotice({
        tone: parsed.warnings.length ? 'warning' : 'success',
        message: parsed.warnings.length
          ? `Đã đọc file nhưng cần xem lại: ${parsed.warnings.join(' ')}`
          : `Đã đọc ${file.name}: ${parsed.demand.length} khung giờ và ${parsed.employees.length} nhân viên.`,
      })
    } catch (error) {
      setOperation(null)
      setWorkbookInvalid(true)
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Không đọc được tệp Excel.',
      })
    }
  }

  const handleSlaChange = (target: number, seconds: number) => {
    if (!updateDemand(() => recalculateDemand(demandList, target, seconds))) return
    setServiceTarget(target)
    setAnswerWithinSeconds(seconds)
    setDemandFilter('all')

    setNotice({
      tone: 'info',
      message: `Đã áp dụng mục tiêu SLA ${(target * 100).toFixed(0)}% trong ${seconds} giây.`,
    })
  }

  const resetToFixture = () => {
    setInputSourceVersion((source) => source + 1)
    setSourceDemand(initialDemandRows)
    setDemandList(recalculateDemand(initialDemandRows, serviceTarget, answerWithinSeconds))
    setEmployeeInputs(initialEmployees)
    setFileName('mau_xep_lich.xlsx')
    setIsFixtureMode(true)
    setWorkbookInvalid(false)
    setHasResult(false)
    setRawResult(null)
    setPreviewStale(false)
    setInputWarnings([])
    setDemandFilter('all')
    setNotice({ tone: 'info', message: 'Đã nạp dữ liệu mẫu 20 nhân viên.' })
  }

  const handleClearToEmptyState = () => {
    clearFrontendSession()
    setHasSavedSession(false)
    setInputSourceVersion((source) => source + 1)
    setSourceDemand([])
    setDemandList([])
    setEmployeeInputs([])
    setFileName('')
    setIsFixtureMode(false)
    setWorkbookInvalid(false)
    setHasResult(false)
    setRawResult(null)
    setPreviewStale(false)
    setInputWarnings([])
    setDemandFilter('all')
    setShowData(true)
    setNotice({ tone: 'info', message: 'Đã đưa về trạng thái ban đầu (chưa nạp mẫu).' })
  }

  const clearSavedSession = () => {
    clearFrontendSession()
    setHasSavedSession(false)
    setNotice({
      tone: 'info',
      message: 'Đã xóa phiên đã lưu trên trình duyệt. Dữ liệu đang mở vẫn được giữ nguyên.',
    })
  }

  const downloadTemplate = () => {
    const link = document.createElement('a')
    link.href = '/mau_xep_lich.xlsx'
    link.download = 'mau_xep_lich.xlsx'
    link.click()
  }

  const loadDemoFixture = (fixtureId: FixtureScenario['id']) => {
    const fixture = getFixture(fixtureId)
    setInputSourceVersion((source) => source + 1)
    setSourceDemand(fixture.demand)
    setDemandList(recalculateDemand(fixture.demand, serviceTarget, answerWithinSeconds))
    setEmployeeInputs(fixture.employees)
    setFileName(`fixture_${fixtureId}.xlsx`)
    setIsFixtureMode(true)
    setWorkbookInvalid(false)
    setHasResult(false)
    setRawResult(null)
    setPreviewStale(false)
    setInputWarnings([])
    setDemandFilter('all')
    setNotice({
      tone: fixture.invalidReason ? 'error' : 'success',
      message:
        fixture.invalidReason ??
        `Đã nạp kịch bản “${fixture.label}”. Kiểm tra nhân viên trước khi tạo lịch.`,
    })
  }

  const downloadCsv = () => {
    downloadTextFile(`lich_${date}.csv`, buildScheduleCsv(date, employeeInputs, hasResult), 'text/csv')
  }

  const downloadCoverageCsv = () => {
    downloadTextFile(`do_phu_${date}.csv`, buildCoverageCsv(coverageRows, hasCoverageResult), 'text/csv')
  }

  const downloadShortageCsv = () => {
    downloadTextFile(`khung_gio_thieu_nguoi_${date}.csv`, buildCoverageCsv(coverageRows.filter(isShortageSlot), true), 'text/csv')
  }

  const downloadAuditJson = () => {
    if (!rawResult) return
    const audit = {
      exported_at: new Date().toISOString(),
      planning_date: date,
      source: 'frontend_local_preview',
      input: {
        file_name: fileName,
        service_target: serviceTarget,
        answer_within_seconds: answerWithinSeconds,
        demand_slots: demandList,
        employees: employeeInputs,
      },
      result: rawResult,
    }
    downloadTextFile(`audit_lich_${date}.json`, buildAuditJson(audit), 'application/json')
  }

  const handlePrint = () => {
    window.print()
  }

  const handleGenerate = async () => {
    if (previewBlockReason) return setNotice({ tone: 'error', message: previewBlockReason })

    setOperation('preview')
    setNotice(null)

    try {
      // Let the browser render the disabled controls before running the local calculation.
      await new Promise<void>((resolve) => requestAnimationFrame(() => window.setTimeout(resolve, 0)))
      const currentDemand = recalculateDemand(demandList, serviceTarget, answerWithinSeconds)
      const result = createMockSchedule(date, currentDemand, employeeInputs)
      setDemandList(currentDemand)
      setRawResult(result)
      setPreviousPreview(latestPreview?.date === date ? latestPreview : undefined)
      setLatestPreview(summarizePreview(date, currentDemand, result))
      const assignedMap = new Map<string, (typeof result.assignments)[number]>()
      for (const assignment of result.assignments) assignedMap.set(assignment.employee_id, assignment)

      setEmployeeInputs((current) => current.map((employee) => {
        const assigned = assignedMap.get(employee.id)
        if (!assigned) return { ...employee, status: employee.working ? 'Chưa xếp' : 'Nghỉ' }
        return {
          ...employee,
          shift: assigned.template_id === 'night_2000' ? 'Ca đêm · 20:00–08:00' : 'Ca ngày · 08:00–20:00',
          breakTime: assigned.breaks[0] ? `${assigned.breaks[0].start.slice(11, 16)}–${assigned.breaks[0].end.slice(11, 16)}` : '—',
          status: 'Có trong bản xem trước',
        }
      }))

      setOperation(null)
      setHasResult(true)
      setPreviewStale(false)
      const hasShortage = (result.metrics?.shortage_agent_slots ?? 0) > 0
      setActiveTab(hasShortage ? 'demand' : 'schedule')
      setDemandFilter('all')
      setNotice(null)
      requestAnimationFrame(() => resultHeading.current?.focus())
    } catch (error) {
      setOperation(null)
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Không tạo được bản xem trước.' })
    }
  }
  const handleDateChange = (value: string) => {
    setDate(value)
    setHasResult(false)
    setRawResult(null)
    setDemandFilter('all')
    if (hasResult) setPreviewStale(true)
  }

  const inspectShortage = () => {
    setActiveTab('demand')
    setDemandViewMode('table')
    setDemandFilter('shortage')
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#demand-panel .roster-table-scroll')?.focus())
  }

  const inspectSlot = (row: CoverageItem, returnTo: string) => {
    slotReturnTarget.current = returnTo
    setInspectedSlot(row.time)
    setActiveTab('schedule')
    requestAnimationFrame(() => document.getElementById('slot-roster-heading')?.focus())
  }

  return (
    <div className="roster-app min-h-screen print:bg-white">
      <SchedulingMasthead />
      <main className="roster-width roster-main" aria-busy={isGenerating}>
        <SchedulingPageHeading
          hasSavedSession={hasSavedSession}
          busy={isGenerating}
          archiveOpen={showArchive}
          onClearSession={clearSavedSession}
          onToggleArchive={() => showArchive ? setShowArchive(false) : openArchive()}
        />
        <SchedulingSetup
          date={date}
          formattedDate={formattedDate}
          serviceTarget={serviceTarget}
          answerWithinSeconds={answerWithinSeconds}
          demand={demandList}
          workingCount={workingCount}
          employeeCount={employeeInputs.length}
          source={{ fileName, isFixtureMode, invalid: workbookInvalid, expanded: showData }}
          busy={isGenerating}
          processingLabel={operation === 'workbook' ? 'Đang đọc Excel…' : 'Đang xếp ca…'}
          previewReady={previewReady}
          previewIsPrimary={!hasResult && !previewStale}
          onDateChange={handleDateChange}
          onSlaChange={handleSlaChange}
          onToggleSource={() => setShowData(!showData)}
          onFile={handleFile}
          onDownloadTemplate={downloadTemplate}
          onSelectFixture={loadDemoFixture}
          onResetFixture={resetToFixture}
          onClearData={handleClearToEmptyState}
          onGenerate={handleGenerate}
        />

        {notice && <div className="mb-4 print:hidden"><NoticeBox notice={notice} /></div>}
        {previewBlockReason && notice?.tone !== 'error' && (
          <p className="mb-4 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-950 print:hidden">
            {previewBlockReason}
          </p>
        )}
        {inputWarnings.length > 0 && notice?.tone !== 'warning' && (
          <ul className="mb-4 list-disc border-l-2 border-amber-500 bg-amber-50 py-2 pl-7 pr-3 text-sm text-amber-950 print:hidden">
            {inputWarnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        )}

        {showArchive && (
          <SavedSchedules
            headingRef={archiveHeading}
            date={date}
            entries={savedSchedules}
            disabled={isGenerating}
            canSaveDraft={Boolean(date && !workbookInvalid)}
            canFinalize={hasCoverageResult && !workbookInvalid}
            previewId={rawResult?.request_id}
            isCurrentFinal={isCurrentFinal}
            shortage={resultSummary.shortage}
            onSave={saveToArchive}
            onOpen={openSavedSchedule}
          />
        )}

        <ScheduleWorkspace
          activeTab={activeTab}
          onTabChange={setActiveTab}
          demandMode={demandViewMode}
          onDemandModeChange={setDemandViewMode}
          scheduleMode={scheduleViewMode}
          onScheduleModeChange={setScheduleViewMode}
          inspectingSlot={Boolean(slotRow)}
          header={
            <ScheduleResultHeader
              headingRef={resultHeading}
              formattedDate={formattedDate}
              isCurrentFinal={isCurrentFinal}
              previewStale={previewStale}
              busy={isGenerating}
              onRegenerate={handleGenerate}
              regenerateBlockReason={previewBlockReason}
              actions={hasResult ? {
                onSave: openArchive,
                onExportSchedule: downloadCsv,
                onExportCoverage: downloadCoverageCsv,
                onExportShortage: hasCoverageResult && resultSummary.worst ? downloadShortageCsv : undefined,
                onExportAudit: downloadAuditJson,
                onPrint: handlePrint,
              } : undefined}
            />
          }
          coverage={hasCoverageResult && (
            <>
              <CoverageStatus summary={resultSummary} onInspectShortage={inspectShortage} onInspectSlot={inspectSlot} />
              {latestPreview?.date === date && (
                <PreviewComparison previous={previousPreview} finalized={finalizedPreview} current={latestPreview} />
              )}
            </>
          )}
          panels={{
            demand: (
              <DemandCoverageView
                key={inputSourceVersion}
                mode={demandViewMode}
                previewId={rawResult?.request_id}
                rows={coverageRows}
                hasResult={hasCoverageResult}
                onUpdateRow={handleUpdateDemandRow}
                onScaleCalls={handleScaleDemand}
                onResetDemand={handleResetDemand}
                onInspectSlot={inspectSlot}
                disabled={isGenerating}
                filter={demandFilter}
                onFilter={setDemandFilter}
              />
            ),
            schedule: (
              <ShiftScheduleView
                mode={scheduleViewMode}
                employees={visibleScheduleEmployees}
                total={employeeInputs.length}
                hasResult={hasResult}
                filter={scheduleFilter}
                onFilter={setScheduleFilter}
                slotReview={slotRow && rawResult ? {
                  row: slotRow,
                  employeeIds: employeeIdsOnDuty(rawResult.assignments, date, slotRow.time),
                  employees: employeeInputs,
                  onClose: () => {
                    setInspectedSlot(null)
                    setScheduleFilter('all')
                    requestAnimationFrame(() => document.getElementById('schedule-panel')?.focus())
                  },
                  onBack: () => {
                    setInspectedSlot(null)
                    setActiveTab('demand')
                    requestAnimationFrame(() => {
                      const target = document.getElementById(slotReturnTarget.current) ?? document.getElementById('demand-panel')
                      target?.focus()
                    })
                  },
                } : undefined}
              />
            ),
            employees: (
              <EmployeeInputTable
                key={inputSourceVersion}
                employees={visibleEmployees}
                total={employeeInputs.length}
                workingCount={workingCount}
                search={employeeSearch}
                filter={employeeFilter}
                onSearch={setEmployeeSearch}
                onFilter={setEmployeeFilter}
                onApply={applyEmployeeAction}
                onUpdate={updateEmployee}
                disabled={isGenerating}
              />
            ),
          }}
          printSchedule={hasResult && activeTab === 'employees' && (
            <div className="hidden print:block">
              <ScheduleTable
                employees={employeeInputs}
                total={employeeInputs.length}
                filter="all"
                onFilter={setScheduleFilter}
                hasResult
              />
            </div>
          )}
        />
      </main>
    </div>
  )
}

export default App
