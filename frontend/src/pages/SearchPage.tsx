import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { zh } from '@/i18n/zh'
import { supervisorsApi } from '@/services/api'
import type { SupervisorSearchResult, ProvinceListItem } from '@/types'
import AutocompleteInput from '@/components/AutocompleteInput'

const PAGE_SIZE = 20

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [province, setProvince] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [results, setResults] = useState<SupervisorSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched, setSearched] = useState(false)

  // Filter options
  const [provinceOptions, setProvinceOptions] = useState<string[]>([])
  const [schoolOptions, setSchoolOptions] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      supervisorsApi.getProvinces(),
      supervisorsApi.getSchoolNames(),
    ]).then(([provRes, schoolRes]) => {
      setProvinceOptions(provRes.data.map((p: ProvinceListItem) => p.province))
      setSchoolOptions(schoolRes.data.map((s: { school_name: string }) => s.school_name))
    }).catch(() => {})
  }, [])

  const doSearch = useCallback(async (pageNum: number, append: boolean) => {
    if (!query.trim()) return
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    try {
      const res = await supervisorsApi.search(query, {
        province: province || undefined,
        school_name: schoolName || undefined,
        page: pageNum,
        page_size: PAGE_SIZE,
      })
      if (append) {
        setResults((prev) => [...prev, ...res.data.items])
      } else {
        setResults(res.data.items)
      }
      setTotal(res.data.total)
      setPage(pageNum)
      setSearched(true)
    } catch {
      if (!append) {
        setResults([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [query, province, schoolName])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    doSearch(1, false)
  }

  const handleLoadMore = () => {
    doSearch(page + 1, true)
  }

  const hasMore = results.length < total

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">搜索导师</h1>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
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

      {/* Filters */}
      <div className="flex gap-3 mb-8">
        <AutocompleteInput
          options={provinceOptions}
          value={province}
          onChange={setProvince}
          placeholder="按省份筛选"
          className="flex-1"
        />
        <AutocompleteInput
          options={schoolOptions}
          value={schoolName}
          onChange={setSchoolName}
          placeholder="按院校名称筛选"
          className="flex-1"
        />
      </div>

      {/* Results */}
      {total > 0 && (
        <p className="text-sm text-gray-500 mb-4">{zh.search.result_count(total)}</p>
      )}

      {results.length === 0 && !loading && searched && (
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

      {/* Load More */}
      {hasMore && !loading && (
        <div className="flex justify-center mt-8">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-brand-300 hover:text-brand-700 transition-colors disabled:opacity-50"
          >
            {loadingMore ? '加载中…' : `加载更多（已显示 ${results.length} / ${total}）`}
          </button>
        </div>
      )}
    </div>
  )
}
