/**
 * MindCraft world HTML chrome — Enter World, Projects cue, post-diagnostic UI.
 */
(function () {
  window.__MINDCRAFT_WORLD_BUILD__ = '2026-07-01-world-chrome-v15'

  var APP = window.location.hostname === 'localhost'
    ? 'http://localhost:5173'
    : 'https://mindcraft-93858.web.app'

  function isDiagDone() {
    return window.MC_isDiagDone ? window.MC_isDiagDone() : !!localStorage.getItem('mc-diag-done')
  }

  function applyPostDiagnosticChrome() {
    var booking = document.getElementById('mc-booking-link')
    var topActions = document.getElementById('mc-top-actions')
    var webToggle = document.getElementById('mc-web-toggle')
    if (booking) booking.style.display = 'flex'
    if (topActions) topActions.style.display = 'flex'
    if (webToggle) webToggle.href = APP + '/dashboard'
  }

  window.MC_hideProjectsCue = function () {
    var projectsBtn = document.getElementById('mc-open-projects')
    if (projectsBtn) {
      projectsBtn.style.display = 'none'
      projectsBtn.dataset.mcVisible = 'false'
    }
  }

  window.MC_applyPostDiagnosticChrome = applyPostDiagnosticChrome

  function wireChrome() {
    var badge = document.getElementById('mc-badge')
    var startBtn = document.getElementById('mc-start-btn')
    var projectsBtn = document.getElementById('mc-open-projects')

    if (badge) badge.classList.add('show')
    if (isDiagDone()) applyPostDiagnosticChrome()

    if (projectsBtn && !projectsBtn.__mcWired) {
      projectsBtn.__mcWired = true
      projectsBtn.addEventListener('click', function () {
        if (typeof window.MC_onProjectsOpen === 'function') window.MC_onProjectsOpen()
      })
    }

    function worldHasStarted() {
      var cooking = document.getElementById('cooking')
      var overlay = document.querySelector('.overlay')
      var liveStartBtn = document.getElementById('mc-start-btn')
      return !liveStartBtn || !cooking || (overlay && overlay.classList.contains('fade'))
    }

    function revealChrome() {
      if (!projectsBtn || projectsBtn.dataset.mcVisible === 'true') return
      projectsBtn.style.display = 'flex'
      projectsBtn.dataset.mcVisible = 'true'
    }

    if (startBtn) {
      startBtn.addEventListener('click', function () {
        setTimeout(revealChrome, 900)
        setTimeout(revealChrome, 1800)
        setTimeout(revealChrome, 3000)
        setTimeout(function () {
          ;[document, window].forEach(function (t) {
            t.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }))
          })
        }, 1400)
      }, { once: true })
    } else {
      revealChrome()
    }

    var checks = 0
    var revealTimer = window.setInterval(function () {
      checks += 1
      if (worldHasStarted()) {
        revealChrome()
        window.clearInterval(revealTimer)
      } else if (checks >= 15) {
        window.clearInterval(revealTimer)
      }
    }, 1000)

    var observer = new MutationObserver(function () {
      if (worldHasStarted()) {
        revealChrome()
        observer.disconnect()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
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
