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
const FREE_ROWS = 5

export default function RankingsPage() {
  const isLoggedIn = !!localStorage.getItem('access_token')

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

  // Shared row renderer (used for both logged-in full view and non-logged-in visible rows)
  function renderRow(item: RankingEntry, clickable = true) {
    const inner = (
      <>
        <div className="flex justify-center">
          <span
            className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs font-bold ${medalColor(item.rank)}`}
          >
            {item.rank}
          </span>
        </div>
        <div>
          <div className="text-xs md:text-sm font-medium text-gray-900 group-hover:text-teal-700 transition-colors">
            {item.supervisor_name}
          </div>
        </div>
        <div>
          <div className="text-xs md:text-sm text-gray-700 truncate">{item.school_name}</div>
          <div className="text-xs text-gray-400 truncate max-w-[120px] md:max-w-[200px]">
            {item.department}
          </div>
        </div>
        <div className="text-right">
          <span className="text-base md:text-lg font-bold text-teal-600">
            {item.avg_score.toFixed(2)}
          </span>
        </div>
        <div className="text-right text-xs md:text-sm text-gray-500">{item.rating_count}</div>
      </>
    )

    if (clickable) {
      return (
        <Link
          key={item.supervisor_id}
          to={`/supervisor/${item.supervisor_id}`}
          className="grid grid-cols-[44px_1fr_1fr_64px_64px] md:grid-cols-[56px_1fr_1fr_80px_80px] gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors group items-center"
        >
          {inner}
        </Link>
      )
    }
    return (
      <div
        key={item.supervisor_id}
        className="grid grid-cols-[44px_1fr_1fr_64px_64px] md:grid-cols-[56px_1fr_1fr_80px_80px] gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-4 border-b border-gray-50 items-center"
      >
        {inner}
      </div>
    )
  }

  const tableHeader = (
    <div className="grid grid-cols-[44px_1fr_1fr_64px_64px] md:grid-cols-[56px_1fr_1fr_80px_80px] gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-100">
      <div className="text-center">排名</div>
      <div>导师</div>
      <div>院校 / 院系</div>
      <div className="text-right">评分</div>
      <div className="text-right">打分数</div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">导师排行榜</h1>
        <p className="text-sm text-gray-500 mt-1">
          仅展示获得至少 1 条打分的导师 · 数据实时更新
        </p>
      </div>

      {/* Filter controls — blurred with hint for non-logged-in users */}
      <div className="relative mb-5">
        <div className={!isLoggedIn ? 'filter blur-sm pointer-events-none select-none' : ''}>
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

          {/* Filter dropdowns */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
        </div>
        {/* Blur overlay with hint for non-logged-in users */}
        {!isLoggedIn && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl z-10">
            <p className="text-gray-500 text-sm text-center max-w-md px-4">
              请先登录或注册账号以查看更多导师使用完整功能。本网站为公益性质，注册、使用完全免费。如果您想志愿帮助我们改进或维护网站请联系webster@gradchoice.org
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-gray-400">加载中…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">📊</div>
            <div>暂无符合条件的导师数据</div>
          </div>
        ) : isLoggedIn ? (
          <>
            {tableHeader}
            {items.map((item) => renderRow(item, true))}
          </>
        ) : (
          <>
            {tableHeader}

            {/* First FREE_ROWS rows — visible and clickable */}
            {items.slice(0, FREE_ROWS).map((item) => renderRow(item, true))}

            {/* Blurred section with login gate */}
            <div className="relative overflow-hidden">
              {/* Rows beyond FREE_ROWS — rendered but blurred */}
              <div className="pointer-events-none select-none">
                {items.slice(FREE_ROWS).map((item) => renderRow(item, false))}
                {/* Ensure minimum height for the CTA even if few rows */}
                {items.length <= FREE_ROWS && <div className="h-48" />}
              </div>

              {/* Blur + gradient overlay */}
              <div
                className="absolute inset-0"
                style={{
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 100%)',
                }}
              />

              {/* CTA card */}
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="bg-white/95 rounded-2xl border border-gray-200 shadow-sm px-5 py-5 md:px-8 md:py-7 text-center max-w-sm w-full">
                  <span className="text-4xl mb-4 block">🔒</span>
                  <h2 className="text-lg font-bold text-gray-800 mb-3">
                    登录后查看完整排行榜
                  </h2>
                  <p className="text-sm text-gray-500 mb-3">
                    研选平台的导师排行数据仅对注册用户完整开放，请先登录或注册账号。
                  </p>
                  <p className="text-xs text-gray-400 mb-6">
                    本网站为公益性质，注册、使用完全免费。
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Link
                      to="/login"
                      className="px-6 py-2.5 rounded-full bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
                    >
                      登录
                    </Link>
                    <Link
                      to="/register"
                      className="px-6 py-2.5 rounded-full border border-brand-600 text-brand-600 text-sm font-medium hover:bg-brand-50 transition-colors"
                    >
                      免费注册
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pagination — hidden for non-logged-in users */}
      {isLoggedIn && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 disabled:opacity-40 hover:border-teal-300 transition-colors"
          >
            上一页
          </button>
          <span className="text-sm text-gray-500">
            第 {page} / {totalPages} 页 · 共 {total} 位已评分导师
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
