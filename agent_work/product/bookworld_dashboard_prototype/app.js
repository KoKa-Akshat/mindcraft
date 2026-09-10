import * as THREE from 'three'
import { OrbitControls } from '/app/node_modules/three/examples/jsm/controls/OrbitControls.js'

const container = document.querySelector('#worldCanvas')
const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-6, 6, 4.5, -4.5, 0.1, 100)
camera.position.set(8.5, 7.2, 9.5)
camera.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setClearColor(0xe8e4da, 1)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
container.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.enablePan = false
controls.minZoom = 0.8
controls.maxZoom = 1.8
controls.target.set(0, 0.65, 0)

scene.add(new THREE.HemisphereLight(0xfff6dd, 0x315a4a, 2.2))
const sunLight = new THREE.DirectionalLight(0xfff0b0, 3.2)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(1024, 1024)
scene.add(sunLight)

const world = new THREE.Group()
scene.add(world)

function material(color, roughness = 0.82) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 })
}

function addBox(x, y, z, width, height, depth, color, parent = world) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

const book = new THREE.Group()
world.add(book)
const leftPage = addBox(-2.25, 0, 0, 4.55, 0.14, 6.2, 0xfffdf7, book)
const rightPage = addBox(2.25, 0, 0, 4.55, 0.14, 6.2, 0xfffdf7, book)
leftPage.rotation.z = -0.035
rightPage.rotation.z = 0.035
addBox(0, -0.04, 0, 0.22, 0.2, 6.25, 0xd2b77c, book)
addBox(-2.25, -0.1, 0.08, 4.62, 0.08, 6.28, 0xe2d8c7, book)
addBox(2.25, -0.1, 0.08, 4.62, 0.08, 6.28, 0xe2d8c7, book)

const city = new THREE.Group()
city.position.y = 0.1
book.add(city)

const roadMaterial = material(0x31556f)
const roadA = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.04, 0.48), roadMaterial)
roadA.position.set(0.35, 0.09, 0.5)
roadA.receiveShadow = true
city.add(roadA)
const roadB = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 5.15), roadMaterial)
roadB.position.set(-0.55, 0.09, 0)
roadB.receiveShadow = true
city.add(roadB)

const buildingPalette = [0xdc7868, 0xe5b84d, 0xa9ccd2, 0x247a4d, 0xf1d9b6]
const buildings = []
const heatColumns = []
const positions = [
  [-3.45, -1.7, 0.7, 0.9, 1.2], [-2.4, -1.65, 0.72, 0.95, 1.8],
  [-3.4, -0.35, 0.8, 0.65, 2.15], [-2.25, -0.25, 0.75, 0.75, 1.35],
  [-3.3, 1.55, 0.9, 0.8, 1.6], [-2.1, 1.55, 0.75, 0.8, 2.3],
  [0.3, -1.6, 0.9, 0.75, 1.5], [1.55, -1.55, 0.72, 0.75, 2.2],
  [3.0, -1.45, 0.85, 0.85, 1.25], [0.45, 1.5, 0.8, 0.72, 1.75],
  [1.65, 1.45, 0.75, 0.82, 1.2], [3.0, 1.4, 0.85, 0.75, 2.05]
]

positions.forEach((item, index) => {
  const [x, z, width, depth, height] = item
  const mesh = addBox(x, 0.16 + height / 2, z, width, height, depth, buildingPalette[index % buildingPalette.length], city)
  buildings.push(mesh)
  const heatMaterial = new THREE.MeshBasicMaterial({ color: 0xdc7868, transparent: true, opacity: 0.13 })
  const heat = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.22, width * 0.34, 1, 12), heatMaterial)
  heat.position.set(x, height + 0.8, z)
  heat.scale.y = 0.8 + (index % 3) * 0.18
  city.add(heat)
  heatColumns.push(heat)
})

const trees = []
function addTree(x, z, scale = 1) {
  const group = new THREE.Group()
  group.position.set(x, 0.18, z)
  addBox(0, 0.28 * scale, 0, 0.12 * scale, 0.55 * scale, 0.12 * scale, 0x8a5a32, group)
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38 * scale, 1), material(0x247a4d))
  crown.position.y = 0.76 * scale
  crown.castShadow = true
  group.add(crown)
  city.add(group)
  trees.push(group)
}
;[[-1.15,-1.55],[-1.1,-0.65],[-1.08,1.25],[2.2,0.05],[2.9,0.25],[0.4,0.05]].forEach(([x,z], i) => addTree(x, z, 0.85 + (i % 2) * 0.12))

