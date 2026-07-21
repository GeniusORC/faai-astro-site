import siteCfg from './data/site.json';

// 全站配置：标题、表单后端地址等「代码级结构配置」在此。
// 注：导航 / 联系邮箱 / 页脚 / 公告等「可编辑站点内容」已迁移到 src/data/site.json，
// 由 Decap CMS「站点配置 → 站点信息」后台管理；改文案无需动代码。
export const SITE = {
  title: '福建省人工智能学会企业工作委员会',
  short: '企工委',
  desc: '汇聚企业需求，链接学会专家。提供需求对接、专家登记、入会申请、课题申报与活动交流一站式服务。',
  // 免费自托管表单后端：Cloudflare Worker（*.workers.dev 子域，免购域名）
  // 部署见 worker/ 目录与 SETUP.md「表单免费自托管」一节。
  // 也支持腾讯问卷免费档（见 SETUP.md 零代码备选）：在对应页面传 surveyUrl 即可。
  formEndpoint: 'https://faai-forms.450311590.workers.dev/submit',
};

export const NAV = siteCfg.nav;
export const SITE_CFG = siteCfg;
