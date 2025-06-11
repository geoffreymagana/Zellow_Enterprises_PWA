
document.addEventListener('DOMContentLoaded', function () {
  const firebaseConfig = {
    // IMPORTANT: Replace with your actual Firebase project configuration!
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
    if (!firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      app = firebase.app();
    }
    db = firebase.firestore();
    console.log("Firebase initialized successfully for gift tracking.");
  } catch (e) {
    console.error("Firebase initialization error:", e);
    displayError("Could not connect to tracking service. Please ensure Firebase config is correct.");
    return;
  }


  const loadingMessage = document.getElementById('loadingMessage');
  const orderDetailsDiv = document.getElementById('orderDetails');
  const errorMessageDiv = document.getElementById('errorMessage');

  const orderStatusEl = document.getElementById('orderStatus');
  const statusTimestampEl = document.getElementById('statusTimestamp');
  const statusNotesEl = document.getElementById('statusNotes');
  const recipientNameEl = document.getElementById('recipientName');
  const giftMessageTextEl = document.getElementById('giftMessageText');
  const deliveryDateEl = document.getElementById('deliveryDate');
  const giftItemsContainerEl = document.getElementById('giftItemsContainer'); // Updated ID

  document.getElementById('currentYear').textContent = new Date().getFullYear();

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token'); // This token is the orderId

  if (!token) {
    displayError("No tracking token provided. Please check the link.");
    return;
  }

  function displayError(message) {
    if (loadingMessage) loadingMessage.classList.add('hidden');
    if (orderDetailsDiv) orderDetailsDiv.classList.add('hidden');
    if (errorMessageDiv) {
      errorMessageDiv.textContent = message;
      errorMessageDiv.classList.remove('hidden');
    }
    console.error("Gift Tracking Error:", message);
  }

  function formatDate(timestampObj) {
    if (!timestampObj) return "N/A";
    let date;
    if (timestampObj.toDate && typeof timestampObj.toDate === 'function') {
      date = timestampObj.toDate(); // Firestore Timestamp
    } else if (timestampObj instanceof Date) {
      date = timestampObj; // JavaScript Date
    } else {
      try {
        date = new Date(timestampObj); // Attempt to parse if string/number
        if (isNaN(date.getTime())) throw new Error("Invalid date constructor input");
      } catch(e) {
        console.warn("Invalid date format for timestamp:", timestampObj, e);
        return "Invalid Date";
      }
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + 
           ' at ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  
  if (db) {
    const orderDocRef = db.collection('orders').doc(token);

    orderDocRef.get().then((doc) => {
      if (doc.exists) {
        const orderData = doc.data();
        console.log("Fetched Order Data:", orderData);

        if (loadingMessage) loadingMessage.classList.add('hidden');
        if (orderDetailsDiv) orderDetailsDiv.classList.remove('hidden');
        if (errorMessageDiv) errorMessageDiv.classList.add('hidden');
        
        if (!orderData.isGift) {
            displayError("This order is not marked as a gift or tracking is not enabled by the sender.");
            return;
        }
        
        // Determine current status and details
        const currentHistoryEntry = orderData.deliveryHistory && orderData.deliveryHistory.length > 0 
            ? orderData.deliveryHistory[orderData.deliveryHistory.length - 1] 
            : { status: orderData.status, timestamp: orderData.updatedAt || orderData.createdAt, notes: 'Order status updated.' };

        if (orderStatusEl) {
            orderStatusEl.textContent = (currentHistoryEntry.status || 'N/A').replace(/_/g, ' ');
            orderStatusEl.className = `status-badge status-${(currentHistoryEntry.status || 'unknown').toLowerCase()}`;
            if (currentHistoryEntry.status === 'delivered') {
                orderStatusEl.classList.add('custom-checkmark');
            }
        }
        if (statusTimestampEl) statusTimestampEl.textContent = `Last updated: ${formatDate(currentHistoryEntry.timestamp)}`;
        if (statusNotesEl) statusNotesEl.textContent = currentHistoryEntry.notes || "";


        if (recipientNameEl) recipientNameEl.textContent = orderData.giftDetails?.recipientName || "Valued Recipient";
        if (giftMessageTextEl) giftMessageTextEl.textContent = orderData.giftDetails?.giftMessage || "Enjoy your gift!";
        
        if (deliveryDateEl) {
            if (orderData.status === 'delivered' && orderData.actualDeliveryTime) {
                deliveryDateEl.textContent = `Delivered on: ${formatDate(orderData.actualDeliveryTime)}`;
            } else if (orderData.estimatedDeliveryTime) {
                deliveryDateEl.textContent = `ETA: ${formatDate(orderData.estimatedDeliveryTime)}`;
            } else {
                deliveryDateEl.textContent = "To be confirmed";
            }
        }

        // Display Item Thumbnails
        if (giftItemsContainerEl && orderData.items && orderData.items.length > 0) {
            giftItemsContainerEl.innerHTML = ''; // Clear previous content
            const itemsTitle = document.createElement('h3');
            itemsTitle.textContent = "Items in Your Gift:";
            giftItemsContainerEl.appendChild(itemsTitle);

            const ul = document.createElement('ul');
            ul.style.listStyleType = 'none'; // ensure no bullets for ul
            ul.style.paddingLeft = '0';

            orderData.items.forEach(item => {
                const li = document.createElement('li');
                li.className = 'gift-item';

                const img = document.createElement('img');
                img.src = item.imageUrl || 'https://placehold.co/60x60.png?text=Gift';
                img.alt = item.name || "Gift item";
                img.className = 'gift-item-thumbnail';
                li.appendChild(img);

                const itemInfoDiv = document.createElement('div');
                itemInfoDiv.className = 'gift-item-info';
                
                const itemNameP = document.createElement('p');
                itemNameP.className = 'item-name';
                itemNameP.textContent = item.name || "Gift Item";
                itemInfoDiv.appendChild(itemNameP);

                const itemQuantityP = document.createElement('p');
                itemQuantityP.className = 'item-quantity';
                itemQuantityP.textContent = `Quantity: ${item.quantity || 1}`;
                itemInfoDiv.appendChild(itemQuantityP);
                
                li.appendChild(itemInfoDiv);
                ul.appendChild(li);
            });
            giftItemsContainerEl.appendChild(ul);
        } else if (giftItemsContainerEl) {
             giftItemsContainerEl.innerHTML = '<p class="notes">Gift item details are not available.</p>';
        }


      } else {
        displayError("Tracking ID not found or is invalid. Please check the link or contact the sender.");
      }
    }).catch((error) => {
      console.error("Error getting document:", error);
      displayError("Could not retrieve tracking information. Please try again later.");
    });
  } else {
     displayError("Tracking service is currently unavailable. Please try again later.");
  }
});
