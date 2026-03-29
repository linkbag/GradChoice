import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { zh } from '@/i18n/zh'
import { analyticsApi } from '@/services/api'
import type { OverviewStats } from '@/types'

export default function HomePage() {
  const principles = zh.home.principles
  const [stats, setStats] = useState<OverviewStats | null>(null)

  useEffect(() => {
    analyticsApi.getOverview().then((res) => setStats(res.data)).catch(() => {})
  }, [])

  const statItems = [
    { label: '收录导师', value: stats ? stats.total_supervisors.toLocaleString() : '—' },
    { label: '用户评价', value: stats ? stats.total_ratings.toLocaleString() : '—' },
    { label: '覆盖院校', value: stats ? (stats.most_active_schools?.length > 0 ? '65+' : '—') : '—' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-700 to-brand-900 text-white py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">{zh.home.hero_title}</h1>
          <p className="text-xl text-brand-100 mb-8">{zh.home.hero_subtitle}</p>
          <Link
            to="/search"
            className="inline-block bg-white text-brand-700 font-semibold px-8 py-3 rounded-full hover:bg-brand-50 transition-colors text-lg"
          >
            {zh.home.hero_cta}
          </Link>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">{zh.home.mission_title}</h2>
        <p className="text-center text-gray-600 mb-12 max-w-xl mx-auto">{zh.home.mission_text}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {principles.map((p) => (
            <div
              key={p.title}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center hover:shadow-md transition-shadow"
            >
              <h3 className="text-xl font-bold text-brand-700 mb-3">{p.title}</h3>
              <p className="text-gray-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-brand-50 py-12">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-8 text-center">
          {statItems.map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-brand-700">{stat.value}</div>
              <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Add Supervisor CTA */}
      <section className="max-w-4xl mx-auto px-4 pt-10 pb-2">
        <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-2xl px-6 py-5">
          <div>
            <h3 className="font-semibold text-teal-800 mb-1">{zh.home.add_cta_title}</h3>
            <p className="text-sm text-teal-700">{zh.home.add_cta_desc}</p>
          </div>
          <Link
            to="/add-supervisor"
            className="ml-6 shrink-0 bg-teal-600 text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-teal-700 transition-colors"
          >
            {zh.home.add_cta_btn}
          </Link>
        </div>
      </section>

      {/* Score Disclaimer */}
      <section className="max-w-4xl mx-auto px-4 pt-8 pb-2">
        <div className="flex gap-3 items-start bg-sky-50 border border-sky-200 rounded-2xl px-5 py-4">
          <span className="text-sky-500 text-lg leading-none mt-0.5">ℹ</span>
          <div>
            <p className="text-sm font-semibold text-sky-800 mb-1">{zh.home.score_disclaimer_title}</p>
            <p className="text-sm text-sky-700 leading-relaxed">{zh.home.score_disclaimer_body}</p>
          </div>
        </div>
      </section>

      {/* Attribution */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">数据致谢</h3>
          <p className="text-sm text-gray-600 mb-3">
            本站部分历史评价数据转载自开源社区，包括：
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside mb-3 space-y-1">
            <li>
              <a
                href="https://github.com/kgco/RateMySupervisor"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                导师评价网
              </a>
              （原 mysupervisor.org / ratemysupervisor.org）
            </li>
            <li>
              <a
                href="https://www.yankong.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                研控
              </a>
            </li>
            <li>及其他开源贡献者</li>
          </ul>
          <p className="text-sm text-gray-500">
            感谢所有先驱者为保护研究生权益所做的贡献。如有任何版权或数据问题，请联系我们。
          </p>
        </div>
      </section>

      {/* Legal Disclaimer */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-gray-400 mb-1.5">⚖️ 免责声明</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            本平台所有评价内容均为用户个人观点，仅代表发布者本人立场，不代表研选 GradChoice 平台立场。平台不对评价内容的真实性、准确性或合法性承担责任。如您认为某条评价侵犯了您的合法权益，请通过平台举报功能联系我们，我们将在核实后依法处理。
          </p>
        </div>
      </section>
    </div>
  )
}
