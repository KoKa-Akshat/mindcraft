/**
 * MindCraft world HTML chrome — pre-diagnostic entry flow.
 */
(function () {
  var APP = window.location.hostname === 'localhost'
    ? 'http://localhost:4321'
    : 'https://mindcraft-93858.web.app'

  window.__MINDCRAFT_WORLD_BUILD__ = '2026-06-30-world-chrome-v10'

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
      try {
        if (window.Howler) {
          window.Howler.mute(false)
          window.Howler.volume(1)
          if (window.Howler.ctx && window.Howler.ctx.resume) window.Howler.ctx.resume()
        }
      } catch (e) {}

      var exp = window.experience
      try {
        if (exp && exp.sounds) {
          if (exp.sounds.cooking && exp.sounds.cooking.mute) exp.sounds.cooking.mute(false)
          if (exp.sounds.cooking && exp.sounds.cooking.volume) exp.sounds.cooking.volume(1)
        }
      } catch (e) {}

      // The original world uses M as the audio unlock/mute shortcut. Fire it once
      // from the Enter World gesture, not on page load, so it doesn't double-toggle.
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
        setTimeout(function () {
          try {
            if (window.Howler) {
              window.Howler.mute(false)
              window.Howler.volume(1)
              if (window.Howler.ctx && window.Howler.ctx.resume) window.Howler.ctx.resume()
            }
          } catch (e) {}
        }, 250)
        setTimeout(revealChrome, 900)
        setTimeout(openDiagnosticFlow, 1500)
      }, { once: true })
    } else {
      turnSoundOn()
      revealChrome()
      setTimeout(openDiagnosticFlow, 1500)
    }

    // Projects cue → go to diagnostic (pre-diagnostic flow)
    if (clickMe && !clickMe.__mcWired) {
      clickMe.__mcWired = true
      clickMe.addEventListener('click', function () {
        openDiagnosticFlow()
      })
    }

    // Keep Enter World manual. Once pressed, sound starts and Projects opens the diagnostic.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireChrome)
  } else {
    wireChrome()
  }

  // Unregister any stale service worker from Jesse's Ramen PWA manifest.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister() })
    }).catch(function () {})
  }
})()
