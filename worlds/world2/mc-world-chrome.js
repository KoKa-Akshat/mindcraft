/**
 * MindCraft world HTML chrome — toggle, Projects, Booking. Always visible.
 */
(function () {
  var APP = window.location.hostname === 'localhost'
    ? 'http://localhost:4321'
    : 'https://mindcraft-93858.web.app'

  window.__MINDCRAFT_WORLD_BUILD__ = '2026-06-29-world-chrome-v8'

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
  var diagDone = !!localStorage.getItem('mc-diag-done')

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

    // After Enter World:
    //   - If diagnostic done: show Booking + 3D|Web, no arrow
    //   - If not done: show arrow only
    function revealChrome() {
      if (diagDone) {
        if (bookingLink) bookingLink.style.display = 'inline-flex'
        if (topActions) topActions.style.display = 'flex'
      } else {
        if (clickMe && !sessionStorage.getItem('mc-clicked-me')) {
          clickMe.style.display = 'flex'
        }
      }
    }

    if (startBtn) {
      startBtn.addEventListener('click', function () {
        setTimeout(revealChrome, 900)
        // Auto-play sound (simulates pressing M)
        setTimeout(function () {
          ;[document, window].forEach(function (t) {
            t.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }))
          })
        }, 1400)
      }, { once: true })
    } else {
      revealChrome()
    }

    // Arrow → go to diagnostic (pre-diagnostic flow)
    if (clickMe && !clickMe.__mcWired) {
      clickMe.__mcWired = true
      clickMe.addEventListener('click', function () {
        sessionStorage.setItem('mc-clicked-me', '1')
        clickMe.style.display = 'none'
        window.location.href = APP + '/diagnostic'
      })
    }

    // If arriving from ?diagDone=1 (from web dashboard 3D button), auto-enter
    if (diagJustDone && startBtn) {
      var obs = new MutationObserver(function () {
        if (startBtn.classList.contains('fadeIn')) {
          obs.disconnect()
          setTimeout(function () { startBtn.click() }, 700)
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

  // Unregister any stale service worker from Jesse's Ramen PWA manifest.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister() })
    }).catch(function () {})
  }
})()
