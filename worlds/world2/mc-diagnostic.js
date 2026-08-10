/**
 * Diagnostic overlay retired.
 * Projects / vending "menu" clicks route to the app dashboard instead.
 * Kept as a stub so older cache keys that still load this file do not break.
 */
(function () {
  var APP = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5173'
    : 'https://mindcraft-93858.web.app'

  function goToAppScreen() {
    var url = APP + '/dashboard'
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = url
        return
      }
    } catch (e) {}
    window.location.href = url
  }

  // Only set if chrome has not already wired Projects → dashboard.
  if (typeof window.MC_onProjectsOpen !== 'function') {
    window.MC_onProjectsOpen = goToAppScreen
  }
  window.MC_onProjectsClose = window.MC_onProjectsClose || function () {}

  // Hide any leftover diag chrome if present in HTML.
  function hideDiagShell() {
    var root = document.getElementById('mc-diag')
    if (!root) return
    root.setAttribute('aria-hidden', 'true')
    root.style.display = 'none'
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideDiagShell)
  } else {
    hideDiagShell()
  }
})()
