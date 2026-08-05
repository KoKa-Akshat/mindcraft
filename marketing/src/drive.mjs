import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ROOT } from './lib.mjs'
import { loadLocalEnv } from './llm.mjs'

// Drive is the inspection surface: each run's slides and contact sheet land in a shared
// folder so a reviewer sees the batch without waiting for a push. Decision capture still
// belongs to the review page — Drive comments are the lightweight stand-in until the
// hosted page exists. Nothing here publishes to Instagram.

export const SCOPE = 'https://www.googleapis.com/auth/drive.file'
export { ROOT }
const FOLDER_MIME = 'application/vnd.google-apps.folder'
// drive.file only grants access to files this app created, so the pipeline owns its root
// folder rather than writing into one made by hand. A folder created in the Drive UI is
// invisible to this scope and returns 404.
const ROOT_FOLDER_NAME = process.env.MARKETING_DRIVE_ROOT_NAME || 'MindCraft Marketing'

// Drive is organised by post type, not by date: browsing "Stories" or "Testimonials" is
// how anyone actually looks for an asset later. Batch contact sheets keep the date axis.
export const PILLAR_FOLDERS = {
  the_miss: 'The Miss',
  quick_win: 'Quick Wins',
  katha: 'Stories',
  research: 'Research',
  data_insight: 'Data Insights',
  testimonial: 'Testimonials',
  the_verdict: 'The Verdict',
  the_origin: 'The Origin',
  jordan: 'Tutor Recruiting',
}
const BATCHES_FOLDER = 'Batches'
const base64url = buffer => Buffer.from(buffer).toString('base64').replaceAll('+','-').replaceAll('/','_').replaceAll('=','')

export function loadServiceAccount() {
  loadLocalEnv(); const raw=process.env.MARKETING_DRIVE_SERVICE_ACCOUNT
  if(!raw) throw new Error('MARKETING_DRIVE_SERVICE_ACCOUNT is not configured (path to a service-account JSON, or the JSON itself)')
  const text=raw.trim().startsWith('{') ? raw : fs.readFileSync(path.resolve(ROOT,raw),'utf8')
  const account=JSON.parse(text); if(!account.client_email||!account.private_key) throw new Error('Service account JSON is missing client_email or private_key')
  return account
}

// Personal Gmail uses OAuth (files owned by the user, whose quota applies). Service
// accounts stay supported for Workspace Shared Drives, where the drive owns the files.
export async function accessToken() {
  loadLocalEnv()
  return process.env.MARKETING_DRIVE_REFRESH_TOKEN ? userToken() : serviceAccountToken()
}

async function userToken() {
  const {MARKETING_DRIVE_CLIENT_ID:id,MARKETING_DRIVE_CLIENT_SECRET:secret,MARKETING_DRIVE_REFRESH_TOKEN:refresh}=process.env
  if(!id||!secret) throw new Error('MARKETING_DRIVE_CLIENT_ID and MARKETING_DRIVE_CLIENT_SECRET are required alongside the refresh token')
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:id,client_secret:secret,refresh_token:refresh,grant_type:'refresh_token'})})
  if(!response.ok){const body=(await response.text()).slice(0,240);throw new Error(`Drive refresh failed ${response.status}: ${body}${/invalid_grant/.test(body)?'\nThe refresh token expired or was revoked. Consent screens left in Testing mode expire tokens after 7 days — publish the app, then re-run node marketing/src/drive-auth.mjs.':''}`)}
  return (await response.json()).access_token
}

export async function serviceAccountToken(account=loadServiceAccount()) {
  const now=Math.floor(Date.now()/1000)
  const claim={iss:account.client_email,scope:SCOPE,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}
  const unsigned=`${base64url(JSON.stringify({alg:'RS256',typ:'JWT'}))}.${base64url(JSON.stringify(claim))}`
  const signature=base64url(crypto.createSign('RSA-SHA256').update(unsigned).sign(account.private_key))
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${signature}`})})
  if(!response.ok) throw new Error(`Drive token exchange failed ${response.status}: ${(await response.text()).slice(0,240)}`)
  return (await response.json()).access_token
}

async function driveJson(url, token, init={}) {
  const response=await fetch(url,{...init,headers:{authorization:`Bearer ${token}`,...init.headers}})
  if(!response.ok) throw new Error(`Drive ${init.method||'GET'} ${response.status}: ${(await response.text()).slice(0,240)}`)
  return response.json()
}

export async function ensureFolder(name, parentId, token) {
  const query=encodeURIComponent(`name='${name.replaceAll("'","\\'")}' and '${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`)
  const found=await driveJson(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,token)
  if(found.files?.length) return found.files[0].id
  const created=await driveJson('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true',token,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,parents:[parentId],mimeType:FOLDER_MIME})})
  return created.id
}

