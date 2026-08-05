#!/usr/bin/env node
// One-time consent helper. Mints a refresh token so the pipeline can upload to a personal
// Drive as you. Service accounts cannot be used here: they have no storage quota and can
// only own files inside a Shared Drive, which requires Google Workspace.
//
//   node marketing/src/drive-auth.mjs
//
// Needs MARKETING_DRIVE_CLIENT_ID and MARKETING_DRIVE_CLIENT_SECRET from a Google Cloud
// OAuth client of type "Desktop app". Writes MARKETING_DRIVE_REFRESH_TOKEN to marketing/.env.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { execFile } from 'node:child_process'
import { ROOT, SCOPE } from './drive.mjs'
import { loadLocalEnv } from './llm.mjs'

loadLocalEnv()
const clientId=process.env.MARKETING_DRIVE_CLIENT_ID, clientSecret=process.env.MARKETING_DRIVE_CLIENT_SECRET
if(!clientId||!clientSecret){console.error('Set MARKETING_DRIVE_CLIENT_ID and MARKETING_DRIVE_CLIENT_SECRET in marketing/.env first.\nCreate them at https://console.cloud.google.com/apis/credentials → Create credentials → OAuth client ID → Desktop app.');process.exitCode=1;process.exit()}

const port=Number(process.argv.includes('--port')?process.argv[process.argv.indexOf('--port')+1]:53682)
const redirect=`http://127.0.0.1:${port}`
const consent=`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent'})}`

const envPath=path.resolve(ROOT,'marketing/.env')
function persist(token){
  const line=`MARKETING_DRIVE_REFRESH_TOKEN=${token}`
  let text=fs.existsSync(envPath)?fs.readFileSync(envPath,'utf8'):''
  text=/^MARKETING_DRIVE_REFRESH_TOKEN=.*$/m.test(text)?text.replace(/^MARKETING_DRIVE_REFRESH_TOKEN=.*$/m,line):`${text.replace(/\s*$/,'')}\n${line}\n`
  fs.writeFileSync(envPath,text); fs.chmodSync(envPath,0o600)
}

const server=http.createServer(async (req,res)=>{
  const url=new URL(req.url,redirect); const code=url.searchParams.get('code'); const error=url.searchParams.get('error')
  if(!code&&!error){res.writeHead(404).end('Waiting for the OAuth redirect.');return}
  if(error){res.writeHead(400).end(`Consent failed: ${error}`);console.error(`Consent failed: ${error}`);process.exitCode=1;server.close();return}
  try{
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirect,grant_type:'authorization_code'})})
    if(!response.ok)throw new Error(`${response.status}: ${(await response.text()).slice(0,240)}`)
    const token=(await response.json()).refresh_token
    if(!token)throw new Error('Google returned no refresh_token. Revoke prior access at https://myaccount.google.com/permissions and retry.')
    persist(token)
    res.writeHead(200,{'content-type':'text/html'}).end('<p>MindCraft marketing is authorised. Close this tab and return to the terminal.</p>')
    console.log('Refresh token written to marketing/.env (mode 600).')
    console.log('Run: npm run marketing:publish -- --date <YYYY-MM-DD>')
  }catch(e){res.writeHead(500).end(String(e.message));console.error(e.message);process.exitCode=1}
  server.close()
})

server.listen(port,'127.0.0.1',()=>{
  console.log(`Add this exact redirect URI to the OAuth client, then approve in the browser:\n  ${redirect}\n\nConsent URL:\n${consent}\n`)
  const opener=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open'
  execFile(opener,process.platform==='win32'?['/c','start',consent]:[consent],()=>{})
})
