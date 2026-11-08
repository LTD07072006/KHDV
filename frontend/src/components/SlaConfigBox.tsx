type Props = {
  serviceTarget: number
  answerWithinSeconds: number
  onChange: (serviceTarget: number, answerWithinSeconds: number) => void
  disabled?: boolean
}

const presets = [
  { value: '0.8:20', label: '80% / 20 s' },
  { value: '0.9:20', label: '90% / 20 s' },
]

export function SlaConfigBox({ serviceTarget, answerWithinSeconds, onChange, disabled }: Props) {
  const current = `${serviceTarget}:${answerWithinSeconds}`

  return (
    <label className="roster-field" htmlFor="service-target">
      <span>Mục tiêu SLA</span>
      <select
        id="service-target"
        value={current}
        onChange={(event) => {
          const [target, seconds] = event.target.value.split(':').map(Number)
          onChange(target, seconds)
        }}
        disabled={disabled}
      >
        {presets.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        {!presets.some(({ value }) => value === current) && (
          <option value={current}>{Math.round(serviceTarget * 100)}% trong {answerWithinSeconds} giây</option>
        )}
      </select>
    </label>
  )
}
