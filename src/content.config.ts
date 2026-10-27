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
    coverImage: z.string().optional().default(''),
    coverAlt: z.string().optional().default(''),
    portraitImage: z.string().optional().default(''),
    portraitAlt: z.string().optional().default(''),
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
    image: z.string().optional().default(''),
    imageAlt: z.string().optional().default(''),
    order: z.number().int().nonnegative(),
    published: z.boolean()
  })
});

export const cursos = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/cursos' }),
  schema: z.object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    aula: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string(),
    summary: z.string(),
    description: z.string(),
    focus: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    image: z.string().optional().default(''),
    imageAlt: z.string().optional().default(''),
    order: z.number().int().nonnegative(),
    published: z.boolean()
  })
});
export const secciones = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/secciones' }),
  schema: z.object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    course: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string(),
    summary: z.string(),
    order: z.number().int().nonnegative(),
    published: z.boolean()
  })
});
export const lecciones = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/lecciones' }),
  schema: z.object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    section: z.string().min(1),
    title: z.string().min(1),
    summary: z.string(),
    order: z.number().int().nonnegative(),
    durationMinutes: z.number().nonnegative().default(0),
    status: z.enum(['published', 'planned', 'draft']),
    blocks: z.array(z.object({
      type: z.enum(['text', 'audio', 'video', 'image', 'practice', 'reflection', 'quote']),
      title: z.string().optional(),
      body: z.string().optional(),
      url: z.string().optional(),
      poster: z.string().optional(),
      alt: z.string().optional(),
      minutes: z.number().optional(),
      prompts: z.array(z.string()).optional()
    })).default([])
  })
});
export const homepage = defineCollection({
  loader: glob({pattern: '**/*.json', base: './src/content/home'}),
  schema: z.object({
    heroImage: z.string().min(1),
    heroAlt: z.string().min(1),
    heroPosition: z.string().default('center'),
    nucleoImage: z.string().min(1),
    nucleoAlt: z.string().min(1),
    onlineImage: z.string().min(1),
    onlineAlt: z.string().min(1),
    encountersImage: z.string().min(1),
    encountersAlt: z.string().min(1)
  })
});
export const collections = { aulas, recursos, cursos, secciones, lecciones, homepage };
