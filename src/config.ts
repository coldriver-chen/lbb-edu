import { defineCollection, z } from 'astro:content';

const contentCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    order: z.number(),
  }),
});

export const collections = {
  content: contentCollection,
};
