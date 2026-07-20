import { defineCollection, z } from 'astro:content';

const notices = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.string().default('活动通知'),
    excerpt: z.string().optional(),
  }),
});

const demands = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    company: z.string(),
    category: z.enum(['技术攻关', '人才团队', '场景数据', '成果转化', '其他']).default('技术攻关'),
    contact: z.string().optional(),
    excerpt: z.string().optional(),
  }),
});

const experts = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    title: z.string(),
    org: z.string(),
    field: z.string(),
    email: z.string().email().optional(),
    avatar: z.string().optional(),
    order: z.number().default(0),
  }),
});

const members = defineCollection({
  type: 'content',
  schema: z.object({
    org: z.string(),
    type: z.enum(['企业会员', '个人会员', '团体会员']).default('企业会员'),
    contact: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    business: z.string().optional(),
    order: z.number().default(0),
  }),
});

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    lead: z.string(),
    type: z.enum(['联合攻关', '企业委托', '学生课题', '开放课题']).default('联合攻关'),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    abstract: z.string().optional(),
    order: z.number().default(0),
  }),
});

export const collections = { notices, demands, experts, members, projects };
