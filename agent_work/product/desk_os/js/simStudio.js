import { inventSim, listChainableLibrarySims } from './simInvent.js';
import { createSimWorld } from './simWorld.js?v=world2';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BOARD_WIDTH = 1480;
const BOARD_HEIGHT = 820;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatValue(value) {
  if (!Number.isFinite(value)) return 'waiting';
  return Math.abs(value) >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

function simDocument(config) {
  const payload = JSON.stringify(config).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; color: #143a2e; background: #fffdf8; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 0; background: #fffdf8; }
    main { min-height: 188px; padding: 12px; display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 12px; }
    .visual { position: relative; min-height: 164px; overflow: hidden; border: 1px solid rgba(20,58,46,.18); border-radius: 6px; background: #f7f3ee; }
    .controls { display: flex; min-width: 0; flex-direction: column; justify-content: center; gap: 8px; }
    label { display: grid; grid-template-columns: 1fr auto; gap: 3px 8px; padding: 3px 4px; border-radius: 5px; color: #52675f; font-size: 10px; font-weight: 700; transition: background-color .3s, box-shadow .3s; }
    label output { color: #143a2e; font-variant-numeric: tabular-nums; }
    label.is-highlighted { background: rgba(196,245,71,.45); box-shadow: 0 0 0 2px #c4f547; }
    input { grid-column: 1 / -1; width: 100%; accent-color: #247a4d; }
    .readouts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
    .readout { min-width: 0; padding: 6px; border: 1px solid rgba(20,58,46,.14); border-radius: 5px; background: #f7f3ee; }
    .readout small { display: block; overflow: hidden; color: #52675f; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
    .readout strong { display: block; margin-top: 2px; font-size: 12px; font-variant-numeric: tabular-nums; }
    .sun-disc { position: absolute; width: 46px; height: 46px; left: 20px; top: 22px; border-radius: 50%; background: #c4f547; border: 2px solid #143a2e; }
    .sun-ray { position: absolute; width: 4px; height: 90px; left: 42px; top: 48px; transform-origin: 50% 0; background: #d3a900; }
    .sun-ground { position: absolute; left: 10px; right: 10px; bottom: 17px; height: 7px; background: #247a4d; }
    .shade-roof { position: absolute; left: 16px; right: 16px; top: 57px; height: 12px; background: #143a2e; }
    .shade-leg { position: absolute; top: 67px; bottom: 20px; width: 5px; background: #143a2e; }
    .shade-leg.left { left: 23px; }
    .shade-leg.right { right: 23px; }
    .shade-canopy { position: absolute; left: 12px; right: 12px; top: 20px; height: 28px; background: #8fb89a; border: 2px solid #143a2e; }
    .shade-heat { position: absolute; left: 12px; bottom: 8px; height: 7px; background: #c1121f; }
    .plant-pot { position: absolute; width: 48px; height: 35px; left: 20px; bottom: 15px; background: #d3a900; border: 2px solid #143a2e; }
    .plant-stem { position: absolute; width: 5px; left: 42px; bottom: 49px; background: #247a4d; transform-origin: bottom; }
    .plant-leaf { position: absolute; width: 28px; height: 16px; bottom: 92px; background: #8fb89a; border: 2px solid #143a2e; border-radius: 50% 0 50% 0; }
    .plant-leaf.left { left: 17px; transform: rotate(16deg); }
    .plant-leaf.right { right: 17px; transform: scaleX(-1) rotate(16deg); }
  </style>
</head>
<body>
  <main>
    <div class="visual" data-visual></div>
    <div class="controls">
      <div data-controls></div>
      <div class="readouts" data-readouts></div>
    </div>
  </main>
  <script>
    const config = ${payload};
    const state = Object.fromEntries(config.inputs.map((input) => [input.id, Number(input.default)]));
    const visual = document.querySelector('[data-visual]');
    const controls = document.querySelector('[data-controls]');
    const readouts = document.querySelector('[data-readouts]');

    if (config.kind === 'sun') {
      visual.innerHTML = '<span class="sun-disc"></span><span class="sun-ray"></span><span class="sun-ground"></span>';
    } else if (config.kind === 'shade') {
      visual.innerHTML = '<span class="shade-canopy"></span><span class="shade-roof"></span><span class="shade-leg left"></span><span class="shade-leg right"></span><span class="shade-heat"></span>';
    } else {
      visual.innerHTML = '<span class="plant-pot"></span><span class="plant-stem"></span><span class="plant-leaf left"></span><span class="plant-leaf right"></span>';
    }

    function clampValue(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function compute() {
      if (config.kind === 'sun') {
        const light = Math.sin(Number(state.angle) * Math.PI / 180) * 100;
        return { light: Math.max(0, Math.round(light * 10) / 10) };
      }
      if (config.kind === 'shade') {
        const light = Number(state.light);
        const canopy = Number(state.canopy);
        return {
          temperature: Math.round((18 + light * 0.18 - canopy * 0.075) * 10) / 10,
          shade: Math.round(clampValue(canopy * 0.82 + (100 - light) * 0.08, 0, 100) * 10) / 10,
        };
      }
      const temperature = Number(state.temperature);
      const shade = Number(state.shade);
      const fertilizer = Number(state.fertilizer);
      const water = Number(state.water);
      const growth = 10
        - Math.abs(temperature - 24) * 0.22
        - Math.abs(shade - 35) * 0.035
        - Math.abs(fertilizer - 50) * 0.045
        - Math.abs(water - 60) * 0.05;
      return { growth: Math.round(Math.max(0, growth) * 10) / 10 };
    }

    function paint(outputs) {
      if (config.kind === 'sun') {
        visual.querySelector('.sun-ray').style.transform = 'rotate(' + (Number(state.angle) - 45) + 'deg)';
      } else if (config.kind === 'shade') {
        visual.querySelector('.shade-canopy').style.opacity = String(0.35 + Number(state.canopy) / 160);
        visual.querySelector('.shade-heat').style.width = clampValue((outputs.temperature - 15) * 3.4, 8, 64) + 'px';
      } else {
        const height = 28 + outputs.growth * 10;
        visual.querySelector('.plant-stem').style.height = height + 'px';
        visual.querySelectorAll('.plant-leaf').forEach((leaf) => { leaf.style.bottom = (40 + height) + 'px'; });
      }

      config.outputs.forEach((output) => {
        const target = readouts.querySelector('[data-output="' + output.id + '"] strong');
        if (target) target.textContent = outputs[output.id] + (output.unit ? ' ' + output.unit : '');
      });
    }

    function emit() {
      const outputs = compute();
      paint(outputs);
      parent.postMessage({ type: 'sim:output', values: outputs }, '*');
    }

    config.inputs.forEach((input) => {
      const label = document.createElement('label');
      label.innerHTML = '<span>' + input.label + '</span><output>' + input.default + '</output><input type="range" min="' + input.min + '" max="' + input.max + '" step="' + input.step + '" value="' + input.default + '">';
      const slider = label.querySelector('input');
      const output = label.querySelector('output');
      slider.dataset.input = input.id;
      slider.addEventListener('input', () => {
        state[input.id] = Number(slider.value);
        output.textContent = slider.value;
        emit();
      });
      controls.appendChild(label);
    });

    config.outputs.forEach((output) => {
      const item = document.createElement('div');
      item.className = 'readout';
      item.dataset.output = output.id;
      item.innerHTML = '<small>' + output.label + '</small><strong>waiting</strong>';
      readouts.appendChild(item);
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message) return;
      // Fired when a student clicks a factor in the documentation panel
      // next to this sim (2026-09-04 ask): a brief, real visual link from
      // "why it matters" straight to the control that does it.
      if (message.type === 'sim:highlight' && typeof message.inputId === 'string') {
        const slider = controls.querySelector('[data-input="' + message.inputId + '"]');
        const label = slider ? slider.closest('label') : null;
        if (label) {
          label.classList.add('is-highlighted');
          setTimeout(() => label.classList.remove('is-highlighted'), 1400);
        }
        return;
      }
      if (message.type !== 'sim:input' || !message.values || typeof message.values !== 'object') return;
      let changed = false;
      config.inputs.forEach((input) => {
        const next = Number(message.values[input.id]);
        if (!Number.isFinite(next)) return;
        state[input.id] = clampValue(next, input.min, input.max);
        const slider = controls.querySelector('[data-input="' + input.id + '"]');
        if (slider) {
          slider.value = String(state[input.id]);
          slider.parentElement.querySelector('output').textContent = String(state[input.id]);
        }
        changed = true;
      });
      if (changed) emit();
    });

    parent.postMessage({ type: 'sim:ready', inputs: config.inputs, outputs: config.outputs }, '*');
    emit();
  <\/script>
</body>
</html>`;
}

const TEMPLATES = {
  sun: {
    id: 'sun',
    title: 'Sun dial',
    eyebrow: 'Light source',
    accent: '#c4f547',
    document: simDocument({
      kind: 'sun',
      inputs: [{ id: 'angle', label: 'Sun angle', min: 0, max: 90, step: 1, default: 52 }],
      outputs: [{ id: 'light', label: 'Light', unit: '%' }],
    }),
  },
  shade: {
    id: 'shade',
    title: 'Shade lab',
    eyebrow: 'Heat model',
    accent: '#ef806a',
    document: simDocument({
      kind: 'shade',
      inputs: [
        { id: 'light', label: 'Light', min: 0, max: 100, step: 1, default: 70 },
        { id: 'canopy', label: 'Tree cover', min: 0, max: 100, step: 1, default: 42 },
      ],
      outputs: [
        { id: 'temperature', label: 'Surface temp', unit: 'C' },
        { id: 'shade', label: 'Shade', unit: '%' },
      ],
    }),
  },
  plant: {
    id: 'plant',
    title: 'Plant bed',
    eyebrow: 'Growth model',
    accent: '#8fb89a',
    document: simDocument({
      kind: 'plant',
      inputs: [
        { id: 'temperature', label: 'Temperature', min: 0, max: 50, step: 0.5, default: 24 },
        { id: 'shade', label: 'Shade', min: 0, max: 100, step: 1, default: 35 },
        { id: 'fertilizer', label: 'Fertilizer', min: 0, max: 100, step: 1, default: 50 },
        { id: 'water', label: 'Soil moisture', min: 0, max: 100, step: 1, default: 60 },
      ],
      outputs: [{ id: 'growth', label: 'Growth', unit: 'mm/day' }],
    }),
  },
};

/** Real reference facts behind a template, shown next to its live sim so a
 * student reads the why before they touch the sliders (2026-09-04 ask).
 * Keyed by TEMPLATES id. Each section's inputId ties it to the exact slider
 * it explains, click a factor and the matching control glows (see
 * renderSoloDoc + the sim:highlight bridge in simDocument's own script).
 * Plant bed's formula (simDocument's kind 'plant' compute()) is tuned to
 * treat each of these four real optimal points as the zero-penalty best
 * case, these numbers are not new, they are what the formula was always
 * built around, made visible and clickable. */
const DOCS = {
  plant: {
    title: 'What actually makes a plant grow',
    sections: [
      {
        heading: 'Temperature',
        inputId: 'temperature',
        body: 'Most common garden and houseplants grow fastest between 18C and 27C (65 to 80F). Below 10C growth slows sharply. Above 35C, heat stress cuts growth even when water is not the problem. This sim treats 24C as the optimum, the middle of that real range.',
      },
      {
        heading: 'Light and shade',
        inputId: 'shade',
        body: '6 or more hours of light drives strong photosynthesis, but full sun in a hot climate can scorch leaves and dry the soil out fast. 30 to 40% shade is a common sweet spot in real gardens: enough light to grow, less heat and water stress. This sim treats 35% shade as the optimum for the same reason.',
      },
      {
        heading: 'Fertilizer',
        inputId: 'fertilizer',
        body: 'A balanced N-P-K fertilizer (like 10-10-10) during active growth covers the basics. Nitrogen (N) grows leaves and stems, phosphorus (P) grows roots and flowers, potassium (K) supports overall health. Too much nitrogen without enough light produces tall, weak, leggy growth, and over-fertilizing at all can burn roots. This sim treats a middle fertilizer level as the optimum, not the max.',
      },
      {
        heading: 'Water and soil',
        inputId: 'water',
        body: 'Keep soil consistently moist, not soaked. Check by feeling an inch down, water when it is dry there. Well-draining soil matters as much as watering itself, standing water suffocates roots and causes rot. This sim treats a well-watered but not soaked soil moisture as the optimum.',
      },
    ],
    note: 'Click a factor to see exactly which control it is. All four are live in this sim, move any slider and watch growth respond for real.',
  },
};

function normalizeInputs(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.label !== 'string') return [];
    const min = Number(item.min);
    const max = Number(item.max);
    const step = Number(item.step);
    const defaultValue = Number(item.default);
    if (![min, max, step, defaultValue].every(Number.isFinite) || max <= min || step <= 0) return [];
    return [{ id: item.id, label: item.label, min, max, step, default: clamp(defaultValue, min, max) }];
  });
}

function normalizeOutputs(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.label !== 'string') return [];
    return [{ id: item.id, label: item.label, unit: typeof item.unit === 'string' ? item.unit : '' }];
  });
}

export function createSimStudio({ root, onToast = () => {}, resumePanel = null, tutorMapPanel = null } = {}) {
  if (!root) return { open() {}, reset() {}, destroy() {} };

  const board = root.querySelector('[data-sim-board]');
  const viewport = root.querySelector('[data-sim-viewport]');
  const wireLayer = root.querySelector('[data-sim-wires]');
  const status = root.querySelector('[data-sim-status]');
  const clearButton = root.querySelector('[data-sim-clear-wires]');
  const resetButton = root.querySelector('[data-sim-reset]');
  const soloDialog = root.querySelector('[data-sim-solo-dialog]');
  const soloMount = root.querySelector('[data-sim-solo-mount]');
  const soloDoc = root.querySelector('[data-sim-solo-doc]');
  const soloTitle = root.querySelector('[data-sim-solo-title]');
  const soloClose = root.querySelector('[data-sim-solo-close]');
  const inventForm = root.querySelector('[data-sim-invent-form]');
  const inventInput = root.querySelector('[data-sim-invent-input]');
  const inventButton = root.querySelector('[data-sim-invent-submit]');
  const libraryList = root.querySelector('[data-sim-library-list]');
  const libraryStatus = root.querySelector('[data-sim-library-status]');
  const nodes = new Map();
  let connections = [];
  let nodeSequence = 0;
  let connectionSequence = 0;
  let pendingWire = null;
  let soloNode = null;
  let resetSequence = 0;

  board.style.width = `${BOARD_WIDTH}px`;
  board.style.height = `${BOARD_HEIGHT}px`;

  function nodeForSource(source) {
    return [...nodes.values()].find((node) => node.iframe.contentWindow === source) || null;
  }

  function portElement(nodeId, direction, portId) {
    const node = nodes.get(nodeId);
    if (!node) return null;
    return node.el.querySelector(`[data-direction="${direction}"][data-port-id="${CSS.escape(portId)}"]`);
  }

  function updateStatus(message = '') {
    const ready = [...nodes.values()].filter((node) => node.ready).length;
    if (status) status.textContent = message || `${ready} sims live, ${connections.length} wires`;
  }

  function wirePoint(element) {
    if (!element) return null;
    const boardRect = board.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2,
    };
  }

  function pathBetween(from, to) {
    const bend = Math.max(70, Math.abs(to.x - from.x) * 0.46);
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
  }

  function createPath(d, color, className) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('class', className);
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    return path;
  }

  function renderWires() {
    wireLayer.replaceChildren();
    wireLayer.setAttribute('viewBox', `0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`);
    wireLayer.setAttribute('width', String(BOARD_WIDTH));
    wireLayer.setAttribute('height', String(BOARD_HEIGHT));

    connections.forEach((connection) => {
      const fromPort = portElement(connection.fromNodeId, 'output', connection.outputId);
      const toPort = portElement(connection.toNodeId, 'input', connection.inputId);
      const from = wirePoint(fromPort);
      const to = wirePoint(toPort);
      if (!from || !to) return;
      const source = nodes.get(connection.fromNodeId);
      wireLayer.appendChild(createPath(pathBetween(from, to), source?.template.accent || '#247a4d', 'sim-wire'));

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String((from.x + to.x) / 2));
      label.setAttribute('y', String((from.y + to.y) / 2 - 8));
      label.setAttribute('class', 'sim-wire-text');
      label.textContent = connection.lastLabel || 'waiting';
      wireLayer.appendChild(label);
    });

    if (pendingWire?.point) {
      const fromPort = portElement(pendingWire.fromNodeId, 'output', pendingWire.outputId);
      const from = wirePoint(fromPort);
      if (from) {
        const source = nodes.get(pendingWire.fromNodeId);
        wireLayer.appendChild(createPath(pathBetween(from, pendingWire.point), source?.template.accent || '#247a4d', 'sim-wire is-preview'));
      }
    }
  }

  function setPortValue(nodeId, direction, portId, value, unit = '') {
    const element = portElement(nodeId, direction, portId);
    const target = element?.querySelector('[data-sim-port-value]');
    if (target) target.textContent = Number.isFinite(value) ? `${formatValue(value)}${unit ? ` ${unit}` : ''}` : 'manual';
  }

  function pushConnectionValue(connection) {
    const source = nodes.get(connection.fromNodeId);
    const target = nodes.get(connection.toNodeId);
    const value = Number(source?.values?.[connection.outputId]);
    if (!source || !target || !Number.isFinite(value)) return;
    const output = source.meta.outputs.find((item) => item.id === connection.outputId);
    connection.lastLabel = `${formatValue(value)}${output?.unit ? ` ${output.unit}` : ''}`;
    setPortValue(connection.fromNodeId, 'output', connection.outputId, value, output?.unit || '');
    setPortValue(connection.toNodeId, 'input', connection.inputId, value);
    if (connection.lastValue === value) return;
    connection.lastValue = value;
    target.iframe.contentWindow?.postMessage({
      type: 'sim:input',
      values: { [connection.inputId]: value },
    }, '*');
  }

  function propagate(nodeId, values) {
    const source = nodes.get(nodeId);
    if (!source) return;
    source.meta.outputs.forEach((output) => {
      const value = Number(values[output.id]);
      if (Number.isFinite(value)) setPortValue(nodeId, 'output', output.id, value, output.unit);
    });
    connections.filter((connection) => connection.fromNodeId === nodeId).forEach(pushConnectionValue);
    renderWires();
  }

  function hasPath(startNodeId, targetNodeId) {
    const seen = new Set();
    const stack = [startNodeId];
    while (stack.length) {
      const current = stack.pop();
      if (current === targetNodeId) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      connections
        .filter((connection) => connection.fromNodeId === current)
        .forEach((connection) => stack.push(connection.toNodeId));
    }
    return false;
  }

  function connect(fromNodeId, outputId, toNodeId, inputId) {
    const source = nodes.get(fromNodeId);
    const target = nodes.get(toNodeId);
    if (!source || !target) return false;
    if (!source.meta.outputs.some((item) => item.id === outputId)) return false;
    if (!target.meta.inputs.some((item) => item.id === inputId)) return false;
    if (fromNodeId === toNodeId || hasPath(toNodeId, fromNodeId)) {
      updateStatus('That loop would run forever');
      onToast('Try a one-way chain instead.');
      return false;
    }

    connections = connections.filter((connection) => !(connection.toNodeId === toNodeId && connection.inputId === inputId));
    const connection = {
      id: `wire-${++connectionSequence}`,
      fromNodeId,
      outputId,
      toNodeId,
      inputId,
      lastValue: null,
      lastLabel: 'waiting',
    };
    connections.push(connection);
    pushConnectionValue(connection);
    updateStatus();
    renderWires();
    return true;
  }

  function cancelWire() {
    if (pendingWire) {
      portElement(pendingWire.fromNodeId, 'output', pendingWire.outputId)?.classList.remove('is-wiring');
    }
    pendingWire = null;
    renderWires();
  }

  function finishWire(inputPort) {
    if (!pendingWire || !inputPort) return;
    const connected = connect(
      pendingWire.fromNodeId,
      pendingWire.outputId,
      inputPort.dataset.nodeId,
      inputPort.dataset.portId,
    );
    if (connected) onToast('Wire connected. Values are moving.');
    cancelWire();
  }

  function startWire(event, outputPort) {
    event.preventDefault();
    event.stopPropagation();
    cancelWire();
    const point = wirePoint(outputPort);
    pendingWire = {
      fromNodeId: outputPort.dataset.nodeId,
      outputId: outputPort.dataset.portId,
      point,
      moved: false,
    };
    outputPort.classList.add('is-wiring');
    renderWires();
  }

  function makePort(node, port, direction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `sim-port sim-port-${direction}`;
    button.dataset.nodeId = node.id;
    button.dataset.portId = port.id;
    button.dataset.direction = direction;
    button.setAttribute('aria-label', `${direction === 'input' ? 'Input' : 'Output'} ${port.label}`);
    button.innerHTML = direction === 'input'
      ? `<span class="sim-port-dot" aria-hidden="true"></span><span class="sim-port-copy"><strong>${port.label}</strong><small data-sim-port-value>manual</small></span>`
      : `<span class="sim-port-copy"><strong>${port.label}</strong><small data-sim-port-value>waiting</small></span><span class="sim-port-dot" aria-hidden="true"></span>`;
    if (direction === 'output') {
      button.addEventListener('pointerdown', (event) => startWire(event, button));
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') startWire(event, button);
      });
    } else {
      button.addEventListener('pointerup', () => finishWire(button));
      button.addEventListener('click', () => finishWire(button));
    }
    return button;
  }

  function renderPorts(node) {
    node.inputColumn.replaceChildren(...node.meta.inputs.map((port) => makePort(node, port, 'input')));
    node.outputColumn.replaceChildren(...node.meta.outputs.map((port) => makePort(node, port, 'output')));
  }

  function closeSolo() {
    if (!soloNode) return;
    const node = soloNode;
    soloNode = null;
    node.el.classList.remove('is-solo');
    if (node.placeholder?.parentNode) node.placeholder.parentNode.replaceChild(node.el, node.placeholder);
    node.placeholder = null;
    if (soloDialog?.open) soloDialog.close();
    requestAnimationFrame(renderWires);
  }

  /** Fills any container with a template's DOCS panel, wired to the node's
   * live iframe via the sim:highlight bridge. Shared by the solo dialog and
   * the world overlay so both doors show the exact same real reference
   * facts with the exact same click-to-find-the-slider behavior. */
  function renderDocInto(container, node) {
    if (!container) return false;
    const doc = DOCS[node.template.id];
    if (!doc) {
      container.hidden = true;
      container.replaceChildren();
      return false;
    }
    container.hidden = false;
    container.innerHTML = `
      <h2>${doc.title}</h2>
      ${doc.sections.map((section) => `
        <button type="button" class="sim-solo-doc-factor" data-doc-input="${section.inputId}">
          <h3>${section.heading}</h3>
          <p>${section.body}</p>
        </button>`).join('')}
      <p class="sim-solo-doc-note">${doc.note}</p>`;
    container.querySelectorAll('[data-doc-input]').forEach((button) => {
      button.addEventListener('click', () => {
        node.iframe.contentWindow?.postMessage({ type: 'sim:highlight', inputId: button.dataset.docInput }, '*');
        button.classList.add('is-active');
        setTimeout(() => button.classList.remove('is-active'), 1400);
      });
    });
    return true;
  }

  function renderSoloDoc(node) {
    renderDocInto(soloDoc, node);
  }

  /** Moves a live board node into any external mount (the world overlay),
   * leaving a placeholder so it can go straight back to its board slot.
   * Reuses the exact adoption trick openSolo has always used; the iframe
   * reloads on reparent and reannounces itself over sim:ready, which
   * handleMessage already handles with no special-casing. */
  function adoptNode(node, mount) {
    if (!node || !mount || node.worldPlaceholder) return;
    if (soloNode === node) closeSolo();
    node.worldPlaceholder = document.createComment(`world-node-${node.id}`);
    node.el.parentNode?.insertBefore(node.worldPlaceholder, node.el);
    mount.appendChild(node.el);
    node.el.classList.add('is-solo');
    requestAnimationFrame(renderWires);
  }

  function restoreNode(node) {
    if (!node?.worldPlaceholder) return;
    node.el.classList.remove('is-solo');
    if (node.worldPlaceholder.parentNode) {
      node.worldPlaceholder.parentNode.replaceChild(node.el, node.worldPlaceholder);
    }
    node.worldPlaceholder = null;
    requestAnimationFrame(renderWires);
  }

  function openSolo(node) {
    if (!soloDialog || !soloMount || soloNode === node) return;
    if (node.worldPlaceholder) return; // already open in the world overlay
    closeSolo();
    node.placeholder = document.createComment(`sim-node-${node.id}`);
    node.el.parentNode?.insertBefore(node.placeholder, node.el);
    soloMount.appendChild(node.el);
    node.el.classList.add('is-solo');
    soloNode = node;
    if (soloTitle) soloTitle.textContent = node.template.title;
    renderSoloDoc(node);
    soloDialog.showModal();
  }

  function removeNode(nodeId) {
    const node = nodes.get(nodeId);
    if (!node) return;
    if (soloNode === node) closeSolo();
    // A node removed while adopted by the world overlay must not come back
    // when that overlay closes: drop the placeholder so restore is a no-op.
    if (node.worldPlaceholder) {
      node.worldPlaceholder.parentNode?.removeChild(node.worldPlaceholder);
      node.worldPlaceholder = null;
    }
    connections = connections.filter((connection) => connection.fromNodeId !== nodeId && connection.toNodeId !== nodeId);
    node.el.remove();
    nodes.delete(nodeId);
    updateStatus();
    renderWires();
  }

  function makeDraggable(node, handle) {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = node.x;
      const originY = node.y;
      handle.setPointerCapture(event.pointerId);
      node.el.classList.add('is-moving');

      const move = (nextEvent) => {
        node.x = clamp(originX + nextEvent.clientX - startX, 10, BOARD_WIDTH - node.el.offsetWidth - 10);
        node.y = clamp(originY + nextEvent.clientY - startY, 10, BOARD_HEIGHT - node.el.offsetHeight - 10);
        node.el.style.left = `${node.x}px`;
        node.el.style.top = `${node.y}px`;
        renderWires();
      };
      const end = () => {
        node.el.classList.remove('is-moving');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  function setNodeHeader(node, { eyebrow, title }) {
    const head = node.el.querySelector('.sim-node-title');
    if (!head) return;
    const small = head.querySelector('small');
    const strong = head.querySelector('strong');
    if (small && eyebrow != null) small.textContent = eyebrow;
    if (strong && title != null) strong.textContent = title;
    node.el.querySelector('[data-sim-focus]')?.setAttribute('title', `Open ${title}`);
    node.el.querySelector('[data-sim-focus]')?.setAttribute('aria-label', `Open ${title}`);
    node.el.querySelector('[data-sim-remove]')?.setAttribute('title', `Remove ${title}`);
    node.el.querySelector('[data-sim-remove]')?.setAttribute('aria-label', `Remove ${title}`);
  }

  function setNodeFailed(node, reason) {
    node.el.classList.remove('is-loading');
    node.el.classList.add('is-failed');
    const badge = node.el.querySelector('[data-sim-node-ready]');
    if (badge) badge.textContent = 'failed';
    onToast(reason || 'That build did not work out.');
    node.readyResolve?.();
    node.readyResolve = null;
  }

  /** Shared DOM/wiring-plumbing for any node, whichever of the three real
   * sources built its {title, eyebrow, accent, document}: a hand-authored
   * TEMPLATES entry, a freshly AI-invented sim, or one pulled from the
   * generated-sims library. Every node speaks the exact same sim:ready /
   * sim:output / sim:input bridge regardless of source, so nothing past
   * this point needs to know which one it came from. */
  function mountNode(template, x, y, idPrefix = 'node') {
    const id = `${idPrefix}-${++nodeSequence}`;
    const element = document.createElement('article');
    element.className = 'sim-node is-loading';
    element.dataset.simNode = id;
    element.style.setProperty('--sim-accent', template.accent);
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.innerHTML = `
      <header class="sim-node-head">
        <span class="sim-node-signal" aria-hidden="true"></span>
        <span class="sim-node-title"><small>${template.eyebrow}</small><strong>${template.title}</strong></span>
        <span class="sim-node-ready" data-sim-node-ready>starting</span>
        <button type="button" class="sim-node-focus" data-sim-focus title="Open ${template.title}" aria-label="Open ${template.title}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path></svg>
        </button>
        <button type="button" class="sim-node-remove" data-sim-remove title="Remove ${template.title}" aria-label="Remove ${template.title}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>
        </button>
      </header>
      <div class="sim-node-body">
        <div class="sim-port-column sim-input-column" data-sim-inputs></div>
        <iframe title="${template.title}" sandbox="allow-scripts"></iframe>
        <div class="sim-port-column sim-output-column" data-sim-outputs></div>
      </div>`;
    board.appendChild(element);

    let readyResolve;
    const readyPromise = new Promise((resolve) => { readyResolve = resolve; });
    const node = {
      id,
      template,
      el: element,
      iframe: element.querySelector('iframe'),
      inputColumn: element.querySelector('[data-sim-inputs]'),
      outputColumn: element.querySelector('[data-sim-outputs]'),
      meta: { inputs: [], outputs: [] },
      values: {},
      x,
      y,
      ready: false,
      readyPromise,
      readyResolve,
      placeholder: null,
      worldPlaceholder: null,
    };
    nodes.set(id, node);
    makeDraggable(node, element.querySelector('.sim-node-head'));
    element.querySelector('[data-sim-focus]').addEventListener('click', () => openSolo(node));
    element.querySelector('[data-sim-remove]').addEventListener('click', () => removeNode(id));
    if (template.document) node.iframe.srcdoc = template.document;
    updateStatus();
    return node;
  }

  function addNode(templateId, x, y) {
    const template = TEMPLATES[templateId];
    if (!template) return null;
    return mountNode(template, x, y, templateId);
  }

  /** A student-described custom sim, AI-generated on the spot via the real
   * /api/generate-sim pipeline (2026-09-04 ask). Mounts immediately in the
   * same loading state a template node briefly shows, with no document yet,
   * then swaps in the real generated HTML once it clears the quality gate.
   * That HTML posts its own real sim:ready the instant it loads, so the
   * existing handleMessage path picks it up with zero special-casing. */
  async function addInventedNode(description, x, y) {
    const node = mountNode(
      { title: 'Inventing...', eyebrow: description.slice(0, 40), accent: '#c4f547', document: null },
      x, y, 'invent',
    );
    if (!node) return null;
    updateStatus(`Inventing "${description.slice(0, 60)}"...`);
    const { sim, reason } = await inventSim(description, (status) => {
      if (nodes.get(node.id) === node) updateStatus(status);
    });
    if (nodes.get(node.id) !== node) return node; // removed while generating
    if (!sim) {
      setNodeFailed(node, reason);
      updateStatus();
      return node;
    }
    setNodeHeader(node, { eyebrow: 'Invented', title: sim.title });
    node.iframe.srcdoc = sim.html;
    updateStatus();
    return node;
  }

  /** A real, already gate-passed sim pulled straight from the shared
   * generated_sims library (see simInvent.js's listChainableLibrarySims).
   * Instant, no generation spend, reusing whatever any student has already
   * built and paid for once. */
  function addLibraryNode(librarySim, x, y) {
    return mountNode(
      { title: librarySim.title || 'Library sim', eyebrow: 'From the library', accent: '#5b3e8f', document: librarySim.html },
      x, y, 'library',
    );
  }

  function nextDropPoint() {
    const index = nodes.size;
    return {
      x: clamp(70 + (index % 3) * 430, 10, BOARD_WIDTH - 410),
      y: clamp(70 + Math.floor(index / 3) * 300, 10, BOARD_HEIGHT - 280),
    };
  }

  async function reset() {
    const sequence = ++resetSequence;
    closeSolo();
    cancelWire();
    connections = [];
    nodes.forEach((node) => node.el.remove());
    nodes.clear();
    const sun = addNode('sun', 44, 70);
    const shade = addNode('shade', 520, 276);
    const plant = addNode('plant', 1030, 76);
    if (!sun || !shade || !plant) return;
    await Promise.all([sun.readyPromise, shade.readyPromise, plant.readyPromise]);
    if (sequence !== resetSequence) return;
    connect(sun.id, 'light', shade.id, 'light');
    connect(shade.id, 'temperature', plant.id, 'temperature');
    connect(shade.id, 'shade', plant.id, 'shade');
    updateStatus();
    renderWires();
    viewport.scrollTo({ left: 0, top: 0 });
  }

  function handleMessage(event) {
    const node = nodeForSource(event.source);
    const message = event.data;
    if (!node || !message || typeof message !== 'object') return;
    if (message.type === 'sim:ready') {
      const inputs = normalizeInputs(message.inputs);
      const outputs = normalizeOutputs(message.outputs);
      if (!outputs.length) {
        updateStatus(`${node.template.title} has no outputs`);
        return;
      }
      node.meta = { inputs, outputs };
      node.ready = true;
      node.el.classList.remove('is-loading');
      node.el.querySelector('[data-sim-node-ready]').textContent = 'live';
      renderPorts(node);
      node.readyResolve?.();
      node.readyResolve = null;
      updateStatus();
      requestAnimationFrame(renderWires);
      return;
    }
    if (message.type === 'sim:output' && message.values && typeof message.values === 'object') {
      const values = {};
      node.meta.outputs.forEach((output) => {
        const value = Number(message.values[output.id]);
        if (Number.isFinite(value)) values[output.id] = value;
      });
      node.values = { ...node.values, ...values };
      propagate(node.id, values);
    }
  }

  window.addEventListener('message', handleMessage);
  document.addEventListener('pointermove', (event) => {
    if (!pendingWire) return;
    const boardRect = board.getBoundingClientRect();
    pendingWire.point = { x: event.clientX - boardRect.left, y: event.clientY - boardRect.top };
    pendingWire.moved = true;
    renderWires();
  });
  document.addEventListener('pointerup', (event) => {
    if (!pendingWire) return;
    const input = event.target.closest?.('.sim-port-input');
    if (input) {
      finishWire(input);
    } else if (pendingWire.moved) {
      cancelWire();
    }
  });

  root.querySelectorAll('[data-sim-template]').forEach((button) => {
    button.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/x-mindcraft-sim', button.dataset.simTemplate);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    });
    button.addEventListener('click', () => {
      const point = nextDropPoint();
      const node = addNode(button.dataset.simTemplate, point.x, point.y);
      if (node) {
        updateStatus(`${node.template.title} added`);
        onToast(`${node.template.title} added to the board.`);
      }
    });
  });

  /** A world object is a door into a real board node. Reuses whichever node
   * already exists so the world and the wiring board are always looking at
   * the one real thing, adds one if this is the first time it is opened. */
  function getOrCreateNode(templateId) {
    const existing = [...nodes.values()].find((node) => node.template.id === templateId);
    if (existing) return existing;
    const point = nextDropPoint();
    return addNode(templateId, point.x, point.y);
  }

  /** The walkable garden world (2026-09-04 founder ask, replacing tonight's
   * earlier click-strip + full-screen dialogs). All world data and the
   * character engine live in simWorld.js; this bridge hands it the real
   * board plumbing so a world "plant" is the same live node the wiring
   * board owns, never a copy. */
  const world = createSimWorld({
    root: root.querySelector('[data-sim-world]'),
    resume: resumePanel,
    tutorMap: tutorMapPanel,
    bridge: {
      getOrCreateNode,
      adoptNode,
      restoreNode,
      renderDocs: (container, node) => renderDocInto(container, node),
      onToast,
    },
  });

  inventForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const description = String(inventInput?.value || '').trim();
    if (!description || inventButton?.disabled) return;
    if (inventButton) inventButton.disabled = true;
    if (inventInput) inventInput.value = '';
    const point = nextDropPoint();
    void addInventedNode(description, point.x, point.y).finally(() => {
      if (inventButton) inventButton.disabled = false;
    });
  });

  async function refreshLibraryPalette() {
    if (!libraryList) return;
    if (libraryStatus) libraryStatus.textContent = 'Loading...';
    const sims = await listChainableLibrarySims();
    libraryList.replaceChildren();
    if (!sims.length) {
      if (libraryStatus) libraryStatus.textContent = 'Nothing chainable built yet, invent the first one.';
      return;
    }
    if (libraryStatus) libraryStatus.textContent = `${sims.length} ready`;
    sims.slice(0, 24).forEach((sim) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'sim-library-item is-from-library';
      item.innerHTML = `<span class="sim-library-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path></svg>
      </span><span><strong>${sim.title || 'Untitled'}</strong><small>${sim.conceptLabel || sim.topic || 'From another student'}</small></span>`;
      item.addEventListener('click', () => {
        const point = nextDropPoint();
        const node = addLibraryNode(sim, point.x, point.y);
        if (node) onToast(`${sim.title || 'Sim'} added to the board.`);
      });
      libraryList.appendChild(item);
    });
  }
  void refreshLibraryPalette();

  viewport.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes('text/x-mindcraft-sim')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  viewport.addEventListener('drop', (event) => {
    const templateId = event.dataTransfer?.getData('text/x-mindcraft-sim');
    if (!templateId) return;
    event.preventDefault();
    const rect = board.getBoundingClientRect();
    const node = addNode(
      templateId,
      clamp(event.clientX - rect.left - 190, 10, BOARD_WIDTH - 410),
      clamp(event.clientY - rect.top - 28, 10, BOARD_HEIGHT - 280),
    );
    if (node) onToast(`${node.template.title} added to the board.`);
  });

  clearButton?.addEventListener('click', () => {
    connections = [];
    nodes.forEach((node) => {
      node.meta.inputs.forEach((input) => setPortValue(node.id, 'input', input.id, NaN));
    });
    updateStatus();
    renderWires();
  });
  resetButton?.addEventListener('click', () => { void reset(); });
  soloClose?.addEventListener('click', closeSolo);
  soloDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSolo();
  });
  soloDialog?.addEventListener('close', () => {
    if (soloNode) closeSolo();
  });
  root.addEventListener('simstudio:show', () => {
    requestAnimationFrame(renderWires);
    world.layout();
  });
  root.addEventListener('simstudio:hide', () => {
    closeSolo();
    world.closeOverlay();
  });
  new ResizeObserver(renderWires).observe(board);

  void reset();

  return {
    open() {
      requestAnimationFrame(renderWires);
      void refreshLibraryPalette();
    },
    reset,
    destroy() {
      closeSolo();
      world.destroy();
      window.removeEventListener('message', handleMessage);
      nodes.forEach((node) => node.el.remove());
      nodes.clear();
      connections = [];
    },
  };
}
