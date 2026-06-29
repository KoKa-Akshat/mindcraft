/**
 * MindCraft world HTML chrome — toggle, Projects, Booking. Always visible.
 */
(function () {
  var APP = window.location.hostname === 'localhost'
    ? 'http://localhost:4321'
    : 'https://mindcraft-93858.web.app'

  window.__MINDCRAFT_WORLD_BUILD__ = '2026-06-24-world-chrome-v5'

  function openProjects() {
    if (window.MC_openProjectsSign) {
      window.MC_openProjectsSign()
    } else if (window.MC_onProjectsOpen) {
      window.MC_onProjectsOpen()
    }
  }

  function wireChrome() {
    var webToggle  = document.getElementById('mc-web-toggle')
    var bookingLink = document.getElementById('mc-booking-link')
    var badge      = document.getElementById('mc-badge')
    var clickMe    = document.getElementById('mc-click-me')

    if (webToggle)   webToggle.href   = APP + '/dashboard'
    if (bookingLink) bookingLink.href = APP + '/book'
    if (badge)       badge.classList.add('show')

    // Reveal booking + "Click me" only after Enter World
    var startBtn = document.getElementById('mc-start-btn')
    function revealChrome() {
      if (bookingLink) bookingLink.style.display = 'inline-flex'
      if (clickMe && !sessionStorage.getItem('mc-clicked-me')) clickMe.style.display = 'flex'
    }
    if (startBtn) {
      startBtn.addEventListener('click', function () { setTimeout(revealChrome, 900) }, { once: true })
    } else {
      revealChrome()
    }

    // Arrow cue → open Projects (same as clicking the sign), one-time per session
    function hideArrow() {
      if (clickMe) clickMe.style.display = 'none'
      sessionStorage.setItem('mc-clicked-me', '1')
    }

    if (clickMe && !clickMe.__mcWired) {
      clickMe.__mcWired = true
      clickMe.addEventListener('click', function () {
        hideArrow()
        if (window.MC_openProjectsSign) window.MC_openProjectsSign()
      })
    }

    // Also hide the arrow when the user clicks Projects sign directly
    var _prevOnProjectsOpen = window.MC_onProjectsOpen
    window.MC_onProjectsOpen = function () {
      hideArrow()
      if (_prevOnProjectsOpen) _prevOnProjectsOpen()
    }
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
