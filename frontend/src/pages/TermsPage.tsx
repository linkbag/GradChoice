import { useI18n } from '@/i18n'

export default function TermsPage() {
  const { t } = useI18n()
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 prose prose-gray max-w-none">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.terms.page_title}</h1>
        <p className="text-sm text-gray-500 mb-8">{t.terms.page_subtitle}</p>

        <p className="text-gray-700 mb-6">
          {t.terms.intro_1}
        </p>
        <p className="text-gray-700 mb-8">
          {t.terms.intro_2}
        </p>

        {/* 使用规则 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            {t.terms.usage_title}
          </h2>
          <ol className="space-y-3 text-gray-700 text-sm leading-relaxed list-decimal list-outside pl-5">
            {t.terms.usage_rules.map((rule, i) => (
              <li key={i}>
                {rule}
                {i === 5 && (
                  <ul className="mt-2 space-y-1 list-disc list-outside pl-5 text-gray-600">
                    {t.terms.usage_rule_6_subitems.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* 知识产权 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            {t.terms.ip_title}
          </h2>
          <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
            {t.terms.ip_items.map((item, i) => (
              <p key={i}>{item}</p>
            ))}
          </div>
        </section>

        {/* 隐私保护 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            {t.terms.privacy_title}
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            {t.terms.privacy_text}
          </p>
        </section>

        {/* 侵权举报 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            {t.terms.report_title}
          </h2>
          <p className="text-gray-700 text-sm mb-4 leading-relaxed">
            {t.terms.report_intro}
          </p>

          <h3 className="font-semibold text-gray-800 mb-2 text-sm">{t.terms.report_scope_title}</h3>
          <ul className="space-y-1 text-gray-700 text-sm leading-relaxed list-disc list-outside pl-5 mb-4">
            {t.terms.report_scope_items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          <h3 className="font-semibold text-gray-800 mb-2 text-sm">{t.terms.report_conditions_title}</h3>
          <div className="space-y-3 text-gray-700 text-sm leading-relaxed mb-4">
            <p>
              {t.terms.report_conditions_intro_prefix}{' '}
              <a
                href="mailto:Webster@gradchoice.org"
                className="text-teal-600 hover:underline"
              >
                Webster@gradchoice.org
              </a>{' '}
              {t.terms.report_conditions_intro_suffix}
            </p>
            <p>
              {t.terms.report_conditions_detail}
            </p>
            <ol className="space-y-2 list-decimal list-outside pl-5">
              {t.terms.report_conditions_items.map((item, i) => (
                <li key={i}>
                  {item}
                  {i === 3 && (
                    <ul className="mt-1 space-y-1 list-disc list-outside pl-5 text-gray-600">
                      {t.terms.report_conditions_item_4_subitems.map((subitem, j) => (
                        <li key={j}>{subitem}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <h3 className="font-semibold text-gray-800 mb-2 text-sm">{t.terms.report_process_title}</h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            {t.terms.report_process_1}
          </p>
          <p className="text-gray-600 text-sm mt-2">
            {t.terms.report_process_2}
          </p>
        </section>

        {/* 免责声明 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            {t.terms.disclaimer_title}
          </h2>
          <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
            {t.terms.disclaimer_items.map((item, i) => (
              <p key={i}>{item}</p>
            ))}
          </div>
        </section>

        {/* 协议修改 */}
        <section className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            {t.terms.amendments_title}
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            {t.terms.amendments_1}
          </p>
          <p className="text-gray-700 text-sm leading-relaxed mt-3">
            {t.terms.amendments_2}
          </p>
        </section>
      </div>
    </div>
  )
}
