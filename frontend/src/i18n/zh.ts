// 中文界面文本
export const zh = {
  nav: {
    home: '首页',
    search: '搜索导师',
    about: '关于我们',
    login: '登录',
    register: '注册',
    profile: '我的主页',
    inbox: '私信',
    logout: '退出登录',
  },
  home: {
    hero_title: '研选 GradChoice',
    hero_subtitle: '中立、公开、免费的研究生导师匿名评分平台',
    hero_cta: '搜索导师',
    mission_title: '我们的使命',
    mission_text: '帮助研究生做出明智的导师选择，保障学术发展与身心健康。',
    principles: [
      { title: '中立客观', desc: '平台不持立场，忠实呈现社区评价' },
      { title: '公开透明', desc: '所有评分数据公开可查，算法透明' },
      { title: '免费开源', desc: '永久免费，代码开源，接受公众监督' },
    ],
  },
  search: {
    placeholder: '搜索导师姓名、院校或院系…',
    filter_province: '选择省份',
    filter_school: '选择院校',
    no_results: '未找到相关导师',
    result_count: (n: number) => `共找到 ${n} 位导师`,
  },
  supervisor: {
    rating_count: (n: number) => `${n} 条评价`,
    verified_badge: '认证学生',
    score_labels: {
      overall: '综合评分',
      academic: '学术水平',
      mentoring: '学生培养',
      wellbeing: '身心健康',
      stipend: '生活补助',
      resources: '科研资源',
      ethics: '学术道德',
    },
    write_review: '写评价',
    no_ratings: '暂无评价，成为第一个评价者',
  },
  auth: {
    login_title: '登录',
    register_title: '注册',
    email_label: '邮箱',
    password_label: '密码',
    display_name_label: '昵称（可选）',
    login_btn: '登录',
    register_btn: '注册',
    no_account: '没有账号？',
    has_account: '已有账号？',
  },
  errors: {
    network: '网络错误，请稍后重试',
    unauthorized: '请先登录',
    not_found: '页面不存在',
    server: '服务器错误',
  },
}

export type ZhKeys = typeof zh
