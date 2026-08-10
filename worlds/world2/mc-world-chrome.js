/**
 * MindCraft world HTML chrome — Enter World, post-enter UI.
 * Desk/embed mode: no chrome, no Enter World — kitchen auto-enters as a background space.
 */
(function () {
  window.__MINDCRAFT_WORLD_BUILD__ = '2026-08-10-desk-zoom-mute-1'
  // Desk opens muted — Field Desk volume button opts in.
  window.__MC_KITCHEN_MUTED__ = true

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

  function isDeskBackground() {
    return /[?&](?:desk|embed)=1(?:&|$)/.test(window.location.search) || inEmbed()
  }

  function applyPostDiagnosticChrome() {
    if (isDeskBackground()) return
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
    if (inEmbed() || isDeskBackground()) {
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
    if (inEmbed() || isDeskBackground()) return
    var el = document.documentElement
    var fn = el.requestFullscreen || el.webkitRequestFullscreen
    try {
      if (fn) fn.call(el)
    } catch (e) {}
  }

  function applyKitchenMute(muted) {
    window.__MC_KITCHEN_MUTED__ = !!muted
    try {
      if (window.Howler) {
        window.Howler.mute(!!muted)
        window.Howler.volume(muted ? 0 : 0.7)
        if (!muted && window.Howler.ctx && window.Howler.ctx.resume) {
          window.Howler.ctx.resume()
        }
      }
      if (window.experience && window.experience.sounds) {
        window.experience.sounds.muted = !!muted
      }
    } catch (e) {}
  }

  function silenceAudio() {
    applyKitchenMute(true)
  }

  function wakeAudio() {
    if (isDeskBackground() && window.__MC_KITCHEN_MUTED__) {
      silenceAudio()
      return
    }
    applyKitchenMute(false)
    try {
      var exp = window.experience
      if (exp && exp.sounds) {
        if (exp.sounds.playClick) exp.sounds.playClick()
        if (exp.sounds.playWhoosh) exp.sounds.playWhoosh()
        if (exp.sounds.playCooking) exp.sounds.playCooking()
      }
    } catch (e) {}
  }

  /** iOS Field Desk volume toggle. opts: { muted: bool, volume?: number } */
  window.MC_setKitchenAudio = function (opts) {
    var muted = !!(opts && opts.muted)
    applyKitchenMute(muted)
    if (!muted) {
      try {
        if (window.Howler && window.Howler.ctx && window.Howler.ctx.resume) {
          window.Howler.ctx.resume()
        }
        if (typeof opts.volume === 'number' && window.Howler) {
          window.Howler.volume(opts.volume)
        }
      } catch (e) {}
    }
    return { muted: !!window.__MC_KITCHEN_MUTED__ }
  }

  function goToAppScreen() {
    // Desk/embed: never bounce to login/dashboard — Field Desk handles Projects.
    if (/[?&](?:desk|embed)=1(?:&|$)/.test(window.location.search)) {
      try {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.deskAction) {
          window.webkit.messageHandlers.deskAction.postMessage({ action: 'intel' })
        }
      } catch (e) {}
      return
    }
    var url = APP + '/dashboard'
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = url
        return
      }
    } catch (e) {}
    window.location.href = url
  }

  window.MC_onProjectsOpen = function () {
    goToAppScreen()
  }
  window.MC_onProjectsClose = function () {}

  function hideDeskChrome() {
    document.documentElement.classList.add('mc-desk-bg')
    if (document.body) document.body.classList.add('mc-desk-bg')
    ;['mc-badge', 'mc-booking-link'].forEach(function (id) {
      var el = document.getElementById(id)
      if (el) {
        el.style.display = 'none'
        el.setAttribute('aria-hidden', 'true')
      }
    })
    document.querySelectorAll('.mc-cue, .mc-top-actions, .mc-booking-btn').forEach(function (el) {
      el.style.display = 'none'
      el.setAttribute('aria-hidden', 'true')
    })
  }

  /** Auto-press Enter World as soon as the loader finishes — no UI. */
  function autoEnterDeskWorld() {
    var tries = 0
    var timer = window.setInterval(function () {
      tries += 1
      var btn = document.querySelector('.start') || document.getElementById('mc-start-btn')
      if (!btn) {
        if (tries > 300) window.clearInterval(timer)
        return
      }
      var shown =
        btn.classList.contains('fadeIn') ||
        btn.style.display === 'inline' ||
        btn.style.display === 'block' ||
        (window.getComputedStyle && window.getComputedStyle(btn).opacity === '1')
      // readyScreen sets display=inline before fadeIn; click as soon as it exists + displayed by engine
      if (btn.style.display === 'inline' || btn.classList.contains('fadeIn') || shown) {
        window.clearInterval(timer)
        // Keep it invisibly clickable even under desk-bg CSS.
        btn.style.opacity = '0'
        btn.style.pointerEvents = 'auto'
        try {
          btn.click()
        } catch (e) {}
        requestFullscreen()
        // Desk stays silent until Field Desk volume is toggled on.
        silenceAudio()
        // Hard-strip leftover chrome after enter.
        window.setTimeout(hideDeskChrome, 50)
        window.setTimeout(hideDeskChrome, 800)
        window.setTimeout(hideDeskChrome, 2200)
        window.setTimeout(silenceAudio, 100)
        window.setTimeout(silenceAudio, 900)
        window.setTimeout(silenceAudio, 2400)
      }
      if (tries > 300) window.clearInterval(timer)
    }, 200)
  }

  function wireChrome() {
    if (isDeskBackground()) {
      hideDeskChrome()
      silenceAudio()
      autoEnterDeskWorld()
      // Re-assert mute — engine often unmutes itself after enter.
      var soundTries = 0
      var soundTimer = window.setInterval(function () {
        soundTries += 1
        if (window.__MC_KITCHEN_MUTED__) silenceAudio()
        if (soundTries >= 40) window.clearInterval(soundTimer)
      }, 300)
      return
    }

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

/* desk-zoom-mute-1 1786344000 */
