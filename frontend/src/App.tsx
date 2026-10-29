import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  LayoutDashboard,
  Moon,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sun,
  Upload,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  demandRows as initialDemandRows,
  employees as initialEmployees,
  type DemandRow,
  type Employee,
  type ShiftId,
} from '@/data/largeFixture'
import { checkBackendHealth, createSchedule, previewWorkbook, type ScheduleResult } from '@/services/api'
import './App.css'

type Notice = { tone: 'success' | 'error' | 'info'; message: string }
type EmployeeFilter = 'all' | 'working' | 'off'
type ScheduleFilter = 'all' | 'ca_ngay' | 'ca_dem' | 'off'

type CoverageItem = {
  time: string
  calls: number
  aht: number
  required: number
  scheduled: number
  shortage: number
  overstaff: number
  onBreak: boolean
}

function App() {
  const [date, setDate] = useState('2026-11-02')
  const [fileName, setFileName] = useState('mau_xep_lich.xlsx')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasResult, setHasResult] = useState(false)
  const [activeTab, setActiveTab] = useState<'demand' | 'schedule'>('demand')
  const [previewReady, setPreviewReady] = useState(true)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [isFixtureMode, setIsFixtureMode] = useState(true)
  const [notice, setNotice] = useState<Notice>({
    tone: 'info',
    message: 'Bạn có thể tải workbook mẫu hoặc chọn file .xlsx để phân tích.',
  })

  const [demandList, setDemandList] = useState<DemandRow[]>(initialDemandRows)
  const [employeeInputs, setEmployeeInputs] = useState<Employee[]>(initialEmployees)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('all')
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all')
  const [rawResult, setRawResult] = useState<ScheduleResult | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Check health on mount
  useEffect(() => {
    checkBackendHealth().then((isUp) => {
      setBackendOnline(isUp)
      if (isUp) {
        setNotice({
          tone: 'info',
          message: 'Backend FastAPI (Erlang C & OR-Tools CP-SAT) đã kết nối. Sẵn sàng tạo lịch thật!',
        })
      }
    })
  }, [])

  const workingCount = employeeInputs.filter((employee) => employee.working).length
  const dayCount = employeeInputs.filter((employee) => employee.working && employee.allowedShifts.includes('ca_ngay')).length
  const nightCount = employeeInputs.filter((employee) => employee.working && employee.allowedShifts.includes('ca_dem')).length
  const invalidEmployeeCount = employeeInputs.filter((employee) => employee.working && employee.allowedShifts.length === 0).length

  const summary = useMemo(() => ({
    totalCalls: demandList.reduce((sum, row) => sum + row.calls, 0),
    maxRequired: Math.max(...demandList.map((row) => row.required), 0),
  }), [demandList])

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
          onBreak: false,
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
    const coveredSlots = coverageRows.filter((row) => row.shortage === 0).length
    const totalSlots = coverageRows.length || 1
    const fulfillmentRate = Math.round((coveredSlots / totalSlots) * 100)
    return {
      shortage: coverageRows.reduce((sum, row) => sum + row.shortage, 0),
      uncoveredSlots: coverageRows.filter((row) => row.shortage > 0).length,
      maxShortage: Math.max(...coverageRows.map((row) => row.shortage), 0),
      fulfillmentRate,
      coveredSlots,
      totalSlots,
    }
  }, [coverageRows])

  const visibleEmployees = useMemo(() => employeeInputs.filter((employee) => {
    const matchesSearch = `${employee.name} ${employee.id}`.toLowerCase().includes(employeeSearch.toLowerCase().trim())
    const matchesFilter = employeeFilter === 'all' || (employeeFilter === 'working' ? employee.working : !employee.working)
    return matchesSearch && matchesFilter
  }), [employeeFilter, employeeInputs, employeeSearch])

  const visibleScheduleEmployees = useMemo(() => employeeInputs.filter((employee) => {
    if (scheduleFilter === 'all') return true
    if (scheduleFilter === 'off') return !employee.working
    if (scheduleFilter === 'ca_ngay') return employee.working && employee.allowedShifts.includes('ca_ngay')
    if (scheduleFilter === 'ca_dem') return employee.working && employee.allowedShifts.includes('ca_dem')
    return true
  }), [employeeInputs, scheduleFilter])

  const updateEmployee = (id: string, change: Partial<Pick<Employee, 'working' | 'allowedShifts'>>) => {
    setEmployeeInputs((current) => current.map((employee) => employee.id === id ? { ...employee, ...change } : employee))
    setHasResult(false)
  }

  const setAllShift = (shift: ShiftId) => {
    setEmployeeInputs((current) => current.map((employee) => employee.working ? {
      ...employee,
      allowedShifts: [...new Set<ShiftId>([...employee.allowedShifts, shift])],
    } : employee))
    setHasResult(false)
  }

  const toggleAllWorking = (workingStatus: boolean) => {
    setEmployeeInputs((current) => current.map((employee) => ({
      ...employee,
      working: workingStatus,
      allowedShifts: workingStatus ? (employee.allowedShifts.length ? employee.allowedShifts : ['ca_ngay']) : [],
    })))
    setHasResult(false)
  }

  const handleFile = async (file?: File) => {
    if (!file) return
    const valid = file.name.toLowerCase().endsWith('.xlsx')
    setFileName(file.name)
    setHasResult(false)

    if (!valid) {
      setPreviewReady(false)
      setNotice({ tone: 'error', message: 'File chưa đúng định dạng. Hãy chọn workbook Excel có đuôi .xlsx.' })
      return
    }

    setIsGenerating(true)
    setNotice({ tone: 'info', message: 'Đang đọc workbook và tính nhu cầu theo Erlang C từ Backend…' })

    try {
      const preview = await previewWorkbook(file)
      setDemandList(preview.demand.map((d) => ({
        time: d.time,
        calls: d.calls,
        aht: d.aht,
        required: d.required,
      })))
      setEmployeeInputs(preview.employees.map((e) => ({
        id: e.id,
        name: e.name,
        shift: e.shift,
        breakTime: e.breakTime,
        status: e.status as 'Đã xếp' | 'Chưa xếp',
        working: e.working,
        allowedShifts: e.allowedShifts,
      })))
      setIsFixtureMode(false)
      setPreviewReady(true)
      setIsGenerating(false)
      setNotice({
        tone: 'success',
        message: `Đã nạp thành công file ${file.name} (${preview.summary.total_slots} slot, ${preview.summary.total_employees} nhân viên). Nhu cầu nhân sự đã được tính tự động qua Erlang C!`,
      })
    } catch (err: any) {
      setIsGenerating(false)
      setPreviewReady(true)
      setNotice({
        tone: 'error',
        message: err.message || 'Không thể đọc nội dung file Excel qua Backend API.',
      })
    }
  }

  const resetToFixture = () => {
    setDemandList(initialDemandRows)
    setEmployeeInputs(initialEmployees)
    setFileName('mau_xep_lich.xlsx')
    setIsFixtureMode(true)
    setHasResult(false)
    setNotice({ tone: 'info', message: 'Đã khôi phục dữ liệu mẫu chuẩn (B1.1 Fixture).' })
  }

  const downloadTemplate = () => {
    const link = document.createElement('a')
    link.href = '/mau_xep_lich.xlsx'
    link.download = 'mau_xep_lich.xlsx'
    link.click()
  }

  const loadDemoFixture = async (fixtureName: string) => {
    try {
      setIsGenerating(true)
      setNotice({ tone: 'info', message: `Đang nạp bộ dữ liệu kiểm thử: ${fixtureName}...` })
      const res = await fetch(`/fixtures/${fixtureName}`)
      if (!res.ok) throw new Error('Không thể tải file fixture từ server')
      const blob = await res.blob()
      const file = new File([blob], fixtureName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      await handleFile(file)
    } catch (err: any) {
      setIsGenerating(false)
      setNotice({ tone: 'error', message: err.message || 'Lỗi khi nạp dữ liệu kiểm thử.' })
    }
  }

  const downloadCsv = () => {
    const headers = 'employee_id,employee_name,date,shift,shift_start,shift_end,break_start,break_end,status'
    const rows = employeeInputs.map((emp) => {
      const isNight = emp.allowedShifts[0] === 'ca_dem'
      const shiftName = isNight ? 'Ca đêm' : 'Ca ngày'
      const sStart = isNight ? '20:00' : '08:00'
      const sEnd = isNight ? '08:00' : '20:00'
      const bStart = isNight ? '00:00' : '12:00'
      const bEnd = isNight ? '01:00' : '13:00'
      const statusStr = displayStatus(emp, hasResult)
      const isAssigned = statusStr === 'Đã xếp'

      return `${emp.id},"${emp.name}",${date},${isAssigned ? shiftName : '—'},${isAssigned ? sStart : '—'},${isAssigned ? sEnd : '—'},${isAssigned ? bStart : '—'},${isAssigned ? bEnd : '—'},${statusStr}`
    })

    const csvContent = [headers, ...rows].join('\n')
    const link = document.createElement('a')
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(`\ufeff${csvContent}`)}`
    link.download = `lich_${date}.csv`
    link.click()
  }

  const downloadCoverageCsv = () => {
    const headers = 'Khung_gio,Cuoc_goi,AHT_phut,Can_ErlangC,Da_xep,Thieu,Thua,Trang_thai'
    const rows = coverageRows.map((r) => {
      const status = r.onBreak ? 'Giờ nghỉ' : r.shortage ? `Thiếu ${r.shortage}` : 'Đủ người'
      return `${r.time},${r.calls},${r.aht},${r.required},${r.scheduled},${r.shortage},${r.overstaff},${status}`
    })
    const csvContent = [headers, ...rows].join('\n')
    const link = document.createElement('a')
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(`\ufeff${csvContent}`)}`
    link.download = `do_phu_${date}.csv`
    link.click()
  }

  const handleGenerate = async () => {
    if (!date) return setNotice({ tone: 'error', message: 'Bạn cần chọn ngày lập lịch.' })
    if (!previewReady) return setNotice({ tone: 'error', message: 'Hãy chọn một workbook .xlsx hợp lệ trước khi tạo lịch.' })
    if (!workingCount) return setNotice({ tone: 'error', message: 'Cần ít nhất một nhân viên được đánh dấu “Đi làm”.' })
    if (invalidEmployeeCount) return setNotice({ tone: 'error', message: `${invalidEmployeeCount} nhân viên đang đi làm nhưng chưa chọn ca.` })

    setIsGenerating(true)
    setNotice({ tone: 'info', message: 'Đang gửi dữ liệu đến CP-SAT Solver để tối ưu hóa phân ca…' })

    try {
      const payloadSlots = demandList.map((d, index) => {
        const [time_start, time_end] = d.time
          .replace('—', '–')
          .replace('-', '–')
          .split('–')
          .map((p) => p.trim())
        return {
          slot_id: `slot_${String(index + 1).padStart(2, '0')}`,
          time_start: time_start || '08:00',
          time_end: time_end || '08:30',
          calls: d.calls,
          aht: d.aht,
          required_agents: d.required,
        }
      })

      const payloadEmployees = employeeInputs.map((e) => ({
        employee_id: e.id,
        name: e.name,
        working: e.working,
        allowed_shifts: e.allowedShifts,
      }))

      const result = await createSchedule({
        planning_date: date,
        slots: payloadSlots,
        employees: payloadEmployees,
      })

      setRawResult(result)

      // Map CP-SAT assignments to employeeInputs
      const assignedMap = new Map<string, typeof result.assignments[number]>()
      for (const a of result.assignments) {
        assignedMap.set(a.employee_id, a)
      }

      setEmployeeInputs((current) => current.map((emp) => {
        const assigned = assignedMap.get(emp.id)
        if (assigned) {
          return {
            ...emp,
            shift: assigned.shift,
            breakTime: `${assigned.break_start}–${assigned.break_end}`,
            status: 'Đã xếp',
          }
        }
        return {
          ...emp,
          status: emp.working ? 'Chưa xếp' : 'Nghỉ',
        }
      }))

      setIsGenerating(false)
      setHasResult(true)
      setActiveTab('schedule')

      const shortageCount = result.metrics ? result.metrics.total_shortage : 0
      if (shortageCount > 0) {
        setNotice({
          tone: 'info',
          message: `Lịch đã tạo bằng CP-SAT (Cảnh báo mềm: còn thiếu ${shortageCount} lượt nhân sự theo SLA).`,
        })
      } else {
        setNotice({
          tone: 'success',
          message: 'Lịch tối ưu đã tạo thành công bằng CP-SAT và phủ 100% nhu cầu!',
        })
      }
    } catch (err: any) {
      console.warn('Backend solver call failed, using local simulation:', err)
      window.setTimeout(() => {
        setIsGenerating(false)
        setHasResult(true)
        setActiveTab('schedule')
        setNotice({
          tone: resultSummary.shortage ? 'info' : 'success',
          message: `(Bản xem trước) Đã tạo lịch mô phỏng. Còn thiếu ${resultSummary.shortage} lượt nhân sự.`,
        })
      }, 550)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900 font-sans">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <LayoutDashboard size={21} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold tracking-tight text-slate-950">Xếp lịch CSKH</p>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  WFM Service
                </span>
              </div>
              <p className="text-xs text-slate-500">Call Center Scheduling · Erlang C + OR-Tools CP-SAT</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-medium">
            {backendOnline ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                <Zap size={13} className="mr-1.5 text-emerald-600 fill-emerald-500" /> Backend CP-SAT: Đang hoạt động
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-slate-600 border border-slate-200">
                <ShieldCheck size={13} className="mr-1.5 text-slate-500" /> Chế độ xem trước
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 border border-slate-200">
              {isFixtureMode ? 'Mẫu B1.1' : 'Excel người dùng'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-6 py-7">
        <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Trung tâm Điều hành Phân ca
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Tạo lịch nhân viên tự động theo SLA
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
              Tải file Excel để tính số người cần theo <strong>Erlang C</strong> và giải phân ca tối ưu bằng{' '}
              <strong>Google OR-Tools CP-SAT</strong>.
            </p>
          </div>
          {!isFixtureMode && (
            <button
              onClick={resetToFixture}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-2xs transition"
            >
              <RotateCcw size={14} /> Khôi phục dữ liệu mẫu
            </button>
          )}
        </section>

        {/* 3 Steps indicator */}
        <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs">
          <Step number="1" label="Nhập dữ liệu (.xlsx)" active={false} done={previewReady} />
          <Step number="2" label="Kiểm tra nhân viên" active={!hasResult} done={hasResult} />
          <Step number="3" label="Xem lịch & Độ phủ" active={hasResult} done={hasResult} />
        </div>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Left Sidebar Controls */}
          <aside className="space-y-5">
            {/* Planning Date Box */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays size={18} className="text-blue-600" />
                <h2 className="font-semibold text-slate-900 text-sm">Thông tin lập lịch</h2>
              </div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="planning-date">
                Ngày cần lập lịch
              </label>
              <input
                id="planning-date"
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  setHasResult(false)
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
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <button
                onClick={() => fileInput.current?.click()}
                className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 text-left transition hover:border-blue-400 hover:bg-blue-50/60"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-blue-600 shadow-2xs">
                  <Upload size={17} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{fileName}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Sheet: NhuCau · NhanVien</p>
                </div>
              </button>
              <button
                onClick={downloadTemplate}
                className="mt-2.5 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 shadow-2xs"
              >
                <Download size={14} className="mr-1.5 inline text-slate-500" /> Tải workbook mẫu Excel
              </button>

              {/* 4 Demo Fixtures */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Kịch bản thử nghiệm nhanh:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => loadDemoFixture('01_normal.xlsx')}
                    className="truncate text-left rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition border border-emerald-200/50"
                    title="01_normal.xlsx: Đủ nhân sự, 100% độ phủ"
                  >
                    1. Bình thường
                  </button>
                  <button
                    onClick={() => loadDemoFixture('02_peak_demand.xlsx')}
                    className="truncate text-left rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition border border-amber-200/50"
                    title="02_peak_demand.xlsx: Giờ cao điểm, soft shortage"
                  >
                    2. Cao điểm
                  </button>
                  <button
                    onClick={() => loadDemoFixture('03_understaffed.xlsx')}
                    className="truncate text-left rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 transition border border-violet-200/50"
                    title="03_understaffed.xlsx: Thiếu người diện rộng"
                  >
                    3. Thiếu người
                  </button>
                  <button
                    onClick={() => loadDemoFixture('04_invalid_data.xlsx')}
                    className="truncate text-left rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition border border-rose-200/50"
                    title="04_invalid_data.xlsx: Dữ liệu lỗi (Validation)"
                  >
                    4. Dữ liệu lỗi
                  </button>
                </div>
              </div>

              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-4 text-slate-500">
                Nhu cầu được Erlang C tự động tính từ số cuộc gọi & AHT.
              </p>
              <NoticeBox notice={notice} />
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
                {isGenerating ? 'Đang chạy OR-Tools CP-SAT…' : 'Tạo lịch bằng CP-SAT'}
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
            <EmployeeInputTable
              employees={visibleEmployees}
              total={employeeInputs.length}
              workingCount={workingCount}
              search={employeeSearch}
              filter={employeeFilter}
              onSearch={setEmployeeSearch}
              onFilter={setEmployeeFilter}
              onSetAll={setAllShift}
              onToggleAllWorking={toggleAllWorking}
              onUpdate={updateEmployee}
            />

            {/* Main Result & Table View */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Kết quả phân ca & Độ phủ thực tế</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Ngày {date ? date.split('-').reverse().join('/') : 'chưa chọn'} ·{' '}
                    {hasResult
                      ? rawResult
                        ? `Giải bằng OR-Tools ${rawResult.solution_source} (${rawResult.status})`
                        : 'Mô phỏng cục bộ'
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
                    <div className="flex items-center gap-1.5">
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
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs Switcher */}
              <div className="flex border-b border-slate-200 px-5">
                <button
                  onClick={() => setActiveTab('demand')}
                  className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${
                    activeTab === 'demand' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                  }`}
                >
                  Nhu cầu và độ phủ ({demandList.length} slot)
                </button>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className={`ml-6 border-b-2 px-1 py-3 text-sm font-semibold transition ${
                    activeTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                  }`}
                >
                  Lịch nhân viên ({employeeInputs.length} người)
                </button>
              </div>

              {activeTab === 'demand' ? (
                <DemandTable rows={coverageRows} hasResult={hasResult} />
              ) : (
                <ScheduleTable
                  employees={visibleScheduleEmployees}
                  total={employeeInputs.length}
                  filter={scheduleFilter}
                  onFilter={setScheduleFilter}
                  hasResult={hasResult}
                />
              )}
            </div>

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

function Step({ number, label, active, done }: { number: string; label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
        active ? 'bg-blue-50 text-blue-700' : 'text-slate-500'
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
          done ? 'bg-emerald-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
        }`}
      >
        {done ? <Check size={14} /> : number}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}

function NoticeBox({ notice }: { notice: Notice }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
    error: 'bg-rose-50 text-rose-800 border border-rose-200/80',
    info: 'bg-slate-50 text-slate-700 border border-slate-200',
  }
  return (
    <p className={`mt-3 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs leading-5 ${styles[notice.tone]}`}>
      {notice.tone === 'success' ? (
        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
      ) : notice.tone === 'error' ? (
        <XCircle size={14} className="mt-0.5 shrink-0 text-rose-600" />
      ) : (
        <Info size={14} className="mt-0.5 shrink-0 text-blue-500" />
      )}
      <span>{notice.message}</span>
    </p>
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
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[color]}`}>{icon}</span>
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
  const color = tone === 'warning' ? 'text-amber-700' : tone === 'success' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

function DemandTable({ rows, hasResult }: { rows: CoverageItem[]; hasResult: boolean }) {
  return (
    <div className="overflow-x-auto max-h-[460px]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-2xs z-10">
          <tr>
            <th className="px-5 py-3 font-semibold">Khung giờ</th>
            <th className="px-5 py-3 font-semibold">Cuộc gọi</th>
            <th className="px-5 py-3 font-semibold">AHT</th>
            <th className="px-5 py-3 font-semibold">Cần (Erlang C)</th>
            <th className="px-5 py-3 font-semibold">Đã xếp</th>
            <th className="px-5 py-3 font-semibold min-w-[190px]">Độ phủ & Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const hasShortage = hasResult && row.shortage > 0
            const percentage = Math.min(100, Math.round((row.scheduled / Math.max(1, row.required)) * 100))

            return (
              <tr
                key={row.time}
                className={`transition ${hasShortage ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'}`}
              >
                <td className="px-5 py-3 font-medium text-slate-800">{row.time}</td>
                <td className="px-5 py-3 text-slate-600">{row.calls}</td>
                <td className="px-5 py-3 text-slate-600">{row.aht} phút</td>
                <td className="px-5 py-3 font-bold text-slate-800">{row.required}</td>
                <td className="px-5 py-3 text-slate-700 font-semibold">{hasResult ? row.scheduled : '—'}</td>
                <td className="px-5 py-3">
                  {row.onBreak ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      Giờ nghỉ (12:00–13:00)
                    </span>
                  ) : !hasResult ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      Chưa tạo
                    </span>
                  ) : hasShortage ? (
                    <div className="space-y-1.5 w-44">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-amber-700">Thiếu {row.shortage}</span>
                        <span className="text-slate-500">{row.scheduled}/{row.required}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 w-44">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-emerald-700">Đủ người</span>
                        <span className="text-emerald-600">{row.scheduled}/{row.required}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
                        <div className="h-full w-full bg-emerald-500 rounded-full" />
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function shiftFor(id: ShiftId) {
  return id === 'ca_ngay'
    ? { label: 'Ca ngày · 08:00–20:00', breakTime: '12:00–13:00', type: 'day' }
    : { label: 'Ca đêm · 20:00–08:00', breakTime: '00:00–01:00', type: 'night' }
}

function displayShift(employee: Employee) {
  const selected = employee.allowedShifts[0]
  return selected ? shiftFor(selected) : { label: 'Chưa chọn ca', breakTime: '—', type: 'none' }
}

function displayStatus(employee: Employee, hasResult: boolean) {
  if (!employee.working) return 'Nghỉ'
  if (!employee.allowedShifts.length) return 'Chưa chọn ca'
  return hasResult ? employee.status || 'Đã xếp' : 'Sẵn sàng'
}

function EmployeeInputTable({
  employees,
  total,
  workingCount,
  search,
  filter,
  onSearch,
  onFilter,
  onSetAll,
  onToggleAllWorking,
  onUpdate,
}: {
  employees: Employee[]
  total: number
  workingCount: number
  search: string
  filter: EmployeeFilter
  onSearch: (value: string) => void
  onFilter: (value: EmployeeFilter) => void
  onSetAll: (shift: ShiftId) => void
  onToggleAllWorking: (workingStatus: boolean) => void
  onUpdate: (id: string, change: Partial<Pick<Employee, 'working' | 'allowedShifts'>>) => void
}) {
  const toggleShift = (employee: Employee, shift: ShiftId, checked: boolean) => {
    const next = checked
      ? [...new Set<ShiftId>([...employee.allowedShifts, shift])]
      : employee.allowedShifts.filter((item) => item !== shift)
    onUpdate(employee.id, { allowedShifts: next })
  }

  const allAreWorking = workingCount === total

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Danh sách nhân viên</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Tích chọn người đi làm và ca khả dụng. Đang hiển thị {employees.length}/{total} nhân sự.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onToggleAllWorking(!allAreWorking)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              {allAreWorking ? 'Bỏ chọn đi làm' : 'Chọn tất cả đi làm'}
            </button>
            <button
              onClick={() => onSetAll('ca_ngay')}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Chọn ca ngày
            </button>
            <button
              onClick={() => onSetAll('ca_dem')}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Chọn ca đêm
            </button>
          </div>
        </div>

        {/* Search & Tab Filters */}
        <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              aria-label="Tìm nhân viên"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc mã nhân viên…"
              className="w-full rounded-xl border border-slate-200 py-1.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
            />
          </label>
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            <button
              onClick={() => onFilter('all')}
              className={`rounded-lg px-2.5 py-1 transition ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Tất cả ({total})
            </button>
            <button
              onClick={() => onFilter('working')}
              className={`rounded-lg px-2.5 py-1 transition ${
                filter === 'working' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Đi làm ({workingCount})
            </button>
            <button
              onClick={() => onFilter('off')}
              className={`rounded-lg px-2.5 py-1 transition ${
                filter === 'off' ? 'bg-white text-slate-700 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Nghỉ ({total - workingCount})
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-[380px] overflow-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-2xs z-10">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Nhân viên</th>
              <th className="px-5 py-2.5 text-center font-semibold">Đi làm</th>
              <th className="px-5 py-2.5 text-center font-semibold">Ca ngày</th>
              <th className="px-5 py-2.5 text-center font-semibold">Ca đêm</th>
              <th className="px-5 py-2.5 font-semibold">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-slate-50">
                <td className="px-5 py-2.5">
                  <p className="font-semibold text-slate-800 text-xs">{employee.name}</p>
                  <p className="text-[11px] text-slate-500">{employee.id}</p>
                </td>
                <td className="px-5 py-2.5 text-center">
                  <input
                    aria-label={`${employee.name} đi làm`}
                    type="checkbox"
                    checked={employee.working}
                    onChange={(event) => onUpdate(employee.id, { working: event.target.checked })}
                    className="h-4 w-4 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="px-5 py-2.5 text-center">
                  <input
                    aria-label={`${employee.name} ca ngày`}
                    type="checkbox"
                    checked={employee.allowedShifts.includes('ca_ngay')}
                    disabled={!employee.working}
                    onChange={(event) => toggleShift(employee, 'ca_ngay', event.target.checked)}
                    className="h-4 w-4 accent-blue-600 disabled:opacity-30 cursor-pointer"
                  />
                </td>
                <td className="px-5 py-2.5 text-center">
                  <input
                    aria-label={`${employee.name} ca đêm`}
                    type="checkbox"
                    checked={employee.allowedShifts.includes('ca_dem')}
                    disabled={!employee.working}
                    onChange={(event) => toggleShift(employee, 'ca_dem', event.target.checked)}
                    className="h-4 w-4 accent-blue-600 disabled:opacity-30 cursor-pointer"
                  />
                </td>
                <td className="px-5 py-2.5 text-xs text-slate-500">
                  {!employee.working ? (
                    <span className="text-slate-400">Không tham gia</span>
                  ) : !employee.allowedShifts.length ? (
                    <span className="font-semibold text-rose-600">Chưa chọn ca</span>
                  ) : employee.allowedShifts.length === 2 ? (
                    <span className="text-blue-600 font-medium">Linh hoạt cả 2 ca</span>
                  ) : (
                    <span className="text-slate-600">Đã chọn ca</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!employees.length && (
          <p className="px-5 py-8 text-center text-xs text-slate-500">Không tìm thấy nhân viên phù hợp.</p>
        )}
      </div>
    </div>
  )
}

function ScheduleTable({
  employees,
  total,
  filter,
  onFilter,
  hasResult,
}: {
  employees: Employee[]
  total: number
  filter: ScheduleFilter
  onFilter: (value: ScheduleFilter) => void
  hasResult: boolean
}) {
  return (
    <div>
      {/* Shift Filter Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <span className="text-xs font-semibold text-slate-500">
          Hiển thị: {employees.length}/{total} nhân sự
        </span>
        <div className="flex items-center gap-1 text-xs font-semibold">
          <button
            onClick={() => onFilter('all')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => onFilter('ca_ngay')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'ca_ngay' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Ca ngày
          </button>
          <button
            onClick={() => onFilter('ca_dem')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'ca_dem' ? 'bg-purple-50 text-purple-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Ca đêm
          </button>
          <button
            onClick={() => onFilter('off')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'off' ? 'bg-slate-200 text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Nghỉ
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[460px]">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-2xs z-10">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Nhân viên</th>
              <th className="px-5 py-2.5 font-semibold">Ca làm việc</th>
              <th className="px-5 py-2.5 font-semibold">Khung giờ nghỉ</th>
              <th className="px-5 py-2.5 font-semibold">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((employee) => {
              const shift = displayShift(employee)
              const status = displayStatus(employee, hasResult)
              const isAssigned = status === 'Đã xếp'

              return (
                <tr key={employee.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800 text-xs">{employee.name}</p>
                    <p className="text-[11px] text-slate-500">{employee.id}</p>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {isAssigned ? (
                      shift.type === 'ca_dem' || employee.allowedShifts[0] === 'ca_dem' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 font-semibold text-purple-700 border border-purple-200/60">
                          <Moon size={12} className="text-purple-600" /> Ca đêm · 20:00–08:00
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 border border-blue-200/60">
                          <Sun size={12} className="text-amber-500" /> Ca ngày · 08:00–20:00
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {isAssigned ? shift.breakTime : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isAssigned
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : status === 'Nghỉ'
                          ? 'bg-slate-100 text-slate-500 border border-slate-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!employees.length && (
          <p className="px-5 py-8 text-center text-xs text-slate-500">Không có nhân viên trong nhóm này.</p>
        )}
      </div>
    </div>
  )
}

export default App
