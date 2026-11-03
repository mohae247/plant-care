/* 내 식물 관리 - 오프라인용 서비스 워커
   앱 파일을 폰에 보관해 두고, 인터넷이 없어도 앱이 열리게 해요.
   새 버전을 올릴 때는 VERSION 값만 바꾸면 돼요. */
const VERSION = 'plant-care-2026.11.03';
const FONTS = 'plant-care-fonts';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 앱 화면(index.html): 인터넷이 되면 새 버전을 받고, 안 되거나 느리면(4초) 보관본을 열어요 */
function pageFirst(req) {
  const cached = () => caches.match('./index.html').then((r) => r || caches.match('./'));
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => cached().then(finish), 4000);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./index.html', copy));
        finish(res);
      } else {
        cached().then((r) => finish(r || res));
      }
    }).catch(() => {
      clearTimeout(timer);
      cached().then((r) => finish(r || Response.error()));
    });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') { e.respondWith(pageFirst(req)); return; }
    /* 아이콘 같은 앱 파일: 보관본 먼저, 없으면 받아서 보관 */
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  /* 글꼴(구글 폰트): 보관본을 바로 쓰고, 뒤에서 새로 받아 둬요 */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then((c) => c.match(req).then((hit) => {
        const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
  }
});
