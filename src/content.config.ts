import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** Single source of truth: Pages CMS edits these JSON files in GitHub. */
export const aulas = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/aulas' }),
  schema: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    shortName: z.string().min(1),
    guide: z.string().min(1),
    qualification: z.string(),
    theme: z.enum(['terra', 'azul', 'oro', 'verde']),
    symbol: z.enum(['heart', 'sound', 'horse', 'body']),
    summary: z.string().min(1),
    description: z.string().min(1),
    approach: z.string().min(1),
    practices: z.array(z.string()),
    invitation: z.string(),
    order: z.number().int().nonnegative(),
    published: z.boolean()
  })
});

export const recursos = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/recursos' }),
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    category: z.string().min(1),
    summary: z.string().min(1),
    duration: z.string(),
    introduction: z.string(),
    sections: z.array(z.object({
      heading: z.string().min(1),
      body: z.string().min(1)
    })),
    reflection: z.string(),
    order: z.number().int().nonnegative(),
    published: z.boolean()
  })
});

export const collections = { aulas, recursos };
