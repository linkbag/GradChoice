import { useState } from 'react'
import { Link } from 'react-router-dom'
import { zh } from '@/i18n/zh'
import { supervisorsApi } from '@/services/api'
import type { SupervisorSearchResult } from '@/types'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SupervisorSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await supervisorsApi.search(query, { page: 1, page_size: 20 })
      setResults(res.data.items)
      setTotal(res.data.total)
    } catch {
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">搜索导师</h1>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={zh.search.placeholder}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-600 text-white px-6 py-3 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {loading ? '搜索中…' : '搜索'}
        </button>
      </form>

      {/* Results */}
      {total > 0 && (
        <p className="text-sm text-gray-500 mb-4">{zh.search.result_count(total)}</p>
      )}

      {results.length === 0 && !loading && query && (
        <p className="text-gray-400 text-center py-12">{zh.search.no_results}</p>
      )}

      <div className="space-y-4">
        {results.map((s) => (
          <Link
            key={s.id}
            to={`/supervisor/${s.id}`}
            className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{s.name}</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {s.school_name} · {s.department}
                </p>
                {s.title && <p className="text-xs text-gray-400 mt-0.5">{s.title}</p>}
              </div>
              <div className="text-right shrink-0 ml-4">
                {s.avg_overall_score != null ? (
                  <span className="text-2xl font-bold text-brand-600">
                    {s.avg_overall_score.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">暂无评分</span>
                )}
                <p className="text-xs text-gray-400">{zh.supervisor.rating_count(s.rating_count)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
