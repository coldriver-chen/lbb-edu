// 1. 从 `astro:content` 导入工具函数
import { defineCollection } from 'astro:content';

// 2. 导入加载器
import { glob } from 'astro/loaders';

// 3. 导入 Zod
import { z } from 'astro/zod';

// 4. 为每个集合定义一个 `loader` 和 `schema`
const tabContent = defineCollection({
    loader: glob({ base: './src/content', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        title: z.string(),
        order: z.number(),
    }),
});

// 5. 导出一个 `collections` 对象来注册你的集合
export const collections = { tabContent };
