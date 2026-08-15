// The Desk host: keep the sim on this page. Drag empty space to move the
// graph. Click a gold node still masters it. No off-site links.
(function () {
  let panX = 0;
  let panY = 0;
  let dragMode = null;
  let lastX = 0;
  let lastY = 0;
  const origBox = window.graphBox;
  const origPressed = window.mousePressed;

  window.graphBox = function () {
    const b = origBox();
    return { x: b.x + panX, y: b.y + panY, w: b.w, h: b.h };
  };

  window.mousePressed = function () {
    if (typeof mouseY === 'number' && typeof drawHeight === 'number' && mouseY > drawHeight) {
      dragMode = null;
      return;
    }
    const n = typeof nodeUnderMouse === 'function' ? nodeUnderMouse() : null;
    if (n) {
      dragMode = null;
      return origPressed();
    }
    dragMode = 'pan';
    lastX = mouseX;
    lastY = mouseY;
  };

  window.mouseDragged = function () {
    if (dragMode !== 'pan') return;
    panX += mouseX - lastX;
    panY += mouseY - lastY;
    lastX = mouseX;
    lastY = mouseY;
  };

  window.mouseReleased = function () {
    dragMode = null;
  };
})();
