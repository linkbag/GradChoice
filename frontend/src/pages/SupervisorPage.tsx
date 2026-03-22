import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supervisorsApi, usersApi } from '@/services/api'
import type { Supervisor, User } from '@/types'
import { zh } from '@/i18n/zh'
import CommentList from '@/components/CommentList'

export default function SupervisorPage() {
  const { id } = useParams<{ id: string }>()
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supervisorsApi.get(id)
      .then((res) => setSupervisor(res.data))
      .catch(() => setSupervisor(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    usersApi.getMeOptional()
      .then((res) => setCurrentUser(res.data))
      .catch(() => setCurrentUser(null))
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6 animate-pulse">
          <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
          <div className="h-7 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-36 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!supervisor) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500">
        导师不存在或已被删除
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Supervisor info header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
        <p className="text-xs text-gray-400 mb-2">导师主页</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{supervisor.name}</h1>
        <p className="text-gray-600">
          {supervisor.school_name} · {supervisor.department}
          {supervisor.title && <span className="ml-2 text-gray-400">({supervisor.title})</span>}
        </p>
        {supervisor.affiliated_unit && (
          <p className="text-sm text-gray-500 mt-1">{supervisor.affiliated_unit}</p>
        )}
        {(supervisor.webpage_url_1 || supervisor.webpage_url_2) && (
          <div className="flex gap-3 mt-3">
            {supervisor.webpage_url_1 && (
              <a
                href={supervisor.webpage_url_1}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline"
              >
                个人主页
              </a>
            )}
            {supervisor.webpage_url_2 && (
              <a
                href={supervisor.webpage_url_2}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline"
              >
                实验室主页
              </a>
            )}
          </div>
        )}
      </div>

      {/* Score radar placeholder */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
        <h2 className="font-bold text-gray-800 mb-4">评分概览</h2>
        <div className="h-48 flex items-center justify-center text-gray-400">
          {/* TODO: Recharts RadarChart */}
          雷达图（待实现）
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          {Object.entries(zh.supervisor.score_labels).map(([key, label]) => (
            key !== 'overall' && (
              <div key={key} className="text-center">
                <div className="text-lg font-bold text-gray-400">—</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Comments section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <CommentList
          supervisorId={supervisor.id}
          currentUserId={currentUser?.id ?? null}
        />
      </div>
    </div>
  )
}
