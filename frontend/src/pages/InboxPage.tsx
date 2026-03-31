import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { chatsApi, usersApi } from '@/services/api'
import { useI18n } from '@/i18n'
import type { Chat, ChatMessage } from '@/types'

const QUOTE_START = '【引用评论】\n'
const QUOTE_END = '\n【/引用评论】'

function parseContent(content: string): { quote: string | null; body: string } {
  if (content.startsWith(QUOTE_START)) {
    const endIdx = content.indexOf(QUOTE_END)
    if (endIdx !== -1) {
      return {
        quote: content.slice(QUOTE_START.length, endIdx),
        body: content.slice(endIdx + QUOTE_END.length).trim(),
      }
    }
  }
  return { quote: null, body: content }
}

export default function InboxPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const { t } = useI18n()

  const openChat = async (chat: Chat) => {
    setSelectedChat(chat)
    setMessages([])
    try {
      const res = await chatsApi.getMessages(chat.id, { page: 1, page_size: 50 })
      setMessages(res.data.items)
      chatsApi.markRead(chat.id).catch(() => {})
    } catch {
      setMessages([])
    }
  }

  useEffect(() => {
    const initChatId = (location.state as { chatId?: string } | null)?.chatId
    Promise.allSettled([
      chatsApi.list(),
      usersApi.getMeOptional(),
    ]).then(async ([chatsResult, userResult]) => {
      const chatsData = chatsResult.status === 'fulfilled' ? chatsResult.value.data : []
      setChats(chatsData)
      if (userResult.status === 'fulfilled') {
        setCurrentUserId(userResult.value.data.id)
      }
      if (initChatId) {
        const target = chatsData.find((c) => c.id === initChatId)
        if (target) await openChat(target)
      }
    }).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChat || !newMsg.trim() || sending) return
    setSending(true)
    try {
      await chatsApi.sendMessage(selectedChat.id, newMsg)
      setNewMsg('')
      const res = await chatsApi.getMessages(selectedChat.id, { page: 1, page_size: 50 })
      setMessages(res.data.items)
    } catch {} finally {
      setSending(false)
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-6 md:py-12 text-gray-400">{t.inbox.loading}</div>

  const otherName = selectedChat?.other_user_display_name || t.inbox.anonymous_user

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-12">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4">{t.inbox.title}</h1>
      <div className="mb-3 md:mb-4 px-3 md:px-4 py-2 md:py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs md:text-sm text-amber-700">
        {t.inbox.ephemeral_notice}
      </div>
      <div className="flex flex-col md:flex-row gap-4 h-auto md:h-[600px]">
        {/* Chat list */}
        <div className="w-full md:w-1/3 max-h-48 md:max-h-none bg-white rounded-2xl border border-gray-200 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">{t.inbox.no_chats}</div>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => openChat(chat)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedChat?.id === chat.id ? 'bg-brand-50' : ''}`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">
                  {chat.other_user_display_name || t.inbox.anonymous_user}
                </p>
                {chat.supervisor_name && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {t.inbox.about_supervisor(chat.supervisor_name)}
                  </p>
                )}
                {chat.last_message && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {chat.last_message.startsWith('【引用评论】') ? t.inbox.quote_preview : chat.last_message}
                  </p>
                )}
                {chat.unread_count > 0 && (
                  <span className="mt-1 inline-block bg-brand-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {chat.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Message pane */}
        <div className="flex-1 min-h-[400px] md:min-h-0 bg-white rounded-2xl border border-gray-200 flex flex-col">
          {selectedChat ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">{otherName}</p>
                {selectedChat.supervisor_name && (
                  <p className="text-xs text-gray-400">
                    {t.inbox.about_supervisor(selectedChat.supervisor_name)}
                    {selectedChat.school_name ? ` · ${selectedChat.school_name}` : ''}
                  </p>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, idx) => {
                  const isMine = currentUserId ? msg.sender_id === currentUserId : false
                  const { quote, body } = parseContent(msg.content)
                  const prevMsg = messages[idx - 1]
                  const showLabel = !prevMsg || prevMsg.sender_id !== msg.sender_id

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {showLabel && (
                        <span className="text-xs text-gray-400 mb-1 px-1">
                          {isMine ? t.inbox.me : otherName}
                        </span>
                      )}
                      <div
                        className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm ${
                          isMine
                            ? 'bg-blue-500 text-white rounded-tr-sm'
                            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                        }`}
                      >
                        {quote && (
                          <div
                            className={`mb-2 pl-3 border-l-2 text-xs ${
                              isMine ? 'border-blue-200 text-blue-100' : 'border-gray-300 text-gray-500'
                            }`}
                          >
                            <p className="font-medium mb-0.5">{t.inbox.quote_label}</p>
                            <p className="whitespace-pre-wrap line-clamp-4">{quote}</p>
                          </div>
                        )}
                        {body && <p className="whitespace-pre-wrap">{body}</p>}
                        {!body && !quote && <p className="opacity-60">{t.inbox.empty_message}</p>}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={sendMessage} className="p-4 border-t border-gray-100 flex gap-3">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder={t.inbox.input_placeholder}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? t.inbox.sending : t.inbox.send_btn}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              {t.inbox.select_chat}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
