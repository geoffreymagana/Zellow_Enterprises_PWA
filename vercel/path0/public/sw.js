// public/sw.js

self.addEventListener('push', function(event) {
  console.log('Push event received:', event);
  
  if (!event.data) {
    console.log('Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push data:', data);
    
    const options = {
      body: data.body || data.options?.body || 'New notification',
      icon: data.icon || data.options?.icon || '/icons/Zellow-icon-192.png',
      badge: data.badge || data.options?.badge || '/icons/Zellow-icon-72.png',
      tag: data.tag || data.options?.tag || 'notification',
      data: data.data || data.options?.data || {},
      actions: data.actions || data.options?.actions || [],
      requireInteraction: data.requireInteraction || data.options?.requireInteraction || false,
      silent: data.silent || data.options?.silent || false,
      vibrate: data.vibrate || data.options?.vibrate || [200, 100, 200],
      timestamp: data.timestamp || Date.now()
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Notification', options)
    );
  } catch (error) {
    console.error('Error processing push event:', error);
    
    // Fallback notification if JSON parsing fails
    const fallbackText = event.data.text();
    event.waitUntil(
      self.registration.showNotification('New Message', {
        body: fallbackText || 'You have a new notification',
        icon: '/icons/Zellow-icon-192.png',
        badge: '/icons/Zellow-icon-72.png'
      })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const url = data.url || '/';
  
  // This looks for an existing window and focuses it.
  // If no window is found, it opens a new one.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        if (clients.openWindow) {
            return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event);
  // Optional: Handle analytics or state changes when a notification is dismissed.
});

// This event is fired when the service worker is installed.
self.addEventListener('install', (event) => {
    console.log('Service Worker: Install in progress.');
    // event.waitUntil(self.skipWaiting()); // Use this to activate the new SW immediately
});

// This event is fired when the service worker is activated.
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Active.');
    // event.waitUntil(self.clients.claim()); // Use this to take control of open clients
});

self.addEventListener('fetch', (event) => {
  // We are not implementing a caching strategy here,
  // but this is where you would add it for offline functionality.
  // console.log('Service Worker: Fetching', event.request.url);
});
