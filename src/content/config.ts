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

export const collections = { notices, demands, experts };
