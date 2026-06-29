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

  var FRONT_VIEW = {
    position: { x: -11.1, y: -1, z: -7.6 },
    target: { x: 0, y: 0, z: -1 },
  }

  function setVector(vec, values) {
    if (!vec || !values) return
    vec.x = values.x
    vec.y = values.y
    vec.z = values.z
  }

  function setFrontView(exp) {
    var camera = exp && exp.camera
    if (!camera || !camera.instance || !camera.controls) return false
    setVector(camera.instance.position, FRONT_VIEW.position)
    setVector(camera.controls.target, FRONT_VIEW.target)
    if (camera.camAngle && camera.camAngle.default) camera.camAngle.default()
    if (camera.controls.update) camera.controls.update()
    return true
  }

  function patchMenuControls(mc) {
    if (!mc) return false
    if (mc.__mcPatched) return true

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

  function patchCamera(exp) {
    var ctrl = exp && exp.controller
    var camera = exp && exp.camera
    if (!ctrl || !ctrl.camControls || !camera) return false
    if (ctrl.camControls.__mcCameraPatched) return true

    ctrl.camControls.toDefault = async function () {
      if (ctrl.sounds && ctrl.sounds.playWhoosh) ctrl.sounds.playWhoosh()
      if (ctrl.logic && ctrl.logic.lockButtons) ctrl.logic.lockButtons(900)
      if (camera.camAngle && camera.camAngle.unlocked) camera.camAngle.unlocked()
      setFrontView(exp)
      if (camera.controls) {
        camera.controls.enableRotate = true
        camera.controls.enableZoom = true
      }
    }

    ctrl.camControls.__mcCameraPatched = true
    setFrontView(exp)
    return true
  }

  function patchProjectsCue(exp) {
    var ctrl = exp && exp.controller
    if (!ctrl || !ctrl.menuControls || !ctrl.ramenShop || window.MC_openProjectsSign) return !!window.MC_openProjectsSign

    window.MC_openProjectsSign = function () {
      if (ctrl.logic && ctrl.logic.mode !== 'menu') {
        if (window.MC_onProjectsOpen) window.MC_onProjectsOpen()
        return
      }
      ctrl.menuControls.projects(ctrl.ramenShop.projectsWhite, 'white')
    }
    return true
  }

  function tryPatch() {
    var exp = window.experience
    var mc = exp && exp.controller && exp.controller.menuControls
    var menuDone = patchMenuControls(mc)
    var cameraDone = patchCamera(exp)
    var cueDone = patchProjectsCue(exp)
    return menuDone && cameraDone && cueDone
  }

  var tries = 0
  var timer = setInterval(function () {
    if (tryPatch() || ++tries > 160) clearInterval(timer)
  }, 200)

  window.addEventListener('load', tryPatch)

  // Re-apply camera after Enter World click — overrides the bundle's intro animation
  var startBtn = document.getElementById('mc-start-btn')
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      [1200, 2400].forEach(function (delay) {
        setTimeout(function () {
          var exp = window.experience
          if (exp) setFrontView(exp)
        }, delay)
      })
    }, { once: true })
  }
})()
