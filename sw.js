// Service worker: deixa o app abrir e imprimir mesmo sem internet.
const VERSAO = 'epi-v3';
const ARQUIVOS = [
  './', './index.html', './css/app.css',
  './js/app.js', './js/store.js', './js/ficha.js', './js/seed.js',
  './vendor/supabase.js', './manifest.webmanifest', './favicon.ico',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png',
  './icons/maskable-192.png', './icons/maskable-512.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSAO)
    .then(c => c.addAll(ARQUIVOS))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // chamadas ao Supabase nunca vão para o cache
  if (url.origin !== self.location.origin) return;

  ev.respondWith(
    caches.match(req).then(guardado => {
      const rede = fetch(req).then(resp => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(VERSAO).then(c => c.put(req, copia));
        }
        return resp;
      }).catch(() => guardado);
      return guardado || rede;
    })
  );
});
