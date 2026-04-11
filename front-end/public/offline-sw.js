const CACHE_NAME = 'tutor-helper-shell-v3';
const BUILD_MANIFEST_URL = '/asset-manifest.json';
const CORE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app-icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

function normalizeAssetUrl(path) {
  if (typeof path !== 'string' || path.length === 0) {
    return null;
  }

  if (path.startsWith('data:') || path.startsWith('blob:')) {
    return null;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path)) {
    try {
      const url = new URL(path);
      if (url.origin !== self.location.origin) {
        return null;
      }
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  return path.startsWith('/') ? path : `/${path}`;
}

function collectManifestAssetUrls(manifest) {
  const urls = new Set();
  if (!manifest || typeof manifest !== 'object') {
    return urls;
  }

  for (const entry of Object.values(manifest)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const fileUrl = normalizeAssetUrl(entry.file);
    if (fileUrl) {
      urls.add(fileUrl);
    }

    if (Array.isArray(entry.css)) {
      for (const cssUrl of entry.css) {
        const normalizedCssUrl = normalizeAssetUrl(cssUrl);
        if (normalizedCssUrl) {
          urls.add(normalizedCssUrl);
        }
      }
    }

    if (Array.isArray(entry.assets)) {
      for (const assetUrl of entry.assets) {
        const normalizedAssetUrl = normalizeAssetUrl(assetUrl);
        if (normalizedAssetUrl) {
          urls.add(normalizedAssetUrl);
        }
      }
    }
  }

  return urls;
}

async function cacheUrls(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // Ignore individual cache misses so one asset cannot block the whole install.
      }
    })
  );
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cacheUrls(cache, CORE_URLS);

  try {
    const response = await fetch(BUILD_MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const manifest = await response.json();
    const assetUrls = Array.from(collectManifestAssetUrls(manifest));
    await cacheUrls(cache, assetUrls);
  } catch {
    // If the manifest is unavailable, the shell still works and assets will fall back to runtime caching.
  }
}

async function respondWithCachedAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    void fetch(request)
      .then((response) => {
        if (response.ok) {
          return cache.put(request, response.clone());
        }
        return undefined;
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      void cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const responseClone = response.clone();
            const cache = await caches.open(CACHE_NAME);
            void cache.put('/index.html', responseClone);
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('/index.html')) || Response.error();
        })
    );
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest' ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(respondWithCachedAsset(request));
  }
});
