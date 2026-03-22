import { useState, useEffect, useCallback } from 'react'
import { commentsApi } from '@/services/api'
import type { Comment } from '@/types'
import CommentCard from './CommentCard'
import CommentForm from './CommentForm'

type SortOption = 'newest' | 'oldest' | 'most_liked' | 'most_discussed'

const SORT_LABELS: Record<SortOption, string> = {
  newest: '最新',
  oldest: '最早',
  most_liked: '最热',
  most_discussed: '最多讨论',
}

interface Props {
  supervisorId: string
  currentUserId?: string | null
}

export default function CommentList({ supervisorId, currentUserId }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortOption>('newest')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const PAGE_SIZE = 20

  const fetchComments = useCallback(
    async (pageNum: number, sortOpt: SortOption, append = false) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await commentsApi.getBySupervisor(supervisorId, {
          page: pageNum,
          page_size: PAGE_SIZE,
          sort: sortOpt,
        })
        const data = res.data
        setTotal(data.total)
        setHasMore(pageNum * PAGE_SIZE < data.total)
        if (append) {
          setComments((prev) => [...prev, ...data.items])
        } else {
          setComments(data.items)
        }
      } finally {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    },
    [supervisorId],
  )

  useEffect(() => {
    setPage(1)
    fetchComments(1, sort)
  }, [sort, fetchComments])

  function handleSortChange(newSort: SortOption) {
    if (newSort === sort) return
    setSort(newSort)
  }

  function handleLoadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    fetchComments(nextPage, sort, true)
  }

  function handleCommentAdded(comment: Comment) {
    setComments((prev) => [comment, ...prev])
    setTotal((t) => t + 1)
    setShowForm(false)
  }

  function handleUpdated(updated: Comment) {
    setComments((prev) => updateCommentInTree(prev, updated))
  }

  function handleDeleted(commentId: string) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, is_deleted: true, content: '(该评论已删除)' }
          : { ...c, replies: (c.replies ?? []).map((r) => r.id === commentId ? { ...r, is_deleted: true, content: '(该评论已删除)' } : r) },
      ),
    )
  }

  function handleReplyAdded(reply: Comment, parentId: string) {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === parentId) {
          return {
            ...c,
            reply_count: c.reply_count + 1,
            replies: [...(c.replies ?? []), reply],
          }
        }
        return c
      }),
    )
    setTotal((t) => t + 1)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-800">
          学生评论{total > 0 && <span className="ml-1 text-gray-400 font-normal text-sm">({total})</span>}
        </h2>
        {currentUserId ? (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition-colors"
          >
            {showForm ? '收起' : '写评论'}
          </button>
        ) : (
          <a
            href="/login"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition-colors"
          >
            登录后评论
          </a>
        )}
      </div>

      {/* Comment form */}
      {showForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <CommentForm
            supervisorId={supervisorId}
            onSubmitted={handleCommentAdded}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Sort controls */}
      <div className="flex gap-1 mb-4">
        {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
          <button
            key={opt}
            onClick={() => handleSortChange(opt)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              sort === opt
                ? 'bg-brand-600 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {SORT_LABELS[opt]}
          </button>
        ))}
      </div>

      {/* Comment list */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">加载中…</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          暂无评论，来分享您的看法吧！
        </div>
      ) : (
        <div className="space-y-0">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              supervisorId={supervisorId}
              depth={0}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              onReplyAdded={handleReplyAdded}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="text-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loadingMore ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  )
}

// Helper: update a comment (or nested reply) anywhere in the tree
function updateCommentInTree(comments: Comment[], updated: Comment): Comment[] {
  return comments.map((c) => {
    if (c.id === updated.id) return updated
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: updateCommentInTree(c.replies, updated) }
    }
    return c
  })
}
