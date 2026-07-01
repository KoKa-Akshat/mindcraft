/**
 * Shared diagnostic-completion signal for the 3D world.
 * Mirrors app `diagnosticCompleted` via URL param, localStorage, and cookie.
 */
(function () {
  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
    return m ? decodeURIComponent(m[1]) : ''
  }

  function persistDiagDone() {
    try { localStorage.setItem('mc-diag-done', '1') } catch (e) {}
    document.cookie = 'mc_diag_done=1; path=/; max-age=31536000; SameSite=Lax'
    if (location.hostname.endsWith('.web.app')) {
      document.cookie = 'mc_diag_done=1; domain=.web.app; path=/; max-age=31536000; SameSite=Lax'
    }
  }

  function stripDiagDoneParam() {
    try {
      var u = new URL(location.href)
      if (!u.searchParams.has('diagDone')) return
      u.searchParams.delete('diagDone')
      var next = u.pathname + u.search + u.hash
      history.replaceState(null, '', next || u.pathname)
    } catch (e) {}
  }

  function appDashboardUrl() {
    return location.hostname === 'localhost'
      ? 'http://localhost:5173/dashboard'
      : 'https://mindcraft-93858.web.app/dashboard'
  }

  function resolveDiagDone() {
    try {
      var params = new URLSearchParams(location.search)
      if (params.get('diagDone') === '1') {
        persistDiagDone()
        stripDiagDoneParam()
        return true
      }
    } catch (e) {}

    try {
      if (localStorage.getItem('mc-diag-done') === '1') return true
    } catch (e) {}

    if (readCookie('mc_diag_done') === '1') return true
    return false
  }

  window.MC_persistDiagDone = persistDiagDone
  window.MC_isDiagDone = resolveDiagDone

  if (resolveDiagDone()) {
    location.replace(appDashboardUrl())
  }
})()
