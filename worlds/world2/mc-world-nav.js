/**
 * MindCraft world navigation — patches 3D sign clicks at runtime via window.experience.
 * Loaded after the bundle so stale cached bundles still get correct routes.
 */
(function () {
  var APP = window.location.hostname === 'localhost'
    ? 'http://localhost:4321'
    : 'https://mindcraft-93858.web.app'

  var ROUTES = {
    articles: APP + '/practice?learnNext=1',
    aboutMe: APP + '/knowledge-graph',
    credits: APP + '/practice?homeworkHelp=1',
    practice: APP + '/practice',
    book: APP + '/book',
    dashboard: APP + '/dashboard',
  }

  function patchMenuControls(mc) {
    if (!mc || mc.__mcPatched) return false

    mc.articles = async function (t, e) {
      if (this.logic.buttonsLocked || this.logic.mode !== 'menu') return
      this.sounds.playClick()
      await this.menuControls.buttonIndicator(t, e)
      await this.sleep(250)
      window.location.href = ROUTES.articles
    }

    mc.aboutMe = async function (t, e) {
      if (this.logic.buttonsLocked || this.logic.mode !== 'menu') return
      this.sounds.playClick()
      await this.menuControls.buttonIndicator(t, e)
      await this.sleep(250)
      window.location.href = ROUTES.aboutMe
    }

    mc.credits = async function (t, e) {
      if (this.logic.buttonsLocked || this.logic.mode !== 'menu') return
      this.sounds.playClick()
      await this.menuControls.buttonIndicator(t, e)
      await this.sleep(250)
      window.location.href = ROUTES.credits
    }

    mc.practice = async function (t, e) {
      if (this.logic.buttonsLocked || this.logic.mode !== 'menu') return
      this.sounds.playClick()
      await this.sleep(250)
      window.location.href = ROUTES.practice
    }

    mc.__mcPatched = true
    console.info('[MindCraft] Jesse\'s world nav patched', ROUTES)
    return true
  }

  function tryPatch() {
    var exp = window.experience
    var mc = exp && exp.controller && exp.controller.menuControls
    return patchMenuControls(mc)
  }

  var tries = 0
  var timer = setInterval(function () {
    if (tryPatch() || ++tries > 160) clearInterval(timer)
  }, 200)

  window.addEventListener('load', tryPatch)
})()
