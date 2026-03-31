import { useI18n } from '@/i18n'

interface Props {
  distribution: Record<string, number>
}

const STAR_COLORS: Record<string, string> = {
  '5': '#22c55e',
  '4': '#84cc16',
  '3': '#eab308',
  '2': '#f97316',
  '1': '#ef4444',
}

export default function DistributionChart({ distribution }: Props) {
  const { t } = useI18n()
  const d = t.components.distribution

  const STAR_LABELS: Record<string, string> = {
    '5': d.star_5,
    '4': d.star_4,
    '3': d.star_3,
    '2': d.star_2,
    '1': d.star_1,
  }

  const total = Object.values(distribution).reduce((sum, v) => sum + v, 0)

  if (total === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-4">{d.no_data}</div>
    )
  }

  return (
    <div className="space-y-2">
      {['5', '4', '3', '2', '1'].map((star) => {
        const count = distribution[star] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const color = STAR_COLORS[star]

        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-8 shrink-0">{STAR_LABELS[star]}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs text-gray-600 w-14 text-right shrink-0">
              {count} ({pct}%)
            </span>
          </div>
        )
      })}
      <p className="text-xs text-gray-400 text-right pt-1">{d.total(total)}</p>
    </div>
  )
}
