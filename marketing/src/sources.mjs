import { readJson } from './lib.mjs'

export function validateResearch(entries=readJson('marketing/sources/research.json')) {
 const errors=[]; for(const [i,e] of entries.entries()){for(const key of ['id','claim','citation','verified_by','verified_at'])if(!e[key])errors.push({index:i,field:key});if(!e.doi&&!e.url)errors.push({index:i,field:'doi|url'})} return {valid:!errors.length,errors}
}
export function validateTestimonials(entries=readJson('marketing/sources/testimonials.json')) {
 const errors=[];for(const [i,e] of entries.entries()){for(const key of ['id','quote','attribution','subject_type','collected_by','collected_at'])if(!e[key])errors.push({index:i,field:key});if(e.consent_on_file!==true)errors.push({index:i,field:'consent_on_file'});if(e.is_minor===true&&e.consent_scope!=='social_media')errors.push({index:i,field:'consent_scope'});if(!['tutor','student','parent'].includes(e.subject_type))errors.push({index:i,field:'subject_type'})}return {valid:!errors.length,errors}
}

export function privacyGate(candidate, floor=50) {
 const failures=[];if(candidate.pillar!=='data_insight')return {status:'pass',failures};if(!Number.isFinite(candidate.aggregate_n)||candidate.aggregate_n<floor)failures.push({rule:'k-anonymity',reason:`Reported cohorts require n ≥ ${floor}.`});if(candidate.contains_student_data)failures.push({rule:'aggregate only',reason:'No per-student data, ever.'});if(candidate.contains_identifiers)failures.push({rule:'identifiers',reason:'No student names, faces, handles, or verbatim free-text.'});return {status:failures.length?'block':'pass',failures}
}
