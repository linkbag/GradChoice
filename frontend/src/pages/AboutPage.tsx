import { useI18n } from '@/i18n'

export default function AboutPage() {
  const { t } = useI18n()
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-5 md:mb-8">{t.about.page_title}</h1>

      <section className="prose prose-gray max-w-none space-y-4 md:space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3">{t.about.mission_title}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t.about.mission_text}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">{t.about.principles_title}</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-brand-700">{t.about.principle_neutral_title}</h3>
              <p className="text-gray-600 text-sm mt-1">
                {t.about.principle_neutral_desc}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-brand-700">{t.about.principle_open_title}</h3>
              <p className="text-gray-600 text-sm mt-1">
                {t.about.principle_open_desc}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-brand-700">{t.about.principle_free_title}</h3>
              <p className="text-gray-600 text-sm mt-1">
                {t.about.principle_free_desc}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-brand-700">{t.about.principle_privacy_title}</h3>
              <p className="text-gray-600 text-sm mt-1">
                {t.about.principle_privacy_desc}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3">{t.about.contribute_title}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t.about.contribute_prefix}{' '}
            <a href="https://github.com/linkbag/GradChoice" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
              GitHub
            </a>
            {t.about.contribute_suffix}
          </p>
        </div>
      </section>
    </div>
  )
}
