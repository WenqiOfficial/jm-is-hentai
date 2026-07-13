import { showToast } from './toast.js';
import { t } from './i18n.js';

const REPO_OWNER = 'WenqiOfficial';
const REPO_NAME = 'jm-is-hentai';
const BRANCH = 'main';
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH}`;
const STORAGE_KEY = 'pwa.github.commit';

async function fetchLatestCommit() {
  const response = await fetch(GITHUB_API, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`GitHub commit request failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    sha: data.sha,
    shortSha: data.sha ? data.sha.slice(0, 8) : '',
    message: data.commit?.message || '',
    date: data.commit?.committer?.date || '',
    url: data.html_url || '',
  };
}

function buildServiceWorkerUrl(version) {
  if (!version) {
    return '/sw.js';
  }

  return `/sw.js?v=${encodeURIComponent(version)}`;
}

export async function initPwaVersioning() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const previousVersion = localStorage.getItem(STORAGE_KEY);
  let latestCommit = null;

  try {
    latestCommit = await fetchLatestCommit();
  } catch (error) {
    console.warn('Failed to resolve GitHub commit version for PWA:', error);
  }

  const nextVersion = latestCommit?.sha || previousVersion || 'dev';
  const updateAvailable = Boolean(previousVersion && latestCommit?.sha && previousVersion !== latestCommit.sha);

  let shouldReload = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (shouldReload) {
      window.location.reload();
    }
  });

  // Show initial registration / syncing toast
  if (updateAvailable) {
    showToast(t('pwa.syncing'), 'info', 4000);
  } else if (!previousVersion) {
    showToast(t('pwa.deploying'), 'info', 4000);
  }

  try {
    const registration = await navigator.serviceWorker.register(buildServiceWorkerUrl(nextVersion), {
      scope: '/',
    });

    if (updateAvailable) {
      showToast(t('pwa.deploy_success'), 'success', 4000);
      shouldReload = true;

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.update().catch(() => {
        // Ignore update failures; the current app still works.
      });
    } else if (!previousVersion) {
      showToast(t('pwa.deploy_success'), 'success', 4000);
    }
  } catch (error) {
    console.warn('PWA registration failed:', error);
    showToast(t('pwa.deploy_fail'), 'error', 5000);
  } finally {
    if (latestCommit?.sha) {
      localStorage.setItem(STORAGE_KEY, latestCommit.sha);
    } else if (!previousVersion) {
      localStorage.setItem(STORAGE_KEY, nextVersion);
    }
  }
}