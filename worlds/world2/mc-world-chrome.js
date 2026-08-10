/**
 * MindCraft world HTML chrome — Enter World, post-enter UI.
 * Diagnostic questions removed: Projects goes straight to the app screen.
 */
(function () {
  window.__MINDCRAFT_WORLD_BUILD__ = '2026-08-09-sound-on-no-diag'

  var APP = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5173'
    : 'https://mindcraft-93858.web.app'

  function inEmbed() {
    try {
      return window.self !== window.top || /[?&]embed=1(?:&|$)/.test(window.location.search)
    } catch (e) {
      return true
    }
  }

  function applyPostDiagnosticChrome() {
    var booking = document.getElementById('mc-booking-link')
    if (booking) booking.style.display = 'flex'
  }

  window.MC_hideProjectsCue = function () {}
  window.MC_applyPostDiagnosticChrome = applyPostDiagnosticChrome

  // Track whether the user intentionally exited (ESC key).
  var userExitedIntentionally = false

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') userExitedIntentionally = true
  }, { capture: true })

  document.addEventListener('fullscreenchange', function () {
    if (inEmbed()) {
      userExitedIntentionally = false
      return
    }
    if (!document.fullscreenElement && !userExitedIntentionally) {
      var el = document.documentElement
      var fn = el.requestFullscreen || el.webkitRequestFullscreen
      try { if (fn) fn.call(el) } catch (e) {}
    }
    userExitedIntentionally = false
  })

  function requestFullscreen() {
    if (inEmbed()) return
    var el = document.documentElement
    var fn = el.requestFullscreen || el.webkitRequestFullscreen
    try {
      if (fn) fn.call(el)
    } catch (e) {}
  }

  function wakeAudio() {
    try {
      var exp = window.experience
      if (window.Howler) {
        window.Howler.mute(false)
        window.Howler.volume(1)
        if (window.Howler.ctx && window.Howler.ctx.resume) window.Howler.ctx.resume()
      }
      if (exp && exp.sounds) {
        exp.sounds.muted = false
        if (exp.sounds.playClick) exp.sounds.playClick()
        if (exp.sounds.playWhoosh) exp.sounds.playWhoosh()
        if (exp.sounds.playCooking) exp.sounds.playCooking()
      }
    } catch (e) {}
  }

  function goToAppScreen() {
    // Prefer parent navigation when embedded in Field Desk proto.
    var url = APP + '/dashboard'
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = url
        return
      }
    } catch (e) {}
    window.location.href = url
  }

  // Projects / vending menu used to open diagnostic questions — go to the app instead.
  window.MC_onProjectsOpen = function () {
    goToAppScreen()
  }
  window.MC_onProjectsClose = function () {}

  function wireChrome() {
    var badge = document.getElementById('mc-badge')
    var startBtn = document.getElementById('mc-start-btn')

    if (badge) badge.classList.add('show')
    applyPostDiagnosticChrome()

    if (startBtn) {
      startBtn.addEventListener('click', function () {
        requestFullscreen()
        wakeAudio()
      }, { once: true })
    }

    // Keep sound awake if the engine re-mutes on boot.
    var soundTries = 0
    var soundTimer = window.setInterval(function () {
      soundTries += 1
      try {
        if (window.Howler) {
          window.Howler.mute(false)
          window.Howler.volume(1)
        }
        if (window.experience && window.experience.sounds) {
          window.experience.sounds.muted = false
        }
      } catch (e) {}
      if (soundTries >= 20) window.clearInterval(soundTimer)
    }, 400)
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
