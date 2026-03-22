import { useParams } from 'react-router-dom'
import { zh } from '@/i18n/zh'

export default function SupervisorPage() {
  const { id } = useParams<{ id: string }>()

  // TODO: fetch supervisor data, ratings, comments, analytics

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Supervisor info header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
        <p className="text-xs text-gray-400 mb-2">导师主页</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">加载中…</h1>
        <p className="text-gray-600">院校 · 院系</p>
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

      {/* Ratings & Comments */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-800">学生评价</h2>
          <button className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition-colors">
            {zh.supervisor.write_review}
          </button>
        </div>
        <p className="text-gray-400 text-center py-8">{zh.supervisor.no_ratings}</p>
      </div>
    </div>
  )
}
