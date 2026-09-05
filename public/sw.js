const CACHE_NAME = 'omnitreco-v23';
const BUILD_ID = 'freeze-v1';
const ASSETS = [
  './',
  './index.html',
  `./style.css?v=${BUILD_ID}`,
  `./app.js?v=${BUILD_ID}`,
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  `./assets/audio/tiny-violin.wav?v=${BUILD_ID}`,
  `./assets/audio/womp.wav?v=${BUILD_ID}`,
  `./assets/audio/dramatic.wav?v=${BUILD_ID}`,
  `./assets/audio/laugh.wav?v=${BUILD_ID}`,
  `./assets/audio/applause.wav?v=${BUILD_ID}`,
  `./assets/audio/horn.wav?v=${BUILD_ID}`,
  `./assets/audio/cricket.wav?v=${BUILD_ID}`,
  `./assets/audio/boing.wav?v=${BUILD_ID}`,
  `./assets/audio/siren.wav?v=${BUILD_ID}`,
  `./assets/audio/beep.wav?v=${BUILD_ID}`,
  `./assets/audio/winner.wav?v=${BUILD_ID}`,
  `./js/lib/transformers.min.js?v=${BUILD_ID}`,
  `./js/lib/tesseract.min.js?v=${BUILD_ID}`,
  `./js/lib/jsqr.js?v=${BUILD_ID}`,
  `./js/lib/qrcode.js?v=${BUILD_ID}`,
  `./js/engine/identityEngine.js?v=${BUILD_ID}`,
  `./js/engine/fileInspector.js?v=${BUILD_ID}`,
  `./js/engine/autoFixer.js?v=${BUILD_ID}`,
  `./js/engine/recipePipeline.js?v=${BUILD_ID}`,
  `./js/engine/intentRouter.js?v=${BUILD_ID}`,
  `./js/lib/qrcode.js?v=${BUILD_ID}`,
  `./js/engine/webrtcTeleport.js?v=${BUILD_ID}`,
  `./js/engine/folderInspector.js?v=${BUILD_ID}`,
  `./js/engine/macgyverEngine.js?v=${BUILD_ID}`,
  `./js/engine/speechEngine.js?v=${BUILD_ID}`,
  `./js/engine/hearingEngine.js?v=${BUILD_ID}`,
  `./js/engine/visionEngine.js?v=${BUILD_ID}`,
  `./js/tools/smartDrop.js?v=${BUILD_ID}`,
  `./js/tools/quickPocket.js?v=${BUILD_ID}`,
  `./js/tools/fingerChooser.js?v=${BUILD_ID}`,
  `./js/tools/capybaraLevel.js?v=${BUILD_ID}`,
  `./js/tools/lieDetector.js?v=${BUILD_ID}`,
  `./js/tools/ringLight.js?v=${BUILD_ID}`,
  `./js/tools/decibelMeter.js?v=${BUILD_ID}`,
  `./js/tools/petTranslator.js?v=${BUILD_ID}`,
  `./js/tools/fakeCall.js?v=${BUILD_ID}`,
  `./js/tools/paidToilet.js?v=${BUILD_ID}`,
  `./js/tools/soundboard.js?v=${BUILD_ID}`,
  `./js/tools/strobeMorse.js?v=${BUILD_ID}`
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // 1. Navigation requests: Network first
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 2. Audio assets: Network first to ensure immediate fresh audio on iOS
  if (e.request.url.includes('/assets/audio/')) {
    e.respondWith(
      fetch(e.request).then((netResp) => {
        if (netResp && netResp.status === 200) {
          const respClone = netResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, respClone));
        }
        return netResp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  
  // 3. Other static assets: Cache first with background update
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
