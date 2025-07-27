// Service Worker for Zellow Enterprises PWA
importScripts('/fallback-ce627215c0e4a9af.js');

// Push notification event handler
self.addEventListener('push', function(event) {
  console.log('Push event received:', event);
  
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('Push payload:', payload);
      
      const options = {
        body: payload.options?.body || 'You have a new notification',
        icon: payload.options?.icon || '/icons/Zellow-icon-192.png',
        badge: payload.options?.badge || '/icons/Zellow-icon-72.png',
        data: payload.options?.data || { url: '/' },
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View',
            icon: '/icons/Zellow-icon-72.png'
          },
          {
            action: 'close',
            title: 'Close',
            icon: '/icons/Zellow-icon-72.png'
          }
        ]
      };

      event.waitUntil(
        self.registration.showNotification(payload.title || 'Zellow Enterprises', options)
      );
    } catch (error) {
      console.error('Error parsing push data:', error);
      // Fallback notification
      event.waitUntil(
        self.registration.showNotification('Zellow Enterprises', {
          body: 'You have a new notification',
          icon: '/icons/Zellow-icon-192.png',
          badge: '/icons/Zellow-icon-72.png'
        })
      );
    }
  } else {
    // Fallback for empty data
    event.waitUntil(
      self.registration.showNotification('Zellow Enterprises', {
        body: 'You have a new notification',
        icon: '/icons/Zellow-icon-192.png',
        badge: '/icons/Zellow-icon-72.png'
      })
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Default action or 'view' action
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for offline functionality
self.addEventListener('sync', function(event) {
  console.log('Background sync event:', event);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync tasks here
      console.log('Background sync completed')
    );
  }
});

// Install event
self.addEventListener('install', function(event) {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', function(event) {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Fallback handler for offline functionality
self.fallback = function(request) {
  return new Response('You are offline. Please check your connection and try again.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'text/plain'
    }
  });
};
