import { Link } from 'react-router-dom'
import { zh } from '@/i18n/zh'

export default function HomePage() {
  const principles = zh.home.principles

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

      {/* Stats placeholder */}
      <section className="bg-brand-50 py-12">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-8 text-center">
          {[
            { label: '收录导师', value: '—' },
            { label: '用户评价', value: '—' },
            { label: '覆盖院校', value: '—' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-brand-700">{stat.value}</div>
              <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
