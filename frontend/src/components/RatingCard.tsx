import { useState } from 'react'
import type { Rating, VoteType } from '@/types'
import { ratingsApi } from '@/services/api'
import { zh } from '@/i18n/zh'

const SUB_SCORE_LABELS: Record<string, string> = {
  score_academic: zh.supervisor.score_labels.academic,
  score_mentoring: zh.supervisor.score_labels.mentoring,
  score_wellbeing: zh.supervisor.score_labels.wellbeing,
  score_stipend: zh.supervisor.score_labels.stipend,
  score_resources: zh.supervisor.score_labels.resources,
  score_ethics: zh.supervisor.score_labels.ethics,
}

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}个月前`
  return `${Math.floor(months / 12)}年前`
}

function StarDisplay({ score }: { score: number }) {
  const filled = Math.round(score * 2) / 2 // round to nearest 0.5
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => {
        const full = filled >= s
        const half = !full && filled >= s - 0.5
        return (
          <svg key={s} viewBox="0 0 24 24" className="w-4 h-4">
            <defs>
              <linearGradient id={`sr-${s}-${score}`}>
                <stop offset="50%" stopColor={half ? '#FBBF24' : full ? '#FBBF24' : '#D1D5DB'} />
                <stop offset="50%" stopColor={full ? '#FBBF24' : '#D1D5DB'} />
              </linearGradient>
            </defs>
            <path
              fill={`url(#sr-${s}-${score})`}
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        )
      })}
      <span className="ml-1 text-sm font-medium text-amber-600">{score.toFixed(1)}</span>
    </span>
  )
}

interface RatingCardProps {
  rating: Rating
  currentUserId?: string | null
  onEdit?: (rating: Rating) => void
  onDelete?: (ratingId: string) => void
  onVoteChange?: (ratingId: string, newUpvotes: number, newDownvotes: number, userVote: VoteType | null) => void
}

export default function RatingCard({
  rating,
  currentUserId,
  onEdit,
  onDelete,
  onVoteChange,
}: RatingCardProps) {
  const [upvotes, setUpvotes] = useState(rating.upvotes)
  const [downvotes, setDownvotes] = useState(rating.downvotes)
  const [userVote, setUserVote] = useState<VoteType | null>(rating.user_vote)
  const [voting, setVoting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isOwner = currentUserId === rating.user_id

  const handleVote = async (type: VoteType) => {
    if (isOwner || voting) return
    setVoting(true)
    try {
      await ratingsApi.vote(rating.id, type)
      // Optimistic update
      let newUp = upvotes
      let newDown = downvotes
      let newVote: VoteType | null = type

      if (userVote === type) {
        // Toggle off
        newVote = null
        if (type === 'up') newUp--
        else newDown--
      } else {
        if (userVote === 'up') newUp--
        else if (userVote === 'down') newDown--
        if (type === 'up') newUp++
        else newDown++
      }
      setUpvotes(newUp)
      setDownvotes(newDown)
      setUserVote(newVote)
      onVoteChange?.(rating.id, newUp, newDown, newVote)
    } catch {
      // ignore vote errors silently
    } finally {
      setVoting(false)
    }
  }

  const handleDelete = async () => {
    try {
      await ratingsApi.delete(rating.id)
      onDelete?.(rating.id)
    } catch {
      setConfirmDelete(false)
    }
  }

  const subScoreEntries = Object.entries(SUB_SCORE_LABELS)
    .map(([key, label]) => ({ key, label, value: (rating as Record<string, unknown>)[key] as number | null }))
    .filter(({ value }) => value !== null)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">
              {rating.display_name}
            </span>
            {rating.is_verified_rating && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                {zh.supervisor.verified_badge}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{relativeTime(rating.created_at)}</p>
        </div>
        <StarDisplay score={rating.overall_score} />
      </div>

      {/* Sub-scores */}
      {subScoreEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {subScoreEntries.map(({ key, label, value }) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-gray-500 truncate">{label}</span>
              <span className="text-amber-600 font-medium ml-1">{(value as number).toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: votes + actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-3">
          {!isOwner && (
            <>
              <button
                type="button"
                onClick={() => handleVote('up')}
                disabled={voting}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                  userVote === 'up'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span>👍</span>
                <span>有用 {upvotes > 0 ? `(${upvotes})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => handleVote('down')}
                disabled={voting}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                  userVote === 'down'
                    ? 'bg-red-100 text-red-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span>👎</span>
                <span>无用 {downvotes > 0 ? `(${downvotes})` : ''}</span>
              </button>
            </>
          )}
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(rating)}
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                编辑
              </button>
            )}
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                删除
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600">确认删除？</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-xs text-red-600 font-medium hover:text-red-800"
                >
                  确认
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
