import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { chatsApi } from '@/services/api'
import type { Chat, ChatMessage } from '@/types'

interface ChatRoomProps {
  chatId: string
  onMessageSent?: () => void
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  if (isToday) return '今天'
  const isYesterday =
    date.getDate() === now.getDate() - 1 &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  if (isYesterday) return '昨天'
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

/** Returns true if two messages are far enough apart in time to show a separator (1 hour). */
function shouldShowSeparator(prev: ChatMessage, curr: ChatMessage): boolean {
  const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()
  return diff > 60 * 60 * 1000
}

export default function ChatRoom({ chatId, onMessageSent }: ChatRoomProps) {
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Get current user id from JWT payload
  const getCurrentUserId = (): string | null => {
    const token = localStorage.getItem('access_token')
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub ?? null
    } catch {
      return null
    }
  }

  const currentUserId = getCurrentUserId()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const fetchChatDetails = useCallback(async () => {
    try {
      const res = await chatsApi.get(chatId)
      setChat(res.data)
    } catch {
      setError('加载会话失败')
    }
  }, [chatId])

  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true)
    try {
      const res = await chatsApi.getMessages(chatId, { page_size: 50 })
      setMessages(res.data.items)
      setHasMore(res.data.has_more)
    } catch {
      setError('加载消息失败')
    } finally {
      setLoadingMessages(false)
    }
  }, [chatId])

  const loadOlderMessages = async () => {
    if (!messages.length || loadingMore) return
    setLoadingMore(true)
    try {
      const oldest = messages[0]
      const res = await chatsApi.getMessages(chatId, {
        page_size: 50,
        before_id: oldest.id,
      })
      setMessages((prev) => [...res.data.items, ...prev])
      setHasMore(res.data.has_more)
    } catch {
      // silently ignore
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setMessages([])
    setHasMore(false)
    setError(null)
    fetchChatDetails()
    fetchMessages()
  }, [chatId, fetchChatDetails, fetchMessages])

  useEffect(() => {
    if (!loadingMessages) {
      scrollToBottom()
    }
  }, [loadingMessages, scrollToBottom])

  // Mark as read when opening
  useEffect(() => {
    chatsApi.markRead(chatId).catch(() => {})
  }, [chatId])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return
    if (text.length > 2000) {
      setError('消息不能超过2000个字符')
      return
    }

    setSending(true)
    setError(null)
    try {
      const res = await chatsApi.sendMessage(chatId, text)
      setMessages((prev) => [...prev, res.data])
      setInput('')
      onMessageSent?.()
      // Scroll after state update
      setTimeout(scrollToBottom, 50)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail ?? '发送失败，请重试')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (error && !messages.length) {
    return (
      <div className="h-full bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-gray-400">
        <p>{error}</p>
      </div>
    )
  }

  const otherUserName = chat?.other_user_display_name ?? '匿名用户'

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{otherUserName}</h2>
            {chat?.supervisor_name && (
              <p className="text-xs text-brand-600 mt-0.5">
                关于导师：
                {chat.supervisor_id ? (
                  <Link
                    to={`/supervisor/${chat.supervisor_id}`}
                    className="hover:underline"
                  >
                    {chat.supervisor_name}
                    {chat.school_name && ` — ${chat.school_name}`}
                  </Link>
                ) : (
                  <span>{chat.supervisor_name}</span>
                )}
              </p>
            )}
          </div>
          <div className="text-xs text-gray-300">
            匿名私信 · 对方看不到您的邮箱
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* Load more button */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              onClick={loadOlderMessages}
              disabled={loadingMore}
              className="text-xs text-brand-600 hover:text-brand-700 disabled:text-gray-300"
            >
              {loadingMore ? '加载中…' : '加载更多消息'}
            </button>
          </div>
        )}

        {loadingMessages ? (
          <div className="text-center text-gray-400 text-sm py-8">加载中…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">暂无消息，发送第一条消息吧</div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.sender_id === currentUserId
            const prev = messages[idx - 1]
            const showSeparator = idx === 0 || (prev && shouldShowSeparator(prev, msg))

            return (
              <div key={msg.id}>
                {/* Time separator */}
                {showSeparator && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-300">
                      {formatGroupDate(msg.created_at)} {formatMessageTime(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}

                {/* Message bubble */}
                <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                      isOwn
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>

                {/* Timestamp (show for last message in a group) */}
                {(idx === messages.length - 1 ||
                  (messages[idx + 1] && shouldShowSeparator(msg, messages[idx + 1]))) && (
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
                    <span className="text-xs text-gray-300 px-1">
                      {formatMessageTime(msg.created_at)}
                      {isOwn && msg.read_at && ' · 已读'}
                    </span>
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-100 p-3">
        {error && (
          <p className="text-xs text-red-500 mb-2 px-1">{error}</p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入消息… (Enter 发送，Shift+Enter 换行)"
            rows={2}
            maxLength={2000}
            className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {sending ? '…' : '发送'}
          </button>
        </div>
        <p className="text-xs text-gray-300 mt-1 px-1 text-right">
          {input.length}/2000
        </p>
      </div>
    </div>
  )
}
