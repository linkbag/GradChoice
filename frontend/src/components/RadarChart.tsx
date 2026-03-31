import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { ScoreBreakdown } from '@/types'
import { useI18n } from '@/i18n'

interface Props {
  scores: ScoreBreakdown
  schoolAvg?: ScoreBreakdown
  avgFirstYearIncome?: number | null
}

type DimKey = keyof ScoreBreakdown

function buildData(
  labels: { key: DimKey; label: string }[],
  scores: ScoreBreakdown,
  schoolAvg?: ScoreBreakdown,
) {
  return labels.map(({ key, label }) => ({
    subject: label,
    supervisor: scores[key] ?? 0,
    school_avg: schoolAvg?.[key] ?? 0,
  }))
}

export default function RadarChart({ scores, schoolAvg, avgFirstYearIncome }: Props) {
  const { t } = useI18n()
  const r = t.components.radar

  const LABELS: { key: DimKey; label: string; desc: string }[] = [
    { key: 'avg_academic', label: r.dim_academic_label, desc: r.dim_academic_desc },
    { key: 'avg_mentoring', label: r.dim_mentoring_label, desc: r.dim_mentoring_desc },
    { key: 'avg_wellbeing', label: r.dim_wellbeing_label, desc: r.dim_wellbeing_desc },
    { key: 'avg_resources', label: r.dim_resources_label, desc: r.dim_resources_desc },
    { key: 'avg_stipend', label: r.dim_stipend_label, desc: r.dim_stipend_desc },
    { key: 'avg_ethics', label: r.dim_ethics_label, desc: r.dim_ethics_desc },
  ]

  const hasData = LABELS.some(({ key }) => scores[key] != null)

  if (!hasData) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        {r.no_data}
      </div>
    )
  }

  const data = buildData(LABELS, scores, schoolAvg)

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
      <div className="w-full sm:w-1/2 min-w-[260px]">
        <ResponsiveContainer width="100%" height={280}>
          <RechartsRadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 12, fill: '#374151', fontFamily: 'inherit' }}
            />
            <Tooltip
              formatter={(value: number) => value.toFixed(2)}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Radar
              name={r.this_supervisor}
              dataKey="supervisor"
              stroke="#0d9488"
              fill="#0d9488"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            {schoolAvg && (
              <Radar
                name={r.school_avg}
                dataKey="school_avg"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.15}
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            )}
            <Legend
              iconType="line"
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full sm:w-1/2 flex flex-col justify-center gap-2 self-center">
        {LABELS.map(({ label, desc }) => (
          <div key={label} className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{label}</span>
            <span className="mx-1">—</span>
            {desc}
          </div>
        ))}
        <div className="mt-3 pt-3 border-t border-gray-100">
          {avgFirstYearIncome != null ? (
            <p className="text-base font-semibold text-gray-800">
              {r.income(avgFirstYearIncome.toLocaleString('zh-CN'))}
            </p>
          ) : (
            <p className="text-base font-semibold text-gray-400">
              {r.income_no_data}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
