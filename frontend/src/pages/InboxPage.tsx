import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { chatsApi } from '@/services/api'
import type { Chat } from '@/types'
import ChatRoom from '@/components/ChatRoom'

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const activeChatId = searchParams.get('chat')

  const fetchChats = useCallback(() => {
    chatsApi.list()
      .then((res) => setChats(res.data))
      .catch(() => setChats([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  const openChat = (chatId: string) => {
    setSearchParams({ chat: chatId })
  }

  const filteredChats = chats.filter((chat) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    const name = (chat.other_user_display_name ?? '匿名用户').toLowerCase()
    const supervisor = (chat.supervisor_name ?? '').toLowerCase()
    return name.includes(q) || supervisor.includes(q)
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">私信</h1>

      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Chat list panel */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <input
              type="text"
              placeholder="搜索用户或导师名…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-400 text-sm">加载中…</div>
            ) : filteredChats.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-sm">{filter ? '未找到相关会话' : '暂无消息'}</p>
                {!filter && (
                  <p className="text-xs text-gray-300 mt-2">
                    在导师页面的评论中点击「联系该用户」发起私信
                  </p>
                )}
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => openChat(chat.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    activeChatId === chat.id ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Other user name + unread badge */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {chat.other_user_display_name ?? '匿名用户'}
                        </span>
                        {chat.unread_count > 0 && (
                          <span className="flex-shrink-0 bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
                            {chat.unread_count > 99 ? '99+' : chat.unread_count}
                          </span>
                        )}
                      </div>

                      {/* Supervisor context */}
                      {chat.supervisor_name && (
                        <p className="text-xs text-brand-600 truncate mt-0.5">
                          关于 {chat.supervisor_name}
                        </p>
                      )}

                      {/* Last message preview */}
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {chat.last_message ?? '会话已创建'}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <span className="flex-shrink-0 text-xs text-gray-300 mt-0.5">
                      {formatRelativeTime(chat.last_message_at ?? chat.created_at)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat room panel */}
        <div className="flex-1 min-w-0">
          {activeChatId ? (
            <ChatRoom
              chatId={activeChatId}
              onMessageSent={fetchChats}
            />
          ) : (
            <div className="h-full bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-4">💬</div>
                <p>选择一个会话开始聊天</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
