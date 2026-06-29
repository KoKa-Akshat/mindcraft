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
    var webToggle = document.getElementById('mc-web-toggle')
    var bookingLink = document.getElementById('mc-booking-link')
    var badge = document.getElementById('mc-badge')
    var bar = document.getElementById('mc-bottom-bar')
    var hint = document.getElementById('mc-hint')
    var projectsCue = document.getElementById('mc-projects-cue')

    if (webToggle) webToggle.href = APP + '/dashboard'
    if (bookingLink) bookingLink.href = APP + '/book'
    if (badge) badge.classList.add('show')
    if (bar) bar.classList.add('show')

    if (hint && !hint.__mcWired) {
      hint.__mcWired = true
      hint.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        openProjects()
      })
    }

    if (projectsCue && !projectsCue.__mcWired) {
      projectsCue.__mcWired = true
      projectsCue.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        openProjects()
      })
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
