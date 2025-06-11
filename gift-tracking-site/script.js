
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
  db = firebase.firestore(app);
  console.log("Firebase initialized for gift tracking.");
} catch (error) {
  console.error("Error initializing Firebase for gift tracking:", error);
  const statusDiv = document.getElementById('status');
  const detailsDiv = document.getElementById('gift-details');
  if (statusDiv) statusDiv.textContent = 'Error initializing. Cannot load details.';
  if (detailsDiv) detailsDiv.innerHTML = '<p>Could not connect to the tracking service. Please try again later.</p>';
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  let date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate(); // Firestore Timestamp
  } else if (timestamp instanceof Date) {
    date = timestamp; // JavaScript Date object
  } else {
    try {
      date = new Date(timestamp); // Try parsing if it's a string or number
    } catch (e) {
      console.warn("Could not parse date:", timestamp, e);
      return "Invalid Date";
    }
  }

  if (isNaN(date.getTime())) {
    console.warn("Formatted date is invalid:", date);
    return "Invalid Date";
  }

  // Example format: "January 1, 2023, 10:30 AM"
  // You can customize this using options for toLocaleString
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!db) {
    console.log("Firestore (db) not initialized. Exiting script.");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token'); // This token is the orderId

  const statusDiv = document.getElementById('status');
  const recipientNameDiv = document.getElementById('recipient-name');
  const expectedDeliveryDiv = document.getElementById('expected-delivery');
  const messageDiv = document.getElementById('message-from-sender');
  const detailsDiv = document.getElementById('gift-details');
  const loadingDiv = document.getElementById('loading-message');

  if (!token) {
    if (loadingDiv) loadingDiv.style.display = 'none';
    if (detailsDiv) detailsDiv.innerHTML = '<p class="error">No tracking token provided in the URL.</p>';
    return;
  }

  const orderRef = db.collection('orders').doc(token);

  orderRef.onSnapshot((doc) => {
    if (loadingDiv) loadingDiv.style.display = 'none'; // Hide loading once we get a response

    if (doc.exists) {
      const orderData = doc.data();
      console.log("Fetched Order Data:", orderData);

      if (orderData.isGift !== true) {
        if (detailsDiv) detailsDiv.innerHTML = '<p>This order is not marked as a trackable gift.</p>';
        return;
      }
      
      // Check if recipient can view order details
      if (orderData.giftDetails && orderData.giftDetails.recipientCanViewAndTrack === false) {
        if (statusDiv) statusDiv.textContent = orderData.status ? orderData.status.replace(/_/g, ' ') : 'Status Unavailable';
        if (recipientNameDiv) recipientNameDiv.textContent = orderData.giftDetails.recipientName || 'Valued Recipient';
        if (expectedDeliveryDiv && orderData.estimatedDeliveryTime) {
            expectedDeliveryDiv.textContent = formatDate(orderData.estimatedDeliveryTime);
        } else if (expectedDeliveryDiv) {
            expectedDeliveryDiv.textContent = 'To be confirmed';
        }
        if (messageDiv && orderData.giftDetails.giftMessage) {
            messageDiv.textContent = orderData.giftDetails.giftMessage;
        } else if (messageDiv) {
            messageDiv.textContent = 'A special gift is on its way!';
        }
        if (detailsDiv) {
            // Show minimal info if tracking is restricted
            detailsDiv.style.display = 'block';
            const minimalInfoHTML = `
                <p><strong>Status:</strong> <span id="status-val">${orderData.status ? orderData.status.replace(/_/g, ' ') : 'Status Unavailable'}</span></p>
                <p>Hello ${orderData.giftDetails.recipientName || 'Valued Recipient'}, your gift from ${orderData.senderName || 'a friend'} is being prepared!</p>
                ${orderData.giftDetails.giftMessage ? `<p class="message"><strong>Message:</strong> ${orderData.giftDetails.giftMessage}</p>` : ''}
                <p class="note">Detailed tracking is not available for this gift as per sender's preference.</p>
            `;
            detailsDiv.innerHTML = minimalInfoHTML;
        }
        return;
      }


      if (detailsDiv) detailsDiv.style.display = 'block'; // Show details section

      if (statusDiv) statusDiv.textContent = orderData.status ? orderData.status.replace(/_/g, ' ') : 'Status Unavailable';

      if (recipientNameDiv) {
        recipientNameDiv.textContent = orderData.giftDetails?.recipientName || 'Valued Recipient';
      } else {
        console.warn("recipientNameDiv not found");
      }

      if (expectedDeliveryDiv) {
        if (orderData.status === 'delivered' && orderData.actualDeliveryTime) {
            expectedDeliveryDiv.innerHTML = `Delivered on: <strong>${formatDate(orderData.actualDeliveryTime)}</strong>`;
        } else if (orderData.estimatedDeliveryTime) {
            expectedDeliveryDiv.textContent = formatDate(orderData.estimatedDeliveryTime);
        } else {
            expectedDeliveryDiv.textContent = 'To be confirmed';
        }
      } else {
        console.warn("expectedDeliveryDiv not found");
      }

      if (messageDiv) {
        if (orderData.giftDetails?.giftMessage) {
          messageDiv.textContent = orderData.giftDetails.giftMessage;
        } else {
          messageDiv.textContent = 'A special gift is on its way!';
        }
      } else {
        console.warn("messageDiv not found");
      }

    } else {
      console.log("No such document for order ID:", token);
      if (detailsDiv) detailsDiv.innerHTML = '<p class="error">Invalid tracking link or gift details not found.</p>';
    }
  }, (error) => {
    console.error("Error getting order details: ", error);
    if (loadingDiv) loadingDiv.style.display = 'none';
    if (detailsDiv) detailsDiv.innerHTML = '<p class="error">Could not load gift tracking information. Please try again later.</p>';
  });
});
    