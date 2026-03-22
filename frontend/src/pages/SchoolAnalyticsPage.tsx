import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { analyticsApi } from '@/services/api'
import type { SchoolAnalytics } from '@/types'

export default function SchoolAnalyticsPage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<SchoolAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    setLoading(true)
    analyticsApi
      .getSchool(code)
      .then((res) => setData(res.data))
      .catch(() => setError('加载失败，请稍后重试'))
      .finally(() => setLoading(false))
  }, [code])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-400">加载中…</div>
    )
  }
  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-red-500">
        {error ?? '院校不存在'}
      </div>
    )
  }

  const deptChartData = data.departments
    .filter((d) => d.avg_overall != null)
    .map((d) => ({
      name: d.department.length > 12 ? d.department.slice(0, 12) + '…' : d.department,
      fullName: d.department,
      评分: d.avg_overall,
      评价数: d.rating_count,
    }))

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <p className="text-xs text-gray-400 mb-1">院校数据分析</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{data.school_name}</h1>
        <p className="text-gray-500 text-sm">{data.province}</p>

        {data.school_percentile != null && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 text-sm px-3 py-1 rounded-full">
            <span>全国院校综合排名 · 超过 {Math.round(data.school_percentile * 100)}% 的院校</span>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '导师总数', value: data.total_supervisors },
          { label: '已评导师', value: data.rated_supervisors },
          { label: '评价总数', value: data.total_ratings },
          { label: '近30天评价', value: data.recent_ratings },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Overall score */}
      {data.avg_overall_score != null && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">综合评分</h2>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold text-teal-600">
              {data.avg_overall_score.toFixed(2)}
            </span>
            <span className="text-gray-400 mb-1">/ 5.00</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-5">
            {[
              { label: '学术水平', val: data.avg_sub_scores.avg_academic },
              { label: '学生培养', val: data.avg_sub_scores.avg_mentoring },
              { label: '身心健康', val: data.avg_sub_scores.avg_wellbeing },
              { label: '生活补助', val: data.avg_sub_scores.avg_stipend },
              { label: '科研资源', val: data.avg_sub_scores.avg_resources },
              { label: '学术道德', val: data.avg_sub_scores.avg_ethics },
            ].map(({ label, val }) => (
              <div key={label} className="text-center bg-gray-50 rounded-xl p-3">
                <div className="text-lg font-semibold text-gray-800">
                  {val != null ? val.toFixed(1) : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department comparison */}
      {deptChartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">院系评分对比</h2>
          <ResponsiveContainer width="100%" height={Math.max(200, deptChartData.length * 36)}>
            <BarChart
              data={deptChartData}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis
                type="number"
                domain={[0, 5]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v.toFixed(1)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number) => [value.toFixed(2), '平均评分']}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="评分" fill="#0d9488" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top supervisors */}
      {data.top_supervisors.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">顶尖导师</h2>
          <div className="space-y-3">
            {data.top_supervisors.map((s, i) => (
              <Link
                key={s.supervisor_id}
                to={`/supervisor/${s.supervisor_id}`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900 group-hover:text-teal-700 transition-colors">
                      {s.supervisor_name}
                    </div>
                    <div className="text-xs text-gray-500">{s.department}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-teal-600">{s.avg_score.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">{s.rating_count} 条评价</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
