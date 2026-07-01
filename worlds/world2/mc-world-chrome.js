/**
 * MindCraft world HTML chrome — Enter World, Projects cue, post-diagnostic UI.
 */
(function () {
  window.__MINDCRAFT_WORLD_BUILD__ = '2026-07-01-world-chrome-v10'

  var APP = window.location.hostname === 'localhost'
    ? 'http://localhost:5173'
    : 'https://mindcraft-93858.web.app'

  function isDiagDone() {
    return window.MC_isDiagDone ? window.MC_isDiagDone() : !!localStorage.getItem('mc-diag-done')
  }

  function applyPostDiagnosticChrome() {
    var booking = document.getElementById('mc-booking-link')
    var topActions = document.getElementById('mc-top-actions')
    var projectsBtn = document.getElementById('mc-open-projects')
    var webToggle = document.getElementById('mc-web-toggle')
    if (booking) booking.style.display = 'flex'
    if (topActions) topActions.style.display = 'flex'
    if (projectsBtn) projectsBtn.style.display = 'none'
    if (webToggle) webToggle.href = APP + '/dashboard'
  }

  window.MC_hideProjectsCue = function () {
    var projectsBtn = document.getElementById('mc-open-projects')
    if (projectsBtn) projectsBtn.style.display = 'none'
  }

  window.MC_applyPostDiagnosticChrome = applyPostDiagnosticChrome

  function wireChrome() {
    var diagDone = isDiagDone()
    var badge = document.getElementById('mc-badge')
    var startBtn = document.getElementById('mc-start-btn')
    var projectsBtn = document.getElementById('mc-open-projects')

    if (badge) badge.classList.add('show')
    if (diagDone) applyPostDiagnosticChrome()

    if (projectsBtn && !projectsBtn.__mcWired) {
      projectsBtn.__mcWired = true
      projectsBtn.addEventListener('click', function () {
        if (isDiagDone()) {
          window.location.href = APP + '/dashboard'
          return
        }
        if (typeof window.MC_onProjectsOpen === 'function') window.MC_onProjectsOpen()
      })
    }

    function revealChrome() {
      if (isDiagDone()) return
      if (projectsBtn) projectsBtn.style.display = 'flex'
    }

    if (startBtn) {
      startBtn.addEventListener('click', function () {
        if (!isDiagDone()) setTimeout(revealChrome, 900)
        setTimeout(function () {
          ;[document, window].forEach(function (t) {
            t.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }))
          })
        }, 1400)
      }, { once: true })
    } else if (!diagDone) {
      revealChrome()
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireChrome)
  } else {
    wireChrome()
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister() })
    }).catch(function () {})
  }
})()
