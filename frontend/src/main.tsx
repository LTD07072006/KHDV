import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SchedulingApp } from './SchedulingApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SchedulingApp />
  </StrictMode>,
)
