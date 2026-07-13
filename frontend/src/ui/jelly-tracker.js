export function syncJellyTracker(container) {
  if (!container) return;
  const tracker = container.querySelector('.jelly-tracker');
  const activeItem = container.querySelector('.active');
  
  if (tracker && activeItem && activeItem.offsetWidth > 0) {
    tracker.style.transform = `translate(${activeItem.offsetLeft}px, ${activeItem.offsetTop}px)`;
    tracker.style.width = `${activeItem.offsetWidth}px`;
    tracker.style.height = `${activeItem.offsetHeight}px`;
    tracker.style.opacity = '1';
  } else if (tracker) {
    tracker.style.opacity = '0'; // Hide cleanly if layout is pending
  }
}

export const jellyObserver = new ResizeObserver((entries) => {
  for (let entry of entries) {
    syncJellyTracker(entry.target);
  }
});

export function initJellyTrackers() {
  const containers = document.querySelectorAll('.platform-toggle, .transfer-tabs, .glass-pill-group');
  
  containers.forEach(container => {
    // 1. Initial state hydration for radio groups
    const checkedInput = container.querySelector('input[type="radio"]:checked');
    if (checkedInput) {
      Array.from(container.children).forEach(child => {
        if (child.tagName === 'LABEL' || child.tagName === 'BUTTON') {
          child.classList.remove('active');
        }
      });
      checkedInput.parentElement.classList.add('active');
    }

    // 2. Observe and track
    jellyObserver.observe(container);
    requestAnimationFrame(() => requestAnimationFrame(() => syncJellyTracker(container)));
    
    // Event Delegation for Radio-based toggles
    container.addEventListener('change', (e) => {
      if (e.target.type === 'radio') {
        // Find all direct child labels and remove active class
        Array.from(container.children).forEach(child => {
          if (child.tagName === 'LABEL' || child.tagName === 'BUTTON') {
            child.classList.remove('active');
          }
        });
        
        if (e.target.checked) {
          e.target.parentElement.classList.add('active');
          syncJellyTracker(container);
        }
      }
    });
  });
}
