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

export const collections = { notices };