const water = addBox(3.2, 0.13, 0.55, 1.45, 0.05, 0.6, 0xa9ccd2, city)
water.material.roughness = 0.35

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(0.42, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xc4f547 })
)
scene.add(sun)

function setSunAngle(value) {
  const angle = THREE.MathUtils.degToRad(Number(value))
  const radius = 8
  sun.position.set(Math.cos(angle) * radius, 4 + Math.sin(angle) * 4, -5)
  sunLight.position.copy(sun.position)
  document.querySelector('#sunAngleOutput').textContent = value + ' degrees'
  const dark = Math.round(27 + Number(value) / 18)
  const shade = Math.round(23 + Number(value) / 25)
  document.querySelector('#darkTemp').textContent = dark + ' C'
  document.querySelector('#shadeTemp').textContent = shade + ' C'
}
setSunAngle(52)

let experimentRunning = false
let activeIntervention = 'trees'
const clock = new THREE.Clock()

function resize() {
  const width = Math.max(1, container.clientWidth)
  const height = Math.max(1, container.clientHeight)
  const aspect = width / height
  const viewHeight = width <= 480 ? 13 : 9
  camera.left = -viewHeight * aspect / 2
  camera.right = viewHeight * aspect / 2
  camera.top = viewHeight / 2
  camera.bottom = -viewHeight / 2
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}

function animate() {
  requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()
  controls.update()
  heatColumns.forEach((mesh, index) => {
    const base = activeIntervention === 'trees' && index > 7 ? 0.34 : 0.7
    const pulse = experimentRunning ? Math.sin(elapsed * 2.1 + index) * 0.14 : 0
    mesh.material.opacity = base * 0.17 + pulse * 0.1
    mesh.scale.y = base + 0.6 + pulse
  })
  trees.forEach((tree, index) => {
    tree.rotation.y = Math.sin(elapsed * 0.6 + index) * 0.03
  })
  renderer.render(scene, camera)
}
resize()
animate()
new ResizeObserver(resize).observe(container)

function centerCurrentMission() {
  if (window.innerWidth > 650) return
  const scroller = document.querySelector('.mission-list-section')
  const current = document.querySelector('.mission-item.is-current')
  if (!scroller || !current) return
  const target = current.closest('li') || current
  scroller.scrollLeft = Math.max(0, target.offsetLeft - (scroller.clientWidth - current.clientWidth) / 2)
}

requestAnimationFrame(centerCurrentMission)
window.addEventListener('resize', centerCurrentMission)

const modeButtons = [...document.querySelectorAll('[data-mode]')]
const simConsole = document.querySelector('#simConsole')
const cameraLab = document.querySelector('#cameraLab')
const runButton = document.querySelector('#runButton')
const evidenceItems = [...document.querySelectorAll('.evidence-item')]
const progressFill = document.querySelector('#progressFill')
const progressLabel = document.querySelector('#progressLabel')
const publishFill = document.querySelector('#publishFill')
const publishScore = document.querySelector('#publishScore')
const evidenceCount = document.querySelector('#evidenceCount')
const toast = document.querySelector('#toast')
let toastTimer

function showToast(message) {
  toast.textContent = message
  toast.classList.add('is-visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200)
}

function setMode(mode) {
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-selected', String(active))
  })
  simConsole.hidden = mode !== 'simulation'
  cameraLab.hidden = mode !== 'camera'
  runButton.textContent = mode === 'camera' ? 'Open fold mission' : mode === 'simulation' ? 'Run experiment' : 'Enter simulation'
}
modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)))

document.querySelector('#sunAngle').addEventListener('input', (event) => setSunAngle(event.target.value))
document.querySelectorAll('[data-intervention]').forEach((button) => {
  button.addEventListener('click', () => {
    activeIntervention = button.dataset.intervention
    document.querySelectorAll('[data-intervention]').forEach((item) => item.classList.toggle('is-active', item === button))
    if (activeIntervention === 'roof') {
      buildings.forEach((building, index) => { if (index % 3 === 0) building.material.color.setHex(0xf5f1e7) })
    }
    if (activeIntervention === 'shade') {
      trees.forEach((tree) => tree.scale.setScalar(1.18))
    }
    showToast(button.textContent + ' applied to the model.')
  })
})

function pinEvidence(name) {
  const item = document.querySelector('[data-evidence="' + name + '"]')
  if (!item) return
  item.classList.add('is-pinned')
  item.setAttribute('aria-pressed', 'true')
  item.querySelector('b').textContent = 'Added'
  updateEvidence()
}

