import { useEffect, useState } from 'react'
import { usersApi } from '@/services/api'
import type { User } from '@/types'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersApi.getMe()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

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
      </div>
    </div>
  )
}
