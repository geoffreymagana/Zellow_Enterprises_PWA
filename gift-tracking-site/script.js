
// IMPORTANT: REPLACE WITH YOUR ACTUAL FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Optional
};

let app;
let db;

try {
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log("Firebase Initialized Successfully (Gift Tracker)");
} catch (e) {
  console.error("Error initializing Firebase (Gift Tracker):", e);
  const loadingMessage = document.getElementById('loading-message');
  const errorMessageElement = document.getElementById('error-message');
  if (loadingMessage) loadingMessage.style.display = 'none';
  if (errorMessageElement) {
    errorMessageElement.textContent = 'Error connecting to tracking service. Please try again later or contact support. (Firebase Init Failed)';
    errorMessageElement.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const recipientNameElement = document.getElementById('recipient-name');
  const orderStatusElement = document.getElementById('order-status');
  const deliveryDateElement = document.getElementById('delivery-date');
  const messageFromSenderElement = document.getElementById('message-from-sender');
  const loadingMessage = document.getElementById('loading-message');
  const giftDetailsContainer = document.getElementById('gift-details-container');
  const errorMessageElement = document.getElementById('error-message');
  const giftImageElement = document.getElementById('gift-image');
  const giftImageContainer = document.getElementById('gift-image-container');

  document.getElementById('current-year').textContent = new Date().getFullYear();

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token'); // This is the orderId

  const formatDate = (timestampInput) => {
    if (!timestampInput) return "To be confirmed";
    let date;
    if (timestampInput.toDate && typeof timestampInput.toDate === 'function') {
      date = timestampInput.toDate(); // Firestore Timestamp
    } else if (timestampInput instanceof Date) {
      date = timestampInput; // JavaScript Date
    } else {
      date = new Date(timestampInput); // Try to parse if it's a string/number
    }
    
    if (isNaN(date.getTime())) {
      return "Date not available";
    }
    // Format: e.g., "Mon, Jan 15, 2024"
    return date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (token && db) {
    const orderRef = db.collection('orders').doc(token);

    orderRef.onSnapshot((doc) => {
      if (loadingMessage) loadingMessage.style.display = 'none';
      if (errorMessageElement) errorMessageElement.style.display = 'none';

      if (doc.exists) {
        const orderData = doc.data();
        console.log("Fetched Order Data:", orderData); // For debugging

        if (orderData.isGift !== true) {
          if (errorMessageElement) {
            errorMessageElement.textContent = 'This order is not marked as a trackable gift.';
            errorMessageElement.style.display = 'block';
          }
          if (giftDetailsContainer) giftDetailsContainer.style.display = 'none';
          return;
        }
        
        if (!orderData.giftDetails) {
            if (errorMessageElement) {
                errorMessageElement.textContent = 'Gift details are not available for this order.';
                errorMessageElement.style.display = 'block';
            }
            if (giftDetailsContainer) giftDetailsContainer.style.display = 'none';
            return;
        }


        if (recipientNameElement) recipientNameElement.textContent = orderData.giftDetails.recipientName || 'Valued Recipient';
        
        if (orderStatusElement) {
          orderStatusElement.textContent = orderData.status ? orderData.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Status Unknown';
          orderStatusElement.setAttribute('data-status-value', orderData.status || '');
          if (orderData.status === 'delivered') {
            orderStatusElement.setAttribute('data-delivered', 'true');
          } else {
            orderStatusElement.removeAttribute('data-delivered');
          }
        }
        
        if (deliveryDateElement) {
          if (orderData.status === 'delivered' && orderData.actualDeliveryTime) {
            deliveryDateElement.textContent = `Delivered on ${formatDate(orderData.actualDeliveryTime)}`;
          } else if (orderData.estimatedDeliveryTime) {
            deliveryDateElement.textContent = `ETA: ${formatDate(orderData.estimatedDeliveryTime)}`;
          } else {
            deliveryDateElement.textContent = 'To be confirmed';
          }
        }
        
        if (messageFromSenderElement) messageFromSenderElement.textContent = orderData.giftDetails.giftMessage || 'Enjoy your gift!';
        
        // Display gift image
        const firstItem = orderData.items && orderData.items.length > 0 ? orderData.items[0] : null;
        if (giftImageElement && giftImageContainer) {
          if (firstItem && firstItem.imageUrl) {
            giftImageElement.src = firstItem.imageUrl;
            giftImageElement.alt = firstItem.name || "Your Gift";
            giftImageContainer.style.display = 'block';
          } else {
            // Optionally, show a placeholder or hide the image section if no image
            giftImageElement.src = 'https://placehold.co/300x200.png?text=Gift+Image'; // Placeholder
            giftImageElement.alt = "Gift Image Placeholder";
            giftImageContainer.style.display = 'block'; // Show placeholder
            // giftImageContainer.style.display = 'none'; // Or hide if no image
          }
        }

        if (giftDetailsContainer) giftDetailsContainer.style.display = 'block';

      } else {
        if (errorMessageElement) {
          errorMessageElement.textContent = 'Sorry, we could not find tracking information for this gift. Please check the link or contact the sender.';
          errorMessageElement.style.display = 'block';
        }
        if (giftDetailsContainer) giftDetailsContainer.style.display = 'none';
        console.error("Order not found for token:", token);
      }
    }, (error) => {
      if (loadingMessage) loadingMessage.style.display = 'none';
      if (errorMessageElement) {
        errorMessageElement.textContent = 'There was an error retrieving gift details. Please try again later.';
        errorMessageElement.style.display = 'block';
      }
      if (giftDetailsContainer) giftDetailsContainer.style.display = 'none';
      console.error("Error fetching order:", error);
    });
  } else {
    if (loadingMessage) loadingMessage.style.display = 'none';
    if (errorMessageElement) {
      errorMessageElement.textContent = !db ? 'Tracking service connection error.' : 'No gift tracking token provided. Please use the link from your notification.';
      errorMessageElement.style.display = 'block';
    }
    if (giftDetailsContainer) giftDetailsContainer.style.display = 'none';
    if (!token) console.error("No token found in URL.");
  }
});
