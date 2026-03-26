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

interface Props {
  scores: ScoreBreakdown
  schoolAvg?: ScoreBreakdown
  nationalAvg?: ScoreBreakdown
}

const LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'avg_academic', label: '学术水平' },
  { key: 'avg_mentoring', label: '学生培养' },
  { key: 'avg_wellbeing', label: '身心健康' },
  { key: 'avg_resources', label: '科研资源' },
  { key: 'avg_stipend', label: '生活补助' },
  { key: 'avg_ethics', label: '学术道德' },
]

function buildData(
  scores: ScoreBreakdown,
  schoolAvg?: ScoreBreakdown,
  nationalAvg?: ScoreBreakdown,
) {
  return LABELS.map(({ key, label }) => ({
    subject: label,
    该导师: scores[key] ?? 0,
    校均值: schoolAvg?.[key] ?? 0,
    全国均值: nationalAvg?.[key] ?? 0,
  }))
}

export default function RadarChart({ scores, schoolAvg, nationalAvg }: Props) {
  const hasData = LABELS.some(({ key }) => scores[key] != null)

  if (!hasData) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        暂无足够评分数据
      </div>
    )
  }

  const data = buildData(scores, schoolAvg, nationalAvg)

  return (
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
          name="该导师"
          dataKey="该导师"
          stroke="#0d9488"
          fill="#0d9488"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        {schoolAvg && (
          <Radar
            name="校均值"
            dataKey="校均值"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.15}
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}
        {nationalAvg && (
          <Radar
            name="全国均值"
            dataKey="全国均值"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.1}
            strokeWidth={1.5}
            strokeDasharray="2 3"
          />
        )}
        <Legend
          iconType="line"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  )
}
