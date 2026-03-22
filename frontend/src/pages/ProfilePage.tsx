import { useEffect, useState } from 'react'
import { usersApi } from '@/services/api'
import type { User } from '@/types'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingNotif, setSavingNotif] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)

  useEffect(() => {
    usersApi.getMe()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const toggleNotifications = async () => {
    if (!user || savingNotif) return
    setSavingNotif(true)
    setNotifSaved(false)
    try {
      const res = await usersApi.updateMe({
        email_notifications_enabled: !user.email_notifications_enabled,
      })
      setUser(res.data)
      setNotifSaved(true)
      setTimeout(() => setNotifSaved(false), 2000)
    } catch {
      // silently ignore — user sees no change
    } finally {
      setSavingNotif(false)
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">加载中…</div>
  if (!user) return <div className="text-center py-20 text-gray-400">请先登录</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">我的主页</h1>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">昵称</p>
            <p className="font-medium">{user.display_name ?? '未设置'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">邮箱</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">认证状态</p>
            <div className="flex gap-2 mt-1">
              {user.is_email_verified ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">邮箱已验证</span>
              ) : (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">邮箱待验证</span>
              )}
              {user.is_student_verified && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">认证学生</span>
              )}
            </div>
          </div>
          {user.bio && (
            <div>
              <p className="text-sm text-gray-500">个人简介</p>
              <p className="text-gray-700">{user.bio}</p>
            </div>
          )}
        </div>

        {/* TODO: Edit profile form, my ratings, my comments */}

        {/* Notification preferences */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">通知设置</h2>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">私信邮件通知</p>
              <p className="text-xs text-gray-400 mt-0.5">
                开启后，当有新消息时将通过邮件通知您
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {notifSaved && (
                <span className="text-xs text-green-600">已保存</span>
              )}
              <button
                onClick={toggleNotifications}
                disabled={savingNotif}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                  user.email_notifications_enabled ? 'bg-brand-600' : 'bg-gray-200'
                } ${savingNotif ? 'opacity-60 cursor-not-allowed' : ''}`}
                role="switch"
                aria-checked={user.email_notifications_enabled}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    user.email_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
