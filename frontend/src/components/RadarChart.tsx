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

const LABELS: { key: keyof ScoreBreakdown; label: string; desc: string }[] = [
  { key: 'avg_academic', label: '学术水平', desc: '导师的科研能力、学术影响力与专业深度' },
  { key: 'avg_mentoring', label: '学生培养', desc: '对学生的指导投入、培养质量与成长关注' },
  { key: 'avg_wellbeing', label: '身心健康', desc: '学生的身体健康和精神压力水平' },
  { key: 'avg_resources', label: '科研资源', desc: '实验条件、经费充裕度与平台资源' },
  { key: 'avg_stipend', label: '生活补助', desc: '补助津贴水平、发放及时性与生活保障' },
  { key: 'avg_ethics', label: '学术道德', desc: '学术诚信、署名公正与师德规范' },
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
      </div>
      <div className="w-full sm:w-1/2 flex flex-col justify-center gap-2 self-center">
        {LABELS.map(({ label, desc }) => (
          <div key={label} className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{label}</span>
            <span className="mx-1">—</span>
            {desc}
          </div>
        ))}
      </div>
    </div>
  )
}
