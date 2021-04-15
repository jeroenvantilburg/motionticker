var CACHE_NAME = 'motionticker-cache-v1';
var urlsToCache = [
  './',
  'index.html',
  'style.css',
  'favicon.ico',
  'scripts/MediaInfo.js',
  'scripts/MediaInfoWasm.wasm',
  'scripts/motionticker.js',
  'scripts/MediaInfo.js.mem',
  'scripts/fabric-patch-arrow.js',
  'scripts/registerSW.js',
  'scripts/MediaInfoWasm.js',
  'scripts/fabric-patch-touch.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.4/Chart.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/4.3.1/fabric.min.js',
  // 'https://docs.opencv.org/4.5.1/opencv.js',
  'videos/demo_bounching_ball.mp4',
  'img/screenshot.png',
  'apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css',
  'mstile-70x70.png'
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');

        const requestCV = new Request('https://docs.opencv.org/4.5.1/opencv.js', { mode: 'no-cors' });
        fetch(requestCV).then(response => cache.put(requestCV, response));

        return cache.addAll(urlsToCache);
        //cache.addAll(urlsToCache.map(function(urlToPrefetch) {
        //   return new Request(urlToPrefetch, { mode: 'no-cors' });
        //})).then(function() {
        //  console.log('All resources have been fetched and cached.');
        //});

      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
