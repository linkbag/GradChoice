import { useEffect, useState } from 'react'
import { editProposalsApi } from '@/services/api'
import { useI18n } from '@/i18n'
import type { EditHistoryItem } from '@/types'

const FIELD_LABELS: Record<string, { zh: string; en: string }> = {
  name: { zh: '姓名', en: 'Name' },
  department: { zh: '院系', en: 'Department' },
  title: { zh: '职称', en: 'Title' },
  affiliated_unit: { zh: '所属单位', en: 'Affiliated Unit' },
  school_name: { zh: '学校', en: 'School' },
  province: { zh: '省份', en: 'Province' },
  webpage_url_1: { zh: '个人主页', en: 'Profile Link 1' },
  webpage_url_2: { zh: '主页2', en: 'Profile Link 2' },
  webpage_url_3: { zh: '主页3', en: 'Profile Link 3' },
}

function relativeTime(dateStr: string, locale: 'zh' | 'en'): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return locale === 'zh' ? '刚刚' : 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return locale === 'zh' ? `${minutes}分钟前` : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return locale === 'zh' ? `${hours}小时前` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return locale === 'zh' ? `${days}天前` : `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return locale === 'zh' ? `${months}个月前` : `${months}mo ago`
  return locale === 'zh' ? `${Math.floor(months / 12)}年前` : `${Math.floor(months / 12)}y ago`
}

interface Props {
  supervisorId: string
  refreshKey?: number
}

export default function EditHistoryPanel({ supervisorId, refreshKey }: Props) {
  const { t, locale } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<EditHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // Fetch count on mount / refreshKey change
  useEffect(() => {
    editProposalsApi.editHistory(supervisorId, { page_size: 1 })
      .then((res) => setTotal(res.data.total))
      .catch(() => {})
  }, [supervisorId, refreshKey])

  // Fetch full list when expanded
  useEffect(() => {
    if (!expanded) return
    setLoading(true)
    editProposalsApi.editHistory(supervisorId, { page_size: 20 })
      .then((res) => {
        setItems(res.data.items)
        setTotal(res.data.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [supervisorId, expanded, refreshKey])

  const getLabel = (field: string) => {
    const entry = FIELD_LABELS[field]
    if (!entry) return field
    return locale === 'zh' ? entry.zh : entry.en
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 mt-4 md:mt-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 md:px-8 py-4 text-left hover:bg-gray-50 transition-colors rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            📝 {t.supervisor.edit_history}
          </span>
          {total > 0 && (
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-mono">
              {total}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 md:px-8 pb-6 border-t border-gray-100">
          {loading ? (
            <p className="text-xs text-gray-400 py-4 text-center">{t.supervisor.loading}</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">—</p>
          ) : (
            <div className="space-y-3 mt-4">
              {items.map((item) => (
                <div key={item.id} className="border-l-2 border-gray-100 pl-3 py-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-600">{item.editor_name}</span>
                    <span className="text-xs text-gray-400">{relativeTime(item.created_at, locale)}</span>
                  </div>
                  {item.previous_data === null ? (
                    <span className="text-xs text-gray-400 italic">{t.supervisor.edit_history_system}</span>
                  ) : (
                    <div className="space-y-0.5">
                      {Object.entries(item.proposed_data).map(([field, newVal]) => {
                        const oldVal = item.previous_data?.[field]
                        return (
                          <div key={field} className="text-xs text-gray-600">
                            <span className="text-gray-400">{getLabel(field)}: </span>
                            {oldVal != null ? (
                              <>
                                <span className="line-through text-red-400">{oldVal}</span>
                                <span className="mx-1 text-gray-400">→</span>
                                <span className="text-green-600">{newVal}</span>
                              </>
                            ) : (
                              <span className="text-green-600">{newVal}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
