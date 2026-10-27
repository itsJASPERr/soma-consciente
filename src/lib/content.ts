import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type Aula = CollectionEntry<'aulas'>['data'];
export type Resource = CollectionEntry<'recursos'>['data'];

export async function loadAulas(): Promise<Aula[]> {
  const entries = await getCollection('aulas', ({ data }) => data.published);
  return entries.map(({ data }) => data).sort((a, b) => a.order - b.order);
}

export async function loadResources(): Promise<Resource[]> {
  const entries = await getCollection('recursos', ({ data }) => data.published);
  return entries.map(({ data }) => data).sort((a, b) => a.order - b.order);
}
