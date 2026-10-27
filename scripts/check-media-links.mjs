import fs from 'node:fs';
import path from 'node:path';
const files=[
 'src/content/home/home.json',
 ...['nicole','jasper','yanina','nico'].map(x=>'src/content/aulas/'+x+'.json'),
 ...['primeros-pasos-meditacion','pausa-de-presencia','diario-de-integracion'].map(x=>'src/content/recursos/'+x+'.json'),
 'src/content/cursos/jasper-musica-medicina.json'
];
const keys=['heroImage','nucleoImage','onlineImage','encountersImage','coverImage','image'];
const checks=[];
for(const f of files){
  const entry=JSON.parse(fs.readFileSync(f,'utf8'));
  for(const key of keys){
    const value=entry[key];
    if(typeof value==='string'&&value.startsWith('http'))checks.push({file:f,key,url:value});
  }
}
const outcomes=await Promise.all(checks.map(async item=>{
  try{
    const res=await fetch(item.url,{method:'GET',signal:AbortSignal.timeout(10000),headers:{Accept:'image/*'}});
    await res.body?.cancel();
    return {...item,status:res.status,ok:res.ok,contentType:res.headers.get('content-type')};
  }catch(e){return {...item,ok:false,error:String(e).slice(0,140)};}
}));
console.log(JSON.stringify(outcomes,null,2));
if(outcomes.some(x=>!x.ok||!x.contentType?.startsWith('image/'))){
  console.error('Invalid or unreachable editorial image URLs (or temporary network restriction).');
  process.exitCode=1;
}
