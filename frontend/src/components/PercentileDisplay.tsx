import type { PercentileRankings } from '@/types'

interface Props {
  percentiles: PercentileRankings
}

interface PercentileItem {
  label: string
  value: number | null
  sublabel: string
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
  const items: PercentileItem[] = [
    { label: '院系排名', value: percentiles.dept_percentile, sublabel: '同院系同校导师中' },
    { label: '校内排名', value: percentiles.school_percentile, sublabel: '同校所有导师中' },
    { label: '省内排名', value: percentiles.province_percentile, sublabel: '同省所有导师中' },
    { label: '全国排名', value: percentiles.national_percentile, sublabel: '全国所有导师中' },
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
                  超过 {pct}%
                </div>
                <div className="text-xs text-gray-400 mb-2">{sublabel}</div>
                <PercentileBar value={value} />
              </>
            ) : (
              <div className="text-sm text-gray-400">数据不足</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
