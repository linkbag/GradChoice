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
import { useI18n } from '@/i18n'
import type { SchoolAnalytics } from '@/types'

export default function SchoolAnalyticsPage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<SchoolAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { t } = useI18n()

  useEffect(() => {
    if (!code) return
    setLoading(true)
    analyticsApi
      .getSchool(code)
      .then((res) => setData(res.data))
      .catch(() => setError(t.school_analytics.load_error))
      .finally(() => setLoading(false))
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-400">{t.school_analytics.loading}</div>
    )
  }
  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-red-500">
        {error ?? t.school_analytics.not_found}
      </div>
    )
  }

  const deptChartData = data.departments
    .filter((d) => d.avg_overall != null)
    .map((d) => ({
      name: d.department.length > 12 ? d.department.slice(0, 12) + '…' : d.department,
      fullName: d.department,
      score: d.avg_overall,
    }))

  const subScoreRows = [
    { label: t.school_analytics.sub_academic, val: data.avg_sub_scores.avg_academic },
    { label: t.school_analytics.sub_mentoring, val: data.avg_sub_scores.avg_mentoring },
    { label: t.school_analytics.sub_wellbeing, val: data.avg_sub_scores.avg_wellbeing },
    { label: t.school_analytics.sub_stipend, val: data.avg_sub_scores.avg_stipend },
    { label: t.school_analytics.sub_resources, val: data.avg_sub_scores.avg_resources },
    { label: t.school_analytics.sub_ethics, val: data.avg_sub_scores.avg_ethics },
  ]

  const statCards = [
    { label: t.school_analytics.stat_total_supervisors, value: data.total_supervisors },
    { label: t.school_analytics.stat_rated_supervisors, value: data.rated_supervisors },
    { label: t.school_analytics.stat_total_ratings, value: data.total_ratings },
    { label: t.school_analytics.stat_recent_ratings, value: data.recent_ratings },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <p className="text-xs text-gray-400 mb-1">{t.school_analytics.breadcrumb}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{data.school_name}</h1>
        <p className="text-gray-500 text-sm">{data.province}</p>

        {data.school_percentile != null && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 text-sm px-3 py-1 rounded-full">
            <span>{t.school_analytics.school_percentile(Math.round(data.school_percentile * 100))}</span>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Overall score */}
      {data.avg_overall_score != null && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">{t.school_analytics.overall_score_title}</h2>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold text-teal-600">
              {data.avg_overall_score.toFixed(2)}
            </span>
            <span className="text-gray-400 mb-1">/ 5.00</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-5">
            {subScoreRows.map(({ label, val }) => (
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
          <h2 className="font-bold text-gray-800 mb-4">{t.school_analytics.dept_chart_title}</h2>
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
                formatter={(value: number) => [value.toFixed(2), t.school_analytics.avg_score_label]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="score" fill="#0d9488" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top supervisors */}
      {data.top_supervisors.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">{t.school_analytics.top_supervisors_title}</h2>
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
                  <div className="text-xs text-gray-400">{t.school_analytics.rating_count(s.rating_count)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
