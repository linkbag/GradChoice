import { useEffect, useState } from 'react'
import { chatsApi } from '@/services/api'
import type { Chat, ChatMessage } from '@/types'

export default function InboxPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chatsApi.list()
      .then((res) => setChats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const openChat = async (chat: Chat) => {
    setSelectedChat(chat)
    try {
      const res = await chatsApi.getMessages(chat.id, { page: 1, page_size: 50 })
      setMessages(res.data.items)
    } catch {
      setMessages([])
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChat || !newMsg.trim()) return
    try {
      await chatsApi.sendMessage(selectedChat.id, newMsg)
      setNewMsg('')
      const res = await chatsApi.getMessages(selectedChat.id, { page: 1, page_size: 50 })
      setMessages(res.data.items)
    } catch {}
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-12 text-gray-400">加载中…</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">私信</h1>
      <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
        本站私信为阅后即删模式，仅保留最近2条消息
      </div>
      {chats.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
          暂无会话
        </div>
      ) : (
        <div className="flex gap-4 h-[600px]">
          {/* Chat list */}
          <div className="w-1/3 bg-white rounded-2xl border border-gray-200 overflow-y-auto">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => openChat(chat)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedChat?.id === chat.id ? 'bg-brand-50' : ''}`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">
                  {chat.last_message || '（无消息）'}
                </p>
                {chat.unread_count > 0 && (
                  <span className="mt-1 inline-block bg-brand-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {chat.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Message pane */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-200 flex flex-col">
            {selectedChat ? (
              <>
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                      {msg.content}
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="p-4 border-t border-gray-100 flex gap-3">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="输入消息…"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700"
                  >
                    发送
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                选择一个会话
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
