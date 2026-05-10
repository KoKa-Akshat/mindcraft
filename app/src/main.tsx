import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './global.css'

declare global {
  interface Window {
    __MINDCRAFT_BUILD__?: string
  }
}

const buildVersion = window.__MINDCRAFT_BUILD__
if (buildVersion) {
  const key = 'mindcraft:last-build'
  const previousBuild = localStorage.getItem(key)
  localStorage.setItem(key, buildVersion)
  if (previousBuild && previousBuild !== buildVersion) {
    window.location.reload()
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
