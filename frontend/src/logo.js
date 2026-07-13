import { t } from './i18n.js';

let centeringCallback = null;

export function setLogoCentered(isCentered) {
  if (centeringCallback) centeringCallback(isCentered);
}

export function initLogoInteractivity() {
  const container = document.getElementById('logo-text-container');
  const mainLogo = document.getElementById('main-logo');
  const logoImg = document.querySelector('.logo-img');
  if (!container || !mainLogo || !logoImg) return;

  let entities = [];
  let dragAnchorIndex = -1;
  let targetX = 0;
  let targetY = 0;
  let startPointerX = 0;
  let startPointerY = 0;

  const SPRING = 0.1;
  const FRICTION = 0.75;
  // Threshold below which we consider the entity "at rest" and stop the RAF
  const SETTLE_THRESHOLD = 0.05;

  let isCentering = false;
  let centerTargetX = 0;
  let centerTargetY = 0;

  // ── RAF on-demand engine ──────────────────────────────────────────────────
  // The loop ONLY runs during drag or spring-back. When idle, CSS animation
  // handles the gentle float — zero JS overhead, zero compositor pressure.
  let rafId = null;

  /** Mark all entities as JS-controlled, disable CSS float */
  function enterJsMode() {
    entities.forEach(ent => ent.el.classList.add('js-driven'));
  }

  /** Restore CSS float animation and clear JS transforms */
  function exitJsMode() {
    entities.forEach(ent => {
      ent.el.classList.remove('js-driven');
      ent.el.style.transform = '';
      ent.x = 0;
      ent.y = 0;
      ent.vx = 0;
      ent.vy = 0;
    });
  }

  function startLoop() {
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  const loop = () => {
    rafId = null;
    let anyMoving = false;

    for (let i = 0; i < entities.length; i++) {
      const c = entities[i];
      let tx = 0, ty = 0;

      if (isCentering) {
        tx = centerTargetX;
        ty = centerTargetY;
      } else if (dragAnchorIndex !== -1) {
        // Chain-follow towards the dragged anchor
        if (i === dragAnchorIndex) {
          tx = targetX;
          ty = targetY;
        } else if (i < dragAnchorIndex) {
          tx = entities[i + 1].x;
          ty = entities[i + 1].y;
        } else {
          tx = entities[i - 1].x;
          ty = entities[i - 1].y;
        }
      }
      // else: idle — CSS handles it, tx/ty stay 0 so spring pulls to origin

      c.vx += (tx - c.x) * SPRING;
      c.vy += (ty - c.y) * SPRING;

      c.vx *= FRICTION;
      c.vy *= FRICTION;

      c.x += c.vx;
      c.y += c.vy;

      c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;

      if (
        Math.abs(c.vx) > SETTLE_THRESHOLD ||
        Math.abs(c.vy) > SETTLE_THRESHOLD ||
        Math.abs(c.x) > SETTLE_THRESHOLD ||
        Math.abs(c.y) > SETTLE_THRESHOLD
      ) {
        anyMoving = true;
      }
    }

    if (dragAnchorIndex !== -1 || isCentering || anyMoving) {
      // Still animating — schedule next frame
      rafId = requestAnimationFrame(loop);
    } else {
      // Fully settled — hand control back to CSS
      exitJsMode();
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  // Handle SSR Hydration
  const wasInitialLoad = document.body.classList.contains('initial-load');
  if (wasInitialLoad) {
    document.body.classList.remove('initial-load');
  }

  centeringCallback = (centered) => {
    isCentering = centered;
    if (centered) {
      const rect = mainLogo.getBoundingClientRect();
      const logoCenterX = rect.left + rect.width / 2;
      const logoCenterY = rect.top + rect.height / 2;
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;

      centerTargetX = screenCenterX - logoCenterX;
      centerTargetY = screenCenterY - logoCenterY;

      dragAnchorIndex = -1;
      enterJsMode();
      startLoop();
    } else {
      // isCentering = false: the loop will spring back to 0 and then call exitJsMode()
    }
  };

  const updateText = () => {
    const text = t('app.title');
    container.innerHTML = '';
    entities = [];

    // Add image as the first entity
    entities.push({ el: logoImg, x: 0, y: 0, vx: 0, vy: 0 });

    // Add letters
    Array.from(text).forEach((char, i) => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.className = 'logo-letter';
      // Stagger the idle float phase per letter via CSS custom property
      span.style.setProperty('--logo-float-dur', `${3.5 + (i % 5) * 0.35}s`);
      span.style.animationDelay = `${(i % 7) * -0.5}s`;
      container.appendChild(span);
      entities.push({ el: span, x: 0, y: 0, vx: 0, vy: 0, isText: true });
    });

    // HYDRATION: If centering (initial load or language switch), snap entities to center
    if (isCentering) {
      requestAnimationFrame(() => {
        enterJsMode();
        entities.forEach(ent => {
          ent.x = centerTargetX;
          ent.y = centerTargetY;
          ent.el.style.transform = `translate3d(${ent.x}px, ${ent.y}px, 0)`;
        });
      });
    }
  };

  updateText();
  window.addEventListener('languageChanged', updateText);

  // Pause RAF when page is hidden (tab switch, phone screen off)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!document.hidden && (dragAnchorIndex !== -1 || isCentering)) {
      startLoop();
    }
  });

  // ── Pointer events ────────────────────────────────────────────────────────
  mainLogo.addEventListener('pointerdown', (e) => {
    const target = e.target;
    dragAnchorIndex = entities.findIndex(ent => ent.el === target);
    if (dragAnchorIndex === -1) dragAnchorIndex = 0;

    targetX = entities[dragAnchorIndex].x;
    targetY = entities[dragAnchorIndex].y;

    startPointerX = e.clientX - targetX;
    startPointerY = e.clientY - targetY;
    mainLogo.setPointerCapture(e.pointerId);

    enterJsMode();
    startLoop();
  });

  mainLogo.addEventListener('pointermove', (e) => {
    if (dragAnchorIndex === -1) return;
    targetX = e.clientX - startPointerX;
    targetY = e.clientY - startPointerY;
  });

  const stopDrag = () => {
    dragAnchorIndex = -1;
    // Loop continues to spring back to 0, then calls exitJsMode() automatically
  };

  mainLogo.addEventListener('pointerup', stopDrag);
  mainLogo.addEventListener('pointercancel', stopDrag);
}
