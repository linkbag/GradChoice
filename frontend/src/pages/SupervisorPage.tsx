import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { zh } from '@/i18n/zh'
import { supervisorsApi, analyticsApi } from '@/services/api'
import type { Supervisor, SupervisorAnalytics, ScoreBreakdown } from '@/types'
import RadarChart from '@/components/RadarChart'
import DistributionChart from '@/components/DistributionChart'
import PercentileDisplay from '@/components/PercentileDisplay'

const KEY_TO_SCORE_FIELD: Record<string, keyof ScoreBreakdown> = {
  academic: 'avg_academic',
  mentoring: 'avg_mentoring',
  wellbeing: 'avg_wellbeing',
  stipend: 'avg_stipend',
  resources: 'avg_resources',
  ethics: 'avg_ethics',
}

function scoreForKey(scores: ScoreBreakdown, key: string): string {
  const field = KEY_TO_SCORE_FIELD[key]
  if (!field) return '—'
  const val = scores[field]
  return val != null ? Number(val).toFixed(1) : '—'
}

export default function SupervisorPage() {
  const { id } = useParams<{ id: string }>()
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null)
  const [analytics, setAnalytics] = useState<SupervisorAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    // Fetch supervisor info and analytics in parallel; analytics may 404 for new supervisors
    Promise.allSettled([
      supervisorsApi.get(id),
      analyticsApi.getSupervisor(id),
    ]).then(([supResult, analyticsResult]) => {
      if (supResult.status === 'fulfilled') setSupervisor(supResult.value.data)
      if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value.data)
    }).finally(() => setLoading(false))
  }, [id])

  const scores = analytics?.scores
  const hasScores = scores != null && scores.total_ratings > 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Supervisor info header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
        <p className="text-xs text-gray-400 mb-2">导师主页</p>
        {loading ? (
          <h1 className="text-2xl font-bold text-gray-400">加载中…</h1>
        ) : supervisor ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{supervisor.name}</h1>
            <p className="text-gray-600">
              {supervisor.school_name} · {supervisor.department}
            </p>
            {supervisor.title && (
              <p className="text-sm text-gray-400 mt-1">{supervisor.title}</p>
            )}
            <Link
              to={`/school/${supervisor.school_code}/analytics`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
            >
              查看院校数据 →
            </Link>
          </>
        ) : (
          <h1 className="text-xl text-red-500">导师不存在</h1>
        )}
      </div>

      {/* Analytics section */}
      {!loading && (
        <>
          {/* Score overview + radar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">评分概览</h2>
              {hasScores && (
                <span className="text-xs text-gray-400">
                  {scores!.total_ratings} 条评价（{scores!.verified_ratings} 条认证）
                </span>
              )}
            </div>

            {hasScores ? (
              <>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-5xl font-bold text-teal-600">
                    {scores!.avg_overall?.toFixed(2)}
                  </span>
                  <span className="text-gray-400 mb-1">/ 5.00</span>
                  <span className="text-sm text-gray-400 mb-1 ml-2">综合评分</span>
                </div>

                <RadarChart
                  scores={scores!}
                  schoolAvg={analytics!.school_avg_scores}
                  nationalAvg={analytics!.national_avg_scores}
                />

                <div className="grid grid-cols-3 gap-3 mt-6">
                  {Object.entries(zh.supervisor.score_labels).map(([key, label]) =>
                    key !== 'overall' ? (
                      <div key={key} className="text-center bg-gray-50 rounded-xl p-3">
                        <div className="text-xl font-bold text-gray-800">
                          {scoreForKey(scores!, key)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                      </div>
                    ) : null,
                  )}
                </div>

                {analytics!.school_avg_scores.avg_overall != null && (
                  <div className="mt-4 text-xs text-gray-400 text-center">
                    与校均值对比 · 校均 {analytics!.school_avg_scores.avg_overall.toFixed(2)} ·
                    全国均 {analytics!.national_avg_scores.avg_overall?.toFixed(2) ?? '—'}
                  </div>
                )}
              </>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2">
                <span className="text-3xl">📊</span>
                <span>新导师，暂无足够评价数据</span>
              </div>
            )}
          </div>

          {/* Percentile rankings */}
          {analytics?.percentiles && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
              <h2 className="font-bold text-gray-800 mb-4">百分位排名</h2>
              <PercentileDisplay percentiles={analytics.percentiles} />
              <p className="text-xs text-gray-400 mt-3 text-center">
                * 超过 X% 的导师 = 该导师评分高于 X% 的同类导师（至少 3 条评价才计入排名）
              </p>
            </div>
          )}

          {/* Score distribution */}
          {analytics && hasScores && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
              <h2 className="font-bold text-gray-800 mb-4">评分分布</h2>
              <DistributionChart distribution={analytics.score_distribution} />
            </div>
          )}
        </>
      )}

      {/* Ratings & Comments */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-800">学生评价</h2>
          <button className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 transition-colors">
            {zh.supervisor.write_review}
          </button>
        </div>
        <p className="text-gray-400 text-center py-8">{zh.supervisor.no_ratings}</p>
      </div>
    </div>
  )
}
