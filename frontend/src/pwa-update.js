import { showToast } from './toast.js';
import { t } from './i18n.js';

export async function initPwaVersioning() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  let shouldReload = false;
  let registration = null;
  let offlineToastShown = false;

  const showOfflineToast = () => {
    if (offlineToastShown) {
      return;
    }

    offlineToastShown = true;
    showToast(t('pwa.offline'), 'info', 4000);
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (shouldReload) {
      window.location.reload();
    }
  });

  window.addEventListener('offline', showOfflineToast);

  if (!navigator.onLine) {
    showOfflineToast();
  }

  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    const hasExistingController = Boolean(navigator.serviceWorker.controller);

    if (!hasExistingController) {
      showToast(t('pwa.deploying'), 'info', 4000);
    }

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration?.installing;
      if (!installingWorker) {
        return;
      }

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state !== 'installed') {
          return;
        }

        if (navigator.serviceWorker.controller) {
          showToast(t('pwa.syncing'), 'info', 4000);
          shouldReload = true;
          offlineToastShown = false;

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        } else {
          showToast(t('pwa.deploy_success'), 'success', 4000);
        }
      });
    });

    await registration.update().catch(() => {
      // Ignore update failures; the current app still works.
    });

    window.setInterval(() => {
      registration?.update().catch(() => {
        // Ignore periodic update failures.
      });
    }, 5 * 60 * 1000);
  } catch (error) {
    console.warn('PWA registration failed:', error);
    showToast(t('pwa.deploy_fail'), 'error', 5000);
  }
}