import fs from 'node:fs'
import path from 'node:path'

export const ROOT = path.resolve(import.meta.dirname, '../..')
export const TOKENS = { deepField: '#080e14', chalk: '#f5f5f5', click: '#c4f547', stakes: '#c1121f', depth: '#1d3a8a' }
export const readJson = p => JSON.parse(fs.readFileSync(path.resolve(ROOT, p), 'utf8'))
export const writeJson = (p, value) => { const full = path.resolve(ROOT, p); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, JSON.stringify(value, null, 2) + '\n') }
export const dateArg = value => value || new Date().toISOString().slice(0, 10)
export const flattenText = value => typeof value === 'string' || typeof value === 'number' ? [String(value)] : Array.isArray(value) ? value.flatMap(flattenText) : value && typeof value === 'object' ? Object.values(value).flatMap(flattenText) : []
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c])
export const sentenceCase = text => !/(^|[.!?]\s+)[A-Z][a-z]+(?:\s+[A-Z][a-z]+){2,}/.test(text)

export function harvest() {
  const misconceptions = readJson('ml/data/eedi_misconceptions.json')
  const questions = readJson('app/src/data/eediQuestions.json')
  const questionById = new Map(questions.map(q => [q.id, q]))
  const stemsFile = readJson('app/src/data/themedStems.generated.json')
  const stories = readJson('app/src/data/conceptStories.json')
  const candidates = []
  for (const [id, m] of Object.entries(misconceptions)) {
    const q = m.example_question_ids.map(x => questionById.get(x)).find(Boolean)
    if (!q) continue
    candidates.push({ id: `miss__${id}`, pillar: 'the_miss', audience: 'student', conceptId: m.concept_ids[0], slideCount: 3, score: m.occurrence_count, evidence: { source_file: 'app/src/data/eediQuestions.json', source_id: q.id, misconception_source: `ml/data/eedi_misconceptions.json#${id}`, stat: `${m.occurrence_count} tagged questions, ${m.example_question_ids.length} examples on file` }, selected: { question: q.question, choices: q.choices, answer: q.choices[q.correctIndex] }, meta: { misconception: m.eedi_name.trim(), occurrenceCount: m.occurrence_count } })
  }
  for (const [key, stem] of Object.entries(stemsFile.stems || {})) {
    const parts = key.split('__'); const conceptId = parts[0]; const questionId = parts.at(-1)
    const q = questionById.get(questionId) || questions.find(x => x.id === questionId)
    if (!q) continue
    candidates.push({ id: `win__${key}`, pillar: 'quick_win', audience: 'student', conceptId, slideCount: 2, score: 2, evidence: { source_file: 'app/src/data/themedStems.generated.json', source_files: ['app/src/data/themedStems.generated.json','app/src/data/eediQuestions.json'], source_id: key, answer_source_id: q.id, stat: 'numeric-preservation validated at bake time' }, selected: { question: stem, answer: q.choices[q.correctIndex] } })
  }
  for (const [conceptId, story] of Object.entries(stories)) {
    const image = `img/story-${conceptId.replaceAll('_','-')}.jpg`
    if (!fs.existsSync(path.resolve(ROOT, image))) continue
    const rawThreshold=story.scenes?.[0]?.questionBridge || story.story
    const threshold=rawThreshold.length <= 520 ? rawThreshold : rawThreshold.slice(0, rawThreshold.lastIndexOf('.', 520) + 1 || 520)
    candidates.push({ id: `katha__${conceptId}`, pillar: 'katha', audience: 'student', conceptId, slideCount: 1, score: 3, evidence: { source_file: 'app/src/data/conceptStories.json', source_id: conceptId, stat: image }, selected: { story: threshold, image } })
  }
  const ontology=readJson('ml/data/ontology.json'); const names=new Map((ontology.concepts||[]).map(c=>[c.id,c.name])); const incoming=new Map()
  for(const edge of ontology.edges||[]){if(edge.relation!=='prerequisite')continue;const list=incoming.get(edge.to)||[];list.push(edge.from);incoming.set(edge.to,list)}
  for(const [target,prereqs] of incoming){if(prereqs.length<1)continue;const chain=[...prereqs.slice(0,3),target];candidates.push({id:`origin__${target}`,pillar:'the_origin',audience:'parent',conceptId:target,slideCount:1,score:4+chain.length,evidence:{source_file:'ml/data/ontology.json',source_id:target,stat:`${chain.length-1} prerequisite links resolve into ${names.get(target)||target}`},selected:{chain},meta:{chainNames:chain.map(id=>names.get(id)||id.replaceAll('_',' '))}})}
  const counts=new Map();for(const q of questions)counts.set(q.conceptId,(counts.get(q.conceptId)||0)+1)
  for(const [conceptId,n] of counts){if(n<50)continue;candidates.push({id:`insight__${conceptId}`,pillar:'data_insight',audience:'parent',conceptId,slideCount:1,score:n,evidence:{source_file:'app/src/data/eediQuestions.json',source_id:conceptId,stat:`${n} anonymized question records in the bank`},selected:{aggregate_n:n},aggregate_n:n,contains_student_data:false,contains_identifiers:false,meta:{conceptName:names.get(conceptId)||conceptId.replaceAll('_',' ')}})}
  for(const e of readJson('marketing/sources/research.json'))if(e.id&&e.claim&&e.citation&&e.verified_by&&(e.doi||e.url))candidates.push({id:`research__${e.id}`,pillar:'research',audience:'parent',slideCount:1,score:4,evidence:{source_file:'marketing/sources/research.json',source_id:e.id,stat:e.citation},selected:{citation:e.citation,doi:e.doi||'',url:e.url||'',verbatim_quote:e.verbatim_quote||''},meta:{claim:e.claim}})
  for(const e of readJson('marketing/sources/testimonials.json'))if(e.id&&e.consent_on_file===true&&(!e.is_minor||e.consent_scope==='social_media'))candidates.push({id:`testimonial__${e.id}`,pillar:'testimonial',audience:e.subject_type==='student'?'student':'parent',slideCount:1,score:4,evidence:{source_file:'marketing/sources/testimonials.json',source_id:e.id,stat:`consent on file · ${e.consent_scope}`},selected:{quote:e.quote,attribution:e.anonymize===false&&!e.is_minor?e.attribution:e.attribution.split(/\s+/).slice(0,2).join(' ')},meta:{subject_type:e.subject_type}})
  return candidates.sort((a,b) => b.score-a.score || a.id.localeCompare(b.id))
}

