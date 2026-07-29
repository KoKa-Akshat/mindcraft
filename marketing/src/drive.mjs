import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ROOT } from './lib.mjs'
import { loadLocalEnv } from './llm.mjs'

// Drive is the inspection surface: each run's slides and contact sheet land in a shared
// folder so a reviewer sees the batch without waiting for a push. Decision capture still
// belongs to the review page — Drive comments are the lightweight stand-in until the
// hosted page exists. Nothing here publishes to Instagram.

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const base64url = buffer => Buffer.from(buffer).toString('base64').replaceAll('+','-').replaceAll('/','_').replaceAll('=','')

export function loadServiceAccount() {
  loadLocalEnv(); const raw=process.env.MARKETING_DRIVE_SERVICE_ACCOUNT
  if(!raw) throw new Error('MARKETING_DRIVE_SERVICE_ACCOUNT is not configured (path to a service-account JSON, or the JSON itself)')
  const text=raw.trim().startsWith('{') ? raw : fs.readFileSync(path.resolve(ROOT,raw),'utf8')
  const account=JSON.parse(text); if(!account.client_email||!account.private_key) throw new Error('Service account JSON is missing client_email or private_key')
  return account
}

export async function accessToken(account=loadServiceAccount()) {
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

export async function publishRun(date, runDir, posts, { contactSheetPdf }={}) {
  loadLocalEnv(); const parent=process.env.MARKETING_DRIVE_FOLDER_ID
  if(!parent) throw new Error('MARKETING_DRIVE_FOLDER_ID is not configured (the shared Drive folder to publish into)')
  const publishable=selectPublishable(posts); const withheld=posts.length-publishable.length
  const token=await accessToken(); const batchFolder=await ensureFolder(date,parent,token); const uploaded=[]
  if(contactSheetPdf&&fs.existsSync(contactSheetPdf)) uploaded.push(await uploadFile(`marketing-batch-${date}.pdf`,fs.readFileSync(contactSheetPdf),'application/pdf',batchFolder,token))
  for(const post of publishable){
    const short=post.id.slice(-3); const folder=await ensureFolder(`${short}-${post.pillar}`,batchFolder,token)
    for(const slide of post.slides){ const png=path.join(runDir,short,`slide-${slide.n}.png`); if(fs.existsSync(png)) uploaded.push(await uploadFile(`slide-${slide.n}.png`,fs.readFileSync(png),'image/png',folder,token)) }
    uploaded.push(await uploadFile('caption.txt',`${post.caption}\n\n${post.hashtags.slice(0,8).join(' ')}\n`,'text/plain',folder,token))
  }
  return {date,folder_id:batchFolder,folder_url:`https://drive.google.com/drive/folders/${batchFolder}`,posts_published:publishable.length,posts_withheld_blocked:withheld,files:uploaded.map(f=>({id:f.id,name:f.name,url:f.webViewLink}))}
}
