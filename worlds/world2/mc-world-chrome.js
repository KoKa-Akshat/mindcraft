/**
 * MindCraft world HTML chrome — Open Projects button, always visible after world loads.
 */
(function () {
  window.__MINDCRAFT_WORLD_BUILD__ = '2026-07-01-world-chrome-v9'

  function wireChrome() {
    var badge       = document.getElementById('mc-badge')
    var startBtn    = document.getElementById('mc-start-btn')
    var projectsBtn = document.getElementById('mc-open-projects')

    if (badge) badge.classList.add('show')

    // Wire the Open Projects button → overlay (always, every visit)
    if (projectsBtn && !projectsBtn.__mcWired) {
      projectsBtn.__mcWired = true
      projectsBtn.addEventListener('click', function () {
        if (typeof window.MC_onProjectsOpen === 'function') window.MC_onProjectsOpen()
      })
    }

    function revealChrome() {
      if (projectsBtn) projectsBtn.style.display = 'flex'
    }

    if (startBtn) {
      startBtn.addEventListener('click', function () {
        setTimeout(revealChrome, 900)
        // Auto-play sound
        setTimeout(function () {
          ;[document, window].forEach(function (t) {
            t.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }))
          })
        }, 1400)
      }, { once: true })
    } else {
      revealChrome()
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