export async function uploadFile(name, body, mimeType, parentId, token) {
  const boundary=`mindcraft-${crypto.randomUUID()}`
  const head=Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name,parents:[parentId]})}\r\n--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`)
  const payload=Buffer.concat([head,Buffer.from(body),Buffer.from(`\r\n--${boundary}--\r\n`)])
  return driveJson('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true',token,{method:'POST',headers:{'content-type':`multipart/related; boundary=${boundary}`},body:payload})
}

// §13 privacy floor: blocked posts never leave the repo.
export const selectPublishable = posts => posts.filter(p=>p.status!=='blocked')

// With drive.file the app must own its root, so it creates one when no folder is pinned.
export async function ensureRootFolder(token) {
  const query=encodeURIComponent(`name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`)
  const found=await driveJson(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&supportsAllDrives=true`,token)
  if(found.files?.length) return found.files[0].id
  const created=await driveJson('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true',token,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:ROOT_FOLDER_NAME,mimeType:FOLDER_MIME})})
  return created.id
}

// 'oauth' for a personal Drive, 'service_account' for a Workspace Shared Drive, null if
// neither is configured. Pure so the guard is testable without touching the environment.
export const driveMode = (env=process.env) => env.MARKETING_DRIVE_REFRESH_TOKEN ? 'oauth' : env.MARKETING_DRIVE_SERVICE_ACCOUNT ? 'service_account' : null

export async function publishRun(date, runDir, posts, { contactSheetPdf }={}) {
  loadLocalEnv()
  if(!driveMode()) throw new Error('Drive is not configured. Run node marketing/src/drive-auth.mjs to authorise, or set MARKETING_DRIVE_SERVICE_ACCOUNT for a Workspace Shared Drive.')
  const publishable=selectPublishable(posts); const withheld=posts.length-publishable.length
  const token=await accessToken()
  const parent=process.env.MARKETING_DRIVE_FOLDER_ID||await ensureRootFolder(token)
  // Create the full taxonomy every run, so the shape of the plan is visible even in weeks
  // a pillar produces nothing.
  const pillarFolders={}
  for(const [pillar,name] of Object.entries(PILLAR_FOLDERS)) pillarFolders[pillar]=await ensureFolder(name,parent,token)
  const uploaded=[]
  if(contactSheetPdf&&fs.existsSync(contactSheetPdf)){
    const batches=await ensureFolder(BATCHES_FOLDER,parent,token)
    uploaded.push(await uploadFile(`marketing-batch-${date}.pdf`,fs.readFileSync(contactSheetPdf),'application/pdf',batches,token))
  }
  for(const post of publishable){
    const short=post.id.slice(-3)
    const home=pillarFolders[post.pillar]||await ensureFolder(PILLAR_FOLDERS[post.pillar]||post.pillar,parent,token)
    const folder=await ensureFolder(`${date}-${short}`,home,token)
    for(const slide of post.slides){ const png=path.join(runDir,short,`slide-${slide.n}.png`); if(fs.existsSync(png)) uploaded.push(await uploadFile(`slide-${slide.n}.png`,fs.readFileSync(png),'image/png',folder,token)) }
    uploaded.push(await uploadFile('caption.txt',`${post.caption}\n\n${post.hashtags.slice(0,8).join(' ')}\n`,'text/plain',folder,token))
  }
  return {date,root_folder_id:parent,root_folder_url:`https://drive.google.com/drive/folders/${parent}`,pillar_folders:Object.fromEntries(Object.entries(pillarFolders).map(([k,v])=>[k,`https://drive.google.com/drive/folders/${v}`])),posts_published:publishable.length,posts_withheld_blocked:withheld,files:uploaded.map(f=>({id:f.id,name:f.name,url:f.webViewLink}))}
}
