/**
 * MindCraft world navigation — patches 3D sign clicks at runtime via window.experience.
 * Desk/embed: hide About/Credits/Articles lettering; Projects → Intel, Credits → Binder.
 */
(function () {
  var APP = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5173'
    : 'https://mindcraft-93858.web.app'

  function isDeskMode() {
    return /[?&](?:desk|embed)=1(?:&|$)/.test(window.location.search)
  }

  function isDiagDone() {
    return window.MC_isDiagDone ? window.MC_isDiagDone() : !!localStorage.getItem('mc-diag-done')
  }

  var ROUTES = {
    articles: APP + '/dashboard?view=gps&learnNext=1',
    aboutMe: APP + '/dashboard?view=gps',
    credits: APP + '/dashboard?view=homework',
    practice: APP + '/practice',
    book: APP + '/book',
    dashboard: APP + '/dashboard',
  }

  // Desk default: ramen shop straight-on, slightly zoomed out.
  var FRONT_VIEW = {
    position: { x: -10.8, y: 0.35, z: -7.6 },
    target: { x: 0.05, y: -0.15, z: -1.0 },
  }

  function setVector(vec, values) {
    if (!vec || !values) return
    vec.x = values.x
    vec.y = values.y
    vec.z = values.z
  }

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

  function postDesk(action) {
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.deskAction) {
        window.webkit.messageHandlers.deskAction.postMessage({ action: action })
        return true
      }
    } catch (e) {}
    try {
      window.parent && window.parent.postMessage({ source: 'mindcraft-kitchen', action: action }, '*')
    } catch (e2) {}
    return false
  }

  function stayInMenu(ctrl) {
    try {
      if (ctrl && ctrl.logic) {
        ctrl.logic.mode = 'menu'
        ctrl.logic.buttonsLocked = false
      }
    } catch (e) {}
  }

  function hideAboutPage(exp) {
    try {
      var rs = exp && exp.world && exp.world.ramenShop
      if (!rs) return
      // Keep bigScreen — Projects uses it for the vending / screen tab.
      ;['aboutMeScreen', 'arcadeScreen'].forEach(function (key) {
        if (rs[key]) rs[key].visible = false
      })
    } catch (e) {}
  }

  function showProjectsScreen(exp) {
    try {
      var worldShop = exp && exp.world && exp.world.ramenShop
      var ctrlShop = exp && exp.controller && exp.controller.ramenShop
      ;[worldShop, ctrlShop].forEach(function (rs) {
        if (rs && rs.bigScreen) rs.bigScreen.visible = true
      })
    } catch (e) {}
  }

  var deskTextures = {
    menu: null,
    shrine: null,
    tools: {},
    loading: false,
    ready: false,
  }

  var DESK_REV = 'desk-polka-2'

  var projectsExitToken = 0
  var projectsExiting = false

  /**
   * The vending screens ship as KTX2 → sample.constructor is CompressedTexture,
   * which CANNOT wrap a canvas/img. Walk the prototype chain up to the plain
   * THREE.Texture class before constructing.
   */
  function plainTextureClass(sample) {
    var C = sample && sample.constructor
    var guard = 0
    while (C && guard++ < 6) {
      try {
        var probe = new C(document.createElement('canvas'))
        if (probe && probe.isTexture && !probe.isCompressedTexture) return C
      } catch (e) {}
      C = Object.getPrototypeOf(C)
    }
    return null
  }

  function cloneTextureFrom(sample, image) {
    if (!sample || !image) return null
    try {
      var Texture = plainTextureClass(sample)
      if (!Texture) return null
      var tex = new Texture(image)
      tex.needsUpdate = true
      if ('flipY' in sample) tex.flipY = sample.flipY
      if ('colorSpace' in sample && 'colorSpace' in tex) tex.colorSpace = sample.colorSpace
      if ('encoding' in sample && 'encoding' in tex) tex.encoding = sample.encoding
      if ('wrapS' in sample) tex.wrapS = sample.wrapS
      if ('wrapT' in sample) tex.wrapT = sample.wrapT
      return tex
    } catch (e) {
      return null
    }
  }

  function loadImage(url) {
    return new Promise(function (resolve) {
      var img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = function () { resolve(img) }
      img.onerror = function () { resolve(null) }
      img.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + DESK_REV
    })
  }

  /** White polka dots on deep ink — the doorway screen into the Desk. */
  function polkaCanvasTexture(sample) {
    var c = document.createElement('canvas')
    c.width = 1024
    c.height = 1024
    var g = c.getContext('2d')
    if (!g) return null

    g.fillStyle = '#0b1611'
    g.fillRect(0, 0, c.width, c.height)

    var step = 96
    for (var y = step / 2, row = 0; y < c.height + step; y += step, row++) {
      var offset = row % 2 ? step / 2 : 0
      for (var x = step / 2 + offset; x < c.width + step; x += step) {
        g.beginPath()
        g.arc(x, y, 17, 0, Math.PI * 2)
        g.fillStyle = 'rgba(255,255,255,0.94)'
        g.fill()
      }
    }

    // Center pill: tell students the screen is a door, not wallpaper.
    var pw = 560
    var ph = 118
    var px = (c.width - pw) / 2
    var py = (c.height - ph) / 2
    g.fillStyle = 'rgba(11,22,17,0.92)'
    if (g.roundRect) {
      g.beginPath()
      g.roundRect(px, py, pw, ph, 59)
      g.fill()
    } else {
      g.fillRect(px, py, pw, ph)
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)'
    g.lineWidth = 3
    if (g.roundRect) {
      g.beginPath()
      g.roundRect(px, py, pw, ph, 59)
      g.stroke()
    }
    g.fillStyle = 'rgba(255,255,255,0.96)'
    g.font = '800 46px "Nunito Sans", system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('tap to open your Desk', c.width / 2, c.height / 2 + 2)

    return cloneTextureFrom(sample, c)
  }

  function stopCameraMotion(exp, ctrl) {
    try {
      var camera = exp && exp.camera
      if (camera && camera.controls) {
        camera.controls.enableRotate = false
        camera.controls.enableZoom = false
        camera.controls.enablePan = false
        if (typeof camera.controls.saveState === 'function') camera.controls.saveState()
        // Kill residual orbit inertia that causes the spin loop.
        if ('enableDamping' in camera.controls) camera.controls.enableDamping = false
        if (camera.controls.target && FRONT_VIEW.target) {
          setVector(camera.controls.target, FRONT_VIEW.target)
        }
        if (camera.instance && FRONT_VIEW.position) {
          setVector(camera.instance.position, FRONT_VIEW.position)
        }
        if (typeof camera.controls.update === 'function') camera.controls.update()
      }
      if (camera && camera.camAngle && camera.camAngle.default) {
        try { camera.camAngle.default() } catch (e) {}
      }
      if (ctrl && ctrl.logic) {
        ctrl.logic.buttonsLocked = true
        ctrl.logic.mode = 'menu'
      }
    } catch (e2) {}
  }

  function exitProjectsCleanly(ctrl) {
    if (!ctrl || projectsExiting) return
    projectsExiting = true
    var token = ++projectsExitToken
    var exp = window.experience

    try { ctrl.sounds && ctrl.sounds.playBloop && ctrl.sounds.playBloop() } catch (e) {}

    // Hard-stop any in-flight projects camera tween / orbit spin.
    stopCameraMotion(exp, ctrl)
    setFrontView(exp)

    var shrine = deskTextures.shrine || (ctrl.resources && ctrl.resources.items && ctrl.resources.items.vendingMachineDefaultTexture)
    try {
      if (shrine && ctrl.bigScreenTransition && ctrl.materials) {
        ctrl.bigScreenTransition(
          ctrl.materials.vendingMachineScreenMaterial,
          shrine,
          0.12,
          null
        )
      }
    } catch (e2) {}

    // Settle once — no second toDefault() that re-enables rotate mid-tween.
    window.setTimeout(function () {
      if (token !== projectsExitToken) return
      try {
        setFrontView(exp)
        stayInMenu(ctrl)
        var camera = exp && exp.camera
        if (camera && camera.controls) {
          // Keep rotate off for a beat so inertia can't restart the loop.
          camera.controls.enableRotate = false
          camera.controls.enableZoom = true
        }
      } catch (e3) {}
      window.setTimeout(function () {
        if (token !== projectsExitToken) return
        projectsExiting = false
        try {
          stayInMenu(ctrl)
          var camera = exp && exp.camera
          if (camera && camera.controls) {
            camera.controls.enableRotate = true
            if ('enableDamping' in camera.controls) camera.controls.enableDamping = true
          }
        } catch (e4) {}
      }, 500)
    }, 180)
  }

  function ensureDeskTextures(ctrl) {
    if (!ctrl || !ctrl.resources || !ctrl.resources.items) return Promise.resolve(false)
    // Bust in-memory cache when the menu art revision changes.
    if (deskTextures.ready && deskTextures.rev === DESK_REV) return Promise.resolve(true)
    if (deskTextures.ready && deskTextures.rev !== DESK_REV) {
      deskTextures.ready = false
      deskTextures.menu = null
      deskTextures.shrine = null
      deskTextures.tools = {}
    }
    if (deskTextures.loading) {
      return new Promise(function (resolve) {
        var n = 0
        var t = setInterval(function () {
          if (deskTextures.ready || ++n > 80) {
            clearInterval(t)
            resolve(deskTextures.ready)
          }
        }, 50)
      })
    }
    deskTextures.loading = true
    var sample = ctrl.resources.items.vendingMachineMenuTexture
      || ctrl.resources.items.vendingMachineDefaultTexture
    var base = 'textures/screens/vendingMachineScreens/'
    // Projects screen: white polka dots (tap → standalone Desk). No cat art.
    deskTextures.menu = polkaCanvasTexture(sample)
    return loadImage(base + 'deskShrineScreen.png').then(function (shrineImage) {
      deskTextures.shrine = cloneTextureFrom(sample, shrineImage)
      if (deskTextures.menu) {
        ctrl.resources.items.vendingMachineMenuTexture = deskTextures.menu
      }
      if (deskTextures.shrine) {
        ctrl.resources.items.vendingMachineDefaultTexture = deskTextures.shrine
      }
      deskTextures.ready = !!deskTextures.menu
      deskTextures.rev = DESK_REV
      deskTextures.loading = false
      return deskTextures.ready
    })
  }

  function patchProjectControls(ctrl) {
    if (!ctrl || !ctrl.projectControls || ctrl.projectControls.__mcDeskTools) return false
    if (!isDeskMode()) return true

    // The polka screen is one door: ANY tap on it opens the standalone Desk.
    var openDesk = async function () {
      openDeskFromProjects(ctrl)
    }

    for (var n = 1; n <= 8; n++) {
      ctrl.projectControls['project' + n] = openDesk
    }
    ctrl.projectControls.projectBack = openDesk

    ctrl.projectControls.__mcDeskTools = true
    return true
  }

  var openingDesk = false

  function openDeskFromProjects(ctrl) {
    if (projectsExiting || openingDesk) return
    openingDesk = true
    window.setTimeout(function () { openingDesk = false }, 1600)
    try { ctrl && ctrl.sounds && ctrl.sounds.playBloop && ctrl.sounds.playBloop() } catch (e) {}
    postDesk('openDesk')
    // Reset the kitchen behind the native polka transition so it is
    // front-facing again when the student comes back.
    window.setTimeout(function () { if (ctrl) exitProjectsCleanly(ctrl) }, 700)
  }

  /** Paint the polka texture onto the vending screen, retrying while it builds. */
  function applyPolkaScreen(ctrl, tries) {
    if (!ctrl) return
    var tex = deskTextures.menu
    if (tex) {
      try {
        if (ctrl.bigScreenTransition && ctrl.materials && ctrl.materials.vendingMachineScreenMaterial) {
          ctrl.bigScreenTransition(ctrl.materials.vendingMachineScreenMaterial, tex, 0.2, null)
          return
        }
      } catch (e) {}
      try {
        var mat = ctrl.materials && ctrl.materials.vendingMachineScreenMaterial
        if (mat && mat.uniforms) {
          if (mat.uniforms.uTexture1) mat.uniforms.uTexture1.value = tex
          if (mat.uniforms.uTexture2) mat.uniforms.uTexture2.value = tex
          return
        }
        if (mat && 'map' in mat) {
          mat.map = tex
          mat.needsUpdate = true
          return
        }
      } catch (e2) {}
      return
    }
    if (tries > 0) window.setTimeout(function () { applyPolkaScreen(ctrl, tries - 1) }, 300)
  }

  /** Hide About Me / Credits / Articles lettering — keep Projects only. */
  function stripDeskSigns(exp) {
    if (!isDeskMode()) return false
    var rs = exp && exp.controller && exp.controller.ramenShop

    // Always scrub DOM labels even before the 3D shop exists.
    ;['wake-jesse', 'connect'].forEach(function (slug) {
      var el = document.getElementById('mc-desk-label-' + slug)
      if (el && el.parentNode) el.parentNode.removeChild(el)
    })
    document.querySelectorAll('.mc-desk-sign-label').forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el)
    })

    if (!rs) return false
    // Re-apply every call — ramenShop sometimes rebuilds meshes after enter.
    ;[
      'aboutMeBlack', 'aboutMeBlue',
      'creditsBlack', 'creditsOrange',
      'articlesRed', 'articlesWhite',
    ].forEach(function (name) {
      if (rs[name]) rs[name].visible = false
    })

    rs.__mcSignsStripped = true
    return true
  }

  function patchMenuControls(mc, exp) {
    if (!mc) return false
    var desk = isDeskMode()

    // Articles lettering hidden — no-op on desk.
    mc.articles = async function (t, e) {
      if (this.logic.buttonsLocked || this.logic.mode !== 'menu') return
      this.sounds.playClick()
      await this.menuControls.buttonIndicator(t, e)
      await this.sleep(120)
      if (desk) {
        stayInMenu(this)
        return
      }
      window.location.href = ROUTES.articles
    }

    // About Me lettering hidden — launched from desk widget instead.
    mc.aboutMe = async function (t, e) {
      if (this.logic.buttonsLocked || this.logic.mode !== 'menu') return
      this.sounds.playClick()
      await this.menuControls.buttonIndicator(t, e)
      await this.sleep(120)
      if (desk) {
        hideAboutPage(exp || window.experience)
        stayInMenu(this)
        return
      }
      window.location.href = ROUTES.aboutMe
    }

    // Credits (lettering hidden) → Binder on desk.
    mc.credits = async function (t, e) {
      if (this.logic.buttonsLocked || this.logic.mode !== 'menu') return
      this.sounds.playClick()
      await this.menuControls.buttonIndicator(t, e)
      await this.sleep(120)
      if (desk) {
        stayInMenu(this)
        postDesk('binder')
        return
      }
      window.location.href = ROUTES.credits
    }

    mc.practice = async function (t, e) {
      if (this.logic.buttonsLocked || this.logic.mode !== 'menu') return
      this.sounds.playClick()
      await this.sleep(250)
      if (desk) {
        stayInMenu(this)
        postDesk('calendar')
        return
      }
      window.location.href = ROUTES.practice
    }

    // Projects → glide the camera to the vending screen showing WHITE POLKA
    // DOTS (never the cat art). Tapping that screen opens the standalone
    // Desk in the app via the native polka-fill transition.
    mc.projects = async function (t, e) {
      var ctrl = (exp && exp.controller) || (window.experience && window.experience.controller)
      if (!ctrl || !ctrl.logic) return

      if (desk) {
        if (projectsExiting || String(ctrl.logic.mode || '').indexOf('projects') === 0) return
        try { ctrl.sounds && ctrl.sounds.playClick && ctrl.sounds.playClick() } catch (err) {}
        try {
          if (ctrl.menuControls && ctrl.menuControls.buttonIndicator) {
            await ctrl.menuControls.buttonIndicator(t, e)
          }
        } catch (err1) {}
        // Never block on texture building — clicks matter more than paint.
        ensureDeskTextures(ctrl)
        showProjectsScreen(window.experience)
        ctrl.logic.mode = 'projects0'
        try {
          if (ctrl.camControls && ctrl.camControls.toProjects) {
            await ctrl.camControls.toProjects()
          }
        } catch (err2) {}
        // Re-assert state — toProjects can flip mode/locks while tweening.
        ctrl.logic.mode = 'projects0'
        ctrl.logic.buttonsLocked = false
        applyPolkaScreen(ctrl, 12)
        window.setTimeout(function () {
          try { ctrl.logic.buttonsLocked = false } catch (errL) {}
        }, 900)
        return
      }

      if (ctrl.logic.buttonsLocked || ctrl.logic.mode !== 'menu') return
      try { ctrl.sounds && ctrl.sounds.playClick && ctrl.sounds.playClick() } catch (err) {}
      try {
        if (ctrl.menuControls && ctrl.menuControls.buttonIndicator) {
          await ctrl.menuControls.buttonIndicator(t, e)
        }
      } catch (err2) {}
      ctrl.logic.mode = 'projects0'
      try {
        if (ctrl.camControls && ctrl.camControls.toProjects) {
          await ctrl.camControls.toProjects()
        }
      } catch (err3) {}
      try {
        if (ctrl.bigScreenTransition && ctrl.materials && ctrl.resources && ctrl.resources.items) {
          ctrl.bigScreenTransition(
            ctrl.materials.vendingMachineScreenMaterial,
            ctrl.resources.items.vendingMachineMenuTexture,
            0.2,
            null
          )
        }
      } catch (err4) {}
    }

    mc.__mcPatched = true
    mc.__mcDeskPatched = desk
    console.info('[MindCraft] Jesse world nav patched', desk ? 'desk-zoom-8' : ROUTES)
    return true
  }

  function patchCamera(exp) {
    var ctrl = exp && exp.controller
    var camera = exp && exp.camera
    if (!ctrl || !ctrl.camControls || !camera) return false
    if (ctrl.camControls.__mcCameraPatched) return true

    ctrl.camControls.toDefault = async function () {
      if (isDeskMode()) {
        var mode = ctrl.logic && ctrl.logic.mode
        if (mode && String(mode).indexOf('projects') === 0) {
          // Leaving the projects screen — hard snap, no orbit spin.
          exitProjectsCleanly(ctrl)
          return
        }
        stopCameraMotion(window.experience, ctrl)
        setFrontView(exp)
        stayInMenu(ctrl)
        return
      }
      if (ctrl.sounds && ctrl.sounds.playWhoosh) ctrl.sounds.playWhoosh()
      if (ctrl.logic && ctrl.logic.lockButtons) ctrl.logic.lockButtons(1400)
      if (camera.camAngle && camera.camAngle.unlocked) camera.camAngle.unlocked()
      if (camera.controls) {
        camera.controls.enableRotate = true
        camera.controls.enableZoom = true
      }
      smoothToFrontView(exp, 1400)
      window.setTimeout(function () { stayInMenu(ctrl) }, 1500)
    }

    ctrl.camControls.__mcCameraPatched = true
    setFrontView(exp)
    stayInMenu(ctrl)
    return true
  }

  function patchProjectsCue(exp) {
    var ctrl = exp && exp.controller
    if (!ctrl || !ctrl.menuControls) return false

    window.MC_onProjectsOpen = function () {
      if (isDeskMode()) {
        // Route into the polka-screen flow; mode guard stops double-runs.
        if (ctrl && ctrl.menuControls && ctrl.menuControls.projects) {
          ctrl.menuControls.projects(null, null)
        }
        return
      }
      window.location.href = ROUTES.dashboard
    }
    window.MC_openProjectsSign = function () {
      if (isDeskMode() && ctrl && ctrl.menuControls && ctrl.menuControls.projects) {
        ctrl.menuControls.projects(null, null)
        return
      }
      window.MC_onProjectsOpen()
    }
    return true
  }

  function tryPatch() {
    var exp = window.experience
    var ctrl = exp && exp.controller
    var mc = ctrl && ctrl.menuControls
    var menuDone = patchMenuControls(mc, exp)
    var cameraDone = patchCamera(exp)
    var cueDone = patchProjectsCue(exp)
    stripDeskSigns(exp)
    if (ctrl) {
      stayInMenu(ctrl)
      if (isDeskMode()) {
        // Clicks must NEVER wait on texture work — patch immediately.
        patchProjectControls(ctrl)
        try { ensureDeskTextures(ctrl) } catch (e) {}
      }
    }
    hideAboutPage(exp)
    return menuDone && cameraDone && cueDone
  }

  var tries = 0
  var patched = false
  var timer = setInterval(function () {
    // Keep stripping even after patch succeeds — enter can re-show lettering briefly.
    stripDeskSigns(window.experience)
    if (!patched) patched = tryPatch()
    if (++tries > 220) clearInterval(timer)
  }, 80)

  window.MC_exitProjects = function () {
    var ctrl = window.experience && window.experience.controller
    if (ctrl) exitProjectsCleanly(ctrl)
    else {
      projectsExiting = false
      stayInMenu(ctrl)
    }
  }

  // Bulletproof door: while zoomed at the projects screen, ANY tap opens the
  // Desk — independent of the 3D raycast/button-lock machinery.
  document.addEventListener('click', function () {
    if (!isDeskMode()) return
    var ctrl = window.experience && window.experience.controller
    if (!ctrl || !ctrl.logic) return
    if (String(ctrl.logic.mode || '').indexOf('projects') !== 0) return
    openDeskFromProjects(ctrl)
  }, true)

  // Debug: inspect texture/patch state from the console.
  window.__MC_NAV = deskTextures

  window.addEventListener('load', tryPatch)
  // Start stripping immediately (before load) so labels never linger.
  stripDeskSigns(window.experience)

  var startBtn = document.getElementById('mc-start-btn')
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      // One settle into FRONT_VIEW — no second snap that fights pinch-zoom.
      setTimeout(function () {
        var exp = window.experience
        if (!exp) return
        if (isDeskMode()) {
          setFrontView(exp)
        } else if (isDiagDone()) {
          smoothToFrontView(exp, 1600)
        } else {
          setFrontView(exp)
        }
        if (exp.controller) {
          window.setTimeout(function () { stayInMenu(exp.controller) }, 900)
        }
        stripDeskSigns(exp)
      }, 900)
    }, { once: true })
  }
})()

/* desk-polka-2 1786350300 */
