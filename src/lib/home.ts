import { getEntry } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { mediaUrl } from './media';

export type Homepage = CollectionEntry<'homepage'>['data'];
export async function loadHomepage(): Promise<Homepage> {
  const entry = await getEntry('homepage', 'home');
  if (!entry) throw new Error('Missing homepage image settings: src/content/home/home.json');
  return entry.data;
}

export function getOnlineCirclePhoto(home: Homepage) {
  const src = mediaUrl(home.onlineCircleImage);
  if (!src) return { src: mediaUrl(home.onlineImage) ?? undefined, alt: home.onlineAlt };

  return { src, alt: home.onlineCircleAlt ?? '', position: home.onlineCirclePosition };
}
