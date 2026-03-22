import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { zh } from '@/i18n/zh'
import { supervisorsApi } from '@/services/api'
import type { SupervisorSearchResult, ProvinceListItem, SchoolListItem } from '@/types'

const SCORE_COLOR = (score: number | null) => {
  if (score === null) return 'text-gray-400'
  if (score >= 4.5) return 'text-emerald-600'
  if (score >= 3.5) return 'text-brand-600'
  if (score >= 2.5) return 'text-yellow-600'
  return 'text-red-500'
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [province, setProvince] = useState(searchParams.get('province') ?? '')
  const [schoolCode, setSchoolCode] = useState(searchParams.get('school') ?? '')
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1))

  const [results, setResults] = useState<SupervisorSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [provinces, setProvinces] = useState<ProvinceListItem[]>([])
  const [schools, setSchools] = useState<SchoolListItem[]>([])

  const PAGE_SIZE = 20

  // Load province list once
  useEffect(() => {
    supervisorsApi.getProvinces().then((r) => setProvinces(r.data)).catch(() => {})
  }, [])

  // Load schools when province changes
  useEffect(() => {
    if (province) {
      supervisorsApi.getSchools({ province }).then((r) => setSchools(r.data.items)).catch(() => {})
    } else {
      setSchools([])
      setSchoolCode('')
    }
  }, [province])

  const doSearch = useCallback(
    async (q: string, prov: string, sc: string, pg: number) => {
      setLoading(true)
      try {
        const params = { province: prov || undefined, school_code: sc || undefined, page: pg, page_size: PAGE_SIZE }
        let res
        if (q.trim()) {
          res = await supervisorsApi.search(q.trim(), params)
        } else {
          res = await supervisorsApi.list({ ...params, sort_by: 'rating_count' })
        }
        setResults(res.data.items)
        setTotal(res.data.total)
      } catch {
        setResults([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Run search on mount if URL has params
  useEffect(() => {
    const initQ = searchParams.get('q') ?? ''
    const initProv = searchParams.get('province') ?? ''
    const initSc = searchParams.get('school') ?? ''
    const initPg = Number(searchParams.get('page') ?? 1)
    if (initQ || initProv || initSc) {
      doSearch(initQ, initProv, initSc, initPg)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newPage = 1
    setPage(newPage)
    const sp: Record<string, string> = {}
    if (query) sp.q = query
    if (province) sp.province = province
    if (schoolCode) sp.school = schoolCode
    setSearchParams(sp)
    doSearch(query, province, schoolCode, newPage)
  }

  const handlePageChange = (pg: number) => {
    setPage(pg)
    const sp: Record<string, string> = {}
    if (query) sp.q = query
    if (province) sp.province = province
    if (schoolCode) sp.school = schoolCode
    sp.page = String(pg)
    setSearchParams(sp)
    doSearch(query, province, schoolCode, pg)
    window.scrollTo(0, 0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">搜索导师</h1>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
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
          className="bg-brand-600 text-white px-6 py-3 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? '搜索中…' : '搜索'}
        </button>
      </form>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <aside className="w-48 shrink-0 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">省份</label>
            <select
              value={province}
              onChange={(e) => { setProvince(e.target.value); setSchoolCode('') }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">{zh.search.filter_province}</option>
              {provinces.map((p) => (
                <option key={p.province} value={p.province}>
                  {p.province}（{p.school_count}所）
                </option>
              ))}
            </select>
          </div>

          {province && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">院校</label>
              <select
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">{zh.search.filter_school}</option>
                {schools.map((s) => (
                  <option key={s.school_code} value={s.school_code}>
                    {s.school_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(province || schoolCode) && (
            <button
              type="button"
              onClick={() => { setProvince(''); setSchoolCode('') }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              清除筛选
            </button>
          )}

          {/* TODO: link to propose-supervisor page once implemented */}
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {total > 0 && (
            <p className="text-sm text-gray-500 mb-4">{zh.search.result_count(total)}</p>
          )}

          {results.length === 0 && !loading && (query || province || schoolCode) && (
            <div className="text-center py-16">
              <p className="text-gray-400 mb-4">{zh.search.no_results}</p>
              {/* TODO: add propose-supervisor link once that page is implemented */}
            </div>
          )}

          {results.length === 0 && !loading && !query && !province && !schoolCode && (
            <p className="text-gray-400 text-center py-16">输入关键词或选择省份开始搜索</p>
          )}

          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div className="space-y-3">
            {results.map((s) => (
              <Link
                key={s.id}
                to={`/supervisor/${s.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-brand-200 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-gray-900">{s.name}</h2>
                      {s.title && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {s.title}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 truncate">
                      <Link
                        to={`/school/${s.school_code}`}
                        className="hover:text-brand-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.school_name}
                      </Link>
                      <span className="mx-1 text-gray-300">·</span>
                      <span className="text-gray-500">{s.department}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {s.avg_overall_score != null ? (
                      <span className={`text-2xl font-bold ${SCORE_COLOR(s.avg_overall_score)}`}>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
