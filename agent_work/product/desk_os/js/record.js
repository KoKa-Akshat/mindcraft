/**
 * Class recording → live transcript.
 * Uses Web Speech API when available; otherwise a local demo lecture take.
 * Emits onLine for settled sentences; onPartial for the live buffer.
 */

const DEMO_LECTURE = [
  { t: 0, line: 'Teacher: Okay, phones away. Stoichiometry warm-up.' },
  { t: 2200, line: 'Teacher: If you burn 2.5 moles of propane, how many moles of CO2 come out?' },
  { t: 5200, line: 'Student: Is it the mole ratio from the balanced equation?' },
  { t: 7800, line: 'Teacher: Yes. C3H8 plus 5 O2 goes to 3 CO2 plus 4 H2O.' },
  { t: 11000, line: 'Student: So 1 propane to 3 CO2… that is 7.5 moles?' },
  { t: 14000, line: 'Teacher: Exactly. Homework is the limiting reactant set, due Friday.' },
];
export function speechSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * @param {{
 *   onPartial?: (text: string) => void,
 *   onLine?: (line: string) => void,
 *   onFinal?: (text: string) => void,
 *   onError?: (msg: string) => void,
 * }} hooks
 */
export function createRecorder(hooks) {
  let recognition = null;
  let demoTimer = null;
  let demoIdx = 0;
  let startedAt = 0;
  let mode = 'idle'; // idle | live | demo
  let buffer = '';
  /** @type {string[]} */
  let lines = [];

  function stopDemo() {
    if (demoTimer) clearInterval(demoTimer);
    demoTimer = null;
  }

  function startDemo() {
    mode = 'demo';
    demoIdx = 0;
    buffer = '';
    lines = [];
    startedAt = Date.now();
    hooks.onPartial?.('Listening…');
    demoTimer = setInterval(() => {
      if (demoIdx >= DEMO_LECTURE.length) {
        stopDemo();
        mode = 'idle';
        hooks.onFinal?.(buffer.trim());
        return;
      }
      const chunk = DEMO_LECTURE[demoIdx];
      lines.push(chunk.line);
      buffer = lines.join(' ');
      hooks.onLine?.(chunk.line);
      hooks.onPartial?.(buffer);
      demoIdx += 1;
    }, 1100);
  }

  function startLive() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    buffer = '';
    lines = [];
    startedAt = Date.now();
    mode = 'live';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i];
        const bit = r[0].transcript.trim();
        if (!bit) continue;
        if (r.isFinal) {
          lines.push(bit);
          buffer = lines.join(' ');
          hooks.onLine?.(bit);
        } else {
          interim += (interim ? ' ' : '') + bit;
        }
      }
      hooks.onPartial?.([buffer, interim].filter(Boolean).join(' '));
    };
    recognition.onerror = (e) => {
      const err = e.error || 'speech error';
      if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
        try { recognition.stop(); } catch { /* ignore */ }
        recognition = null;
        hooks.onError?.(err);
        startDemo();
        return;
      }
      hooks.onError?.(err);
    };
    recognition.onend = () => {
      if (mode !== 'live') return;
      const elapsed = Date.now() - startedAt;
      if (!buffer.trim() && elapsed < 1600) {
        recognition = null;
        startDemo();
        return;
      }
      mode = 'idle';
      recognition = null;
      hooks.onFinal?.(buffer.trim());
    };
    try {
      recognition.start();
      hooks.onPartial?.('Listening…');
    } catch (err) {
      hooks.onError?.(String(err.message || err));
      startDemo();
    }
  }

  return {
    get mode() { return mode; },
    get startedAt() { return startedAt; },
    start({ preferDemo = false } = {}) {
      if (mode !== 'idle') return;
      if (!preferDemo && speechSupported()) startLive();
      else startDemo();
    },
    stop() {
      const text = buffer.trim();
      const elapsed = Date.now() - startedAt;
      if (mode === 'live' && recognition) {
        mode = 'idle';
        try { recognition.stop(); } catch { /* ignore */ }
        recognition = null;
      }
      if (mode === 'demo') {
        mode = 'idle';
        stopDemo();
      }
      hooks.onFinal?.(text);
      return { text, elapsedMs: elapsed, lines: [...lines] };
    },
  };
}

export function demoLectureFullText() {
  return DEMO_LECTURE.map((d) => d.line).join(' ');
}