function updateEvidence() {
  const pinned = document.querySelectorAll('.evidence-item.is-pinned').length
  evidenceCount.textContent = pinned + ' pinned'
  const score = Math.min(5, pinned + 1)
  publishScore.textContent = score + ' of 5'
  publishFill.style.width = (score / 5 * 100) + '%'
  const progress = 36 + pinned * 11
  progressLabel.textContent = progress + '%'
  progressFill.style.width = progress + '%'
}

evidenceItems.forEach((item) => {
  item.addEventListener('click', () => {
    const pinned = item.classList.toggle('is-pinned')
    item.setAttribute('aria-pressed', String(pinned))
    item.querySelector('b').textContent = pinned ? 'Added' : 'Pin'
    updateEvidence()
  })
})

runButton.addEventListener('click', () => {
  const selectedMode = document.querySelector('[data-mode].is-active').dataset.mode
  if (selectedMode === 'world') {
    setMode('simulation')
    showToast('Simulation controls are open.')
    return
  }
  if (selectedMode === 'camera') {
    document.querySelector('#cameraButton').click()
    return
  }
  experimentRunning = true
  runButton.textContent = 'Measuring...'
  window.setTimeout(() => {
    experimentRunning = false
    runButton.textContent = 'Run again'
    pinEvidence('simulation')
    showToast('Result pinned to Chapter 3.')
  }, 1500)
})

const missionCopy = {
  question: ['Book question', 'Why does one city block feel hotter?', 'Turn the observation into a question your book can answer.', 'world'],
  map: ['Chapter 2, concept map', 'Connect sunlight, surfaces, and shade.', 'Open the ideas your experiment needs before you run it.', 'world'],
  lab: ['Chapter 3, city heat', 'Make the invisible heat visible.', 'Run the model. Explain one pattern. Pin the evidence to your book.', 'simulation'],
  fold: ['Chapter 4, physical build', 'Fold shade you can test.', 'Use the camera guide to build a small model with your hands.', 'camera'],
  draft: ['Chapter 3, explanation', 'Turn the result into a page.', 'Choose the evidence that earns a place in your explanation.', 'world'],
  publish: ['Final mission', 'Make the work ready for readers.', 'Check sources, credit your crew, and preview the finished book.', 'world']
}

document.querySelectorAll('[data-mission]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-mission]').forEach((item) => item.classList.remove('is-current'))
    button.classList.add('is-current')
    const copy = missionCopy[button.dataset.mission]
    document.querySelector('#chapterLabel').textContent = copy[0]
    document.querySelector('#worldTitle').textContent = copy[1]
    document.querySelector('#worldPrompt').textContent = copy[2]
    setMode(copy[3])
    if (button.dataset.mission === 'publish') document.querySelector('#bookDialog').showModal()
  })
})

document.querySelectorAll('[data-nav-stage]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-nav-stage]').forEach((item) => item.classList.toggle('is-active', item === button))
    if (button.dataset.navStage === 'publish') document.querySelector('#bookDialog').showModal()
    else showToast(button.textContent.trim() + ' stage selected.')
  })
})

const dialog = document.querySelector('#bookDialog')
document.querySelector('#previewButton').addEventListener('click', () => dialog.showModal())
document.querySelector('#openDraftButton').addEventListener('click', () => dialog.showModal())
document.querySelector('#closeDialog').addEventListener('click', () => dialog.close())
dialog.addEventListener('click', (event) => {
  const rect = dialog.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close()
})

let cameraStream
const cameraVideo = document.querySelector('#cameraVideo')
const cameraButton = document.querySelector('#cameraButton')
const captureButton = document.querySelector('#captureButton')
cameraButton.addEventListener('click', async () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop())
    cameraStream = null
    cameraVideo.srcObject = null
    cameraButton.textContent = 'Turn on camera'
    captureButton.disabled = true
    return
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    cameraVideo.srcObject = cameraStream
    await cameraVideo.play()
    cameraButton.textContent = 'Turn off camera'
    captureButton.disabled = false
  } catch {
    showToast('Camera permission is needed for this mission.')
  }
})
captureButton.addEventListener('click', () => {
  pinEvidence('fold')
  showToast('Fold captured as book evidence.')
})

document.querySelector('#crewButton').addEventListener('click', () => showToast('Noor and Eli are in this book crew.'))
document.querySelector('#fieldButton').addEventListener('click', () => showToast('Field mission saved for guardian approval.'))
document.querySelectorAll('.page-row').forEach((row) => row.addEventListener('click', () => dialog.showModal()))

window.addEventListener('beforeunload', () => {
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop())
})
