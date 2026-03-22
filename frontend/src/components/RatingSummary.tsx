import { useState } from 'react'
import type { SupervisorRatingCache } from '@/types'
import { zh } from '@/i18n/zh'

const SCORE_KEYS: Array<{
  allKey: keyof SupervisorRatingCache
  verifiedKey: keyof SupervisorRatingCache
  label: string
}> = [
  { allKey: 'all_avg_academic', verifiedKey: 'verified_avg_academic', label: zh.supervisor.score_labels.academic },
  { allKey: 'all_avg_mentoring', verifiedKey: 'verified_avg_mentoring', label: zh.supervisor.score_labels.mentoring },
  { allKey: 'all_avg_wellbeing', verifiedKey: 'verified_avg_wellbeing', label: zh.supervisor.score_labels.wellbeing },
  { allKey: 'all_avg_stipend', verifiedKey: 'verified_avg_stipend', label: zh.supervisor.score_labels.stipend },
  { allKey: 'all_avg_resources', verifiedKey: 'verified_avg_resources', label: zh.supervisor.score_labels.resources },
  { allKey: 'all_avg_ethics', verifiedKey: 'verified_avg_ethics', label: zh.supervisor.score_labels.ethics },
]

function ScoreBar({ value, max = 5 }: { value: number | null; max?: number }) {
  const pct = value !== null ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 bg-amber-400 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 w-8 text-right">
        {value !== null ? value.toFixed(1) : '—'}
      </span>
    </div>
  )
}

interface RatingSummaryProps {
  cache: SupervisorRatingCache
}

export default function RatingSummary({ cache }: RatingSummaryProps) {
  const [showVerified, setShowVerified] = useState(false)

  const overallScore = showVerified ? cache.verified_avg_overall : cache.all_avg_overall
  const count = showVerified ? cache.verified_count : cache.all_count

  const distributions = [
    { star: 5, count: cache.distribution_5 },
    { star: 4, count: cache.distribution_4 },
    { star: 3, count: cache.distribution_3 },
    { star: 2, count: cache.distribution_2 },
    { star: 1, count: cache.distribution_1 },
  ]
  const maxDist = Math.max(...distributions.map((d) => d.count), 1)

  return (
    <div className="space-y-5">
      {/* Overall score + toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-end gap-3">
          <span className="text-5xl font-bold text-gray-900">
            {overallScore !== null ? overallScore.toFixed(1) : '—'}
          </span>
          <div className="pb-1">
            <div className="text-amber-400 text-xl">★★★★★</div>
            <p className="text-xs text-gray-500">{zh.supervisor.rating_count(count)}</p>
          </div>
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setShowVerified(false)}
            className={`px-3 py-1.5 transition-colors ${
              !showVerified ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            全部评价
          </button>
          <button
            type="button"
            onClick={() => setShowVerified(true)}
            className={`px-3 py-1.5 transition-colors ${
              showVerified ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            已验证评价 {cache.verified_count > 0 && `(${cache.verified_count})`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Score distribution */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">评分分布</h3>
          <div className="space-y-1.5">
            {distributions.map(({ star, count: c }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-4 text-right">{star}</span>
                <span className="text-amber-400 text-xs">★</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${(c / maxDist) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-6 text-right">{c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-score breakdown */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">各维度评分</h3>
          <div className="space-y-2">
            {SCORE_KEYS.map(({ allKey, verifiedKey, label }) => {
              const val = (showVerified ? cache[verifiedKey] : cache[allKey]) as number | null
              return (
                <div key={allKey}>
                  <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                    <span>{label}</span>
                  </div>
                  <ScoreBar value={val} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
