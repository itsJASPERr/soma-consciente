import { getEntry } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type Homepage = CollectionEntry<'homepage'>['data'];
export async function loadHomepage(): Promise<Homepage> {
  const entry = await getEntry('homepage', 'home');
  if (!entry) throw new Error('Missing homepage image settings: src/content/home/home.json');
  return entry.data;
}
