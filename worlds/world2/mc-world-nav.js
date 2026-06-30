/**
 * MindCraft world navigation — patches 3D sign clicks at runtime via window.experience.
 * Loaded after the bundle so stale cached bundles still get correct routes.
 */
(function () {
  var APP = window.location.hostname === 'localhost'
    ? 'http://localhost:4321'
    : 'https://mindcraft-93858.web.app'

  var diagDone = !!localStorage.getItem('mc-diag-done')

  var ROUTES = {
    articles: APP + '/dashboard?view=gps&learnNext=1',
    aboutMe: APP + '/dashboard?view=gps',
    credits: APP + '/dashboard?view=homework',
    practice: APP + '/practice',
    book: APP + '/book',
    dashboard: APP + '/dashboard',
  }

  var FRONT_VIEW = {
    position: { x: -9, y: -0.7, z: -6.2 },
    target: { x: 0, y: 0, z: -1 },
  }

  function setVector(vec, values) {
    if (!vec || !values) return
    vec.x = values.x
    vec.y = values.y
    vec.z = values.z
  }

  // Smooth eased camera animation — same "Projects zoom" style
  function smoothToFrontView(exp, duration) {
    var camera = exp && exp.camera
    if (!camera || !camera.instance || !camera.controls) return
    var p = camera.instance.position
    var t = camera.controls.target
    var start = { px: p.x, py: p.y, pz: p.z, tx: t.x, ty: t.y, tz: t.z }
    var fp = FRONT_VIEW.position
    var ft = FRONT_VIEW.target
    var t0 = performance.now()
    function tick() {
      var prog = Math.min((performance.now() - t0) / duration, 1)
      // ease-in-out quad
      var e = prog < 0.5 ? 2 * prog * prog : -1 + (4 - 2 * prog) * prog
      p.x = start.px + (fp.x - start.px) * e
      p.y = start.py + (fp.y - start.py) * e
      p.z = start.pz + (fp.z - start.pz) * e
      t.x = start.tx + (ft.x - start.tx) * e
      t.y = start.ty + (ft.y - start.ty) * e
      t.z = start.tz + (ft.z - start.tz) * e
      if (camera.controls.update) camera.controls.update()
      if (prog < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
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
      if (ctrl.logic && ctrl.logic.lockButtons) ctrl.logic.lockButtons(1400)
      if (camera.camAngle && camera.camAngle.unlocked) camera.camAngle.unlocked()
      if (camera.controls) {
        camera.controls.enableRotate = true
        camera.controls.enableZoom = true
      }
      smoothToFrontView(exp, 1400)
    }

    ctrl.camControls.__mcCameraPatched = true
    setFrontView(exp)
    return true
  }

  function patchProjectsCue(exp) {
    var ctrl = exp && exp.controller
    if (!ctrl || !ctrl.menuControls || !ctrl.ramenShop || window.MC_openProjectsSign) return !!window.MC_openProjectsSign

    window.MC_openProjectsSign = function () {
      // Jesse's Kitchen is pre-diagnostic only. After diagnostic, return to the web app.
      if (localStorage.getItem('mc-diag-done')) {
        window.location.href = ROUTES.dashboard
        return
      }
      if (window.MC_onProjectsOpen) window.MC_onProjectsOpen()
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

  // Re-apply camera after Enter World click
  // Post-diagnostic: smooth zoom animation; otherwise instant snap
  var startBtn = document.getElementById('mc-start-btn')
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      // Instant snap first (fast) then smooth zoom if post-diagnostic
      setTimeout(function () {
        var exp = window.experience
        if (!exp) return
        if (diagDone) {
          smoothToFrontView(exp, 1600)
        } else {
          setFrontView(exp)
        }
      }, 1200)
      setTimeout(function () {
        var exp = window.experience
        if (exp && !diagDone) setFrontView(exp)
      }, 2400)
    }, { once: true })
  }
})()
