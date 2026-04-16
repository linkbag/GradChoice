import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { analyticsApi } from '@/services/api'
import type { OverviewStats } from '@/types'

export default function HomePage() {
  const { t } = useI18n()
  const principles = t.home.principles
  const [stats, setStats] = useState<OverviewStats | null>(null)

  useEffect(() => {
    analyticsApi.getOverview().then((res) => setStats(res.data)).catch(() => {})
  }, [])

  const statItems = [
    { label: t.home.stat_supervisors, value: stats ? stats.total_supervisors.toLocaleString() : '—' },
    { label: t.home.stat_ratings, value: stats ? stats.total_ratings.toLocaleString() : '—' },
    { label: t.home.stat_schools, value: stats ? (stats.most_active_schools?.length > 0 ? '400+' : '—') : '—' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-700 to-brand-900 text-white py-10 md:py-16 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl md:text-4xl font-bold mb-4">{t.home.hero_title}</h1>
          <p className="text-sm md:text-base text-brand-100 mb-8">{t.home.hero_subtitle}</p>
          <Link
            to="/search"
            className="block w-full md:w-auto md:inline-block bg-white text-brand-700 font-semibold px-8 py-3 rounded-full hover:bg-brand-50 transition-colors text-lg"
          >
            {t.home.hero_cta}
          </Link>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">{t.home.mission_title}</h2>
        <p className="text-center text-gray-600 mb-8 md:mb-12 max-w-xl mx-auto">{t.home.mission_text}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8">
          {principles.map((p) => (
            <div
              key={p.title}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-8 text-center hover:shadow-md transition-shadow"
            >
              <h3 className="text-xl font-bold text-brand-700 mb-3">{p.title}</h3>
              <p className="text-gray-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-brand-50 py-12">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
          {statItems.map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl md:text-4xl font-bold text-brand-700">{stat.value}</div>
              <div className="text-xs md:text-sm text-gray-600 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Add Supervisor CTA */}
      <section className="max-w-4xl mx-auto px-4 pt-10 pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-teal-50 border border-teal-200 rounded-2xl p-4 md:px-6 md:py-5 gap-4">
          <div>
            <h3 className="font-semibold text-teal-800 mb-1">{t.home.add_cta_title}</h3>
            <p className="text-sm text-teal-700">{t.home.add_cta_desc}</p>
          </div>
          <Link
            to="/add-supervisor"
            className="w-full sm:w-auto shrink-0 bg-teal-600 text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-teal-700 transition-colors text-center"
          >
            {t.home.add_cta_btn}
          </Link>
        </div>
      </section>

      {/* Score Disclaimer */}
      <section className="max-w-4xl mx-auto px-4 pt-8 pb-2">
        <div className="flex gap-3 items-start bg-sky-50 border border-sky-200 rounded-2xl p-4 md:px-5 md:py-4">
          <span className="text-sky-500 text-lg leading-none mt-0.5">ℹ</span>
          <div>
            <p className="text-xs md:text-sm font-semibold text-sky-800 mb-1">{t.home.score_disclaimer_title}</p>
            <p className="text-xs md:text-sm text-sky-700 leading-relaxed">{t.home.score_disclaimer_body}</p>
          </div>
        </div>
      </section>

      {/* Attribution */}
      <section className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">{t.home.attribution_title}</h3>
          <p className="text-sm text-gray-600 mb-3">
            {t.home.attribution_desc}
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside mb-3 space-y-1">
            <li>
              <a
                href="https://github.com/kgco/RateMySupervisor"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                {t.home.attribution_site1_name}
              </a>
              {t.home.attribution_site1_note}
            </li>
            <li>
              <a
                href="https://www.yankong.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                {t.home.attribution_site2_name}
              </a>
            </li>
            <li>{t.home.attribution_others}</li>
          </ul>
          <p className="text-sm text-gray-500">
            {t.home.attribution_thanks}
          </p>
        </div>
      </section>

      {/* Legal Disclaimer */}
      <section className="max-w-4xl mx-auto px-4 pb-8 md:pb-12">
        <div className="px-4 md:px-5 py-4">
          <p className="text-xs md:text-sm font-semibold text-gray-400 mb-1.5">{t.home.disclaimer_title}</p>
          <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
            {t.home.disclaimer_body}
          </p>
        </div>
      </section>
    </div>
  )
}
