import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi, supervisorsApi } from '@/services/api'
import type { RankingEntry, ProvinceListItem } from '@/types'
import AutocompleteInput from '@/components/AutocompleteInput'

type Dimension = 'overall' | 'academic' | 'mentoring' | 'wellbeing' | 'stipend' | 'resources' | 'ethics'

const DIMENSION_TABS: { key: Dimension; label: string }[] = [
  { key: 'overall', label: '综合排名' },
  { key: 'academic', label: '学术水平' },
  { key: 'mentoring', label: '学生培养' },
  { key: 'wellbeing', label: '身心健康' },
  { key: 'stipend', label: '生活补助' },
  { key: 'resources', label: '科研资源' },
  { key: 'ethics', label: '学术道德' },
]

const PAGE_SIZE = 20

export default function RankingsPage() {
  const [dimension, setDimension] = useState<Dimension>('overall')
  const [province, setProvince] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<RankingEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // Filter options
  const [provinceOptions, setProvinceOptions] = useState<string[]>([])
  const [schoolOptions, setSchoolOptions] = useState<{ school_name: string; school_code: string }[]>([])
  const [schoolNameOptions, setSchoolNameOptions] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      supervisorsApi.getProvinces(),
      supervisorsApi.getSchoolNames(),
    ]).then(([provRes, schoolRes]) => {
      setProvinceOptions(provRes.data.map((p: ProvinceListItem) => p.province))
      setSchoolOptions(schoolRes.data)
      setSchoolNameOptions(schoolRes.data.map((s: { school_name: string }) => s.school_name))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    analyticsApi
      .getRankings({
        dimension,
        province: province || undefined,
        school_code: schoolCode || undefined,
        page,
        page_size: PAGE_SIZE,
        min_ratings: 1,
      })
      .then((res) => {
        setItems(res.data.items)
        setTotal(res.data.total)
      })
      .catch(() => {
        setItems([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [dimension, province, schoolCode, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function handleDimensionChange(d: Dimension) {
    setDimension(d)
    setPage(1)
  }

  function handleProvinceChange(v: string) {
    setProvince(v)
    setPage(1)
  }

  function handleSchoolNameChange(v: string) {
    setSchoolName(v)
    // Look up the school_code from the school name
    const match = schoolOptions.find((s) => s.school_name === v)
    setSchoolCode(match ? match.school_code : '')
    setPage(1)
  }

  function medalColor(rank: number): string {
    if (rank === 1) return 'bg-yellow-100 text-yellow-700'
    if (rank === 2) return 'bg-gray-100 text-gray-600'
    if (rank === 3) return 'bg-orange-100 text-orange-700'
    return 'bg-gray-50 text-gray-500'
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">导师排行榜</h1>
        <p className="text-sm text-gray-500 mt-1">
          仅展示获得至少 1 条评价的导师 · 数据实时更新
        </p>
      </div>

      {/* Dimension tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        {DIMENSION_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleDimensionChange(key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              dimension === key
                ? 'bg-teal-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <AutocompleteInput
          options={provinceOptions}
          value={province}
          onChange={handleProvinceChange}
          placeholder="按省份筛选"
          className="flex-1"
        />
        <AutocompleteInput
          options={schoolNameOptions}
          value={schoolName}
          onChange={handleSchoolNameChange}
          placeholder="按院校名称筛选"
          className="flex-1"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">加载中…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">📊</div>
            <div>暂无符合条件的导师数据</div>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[56px_1fr_1fr_80px_80px] gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-100">
              <div className="text-center">排名</div>
              <div>导师</div>
              <div>院校 / 院系</div>
              <div className="text-right">评分</div>
              <div className="text-right">评价数</div>
            </div>

            {items.map((item) => (
              <Link
                key={item.supervisor_id}
                to={`/supervisor/${item.supervisor_id}`}
                className="grid grid-cols-[56px_1fr_1fr_80px_80px] gap-4 px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors group items-center"
              >
                <div className="flex justify-center">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${medalColor(item.rank)}`}
                  >
                    {item.rank}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900 group-hover:text-teal-700 transition-colors">
                    {item.supervisor_name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-700">{item.school_name}</div>
                  <div className="text-xs text-gray-400 truncate max-w-[200px]">
                    {item.department}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-teal-600">
                    {item.avg_score.toFixed(2)}
                  </span>
                </div>
                <div className="text-right text-sm text-gray-500">{item.rating_count}</div>
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 disabled:opacity-40 hover:border-teal-300 transition-colors"
          >
            上一页
          </button>
          <span className="text-sm text-gray-500">
            第 {page} / {totalPages} 页 · 共 {total} 位导师
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 disabled:opacity-40 hover:border-teal-300 transition-colors"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
