import fs from 'node:fs';
import path from 'node:path';

const dir = (folder) => {
  const dirName = path.join('src', 'content', folder);
  return fs.readdirSync(dirName).filter(f => f.endsWith('.json')).map(f => ({
    filename: f.replace(/\.json$/, ''),
    ...JSON.parse(fs.readFileSync(path.join(dirName,f), 'utf8'))
  }));
};
const aula=dir('aulas'), curso=dir('cursos'), seccion=dir('secciones'), leccion=dir('lecciones');
const errors=[];
const exists=(entries,key)=>entries.some(e=>e.key===key);
const inspect=(entries,label)=>{
 const names=new Set();
 for(const entry of entries){
   if(!/^[a-z0-9-]+$/.test(entry.slug||''))errors.push(label+' invalid slug: '+entry.slug);
   if(entry.key){
     if(entry.filename!==entry.key)errors.push(label+' filename differs from key: '+entry.filename);
     if(names.has(entry.key))errors.push(label+' duplicated key: '+entry.key);
     names.add(entry.key);
   }
 }
};
inspect(curso,'curso');inspect(seccion,'seccion');inspect(leccion,'leccion');
for(const c of curso){ if(!aula.some(a=>a.slug===c.aula)) errors.push('Missing aula for course '+c.key); }
for(const s of seccion){ if(!exists(curso,s.course))errors.push('Missing course for section '+s.key); }
for(const l of leccion){
 if(!exists(seccion,l.section))errors.push('Missing section for lesson '+l.key);
 if(!['published','planned','draft'].includes(l.status))errors.push('Bad lesson status: '+l.key);
 if(l.status==='published' && (!Array.isArray(l.blocks) || l.blocks.length===0))errors.push('Published lesson has no content: '+l.key);
 if(l.status!=='published' && Array.isArray(l.blocks) && l.blocks.length>0)errors.push('Unpublished lesson has blocks in public source: '+l.key);
}
for(const c of curso.filter(c=>c.published)){
 const related=seccion.filter(s=>s.course===c.key&&s.published);
 const pairs=new Set();
 for(const s of related){
   if(pairs.has(s.slug))errors.push('Duplicate section slug in '+c.key+': '+s.slug);
   pairs.add(s.slug);
   const paths=new Set();
   for(const l of leccion.filter(l=>l.section===s.key)){
     if(paths.has(l.slug))errors.push('Duplicate lesson slug in '+s.key+': '+l.slug);
     paths.add(l.slug);
   }
 }
}
if(errors.length){ console.error(errors.join('\n')); process.exit(1); }
console.log(`Content relationships valid: ${aula.length} Aulas, ${curso.length} courses, ${seccion.length} sections, ${leccion.length} lessons.`);
