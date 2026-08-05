import fs from 'node:fs'
import path from 'node:path'
import { ROOT, flattenText } from './lib.mjs'

export const MARKETING_MODEL = process.env.MARKETING_MODEL || 'llama-3.3-70b-versatile'

export function loadLocalEnv() {
  for (const file of ['.env','marketing/.env','ml/.env.local','webhook/.env.local']) {
    const full=path.resolve(ROOT,file); if(!fs.existsSync(full)) continue
    for(const line of fs.readFileSync(full,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
  }
}

function parseJson(text) { const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i); const raw=fenced?.[1]||text; const start=raw.indexOf('{'),end=raw.lastIndexOf('}'); if(start<0||end<start)throw new Error('Model returned no JSON object'); return JSON.parse(raw.slice(start,end+1)) }

async function complete(system, payload, { temperature=.45, maxTokens=1800 }={}) {
  loadLocalEnv(); const key=process.env.GROQ_API_KEY; if(!key)throw new Error('GROQ_API_KEY is not configured')
  const request={method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model:MARKETING_MODEL,temperature,max_tokens:maxTokens,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(payload)}]})}
  for(let attempt=0;attempt<4;attempt++){const response=await fetch('https://api.groq.com/openai/v1/chat/completions',request);if(response.ok)return parseJson((await response.json()).choices?.[0]?.message?.content||'');const body=(await response.text()).slice(0,500);if(response.status!==429||attempt===3)throw new Error(`Groq ${response.status}: ${body.slice(0,240)}`);const header=Number(response.headers.get('retry-after'));const hinted=Number(body.match(/try again in ([\d.]+)/i)?.[1]);const seconds=Math.min(20,Math.max(2,header||hinted||5));await new Promise(resolve=>setTimeout(resolve,seconds*1000))}
}

const immutable = candidate => Object.fromEntries(Object.entries(candidate.selected||{}).map(([k,v])=>[k,v]))
export async function angleWrite(candidate, fallbackPost) {
  const result=await complete(`You are MindCraft's marketing language layer. Deterministic code already chose the fact, pillar, audience, and slides. Return JSON only. Preserve every selected field byte-for-byte. Never alter puzzle math, answers, citations, or testimonials. No emoji, exclamation marks, title case, or banned words: quiz, wrong, incorrect, try again, drill, deficiency, deficit, aha moment, lightbulb moment, gamified, falling behind. Use second person, present tense, active voice, short declaratives. Output: {hook,caption,hashtags,slides:[{n,copy,alt}],authorship}. Keep existing template names and slide count. Hashtags max 8. Authorship must label every selected field as selected.`,{candidate:{...candidate,selected:immutable(candidate)},fallback_structure:fallbackPost})
  if(!result||typeof result.caption!=='string'||!Array.isArray(result.slides)||result.slides.length!==fallbackPost.slides.length)throw new Error('ANGLE/WRITE output failed shape validation')
  const slides=fallbackPost.slides.map((base,i)=>({...base,copy:result.slides[i]?.copy||base.copy,alt:result.slides[i]?.alt||base.alt}))
  let caption=result.caption;if(candidate.pillar==='research'){const tail=[candidate.selected.citation,candidate.selected.doi||candidate.selected.url].filter(Boolean).join(' · ');caption=`${caption.replace(tail,'').trim()}\n\n${tail}`}
  const post={...fallbackPost,hook:result.hook||fallbackPost.hook,caption,hashtags:Array.isArray(result.hashtags)?result.hashtags.slice(0,8):fallbackPost.hashtags,slides,authorship:{...fallbackPost.authorship},llm:{writer:{provider:'groq',model:MARKETING_MODEL,status:'live'}}}
  for(const [field,mode] of Object.entries(fallbackPost.authorship||{})){if(mode!=='selected')continue;const keys=field.split('.');let target=post,source=fallbackPost;for(let i=0;i<keys.length-1;i++){target=target[keys[i]];source=source[keys[i]]}target[keys.at(-1)]=source[keys.at(-1)]}
  return post
}

export async function judgePersonality(post) {
  const result=await complete(`Judge MindCraft marketing copy against exactly five traits: cinematic, electric, certain, human, unflinching. Return JSON {traits:{cinematic:{pass,line,reason},electric:{pass,line,reason},certain:{pass,line,reason},human:{pass,line,reason},unflinching:{pass,line,reason}}}. For every pass, line must quote the exact submitted line that earns it. For every miss, line must quote the exact failing line. A bare score is forbidden. Cinematic means scene and stakes, electric means sharp earned voltage, certain means declaratives without hedging, human means respect that knows what 2am feels like, unflinching means naming gaps without shame.`,{hook:post.hook,caption:post.caption,slides:post.slides.map(s=>s.copy)},{temperature:.1,maxTokens:1200})
  const names=['cinematic','electric','certain','human','unflinching'];if(!names.every(n=>typeof result.traits?.[n]?.pass==='boolean'&&typeof result.traits[n].line==='string'))throw new Error('Personality output failed shape validation')
  const submitted=flattenText({hook:post.hook,caption:post.caption,slides:post.slides.map(s=>s.copy)}).join('\n');for(const n of names)if(result.traits[n].line&&!submitted.includes(result.traits[n].line))throw new Error(`Personality judge cited a nonexistent line for ${n}`)
  const score=names.filter(n=>result.traits[n].pass).length;return {score,traits:result.traits,note:names.map(n=>`${n} ${result.traits[n].pass?'✓':'✗'} “${result.traits[n].line}”`).join(' · '),judge:`groq/${MARKETING_MODEL}`}
}
