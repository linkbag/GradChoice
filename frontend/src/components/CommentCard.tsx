import { useState, useEffect } from 'react'
import { commentsApi } from '@/services/api'
import type { Comment } from '@/types'
import CommentForm from './CommentForm'
import FlagModal from './FlagModal'

interface Props {
  comment: Comment
  currentUserId?: string | null
  supervisorId: string
  depth?: number
  onUpdated: (updated: Comment) => void
  onDeleted: (commentId: string) => void
  onReplyAdded: (reply: Comment, parentId: string) => void
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 30) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN')
}

export default function CommentCard({
  comment,
  currentUserId,
  supervisorId,
  depth = 0,
  onUpdated,
  onDeleted,
  onReplyAdded,
}: Props) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)

  // Keep edit buffer in sync with the latest comment content when not actively editing
  useEffect(() => {
    if (!editing) {
      setEditContent(comment.content)
    }
  }, [comment.content, editing])
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [voteLoading, setVoteLoading] = useState(false)

  const isOwn = currentUserId != null && comment.author?.id === currentUserId
  const isDeleted = comment.is_deleted
  const isHidden = comment.is_deleted || comment.is_flagged
  // Edit window: check if created within 24h (client-side approximation)
  const createdAt = new Date(comment.created_at)
  const canEdit = isOwn && !isHidden && Date.now() - createdAt.getTime() < 24 * 60 * 60 * 1000

  async function handleVote(type: 'up' | 'down') {
    if (!currentUserId) return
    setVoteLoading(true)
    try {
      await commentsApi.vote(comment.id, type)
      // Optimistic update — toggle logic
      const alreadySame = comment.user_vote === type
      const updated: Comment = {
        ...comment,
        user_vote: alreadySame ? null : type,
        likes_count:
          type === 'up'
            ? alreadySame
              ? comment.likes_count - 1
              : comment.likes_count + 1
            : comment.user_vote === 'up'
              ? comment.likes_count - 1
              : comment.likes_count,
        dislikes_count:
          type === 'down'
            ? alreadySame
              ? comment.dislikes_count - 1
              : comment.dislikes_count + 1
            : comment.user_vote === 'down'
              ? comment.dislikes_count - 1
              : comment.dislikes_count,
      }
      onUpdated(updated)
    } catch {
      // ignore
    } finally {
      setVoteLoading(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('确认删除该评论？删除后内容将不可恢复。')) return
    try {
      await commentsApi.delete(comment.id)
      onDeleted(comment.id)
    } catch {
      // ignore
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = editContent.trim()
    if (!trimmed) return
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await commentsApi.update(comment.id, trimmed)
      setEditing(false)
      onUpdated(res.data)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '编辑失败，请稍后再试'
      setEditError(msg)
    } finally {
      setEditLoading(false)
    }
  }

  function handleReplyAdded(reply: Comment) {
    setShowReplyForm(false)
    onReplyAdded(reply, comment.id)
  }

  const authorName = comment.author?.display_name ?? '匿名用户'

  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-gray-100' : ''}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
        {isHidden ? (
          <p className="text-gray-400 text-sm italic">
            {isDeleted ? '(该评论已删除)' : '(该评论因违规已被隐藏)'}
          </p>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{authorName}</span>
                {comment.author?.is_student_verified && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">
                    已认证
                  </span>
                )}
                {comment.is_edited && (
                  <span className="text-xs text-gray-400">(已编辑)</span>
                )}
              </div>
              <span className="text-xs text-gray-400">{formatRelativeTime(comment.created_at)}</span>
            </div>

            {/* Content or edit form */}
            {editing ? (
              <form onSubmit={handleEditSubmit} className="space-y-2 mb-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  maxLength={5000}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
                {editError && <p className="text-xs text-red-500">{editError}</p>}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { setEditing(false); setEditContent(comment.content) }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                    disabled={editLoading}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading || !editContent.trim()}
                    className="px-3 py-1 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    {editLoading ? '保存中…' : '保存'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mb-3">
                {comment.content}
              </p>
            )}

            {/* Actions */}
            {!editing && (
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {/* Like */}
                <button
                  onClick={() => handleVote('up')}
                  disabled={voteLoading || isOwn || !currentUserId}
                  className={`flex items-center gap-1 transition-colors disabled:cursor-default ${
                    comment.user_vote === 'up'
                      ? 'text-brand-600'
                      : 'hover:text-brand-600'
                  }`}
                  title={isOwn ? '不能给自己投票' : ''}
                >
                  <span>👍</span>
                  <span>{comment.likes_count}</span>
                </button>

                {/* Dislike */}
                <button
                  onClick={() => handleVote('down')}
                  disabled={voteLoading || isOwn || !currentUserId}
                  className={`flex items-center gap-1 transition-colors disabled:cursor-default ${
                    comment.user_vote === 'down'
                      ? 'text-red-500'
                      : 'hover:text-red-500'
                  }`}
                  title={isOwn ? '不能给自己投票' : ''}
                >
                  <span>👎</span>
                  <span>{comment.dislikes_count}</span>
                </button>

                {/* Reply — only top-level or first-level replies */}
                {depth < 1 && currentUserId && (
                  <button
                    onClick={() => setShowReplyForm((v) => !v)}
                    className="hover:text-brand-600 transition-colors"
                  >
                    {showReplyForm ? '收起' : '回复'}
                  </button>
                )}

                {/* Edit */}
                {canEdit && (
                  <button
                    onClick={() => setEditing(true)}
                    className="hover:text-brand-600 transition-colors"
                  >
                    编辑
                  </button>
                )}

                {/* Delete */}
                {isOwn && (
                  <button
                    onClick={handleDelete}
                    className="hover:text-red-500 transition-colors"
                  >
                    删除
                  </button>
                )}

                {/* Flag */}
                {!isOwn && currentUserId && (
                  <button
                    onClick={() => setShowFlagModal(true)}
                    className="hover:text-orange-500 transition-colors ml-auto"
                  >
                    举报
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Reply form */}
      {showReplyForm && !isHidden && (
        <div className="ml-6 mb-3">
          <CommentForm
            supervisorId={supervisorId}
            parentComment={comment}
            onSubmitted={handleReplyAdded}
            onCancel={() => setShowReplyForm(false)}
          />
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              supervisorId={supervisorId}
              depth={depth + 1}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              onReplyAdded={onReplyAdded}
            />
          ))}
        </div>
      )}

      {/* Flag modal */}
      {showFlagModal && (
        <FlagModal commentId={comment.id} onClose={() => setShowFlagModal(false)} />
      )}
    </div>
  )
}
