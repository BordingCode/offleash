// OFF-LEASH service worker — network-first, cache fallback. Bump CACHE on EVERY release.
const CACHE = 'offleash-v6';
const SHELL = [
  './',
  'index.html',
  'css/main.css',
  'js/main.js',
  'js/audio.js',
  'js/engine/loop.js',
  'js/engine/canvas.js',
  'js/engine/pool.js',
  'js/engine/vec.js',
  'js/engine/fx.js',
  'js/engine/pixels.js',
  'js/data/palette.js',
  'js/data/sprites.js',
  'js/data/moves.js',
  'js/data/forms.js',
  'js/data/missions.js',
  'js/data/trainers.js',
  'js/data/story.js',
  'js/data/achievements.js',
  'js/data/pursuit.js',
  'js/game/world.js',
  'js/game/render.js',
  'js/game/input.js',
  'js/game/run.js',
  'js/game/save.js',
  'manifest.json',
  'assets/icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((m) => m || caches.match('index.html'))
      )
  );
});
