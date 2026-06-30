/**
 * MindCraft world HTML chrome — pre-diagnostic entry flow.
 */
(function () {
  var APP = window.location.hostname === 'localhost'
    ? 'http://localhost:4321'
    : 'https://mindcraft-93858.web.app'

  window.__MINDCRAFT_WORLD_BUILD__ = '2026-06-29-world-chrome-v9'

  // Read shared .web.app cookie set by the dashboard when diagnostic is confirmed done
  function hasDiagCookie() {
    return document.cookie.split(';').some(function (c) {
      return c.trim() === 'mc_diag_done=1'
    })
  }

  // Check if student just completed diagnostic (URL param from the React app)
  var params = new URLSearchParams(window.location.search)
  var diagJustDone = params.get('diagDone') === '1'
  if (diagJustDone) {
    localStorage.setItem('mc-diag-done', '1')
    // Clean the URL param without reloading
    params.delete('diagDone')
    var cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '')
    history.replaceState(null, '', cleanUrl)
  }

  // diagDone: localStorage flag (world-own), shared cookie (set by dashboard), or URL param
  var diagDone = !!localStorage.getItem('mc-diag-done') || hasDiagCookie()
  if (diagDone) localStorage.setItem('mc-diag-done', '1') // sync to localStorage for next visit

  function wireChrome() {
    var webToggle  = document.getElementById('mc-web-toggle')
    var bookingLink = document.getElementById('mc-booking-link')
    var topActions = document.getElementById('mc-top-actions')
    var badge      = document.getElementById('mc-badge')
    var clickMe    = document.getElementById('mc-click-me')
    var startBtn   = document.getElementById('mc-start-btn')

    if (webToggle)   webToggle.href   = APP + '/dashboard'
    if (bookingLink) bookingLink.href = APP + '/book'
    if (badge)       badge.classList.add('show')

    function turnSoundOn() {
      ;[document, window].forEach(function (t) {
        t.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }))
      })
    }

    function openDiagnosticFlow() {
      if (diagDone) return
      if (clickMe) clickMe.style.display = 'none'
      sessionStorage.setItem('mc-clicked-me', '1')
      if (window.MC_openProjectsSign) window.MC_openProjectsSign()
      else if (window.MC_onProjectsOpen) window.MC_onProjectsOpen()
    }

    // Jesse's Kitchen is now a pre-diagnostic experience only:
    // no Booking, no 3D|Web toggle, and no return path after diagnostic.
    function revealChrome() {
      if (bookingLink) bookingLink.style.display = 'none'
      if (topActions) topActions.style.display = 'none'
      if (!diagDone && clickMe && !sessionStorage.getItem('mc-clicked-me')) {
        clickMe.style.display = 'flex'
      }
    }

    if (startBtn) {
      startBtn.addEventListener('click', function () {
        turnSoundOn()
        setTimeout(turnSoundOn, 250)
        setTimeout(revealChrome, 900)
        setTimeout(openDiagnosticFlow, 2000)
      }, { once: true })
    } else {
      turnSoundOn()
      revealChrome()
      setTimeout(openDiagnosticFlow, 2000)
    }

    // Projects cue → go to diagnostic (pre-diagnostic flow)
    if (clickMe && !clickMe.__mcWired) {
      clickMe.__mcWired = true
      clickMe.addEventListener('click', function () {
        openDiagnosticFlow()
      })
    }

    // Auto-enter Jesse's Kitchen so the diagnostic starts without extra clicks.
    if (startBtn) {
      var obs = new MutationObserver(function () {
        if (startBtn.classList.contains('fadeIn')) {
          obs.disconnect()
          setTimeout(function () { startBtn.click() }, diagJustDone ? 700 : 350)
        }
      })
      obs.observe(startBtn, { attributes: true, attributeFilter: ['class'] })
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireChrome)
  } else {
    wireChrome()
  }

  window.addEventListener('load', function () {
    ;[document, window].forEach(function (t) {
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }))
    })
  }, { once: true })

  // Unregister any stale service worker from Jesse's Ramen PWA manifest.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister() })
    }).catch(function () {})
  }
})()
