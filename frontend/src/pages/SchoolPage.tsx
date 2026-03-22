import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supervisorsApi, analyticsApi } from '@/services/api'
import type { SchoolSupervisorsResponse, SchoolAnalytics, SupervisorSearchResult } from '@/types'

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-400">暂无评分</span>
  const color = score >= 4.5 ? 'text-emerald-600' : score >= 3.5 ? 'text-brand-600' : score >= 2.5 ? 'text-yellow-600' : 'text-red-500'
  return <span className={`text-sm font-bold ${color}`}>{score.toFixed(1)}</span>
}

function SupervisorCard({ s }: { s: SupervisorSearchResult }) {
  return (
    <Link
      to={`/supervisor/${s.id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-brand-50 rounded-lg transition-colors group"
    >
      <div>
        <span className="text-sm font-medium text-gray-800 group-hover:text-brand-700">{s.name}</span>
        {s.title && <span className="ml-2 text-xs text-gray-400">{s.title}</span>}
      </div>
      <div className="text-right">
        <ScoreChip score={s.avg_overall_score} />
        {s.rating_count > 0 && (
          <p className="text-xs text-gray-400">{s.rating_count} 条评价</p>
        )}
      </div>
    </Link>
  )
}

export default function SchoolPage() {
  const { code } = useParams<{ code: string }>()

  const [school, setSchool] = useState<SchoolSupervisorsResponse | null>(null)
  const [analytics, setAnalytics] = useState<SchoolAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!code) return
    setLoading(true)
    Promise.all([
      supervisorsApi.getSchoolSupervisors(code),
      analyticsApi.getSchool(code).catch(() => null),
    ]).then(([schoolRes, analyticsRes]) => {
      setSchool(schoolRes.data)
      setAnalytics(analyticsRes?.data ?? null)
    }).catch(() => {
      setSchool(null)
    }).finally(() => setLoading(false))
  }, [code])

  const toggleDept = (dept: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept)
      else next.add(dept)
      return next
    })
  }

  const expandAll = () => {
    if (school) setExpanded(new Set(school.departments.map((d) => d.department)))
  }

  const collapseAll = () => setExpanded(new Set())

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!school) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">院校不存在或暂无导师数据</p>
        <Link to="/search" className="text-brand-600 hover:underline text-sm mt-2 inline-block">
          返回搜索
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-4 flex items-center gap-1">
        <Link to="/" className="hover:text-brand-600">首页</Link>
        <span>/</span>
        <Link to="/search" className="hover:text-brand-600">搜索</Link>
        <span>/</span>
        <span className="text-gray-600">{school.school_name}</span>
      </nav>

      {/* School header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{school.school_name}</h1>
            <p className="text-gray-500 text-sm mt-1">{school.province}</p>
          </div>
          {analytics && (
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-800">{analytics.total_supervisors}</div>
                <div className="text-xs text-gray-400">导师总数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{analytics.rated_supervisors}</div>
                <div className="text-xs text-gray-400">已评价</div>
              </div>
              {analytics.avg_overall_score !== null && (
                <div>
                  <div className="text-2xl font-bold text-brand-600">{analytics.avg_overall_score.toFixed(1)}</div>
                  <div className="text-xs text-gray-400">均分</div>
                </div>
              )}
            </div>
          )}
          {!analytics && (
            <div>
              <div className="text-2xl font-bold text-gray-800">{school.total_count}</div>
              <div className="text-xs text-gray-400">导师总数</div>
            </div>
          )}
        </div>

        {/* Top supervisors if any */}
        {analytics && analytics.top_supervisors.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">评分最高导师</p>
            <div className="flex flex-wrap gap-2">
              {analytics.top_supervisors.slice(0, 5).map((s) => (
                <Link
                  key={String(s.id)}
                  to={`/supervisor/${s.id}`}
                  className="text-xs bg-brand-50 text-brand-700 px-3 py-1 rounded-full hover:bg-brand-100 transition-colors"
                >
                  {String(s.name)} {s.avg_score !== null ? `(${Number(s.avg_score).toFixed(1)})` : ''}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Department list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">
            院系列表
            <span className="ml-2 text-sm font-normal text-gray-400">
              {school.departments.length} 个院系 · {school.total_count} 位导师
            </span>
          </h2>
          <div className="flex gap-2">
            <button onClick={expandAll} className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
              展开全部
            </button>
            <span className="text-gray-200">|</span>
            <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
              收起全部
            </button>
          </div>
        </div>

        <div>
          {school.departments.map((dept, idx) => {
            const isOpen = expanded.has(dept.department)
            return (
              <div key={dept.department} className={idx > 0 ? 'border-t border-gray-50' : ''}>
                {/* Department header */}
                <button
                  onClick={() => toggleDept(dept.department)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    <span className="font-medium text-gray-800">{dept.department}</span>
                    <span className="text-xs text-gray-400">{dept.supervisors.length} 位</span>
                  </div>
                  {/* Average score for dept */}
                  {(() => {
                    const rated = dept.supervisors.filter((s) => s.avg_overall_score !== null)
                    if (rated.length === 0) return null
                    const avg = rated.reduce((sum, s) => sum + s.avg_overall_score!, 0) / rated.length
                    return <ScoreChip score={avg} />
                  })()}
                </button>

                {/* Supervisor list */}
                {isOpen && (
                  <div className="px-2 pb-2">
                    {dept.supervisors.map((s) => (
                      <SupervisorCard key={s.id} s={s} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
