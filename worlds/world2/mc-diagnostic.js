/**
 * In-world diagnostic overlay for Nox's kitchen (projects / diagnostics screen).
 * Confidence is handed off to the web app via ?diag= URL — the app seeds the graph.
 */
(function () {
  var APP_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:5173'
    : 'https://mindcraft-93858.web.app'

  var PER_PAGE = 10
  var spec = null
  var step = 'intro'
  var goalTags = []
  var goalText = ''
  var confidence = {}
  var excluded = {}
  var confPage = 0
  var pendingOpen = false
  var root, panel

  function $(sel) { return root.querySelector(sel) }

  function dashboardUrl() {
    var excludedList = Object.keys(excluded)
    var payload = {
      exam: 'ACT',
      confidence: confidence,
      goals: { tags: goalTags, text: goalText.trim() },
      excluded: excludedList,
    }
    return APP_BASE + '/dashboard?diag=' + encodeURIComponent(JSON.stringify(payload))
  }

  function isConceptDone(conceptId) {
    return confidence[conceptId] || excluded[conceptId]
  }

  function render() {
    if (!spec || !panel) return
    var html = ''
    var presets = spec.goals_step.presets || []
    var concepts = spec.confidence_step.concepts || []
    var scale = spec.confidence_step.scale || []

    if (step === 'intro') {
      html += '<h2 class="mc-diag-title">' + esc(spec.intro.title) + '</h2>'
      html += '<p class="mc-diag-body">' + esc(spec.intro.body) + '</p>'
      html += '<button class="mc-diag-primary" data-action="next">Start</button>'
    } else if (step === 'goals') {
      html += '<h2 class="mc-diag-title">' + esc(spec.goals_step.prompt) + '</h2>'
      var goalsPlaceholder = spec.goals_step.placeholder || 'Tell us what you are aiming for…'
      html += '<div class="mc-diag-tags">'
      presets.forEach(function (p) {
        html += '<button class="mc-diag-tag' + (goalTags.indexOf(p) >= 0 ? ' on' : '') + '" data-goal="' + escAttr(p) + '">' + esc(p) + '</button>'
      })
      html += '</div>'
      html += '<textarea class="mc-diag-textarea" id="mc-diag-goals-text" placeholder="' + escAttr(goalsPlaceholder) + '" rows="6">' + esc(goalText) + '</textarea>'
      html += '<button class="mc-diag-primary" data-action="next"' + (goalTags.length === 0 && !goalText.trim() ? ' disabled' : '') + '>Next</button>'
    } else if (step === 'confidence') {
      var pageCount = Math.ceil(concepts.length / PER_PAGE)
      var pageConcepts = concepts.slice(confPage * PER_PAGE, confPage * PER_PAGE + PER_PAGE)
      var pageRated = pageConcepts.every(function (c) { return isConceptDone(c.concept_id) })
      var allRated = concepts.every(function (c) { return isConceptDone(c.concept_id) })

      html += '<h2 class="mc-diag-title">' + esc(spec.confidence_step.prompt) + '</h2>'
      html += '<p class="mc-diag-note">' + esc(spec.confidence_step.note) + '</p>'
      if (pageCount > 1) {
        html += '<p class="mc-diag-note">Page ' + (confPage + 1) + ' of ' + pageCount + '</p>'
      }
      html += '<div class="mc-diag-conf">'
      pageConcepts.forEach(function (c) {
        html += '<div class="mc-diag-conf-row"><div class="mc-diag-conf-name">' + esc(c.name) + '</div><div class="mc-diag-scale">'
        scale.forEach(function (s) {
          html += '<button class="' + (confidence[c.concept_id] === s.value ? 'on' : '') + '" data-conf="' + escAttr(c.concept_id) + '" data-val="' + s.value + '">' + esc(s.label) + '</button>'
        })
        html += '<button class="mc-diag-topic-skip' + (excluded[c.concept_id] ? ' on' : '') + '" type="button" data-skip="' + escAttr(c.concept_id) + '">Skip</button>'
        html += '</div></div>'
      })
      html += '</div>'
      html += '<div class="mc-diag-nav">'
      if (confPage > 0) {
        html += '<button class="mc-diag-skip" type="button" data-action="conf-back">Back</button>'
      }
      if (confPage < pageCount - 1) {
        html += '<button class="mc-diag-primary" data-action="conf-next"' + (pageRated ? '' : ' disabled') + '>Next page</button>'
      } else {
        html += '<button class="mc-diag-primary" data-action="next"' + (allRated ? '' : ' disabled') + '>Finish</button>'
      }
      html += '</div>'
    } else if (step === 'done') {
      html += '<h2 class="mc-diag-title">Complete</h2>'
      html += '<p class="mc-diag-body">Lessons will dynamically accommodate you, Jesse really cooked.</p>'
      html += '<button class="mc-diag-primary" data-action="dashboard">Go to dashboard</button>'
    }

    panel.innerHTML = html
    panel.querySelectorAll('[data-goal]').forEach(function (btn) {
      btn.onclick = function () {
        var g = btn.getAttribute('data-goal')
        if (goalTags.indexOf(g) >= 0) goalTags = goalTags.filter(function (x) { return x !== g })
        else goalTags.push(g)
        render()
      }
    })
    var ta = $('#mc-diag-goals-text')
    if (ta) {
      ta.oninput = function () {
        goalText = ta.value
        var next = panel.querySelector('[data-action="next"]')
        if (next) next.disabled = goalTags.length === 0 && !goalText.trim()
      }
    }

    panel.querySelectorAll('[data-conf]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-conf')
        delete excluded[id]
        confidence[id] = btn.getAttribute('data-val')
        render()
      }
    })

    panel.querySelectorAll('[data-skip]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-skip')
        if (excluded[id]) {
          delete excluded[id]
        } else {
          excluded[id] = true
          delete confidence[id]
        }
        render()
      }
    })

    var nextBtn = panel.querySelector('[data-action="next"]')
    if (nextBtn) nextBtn.onclick = onNext
    var backBtn = panel.querySelector('[data-action="conf-back"]')
    if (backBtn) backBtn.onclick = function () { confPage--; render() }
    var confNextBtn = panel.querySelector('[data-action="conf-next"]')
    if (confNextBtn) confNextBtn.onclick = function () { confPage++; render() }
    var dashBtn = panel.querySelector('[data-action="dashboard"]')
    if (dashBtn) dashBtn.onclick = function () { window.location.href = dashboardUrl() }
  }

  function onNext() {
    if (step === 'intro') step = 'goals'
    else if (step === 'goals') {
      step = 'confidence'
      confPage = 0
    } else if (step === 'confidence') finishConfidence()
    render()
  }

  function finishConfidence() {
    complete()
  }

  function complete() {
    if (window.MC_persistDiagDone) window.MC_persistDiagDone()
    else {
      localStorage.setItem('mc-diag-done', '1')
      document.cookie = 'mc_diag_done=1; path=/; max-age=31536000; SameSite=Lax'
    }
    window.location.href = dashboardUrl()
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  }
  function escAttr(s) { return esc(s).replace(/'/g, '&#39;') }

  function show() {
    if (!spec) {
      pendingOpen = true
      return
    }
    pendingOpen = false
    if (window.MC_hideProjectsCue) window.MC_hideProjectsCue()
    try { sessionStorage.setItem('mc-clicked-me', '1') } catch (e) {}
    root.classList.add('show')
    step = 'intro'
    goalTags = []
    goalText = ''
    confidence = {}
    excluded = {}
    confPage = 0
    render()
  }

  function hide() {
    if (step !== 'done') return
    root.classList.remove('show')
  }

  function boot() {
    root = document.getElementById('mc-diag')
    panel = document.getElementById('mc-diag-panel')
    if (!root || !panel) return

    fetch('data/actDiagnostic.json?v=2026-act-v2')
      .then(function (r) { return r.json() })
      .then(function (d) {
        spec = d
        if (pendingOpen) show()
      })
      .catch(function () { console.warn('MC: could not load diagnostic spec') })

    root.querySelector('#mc-diag-backdrop').onclick = function (e) {
      e.preventDefault()
      e.stopPropagation()
      if (step === 'done') hide()
    }

    root.addEventListener('click', function (e) { e.stopPropagation() })
    root.addEventListener('pointerdown', function (e) { e.stopPropagation() })
    root.addEventListener('pointerup', function (e) { e.stopPropagation() })
  }

  window.MC_onProjectsOpen = function () {
    show()
  }
  window.MC_onProjectsClose = function () { hide() }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
