import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { zh } from '@/i18n/zh'
import { supervisorsApi } from '@/services/api'
import type { SupervisorSearchResult, ProvinceListItem } from '@/types'
import AutocompleteInput from '@/components/AutocompleteInput'

const PAGE_SIZE = 20

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('') // last submitted search term
  const [province, setProvince] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [department, setDepartment] = useState('')
  const [results, setResults] = useState<SupervisorSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [provinceOptions, setProvinceOptions] = useState<string[]>([])
  const [schoolOptions, setSchoolOptions] = useState<string[]>([])
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([])
  const [schoolCodeMap, setSchoolCodeMap] = useState<Record<string, string>>({})

  // Skip filter-change effect on first render (initial load uses mount effect)
  const isFirstRender = useRef(true)

  useEffect(() => {
    Promise.all([
      supervisorsApi.getProvinces(),
      supervisorsApi.getSchoolNames(),
    ]).then(([provRes, schoolRes]) => {
      setProvinceOptions(provRes.data.map((p: ProvinceListItem) => p.province))
      setSchoolOptions(schoolRes.data.map((s: { school_name: string }) => s.school_name))
      const map: Record<string, string> = {}
      schoolRes.data.forEach((s: { school_name: string; school_code: string }) => {
        map[s.school_name] = s.school_code
      })
      setSchoolCodeMap(map)
    }).catch(() => {})
  }, [])

  // When school changes: fetch departments for that school, reset department
  useEffect(() => {
    setDepartment('')
    const code = schoolCodeMap[schoolName]
    if (!schoolName || !code) {
      setDepartmentOptions([])
      return
    }
    supervisorsApi.getDepartments(code)
      .then((res) => setDepartmentOptions(res.data.map((d) => d.department)))
      .catch(() => setDepartmentOptions([]))
  }, [schoolName, schoolCodeMap])

  async function fetchData(
    pageNum: number,
    append: boolean,
    q: string,
    prov: string,
    school: string,
    dept: string,
  ) {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      let res
      if (q) {
        res = await supervisorsApi.search(q, {
          province: prov || undefined,
          school_name: school || undefined,
          department: dept || undefined,
          page: pageNum,
          page_size: PAGE_SIZE,
        })
      } else {
        res = await supervisorsApi.list({
          province: prov || undefined,
          school_name: school || undefined,
          department: dept || undefined,
          page: pageNum,
          page_size: PAGE_SIZE,
        })
      }
      if (append) {
        setResults((prev) => [...prev, ...res.data.items])
      } else {
        setResults(res.data.items)
      }
      setTotal(res.data.total)
      setPage(pageNum)
    } catch {
      if (!append) {
        setResults([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Initial load — show all supervisors (browse mode)
  useEffect(() => {
    fetchData(1, false, '', '', '', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-reload when province, school, or department filter changes (skip first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchData(1, false, activeQuery, province, schoolName, department)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province, schoolName, department])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    setActiveQuery(q)
    fetchData(1, false, q, province, schoolName, department)
  }

  function handleLoadMore() {
    fetchData(page + 1, true, activeQuery, province, schoolName, department)
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

      {/* Filters — changing any triggers an auto-reload */}
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
        <AutocompleteInput
          options={departmentOptions}
          value={department}
          onChange={setDepartment}
          placeholder={zh.search.filter_department}
          className="flex-1"
        />
      </div>

      {/* Result count */}
      {total > 0 && !loading && (
        <p className="text-sm text-gray-500 mb-4">
          {activeQuery ? zh.search.result_count(total) : `共 ${total} 位导师`}
        </p>
      )}

      {/* Loading indicator */}
      {loading && (
        <p className="text-gray-400 text-center py-12">加载中…</p>
      )}

      {/* Empty state */}
      {results.length === 0 && !loading && (
        <p className="text-gray-400 text-center py-12">
          {activeQuery ? zh.search.no_results : '暂无导师数据'}
        </p>
      )}

      {/* Results */}
      {!loading && (
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
      )}

      {/* Load more */}
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
