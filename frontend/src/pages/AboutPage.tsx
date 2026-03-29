export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-5 md:mb-8">关于研选 GradChoice</h1>

      <section className="prose prose-gray max-w-none space-y-4 md:space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3">我们的使命</h2>
          <p className="text-gray-600 leading-relaxed">
            研选 GradChoice 是一个匿名的研究生导师评分平台，旨在帮助研究生在选择导师时获得真实、客观的参考信息，
            保障学生的学术发展与身心健康。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">核心原则</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-brand-700">中立客观</h3>
              <p className="text-gray-600 text-sm mt-1">
                平台不持任何立场，忠实呈现社区评价数据。我们不删除负面评价，也不为任何机构背书。
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-brand-700">公开透明</h3>
              <p className="text-gray-600 text-sm mt-1">
                所有评分数据公开可查，评分算法透明公开。平台运营情况定期公示。
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-brand-700">免费开源</h3>
              <p className="text-gray-600 text-sm mt-1">
                平台永久免费，代码在 GitHub 上开源，接受公众监督与贡献。
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-brand-700">保护隐私</h3>
              <p className="text-gray-600 text-sm mt-1">
                所有评价均匿名发布。我们严格保护用户隐私，绝不泄露个人信息。
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3">参与贡献</h2>
          <p className="text-gray-600 leading-relaxed">
            研选是一个社区驱动的项目。欢迎提交 Pull Request、报告 Bug，或通过社区审核机制参与导师信息的维护。
            项目代码托管于{' '}
            <a href="https://github.com/linkbag/GradChoice" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
              GitHub
            </a>
            ，遵循 MIT 协议。
          </p>
        </div>
      </section>
    </div>
  )
}
