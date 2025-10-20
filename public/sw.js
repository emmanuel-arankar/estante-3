self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/avatars/') || event.request.url.includes('/profile-images/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          return caches.open('avatar-cache').then((cache) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});