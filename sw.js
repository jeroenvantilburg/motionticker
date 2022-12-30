var CACHE_NAME = 'motionticker-cache-v1';
var CURRENT_CACHES = CACHE_NAME;
var urlsToCache = [
  './',
  'index.html',
  'style.css',
  'favicon.ico',
  'site.webmanifest',
  'sw.js',
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
  'scripts/opencv.js',
  //'videos/demo_bounching_ball.mp4',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/fonts/fontawesome-webfont.eot',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/fonts/fontawesome-webfont.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/fonts/fontawesome-webfont.ttf',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/fonts/fontawesome-webfont.woff',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/fonts/fontawesome-webfont.woff2?v=4.7.0',
  'mstile-70x70.png'
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');

        // Add manually due to CORS restriction on opencv.org
        //const requestCV = new Request('https://docs.opencv.org/4.5.1/opencv.js', { mode: 'no-cors' });
        //fetch(requestCV).then(response => cache.put(requestCV, response));

        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  // Return without calling event.respondWith()
  // if this is a range request.
  if (event.request.headers.has('range')) {
    return;
  }

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

