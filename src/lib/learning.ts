import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { path } from './paths';

export type Curso = CollectionEntry<'cursos'>['data'];
export type Seccion = CollectionEntry<'secciones'>['data'];
export type Leccion = CollectionEntry<'lecciones'>['data'];

export interface CourseSection {
  section: Seccion;
  lessons: Leccion[];
}
export interface CourseTree {
  sections: CourseSection[];
  available: Leccion[];
  plannedCount: number;
}

const byOrder = <T extends {order:number}>(entries: T[]): T[] =>
  [...entries].sort((a,b) => a.order-b.order);

export async function loadCourses(): Promise<Curso[]> {
  return byOrder((await getCollection('cursos', ({data})=>data.published)).map(x=>x.data));
}
export async function loadSections(): Promise<Seccion[]> {
  return byOrder((await getCollection('secciones', ({data})=>data.published)).map(x=>x.data));
}
export async function loadLessons(): Promise<Leccion[]> {
  return byOrder((await getCollection('lecciones', ({data})=>data.status!=='draft')).map(x=>x.data));
}
export function courseHref(aulaSlug: string, course: Curso): string {
  return path('/aulas/'+aulaSlug+'/'+course.slug+'/');
}
export function lessonHref(aulaSlug: string, course: Curso, section: Seccion, lesson: Leccion): string {
  return path('/aulas/'+aulaSlug+'/'+course.slug+'/'+section.slug+'/'+lesson.slug+'/');
}
export function courseTree(course: Curso, sections: Seccion[], lessons: Leccion[]): CourseTree {
  const groups=byOrder(sections.filter(section=>section.course===course.key))
    .map(section=>({
      section,
      lessons:byOrder(lessons.filter(lesson=>lesson.section===section.key))
    }));
  const flat=groups.flatMap(x=>x.lessons);
  return {
    sections:groups,
    available:flat.filter(x=>x.status==='published'),
    plannedCount:flat.filter(x=>x.status==='planned').length
  };
}
