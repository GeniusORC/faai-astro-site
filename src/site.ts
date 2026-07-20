// 全站配置：标题、导航、表单后端地址（部署前替换）
export const SITE = {
  title: '福建省人工智能学会企业工作委员会',
  short: 'AI 企工委',
  desc: '汇聚企业需求，链接学会专家。提供需求对接、专家登记、入会申请、课题申报与活动交流一站式服务。',
  // 免费自托管表单后端：Cloudflare Worker（*.workers.dev 子域，免购域名）
  // 部署见 worker/ 目录与 SETUP.md「表单免费自托管」一节。
  // 也支持腾讯问卷免费档（见 SETUP.md 零代码备选）：在对应页面传 surveyUrl 即可。
  formEndpoint: 'https://faai-forms.YOUR_SUBDOMAIN.workers.dev/submit',
};

export const NAV = [
  { href: '/', label: '首页' },
  { href: '/gong-wei-jian-jie', label: '工委简介' },
  { href: '/xu-qiu-ku', label: '企业需求库' },
  { href: '/zhuan-jia', label: '专家登记' },
  { href: '/ru-hui', label: '入会申请' },
  { href: '/ke-ti', label: '课题申请' },
  { href: '/notices', label: '活动通知' },
];
