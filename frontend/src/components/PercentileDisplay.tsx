import type { PercentileRankings } from '@/types'
import { useI18n } from '@/i18n'

interface Props {
  percentiles: PercentileRankings
}

function colorClass(pct: number): string {
  if (pct >= 0.75) return 'text-green-600'
  if (pct >= 0.25) return 'text-yellow-600'
  return 'text-red-500'
}

function barColor(pct: number): string {
  if (pct >= 0.75) return '#22c55e'
  if (pct >= 0.25) return '#eab308'
  return '#ef4444'
}

function PercentileBar({ value }: { value: number | null }) {
  if (value == null) {
    return <div className="h-2 bg-gray-100 rounded-full" />
  }
  const pct = Math.round(value * 100)
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: barColor(value) }}
      />
    </div>
  )
}

export default function PercentileDisplay({ percentiles }: Props) {
  const { t } = useI18n()
  const p = t.components.percentile

  const items = [
    { label: p.dept_rank, value: percentiles.dept_percentile, sublabel: p.dept_rank_sub },
    { label: p.school_rank, value: percentiles.school_percentile, sublabel: p.school_rank_sub },
    { label: p.province_rank, value: percentiles.province_percentile, sublabel: p.province_rank_sub },
    { label: p.national_rank, value: percentiles.national_percentile, sublabel: p.national_rank_sub },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {items.map(({ label, value, sublabel }) => {
        const pct = value != null ? Math.round(value * 100) : null
        return (
          <div key={label} className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            {pct != null ? (
              <>
                <div className={`text-lg font-bold ${colorClass(value!)}`}>
                  {p.beats(pct)}
                </div>
                <div className="text-xs text-gray-400 mb-2">{sublabel}</div>
                <PercentileBar value={value} />
              </>
            ) : (
              <div className="text-sm text-gray-400">{p.insufficient}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
