const CACHE = "chamados-v8";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Chamadas de API passam sempre pela rede, sem cache
  const ehApi = ["/auth", "/chamados", "/cadastro", "/admin", "/unidades"].some((p) => url.pathname.startsWith(p));
  if (ehApi) return;
  // Cache-first só para os estáticos do PWA.
  // "no-cache": o navegador revalida com o servidor antes de usar a cópia
  // do cache HTTP, então nunca grava arquivo velho no cache do SW.
  event.respondWith(
    caches.match(event.request).then((resposta) =>
      resposta || fetch(event.request, { cache: "no-cache" })
    )
  );
});