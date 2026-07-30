import test from 'node:test'
import assert from 'node:assert/strict'
import { harvest, lintVocab, schedule, verifyAuthorship } from '../src/lib.mjs'
import { lintComposition } from '../src/render.mjs'
import { validateResearch, validateTestimonials, privacyGate } from '../src/sources.mjs'
import { selectPublishable, publishRun } from '../src/drive.mjs'

test('harvest resolves at least 30 real candidates',()=>{const c=harvest();assert.ok(c.length>=30);assert.ok(c.every(x=>x.evidence.source_file&&x.evidence.source_id))})
test('hard and soft vocabulary severities differ',()=>{assert.equal(lintVocab('This quiz starts now.').status,'block');assert.equal(lintVocab('The user starts now.').status,'warn')})
test('mutated selected text is blocked',()=>{const post={evidence:{source_file:'app/src/data/eediQuestions.json'},slides:[{copy:{question:'deliberately mutated fixture text'}}],authorship:{'slides.0.copy.question':'selected'}};assert.equal(verifyAuthorship(post).status,'block')})
test('real selected text passes',()=>{const c=harvest().find(x=>x.pillar==='the_miss');const post={evidence:c.evidence,slides:[{copy:{question:c.selected.question}}],authorship:{'slides.0.copy.question':'selected'}};assert.equal(verifyAuthorship(post).status,'pass')})
test('two lime elements fail composition',()=>{const post={slides:[{n:1,template:'stat_card',copy:{headline:'One signal'},limeElements:2}]};assert.equal(lintComposition(post).status,'fail')})
test('scheduler never exceeds budget or truncates',()=>{const candidates=harvest();const result=schedule(candidates);assert.ok(result.slidesUsed<=10);assert.equal(result.slidesUsed,result.candidates.reduce((n,c)=>n+c.slideCount,0))})
test('empty human source files validate',()=>{assert.equal(validateResearch([]).valid,true);assert.equal(validateTestimonials([]).valid,true)})
test('testimonial consent hard blocks',()=>{const e={id:'t',quote:'q',attribution:'A, tutor',subject_type:'tutor',is_minor:false,consent_on_file:false,collected_by:'b',collected_at:'2026-01-01'};assert.equal(validateTestimonials([e]).valid,false)})
test('origin and aggregate insight candidates are harvested',()=>{const c=harvest();assert.ok(c.some(x=>x.pillar==='the_origin'));assert.ok(c.some(x=>x.pillar==='data_insight'&&x.aggregate_n>=50))})
test('privacy floor blocks small or identifying cohorts',()=>{assert.equal(privacyGate({pillar:'data_insight',aggregate_n:49,contains_student_data:false}).status,'block');assert.equal(privacyGate({pillar:'data_insight',aggregate_n:50,contains_student_data:false,contains_identifiers:false}).status,'pass')})
test('blocked posts never publish to Drive',()=>{const posts=[{id:'a',status:'ready'},{id:'b',status:'blocked'},{id:'c',status:'needs_edit'}];assert.deepEqual(selectPublishable(posts).map(p=>p.id),['a','c'])})
test('publish refuses to run without a configured Drive folder',async()=>{const saved=process.env.MARKETING_DRIVE_FOLDER_ID;delete process.env.MARKETING_DRIVE_FOLDER_ID;await assert.rejects(()=>publishRun('2026-01-01','/tmp',[{id:'a',status:'ready',slides:[],caption:'c',hashtags:[]}]),/MARKETING_DRIVE_FOLDER_ID/);if(saved)process.env.MARKETING_DRIVE_FOLDER_ID=saved})
