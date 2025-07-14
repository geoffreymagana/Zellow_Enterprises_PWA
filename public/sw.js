// public/sw.js

self.addEventListener('push', function(event) {
  const data = event.data.json();
  const { title, options } = data;

  const notificationOptions = {
    body: options.body,
    icon: options.icon || '/icons/Zellow-icon-192.png',
    badge: options.badge || '/icons/Zellow-icon-72.png',
    data: options.data || { url: '/' }, // Default URL if none provided
    // You can add more options like vibrate, actions, etc. here
  };
  
  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});


self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {
      // Check if a window is already open with the same URL
      const existingClient = windowClients.find(client => {
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(urlToOpen, self.location.origin);
        return clientUrl.pathname === targetUrl.pathname;
      });

      if (existingClient) {
        // If so, focus it.
        return existingClient.focus();
      } else {
        // If not, open a new window.
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// This is a basic service worker. The @ducanh2912/next-pwa plugin
// will inject its own precaching logic into this file during the build process.
// Your custom push logic will be preserved.

self.addEventListener('install', () => {
  console.log('Service Worker: Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // The PWA plugin will handle caching. You can add custom fetch logic here if needed.
  // For a network-first or cache-first strategy, you would add more logic here.
  // For now, we let the PWA plugin manage it.
});