const hardTerms = [
  ['quiz','A quiz judges you at school. A challenge invites you into a story. "Quiz" is banned outright.'], ['wrong','"Wrong" is a verdict on the person. "Not yet" is a fact about time.'], ['incorrect','"Incorrect" is "wrong" wearing a lab coat. Same verdict, colder delivery.'], ['try again','MindCraft always points at what to see differently first.'], ['drill','Practice is what musicians and athletes do on purpose.'], ['deficiency','Weakness is honest and useful when it describes the map.'], ['deficit','Weakness is honest and useful when it describes the map.'], ['aha moment','The click is the brand\'s own word for its own promise.'], ['lightbulb moment','The click is the brand\'s own word for its own promise.'], ['gamified','The story is load-bearing.'], ['falling behind','A gap is a location on a map: findable, closeable, gone when closed.']
]
const softTerms = ['user','content','easy','reward','complete','finish','app','platform','homework','instructor','coach','mentor','placement test','diagnostic test']
export function lintVocab(value) {
  const text = flattenText(value).join('\n'); const lower = text.toLowerCase(); const failures=[]; const warnings=[]
  for (const [term, reason] of hardTerms) if (new RegExp(`\\b${term.replace(' ', '\\s+')}\\b`, 'i').test(text)) failures.push({ rule: term, reason })
  if (/!/.test(text)) failures.push({ rule: 'exclamation marks', reason: 'Sentence case everywhere. No exclamation marks in UI chrome.' })
  if (/\p{Extended_Pictographic}/u.test(text)) failures.push({ rule: 'emoji', reason: 'No emoji in product copy, ever.' })
  if (/\bcan['’]t\b(?![^.!?]{0,20}\byet\b)/i.test(text)) failures.push({ rule: "unqualified can't", reason: 'Yet is the single most important word in the vocabulary.' })
  if (!sentenceCase(text)) failures.push({ rule: 'sentence case', reason: 'Sentence case everywhere.' })
  for (const term of softTerms) if (new RegExp(`\\b${term.replace(' ', '\\s+')}\\b`, 'i').test(lower)) warnings.push({ rule: term, reason: 'Context-dependent brand vocabulary; human review required.' })
  if (/\b(smart|dumb)\b/i.test(text)) failures.push({ rule: 'smart/dumb as identity', reason: 'Praise the seeing, never the ceiling.' })
  return { status: failures.length ? 'block' : warnings.length ? 'warn' : 'pass', failures, warnings }
}

export function verifyAuthorship(post) {
  const failures=[]
  for (const [field, mode] of Object.entries(post.authorship || {})) {
    if (mode !== 'selected') continue
    const value = field.split('.').reduce((v,k) => v?.[k], post)
    const sourceValues = (post.evidence.source_files || [post.evidence.source_file]).flatMap(file => flattenText(readJson(file)))
    for (const text of flattenText(value)) if (text && !sourceValues.some(source => source.includes(text))) failures.push({ field, reason: 'Selected text is not verbatim in its cited source.' })
  }
  return { status: failures.length ? 'block' : 'pass', failures }
}

export function schedule(candidates, config = readJson('marketing/config/mix.json')) {
  const picked=[]; let spent=0; const quota={...config.weeklyPillarQuotas}; let last=''
  const pool=candidates.filter(c => quota[c.pillar] > 0)
  while (pool.length) {
    const index=pool.findIndex(c => c.pillar !== last && c.slideCount + spent <= config.slideBudget && quota[c.pillar] > 0)
    if (index < 0) break
    const [c]=pool.splice(index,1); picked.push(c); spent+=c.slideCount; quota[c.pillar]--; last=c.pillar
  }
  return { candidates: picked, slideBudget: config.slideBudget, slidesUsed: spent }
}

const shorten=(s,n=145)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s
export function writePost(candidate, date, index) {
  const num=String(index+1).padStart(3,'0'); const common={ id:`${date}-${num}`, pillar:candidate.pillar, audience:candidate.audience, conceptId:candidate.conceptId, evidence:candidate.evidence, rank:{ evidence:candidate.score, days_since_concept_posted:90, calendar_hook:null }, hashtags:['#MindCraft','#MathStories'], gate:{}, status:'needs_edit' }
  if(candidate.pillar==='the_miss') return {...common, hook:'The trap looks harmless.', caption:`The trap looks harmless. Watch where the order changes. The gap has a name, and a named gap has a way through.`, slides:[{n:1,template:'question_card',copy:{eyebrow:'The miss',headline:'Where does the path turn?',question:candidate.selected.question},alt:'A math challenge on a dark background.'},{n:2,template:'question_card',copy:{eyebrow:'The path',headline:'One step changes everything',body:`${candidate.meta.occurrenceCount} questions carry this same trap.`},alt:'A prompt to inspect the order of operations.'},{n:3,template:'reveal_card',copy:{eyebrow:'The reveal',headline:'The order is the whole move',answer:candidate.selected.answer,body:shorten(candidate.meta.misconception)},alt:'The answer and named misconception on a dark background.'}],authorship:{'slides.0.copy.question':'selected','slides.2.copy.answer':'selected'}}
  if(candidate.pillar==='quick_win') return {...common, hook:'A short path. Real stakes.', caption:'A short path. Real stakes. Take the next move, then check the reveal.',slides:[{n:1,template:'question_card',copy:{eyebrow:'Quick win',headline:'Take the next move',question:candidate.selected.question},alt:'A short story-framed math challenge.'},{n:2,template:'reveal_card',copy:{eyebrow:'The reveal',headline:'There it is.',answer:candidate.selected.answer},alt:'The answer revealed on a dark background.'}],authorship:{'slides.0.copy.question':'selected','slides.1.copy.answer':'selected'}}
  if(candidate.pillar==='the_origin')return {...common,hook:'The gap starts earlier than the problem.',caption:`The gap starts earlier than the problem. You follow the path into ${candidate.meta.chainNames.at(-1)}. The map shows the way through.`,slides:[{n:1,template:'chain_diagram',copy:{eyebrow:'The origin',headline:'The problem behind the problem',body:candidate.meta.chainNames.join('  →  ')},alt:`A prerequisite chain ending at ${candidate.meta.chainNames.at(-1)}.`}],authorship:{}}
  if(candidate.pillar==='data_insight')return {...common,hook:'One problem hides the larger pattern.',caption:`You see one problem. The map sees ${candidate.selected.aggregate_n} question records shaping the same gap in ${candidate.meta.conceptName}. There it is. The route through becomes visible.`,slides:[{n:1,template:'stat_card',copy:{eyebrow:'Data insight',headline:String(candidate.selected.aggregate_n),body:`question records map ${candidate.meta.conceptName}`},alt:`A chart card showing ${candidate.selected.aggregate_n} aggregated question records for ${candidate.meta.conceptName}.`}],authorship:{'slides.0.copy.headline':'selected'}}
  if(candidate.pillar==='research')return {...common,hook:'The schedule changes what stays.',caption:`${candidate.meta.claim}\n\n${candidate.selected.citation}${candidate.selected.doi?` · ${candidate.selected.doi}`:''}`,citation:candidate.selected.citation,doi:candidate.selected.doi,slides:[{n:1,template:'stat_card',copy:{eyebrow:'Research',headline:'The schedule changes what stays',body:candidate.meta.claim},alt:'A research claim on a dark background.'}],authorship:{citation:'selected',doi:'selected'}}
  if(candidate.pillar==='testimonial')return {...common,hook:candidate.selected.quote,caption:`“${candidate.selected.quote}”\n\n${candidate.selected.attribution}`,slides:[{n:1,template:'quote_card',copy:{eyebrow:'From across the table',headline:candidate.selected.quote,body:candidate.selected.attribution},alt:`A testimonial from ${candidate.selected.attribution}.`}],authorship:{'slides.0.copy.headline':'selected','slides.0.copy.body':'selected'}}
  return {...common,hook:'The problem is already in motion.',caption:'The problem is already in motion. The story stops at the threshold. You take the next move.',slides:[{n:1,template:'katha_page',copy:{eyebrow:'A Katha story',headline:'The threshold',body:candidate.selected.story},image:candidate.selected.image,alt:'A cinematic Katha story scene on a dark background.'}],authorship:{'slides.0.copy.body':'selected'}}
}
