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
  const FLOAT_AMP = 1.2;
  const FLOAT_SPEED = 0.0015;
  let time = 0;

  let isCentering = false;
  let centerTargetX = 0;
  let centerTargetY = 0;

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
    }
  };

  const updateText = () => {
    const text = t('app.title');
    container.innerHTML = '';
    entities = [];
    
    // Add image as the first entity
    entities.push({ el: logoImg, x: 0, y: 0, vx: 0, vy: 0, rx: Math.random() * Math.PI * 2, ry: Math.random() * Math.PI * 2 });
    
    // Add letters
    const textArr = Array.from(text);
    textArr.forEach(char => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.className = 'logo-letter';
      container.appendChild(span);
      entities.push({ el: span, x: 0, y: 0, vx: 0, vy: 0, rx: Math.random() * Math.PI * 2, ry: Math.random() * Math.PI * 2, isText: true });
    });

    // Capture the initial layout offset to seamlessly connect the background gradient
    requestAnimationFrame(() => {
      // HYDRATION: If we are centering (initial load or language switch), forcefully set new entities to the center so they can fly back smoothly!
      if (isCentering) {
        entities.forEach(ent => {
          ent.x = centerTargetX;
          ent.y = centerTargetY;
        });
      }
    });
  };

  updateText();
  window.addEventListener('languageChanged', updateText);

  // Pointer events on the main container
  mainLogo.addEventListener('pointerdown', (e) => {
    // Find which entity was actually clicked
    const target = e.target;
    dragAnchorIndex = entities.findIndex(ent => ent.el === target);
    
    // If user clicked the container background, default to the image (0)
    if (dragAnchorIndex === -1) dragAnchorIndex = 0;
    
    // Reset target to the entity's current position so it doesn't snap to an old target
    targetX = entities[dragAnchorIndex].x;
    targetY = entities[dragAnchorIndex].y;
    
    startPointerX = e.clientX - targetX;
    startPointerY = e.clientY - targetY;
    mainLogo.setPointerCapture(e.pointerId);
  });

  mainLogo.addEventListener('pointermove', (e) => {
    if (dragAnchorIndex === -1) return;
    targetX = e.clientX - startPointerX;
    targetY = e.clientY - startPointerY;
  });

  const stopDrag = () => {
    dragAnchorIndex = -1;
  };

  mainLogo.addEventListener('pointerup', stopDrag);
  mainLogo.addEventListener('pointercancel', stopDrag);

  const loop = () => {
    time += 16;
    
    for (let i = 0; i < entities.length; i++) {
      const c = entities[i];
      let tx = 0, ty = 0;
      
      if (isCentering) {
        tx = centerTargetX;
        ty = centerTargetY;
      } else if (dragAnchorIndex === -1) {
        // Floating at rest
        tx = Math.sin(time * FLOAT_SPEED + c.rx) * FLOAT_AMP;
        ty = Math.cos(time * FLOAT_SPEED + c.ry) * FLOAT_AMP;
      } else {
        // Chain follow towards the anchor
        if (i === dragAnchorIndex) {
          tx = targetX;
          ty = targetY;
        } else if (i < dragAnchorIndex) {
          tx = entities[i + 1].x;
          ty = entities[i + 1].y;
        } else if (i > dragAnchorIndex) {
          tx = entities[i - 1].x;
          ty = entities[i - 1].y;
        }
      }
      
      c.vx += (tx - c.x) * SPRING;
      c.vy += (ty - c.y) * SPRING;
      
      c.vx *= FRICTION;
      c.vy *= FRICTION;
      
      c.x += c.vx;
      c.y += c.vy;
      
      c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
    }
    requestAnimationFrame(loop);
  };
  
  requestAnimationFrame(loop);
}
