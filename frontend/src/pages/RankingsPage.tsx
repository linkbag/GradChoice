import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi, supervisorsApi } from '@/services/api'
import type { RankingEntry, ProvinceListItem } from '@/types'
import AutocompleteInput from '@/components/AutocompleteInput'
import { zh } from '@/i18n/zh'

type Dimension = 'overall' | 'academic' | 'mentoring' | 'wellbeing' | 'stipend' | 'resources' | 'ethics'
type UserStatus = 'all' | 'verified' | 'unverified'

const DIMENSION_TABS: { key: Dimension; label: string }[] = [
  { key: 'overall', label: '综合排名' },
  { key: 'academic', label: '学术水平' },
  { key: 'mentoring', label: '学生培养' },
  { key: 'wellbeing', label: '身心健康' },
  { key: 'stipend', label: '生活补助' },
  { key: 'resources', label: '科研资源' },
  { key: 'ethics', label: '学术道德' },
]

const USER_STATUS_TABS: { key: UserStatus; label: string }[] = [
  { key: 'all', label: zh.supervisor.user_status_all },
  { key: 'verified', label: zh.supervisor.user_status_verified },
  { key: 'unverified', label: zh.supervisor.user_status_unverified },
]

const PAGE_SIZE = 20

export default function RankingsPage() {
  const [dimension, setDimension] = useState<Dimension>('overall')
  const [userStatus, setUserStatus] = useState<UserStatus>('all')
  const [province, setProvince] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [department, setDepartment] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<RankingEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // Filter options
  const [provinceOptions, setProvinceOptions] = useState<string[]>([])
  const [schoolOptions, setSchoolOptions] = useState<{ school_name: string; school_code: string }[]>([])
  const [schoolNameOptions, setSchoolNameOptions] = useState<string[]>([])
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([])

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

  // Fetch departments when school changes
  useEffect(() => {
    if (!schoolCode) {
      setDepartmentOptions([])
      return
    }
    supervisorsApi.getDepartments(schoolCode)
      .then((res) => setDepartmentOptions(res.data.map((d: { department: string }) => d.department)))
      .catch(() => setDepartmentOptions([]))
  }, [schoolCode])

  useEffect(() => {
    setLoading(true)
    analyticsApi
      .getRankings({
        dimension,
        province: province || undefined,
        school_code: schoolCode || undefined,
        department: department || undefined,
        sort_order: sortOrder,
        page,
        page_size: PAGE_SIZE,
        min_ratings: 1,
        user_status: userStatus,
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
  }, [dimension, userStatus, province, schoolCode, department, sortOrder, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function handleDimensionChange(d: Dimension) {
    setDimension(d)
    setPage(1)
  }

  function handleUserStatusChange(s: UserStatus) {
    setUserStatus(s)
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
    setDepartment('')
    setPage(1)
  }

  function handleDepartmentChange(v: string) {
    setDepartment(v)
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
          仅展示获得至少 1 条打分的导师 · 数据实时更新
        </p>
      </div>

      {/* Dimension tabs + sort toggle */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide flex-1">
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
        <button
          onClick={() => { setSortOrder((o) => o === 'desc' ? 'asc' : 'desc'); setPage(1) }}
          title={sortOrder === 'desc' ? '当前：从高到低，点击切换为从低到高' : '当前：从低到高，点击切换为从高到低'}
          className="shrink-0 px-3 py-2 rounded-full text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
        >
          {sortOrder === 'desc' ? '↓ 从高到低' : '↑ 从低到高'}
        </button>
      </div>

      {/* User status toggle */}
      <div className="flex gap-1 mb-5">
        {USER_STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleUserStatusChange(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              userStatus === key
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <AutocompleteInput
          options={provinceOptions}
          value={province}
          onChange={handleProvinceChange}
          placeholder="按省份筛选"
          className="flex-1 min-w-[140px]"
        />
        <AutocompleteInput
          options={schoolNameOptions}
          value={schoolName}
          onChange={handleSchoolNameChange}
          placeholder="按院校名称筛选"
          className="flex-1 min-w-[160px]"
        />
        <AutocompleteInput
          options={departmentOptions}
          value={department}
          onChange={handleDepartmentChange}
          placeholder={schoolCode ? '按院系筛选' : '先选院校再筛选院系'}
          className="flex-1 min-w-[140px]"
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
              <div className="text-right">打分数</div>
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
