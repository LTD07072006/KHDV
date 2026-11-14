import { useState } from 'react'
import DemoWorkspace from './App'
import { ScheduleV2Workspace } from './components/ScheduleV2Workspace'
import { Button } from './components/ui/button'

export function SchedulingApp() {
  const [showDemo, setShowDemo] = useState(false)
  return (
    <>
      <div hidden={showDemo}>
        <ScheduleV2Workspace onOpenDemo={() => setShowDemo(true)} />
      </div>
      {showDemo && (
        <div>
          <div className="roster-width roster-page-heading print:hidden">
            <p>Bản mô phỏng trong trình duyệt</p>
            <Button onClick={() => setShowDemo(false)}>Về xếp lịch tuần</Button>
          </div>
          <DemoWorkspace />
        </div>
      )}
    </>
  )
}
