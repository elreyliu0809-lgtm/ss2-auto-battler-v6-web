'use strict';
const VERSION = 'source53-r3-svn323591-20261113-r1';
self.SS2Source53Web = {version: VERSION};
const BASE = new URL('./', self.location.href);
const NS = 'ss2-source53-web:' + BASE.pathname + ':';
const OLD_NS = 'ss2-v6-web:' + BASE.pathname + ':';
const CACHE = NS + VERSION;
const META = new URL('__ss2_publication_manifest__', BASE).href;
const INDEX = new URL('index.html', BASE).href;
const REQUIRED = [
  'index.html', 'bootstrap.js', 'styles.css', 'yanwu-source53-r3.css',
  'assets/actors.js', 'src/timeline-actor.js', 'src/scene-resources.js',
  'src/actor.js', 'src/portraits.js', 'src/yanwu-source53-data-r3.js',
  'src/yanwu-source53-engine-r3.js', 'src/yanwu-source53-core-r3.js',
  'src/yanwu-source53-app-r3.js'
];
const pending = new Map();
let manifestPromise;

function inBase(u) {
  return u.origin === BASE.origin && u.pathname.startsWith(BASE.pathname);
}
function canonicalPath(path) {
  if (typeof path !== 'string' || !path || /[\\?#]/.test(path) ||
      path.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
    throw Error('Invalid manifest path');
  }
  if (path === './') return INDEX;
  if (path.startsWith('./')) path = path.slice(2);
  const segments = path.split('/');
  for (const segment of segments) {
    const decoded = decodeURIComponent(segment);
    if (!decoded || decoded === '.' || decoded === '..' || /[\\/\u0000-\u001f]/.test(decoded)) {
      throw Error('Invalid manifest path');
    }
  }
  const u = new URL(path, BASE);
  if (!inBase(u) || u.search || u.hash ||
      u.href === new URL('sw.js', BASE).href ||
      u.href === new URL('web-manifest.json', BASE).href || u.href === META) {
    throw Error('Invalid manifest path');
  }
  return u.href;
}
function validateManifest(raw) {
  if (!raw || raw.version !== VERSION || !Array.isArray(raw.files) ||
      !Array.isArray(raw.shell) || !raw.files.length || !raw.shell.length) {
    throw Error('Invalid publication manifest');
  }
  const files = new Map();
  for (const row of raw.files) {
    if (!row || !Number.isSafeInteger(row.size) || row.size < 0 ||
        typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(row.sha256)) {
      throw Error('Invalid manifest file');
    }
    const key = canonicalPath(row.path);
    const file = {size: row.size, sha256: row.sha256.toLowerCase()};
    const previous = files.get(key);
    if (previous && (previous.size !== file.size || previous.sha256 !== file.sha256)) {
      throw Error('Conflicting manifest paths');
    }
    files.set(key, file);
  }
  const shell = new Set();
  let total = 0;
  for (const path of raw.shell) {
    const key = canonicalPath(path);
    const file = files.get(key);
    if (!file) throw Error('Shell file missing from manifest');
    if (!shell.has(key)) {
      // Keep installation small; models and large images are demand-only.
      if (file.size > 4 * 1024 * 1024) throw Error('Shell file too large');
      total += file.size;
      shell.add(key);
    }
  }
  if (total > 32 * 1024 * 1024 || !raw.shell.includes('./') ||
      !REQUIRED.every(path => shell.has(new URL(path, BASE).href))) {
    throw Error('Incomplete or oversized shell');
  }
  return {raw, files, shell};
}
function hex(buffer) {
  return Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, '0')).join('');
}
function responseAt(response, key) {
  if (!response.ok || response.status !== 200 || response.type === 'opaque' ||
      response.type === 'opaqueredirect' || response.redirected) return false;
  if (!response.url) return true; // Cache-created responses may have no URL.
  const u = new URL(response.url);
  if (!inBase(u)) return false;
  u.search = '';
  u.hash = '';
  if (u.href === BASE.href) return key === INDEX;
  return u.href === key;
}
async function validBody(response, key, file) {
  if (!responseAt(response, key)) return false;
  const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (type === 'text/html' && !/\.html?$/i.test(new URL(key).pathname)) return false;
  const bytes = await response.clone().arrayBuffer();
  return bytes.byteLength === file.size &&
    hex(await crypto.subtle.digest('SHA-256', bytes)) === file.sha256;
}
async function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const response = await (await caches.open(CACHE)).match(META);
        if (!response) return null;
        const saved = await response.json();
        return validateManifest(saved.manifest);
      } catch (_) {
        return null;
      }
    })();
  }
  return manifestPromise;
}
async function cachedFile(key, file) {
  try {
    const cache = await caches.open(CACHE);
    const response = await cache.match(key);
    if (!response) return null;
    if (await validBody(response, key, file)) return response;
    await cache.delete(key);
  } catch (_) {
    // Cache access, corrupt entries and quota errors must not stop networking.
  }
  return null;
}
async function storeFile(key, response) {
  try {
    await (await caches.open(CACHE)).put(key, response.clone());
  } catch (_) {
    // The validated network response remains usable even without cache space.
  }
}
function fetchStable(key) {
  return fetch(key, {cache: 'no-cache', credentials: 'same-origin', redirect: 'error'});
}
async function asset(key, file) {
  const cached = await cachedFile(key, file);
  if (cached) return cached;
  let work = pending.get(key);
  if (!work) {
    work = (async () => {
      const response = await fetchStable(key);
      if (!response.ok) return response;
      if (!await validBody(response, key, file)) {
        return new Response('Resource integrity check failed', {status: 502});
      }
      await storeFile(key, response);
      return response;
    })();
    pending.set(key, work);
    const clear = () => { if (pending.get(key) === work) pending.delete(key); };
    work.then(clear, clear);
  }
  return (await work).clone();
}
async function navigation(request, manifest) {
  try {
    const response = await fetch(request, {cache: 'no-cache', redirect: 'error'});
    if (response.ok && response.type !== 'opaque' && !response.redirected) {
      const u = new URL(request.url);
      u.search = '';
      u.hash = '';
      const file = manifest && manifest.files.get(INDEX);
      if (file && (u.href === BASE.href || u.href === INDEX)) {
        try {
          if (await validBody(response, INDEX, file)) await storeFile(INDEX, response);
        } catch (_) {
          // An online document is not blocked by cache or hashing failures.
        }
      }
      return response;
    }
    const file = manifest && manifest.files.get(INDEX);
    const fallback = file && await cachedFile(INDEX, file);
    return fallback || response;
  } catch (_) {
    const file = manifest && manifest.files.get(INDEX);
    const fallback = file && await cachedFile(INDEX, file);
    return fallback || new Response('Offline', {
      status: 503,
      headers: {'Content-Type': 'text/plain; charset=utf-8'}
    });
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existed = (await caches.keys()).includes(CACHE);
    try {
      const response = await fetchStable(new URL('web-manifest.json', BASE).href);
      if (!responseAt(response, new URL('web-manifest.json', BASE).href)) {
        throw Error('Manifest unavailable');
      }
      const manifest = validateManifest(await response.json());
      // Validate the entire shell before writing anything or calling skipWaiting.
      const rows = await Promise.all(Array.from(manifest.shell, async key => {
        const body = await fetchStable(key);
        if (!await validBody(body, key, manifest.files.get(key))) {
          throw Error('Shell integrity check failed');
        }
        return [key, body];
      }));
      const cache = await caches.open(CACHE);
      for (const [key, body] of rows) await cache.put(key, body);
      await cache.put(META, new Response(JSON.stringify({
        manifest: manifest.raw,
        upgrade: !!self.registration.active
      }), {headers: {'Content-Type': 'application/json'}}));
      manifestPromise = Promise.resolve(manifest);
      await self.skipWaiting();
    } catch (error) {
      if (!existed) {
        try { await caches.delete(CACHE); } catch (_) {}
      }
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    let upgrade = false;
    try {
      const saved = await (await caches.open(CACHE)).match(META);
      upgrade = !!(saved && (await saved.json()).upgrade);
    } catch (_) {}
    // Capture existing windows before claim; newly opened windows need no reload.
    const existing = upgrade ? await self.clients.matchAll({
      type: 'window', includeUncontrolled: true
    }) : [];
    await self.skipWaiting();
    await self.clients.claim();
    try {
      const names = await caches.keys();
      await Promise.all(names.filter(name =>
        name.startsWith(OLD_NS) || (name.startsWith(NS) && name !== CACHE)
      ).map(name => caches.delete(name).catch(() => false)));
    } catch (_) {}
    // Activation runs once, not on fetch/controllerchange. Replace old DOMs,
    // including old loaders, without a storage flag or a bootstrap reload loop.
    await Promise.all(existing.map(async client => {
      try {
        if (inBase(new URL(client.url))) await client.navigate(BASE.href);
      } catch (_) {}
    }));
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const u = new URL(request.url);
  if (request.method !== 'GET' || !inBase(u)) return;
  if (request.mode === 'navigate') {
    event.respondWith(loadManifest().then(manifest => navigation(request, manifest)));
    return;
  }
  u.search = '';
  u.hash = '';
  const key = u.href === BASE.href ? INDEX : u.href;
  event.respondWith((async () => {
    const manifest = await loadManifest();
    const file = manifest && manifest.files.get(key);
    // Unlisted files are never cached, including old releases and arbitrary URLs.
    if (!file) return fetch(request);
    try {
      return await asset(key, file);
    } catch (_) {
      return new Response('Resource unavailable', {status: 503});
    }
  })());
});

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SS2_SOURCE53_STATUS') return;
  const port = event.ports && event.ports[0];
  if (port) port.postMessage({
    type: 'SS2_SOURCE53_STATUS', version: VERSION, scope: BASE.href
  });
});
