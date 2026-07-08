/**
 * MindCraft world HTML chrome — Enter World, diagnostic entry, post-diagnostic UI.
 */
(function () {
  window.__MINDCRAFT_WORLD_BUILD__ = '2026-07-08-world-focus-v1'

  var APP = window.location.hostname === 'localhost'
    ? 'http://localhost:5173'
    : 'https://mindcraft-93858.web.app'

  function isDiagDone() {
    return window.MC_isDiagDone ? window.MC_isDiagDone() : !!localStorage.getItem('mc-diag-done')
  }

  function applyPostDiagnosticChrome() {
    var booking = document.getElementById('mc-booking-link')
    if (booking) booking.style.display = 'flex'
  }

  window.MC_hideProjectsCue = function () {}

  window.MC_applyPostDiagnosticChrome = applyPostDiagnosticChrome

  function requestFullscreen() {
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
        if (exp.sounds.playClick) exp.sounds.playClick()
        if (exp.sounds.playWhoosh) exp.sounds.playWhoosh()
      }
    } catch (e) {}
  }

  function openDiagnosticWhenReady() {
    if (isDiagDone()) return
    var tries = 0
    var timer = window.setInterval(function () {
      tries += 1
      if (typeof window.MC_onProjectsOpen === 'function') {
        window.clearInterval(timer)
        window.MC_onProjectsOpen()
      } else if (tries > 40) {
        window.clearInterval(timer)
      }
    }, 250)
  }

  function wireChrome() {
    var badge = document.getElementById('mc-badge')
    var startBtn = document.getElementById('mc-start-btn')

    if (badge) badge.classList.add('show')
    if (isDiagDone()) applyPostDiagnosticChrome()

    function worldHasStarted() {
      var cooking = document.getElementById('cooking')
      var overlay = document.querySelector('.overlay')
      var liveStartBtn = document.getElementById('mc-start-btn')
      return !liveStartBtn || !cooking || (overlay && overlay.classList.contains('fade'))
    }

    if (startBtn) {
      startBtn.addEventListener('click', function () {
        requestFullscreen()
        wakeAudio()
        setTimeout(openDiagnosticWhenReady, 1100)
        setTimeout(function () {
          ;[document, window].forEach(function (t) {
            t.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }))
          })
        }, 1400)
      }, { once: true })
    }

    var checks = 0
    var revealTimer = window.setInterval(function () {
      checks += 1
      if (worldHasStarted()) {
        openDiagnosticWhenReady()
        window.clearInterval(revealTimer)
      } else if (checks >= 15) {
        window.clearInterval(revealTimer)
      }
    }, 1000)

    var observer = new MutationObserver(function () {
      if (worldHasStarted()) {
        openDiagnosticWhenReady()
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
