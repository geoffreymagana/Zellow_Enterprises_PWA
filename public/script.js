document.addEventListener('DOMContentLoaded', () => {
    const orderDetailsDiv = document.getElementById('orderDetails');
    const statusTextEl = document.getElementById('statusText');
    const statusTimestampEl = document.getElementById('statusTimestamp');
    const statusNotesEl = document.getElementById('statusNotes');
    const recipientNameEl = document.getElementById('recipientName');
    const recipientInfoDiv = document.getElementById('recipientInfo');
    const giftMessageTextEl = document.getElementById('giftMessageText');
    const giftMessageSectionDiv = document.getElementById('giftMessageSection');
    const deliveryDateLabelEl = document.getElementById('deliveryDateLabel');
    const deliveryDateEl = document.getElementById('deliveryDate');
    const deliveryDateSectionDiv = document.getElementById('deliveryDateSection');
    const loaderDiv = document.getElementById('loader');
    const errorMessageEl = document.getElementById('errorMessage');
    const currentYearEl = document.getElementById('currentYear');
    const giftItemsContainer = document.getElementById('giftItemsContainer');


    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear().toString();
    }

    // --- Replace with your actual Firebase Project Configuration ---
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID" // Optional
    };
    // --- End Firebase Project Configuration ---

    let db;
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        } else {
            firebase.app(); // if already initialized, use that one
        }
        db = firebase.firestore();
        console.log("Firebase Initialized Successfully for Gift Tracking.");
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
        if (loaderDiv) loaderDiv.style.display = 'none';
        if (errorMessageEl) {
            errorMessageEl.textContent = "Error initializing tracking service. Please try again later.";
            errorMessageEl.style.display = 'block';
        }
        if (orderDetailsDiv) orderDetailsDiv.style.display = 'none';
        return; // Stop further execution if Firebase fails to initialize
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token'); // This token is the orderId

    if (!token) {
        if (loaderDiv) loaderDiv.style.display = 'none';
        if (errorMessageEl) {
            errorMessageEl.textContent = 'Tracking token missing or invalid.';
            errorMessageEl.style.display = 'block';
        }
        return;
    }

    if (!db) {
        console.error("Firestore (db) is not initialized.");
        if (loaderDiv) loaderDiv.style.display = 'none';
        if (errorMessageEl) {
            errorMessageEl.textContent = "Tracking service is currently unavailable.";
            errorMessageEl.style.display = 'block';
        }
        return;
    }

    const orderDocRef = db.collection('orders').doc(token);

    const formatDate = (timestampInput, includeTime = true) => {
        if (!timestampInput) return 'N/A';
        let date;
        if (timestampInput.toDate && typeof timestampInput.toDate === 'function') {
            date = timestampInput.toDate(); // Firestore Timestamp
        } else if (timestampInput instanceof Date) {
            date = timestampInput; // JavaScript Date object
        } else {
            date = new Date(timestampInput); // Attempt to parse if string/number
        }

        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return includeTime ? date.toLocaleString() : date.toLocaleDateString();
    };


    orderDocRef.onSnapshot((doc) => {
        if (loaderDiv) loaderDiv.style.display = 'none';

        if (doc.exists) {
            const orderData = doc.data();
            console.log("Fetched Order Data:", orderData);

            if (!orderData.isGift) {
                if (errorMessageEl) {
                    errorMessageEl.textContent = "This order is not marked as a gift or tracking is not enabled.";
                    errorMessageEl.style.display = 'block';
                }
                if (orderDetailsDiv) orderDetailsDiv.style.display = 'none';
                return;
            }
            
            if (errorMessageEl) errorMessageEl.style.display = 'none';
            if (orderDetailsDiv) orderDetailsDiv.style.display = 'block';

            // Status
            const currentStatusEntry = orderData.deliveryHistory && orderData.deliveryHistory.length > 0 
                ? orderData.deliveryHistory[orderData.deliveryHistory.length - 1] 
                : { status: orderData.status, timestamp: orderData.updatedAt || orderData.createdAt, notes: 'Order status updated.' };

            if (statusTextEl) {
                statusTextEl.textContent = currentStatusEntry.status.replace(/_/g, ' ');
                if (currentStatusEntry.status === 'delivered') {
                    statusTextEl.classList.add('delivered');
                } else {
                    statusTextEl.classList.remove('delivered');
                }
            }
            if (statusTimestampEl) statusTimestampEl.textContent = `As of: ${formatDate(currentStatusEntry.timestamp)}`;
            if (statusNotesEl) {
                statusNotesEl.textContent = currentStatusEntry.notes ? `Note: ${currentStatusEntry.notes}` : "";
                statusNotesEl.style.display = currentStatusEntry.notes ? 'block' : 'none';
            }
            
            // Items with Thumbnails
            if (giftItemsContainer && orderData.items && orderData.items.length > 0) {
                giftItemsContainer.innerHTML = '<h3>Items in Your Gift:</h3>'; // Clear previous and add title
                const ul = document.createElement('ul');
                ul.className = 'gift-item-list'; // For potential future styling if needed

                orderData.items.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'gift-item';

                    const img = document.createElement('img');
                    img.src = item.imageUrl || 'https://placehold.co/60x60.png?text=Gift';
                    img.alt = item.name;
                    img.className = 'gift-item-thumbnail';
                    img.onerror = () => { img.src = 'https://placehold.co/60x60.png?text=Image+Error'; };


                    const itemInfoDiv = document.createElement('div');
                    itemInfoDiv.className = 'gift-item-info';

                    const itemNameP = document.createElement('p');
                    itemNameP.className = 'item-name';
                    itemNameP.textContent = item.name;

                    const itemQuantityP = document.createElement('p');
                    itemQuantityP.className = 'item-quantity';
                    itemQuantityP.textContent = `Quantity: ${item.quantity}`;
                    
                    itemInfoDiv.appendChild(itemNameP);
                    itemInfoDiv.appendChild(itemQuantityP);

                    li.appendChild(img);
                    li.appendChild(itemInfoDiv);
                    ul.appendChild(li);
                });
                giftItemsContainer.appendChild(ul);
                giftItemsContainer.style.display = 'block';
            } else if (giftItemsContainer) {
                giftItemsContainer.style.display = 'none';
            }


            // Recipient Name
            if (recipientNameEl && recipientInfoDiv && orderData.giftDetails && orderData.giftDetails.recipientName) {
                recipientNameEl.textContent = orderData.giftDetails.recipientName;
                recipientInfoDiv.style.display = 'block';
            } else if (recipientInfoDiv) {
                recipientInfoDiv.style.display = 'none';
            }

            // Delivery Date
            if (deliveryDateEl && deliveryDateLabelEl && deliveryDateSectionDiv) {
                if (orderData.status === 'delivered' && orderData.actualDeliveryTime) {
                    deliveryDateLabelEl.textContent = 'Delivered on:';
                    deliveryDateEl.textContent = formatDate(orderData.actualDeliveryTime, false); // Date only for delivered
                    deliveryDateSectionDiv.style.display = 'block';
                } else if (orderData.estimatedDeliveryTime) {
                    deliveryDateLabelEl.textContent = 'Expected Delivery:';
                    deliveryDateEl.textContent = formatDate(orderData.estimatedDeliveryTime, false); // Date only
                    deliveryDateSectionDiv.style.display = 'block';
                } else {
                    deliveryDateLabelEl.textContent = 'Expected Delivery:';
                    deliveryDateEl.textContent = 'To be confirmed';
                    deliveryDateSectionDiv.style.display = 'block';
                }
            }


            // Gift Message
            if (giftMessageTextEl && giftMessageSectionDiv && orderData.giftDetails && orderData.giftDetails.giftMessage) {
                giftMessageTextEl.textContent = orderData.giftDetails.giftMessage;
                giftMessageSectionDiv.style.display = 'block';
            } else if (giftMessageSectionDiv) {
                giftMessageSectionDiv.style.display = 'none';
            }

        } else {
            if (errorMessageEl) {
                errorMessageEl.textContent = 'Tracking ID not found or order details are unavailable.';
                errorMessageEl.style.display = 'block';
            }
            if (orderDetailsDiv) orderDetailsDiv.style.display = 'none';
        }
    }, (error) => {
        console.error("Error fetching order: ", error);
        if (loaderDiv) loaderDiv.style.display = 'none';
        if (errorMessageEl) {
            errorMessageEl.textContent = 'Error fetching tracking information. Please try again later.';
            errorMessageEl.style.display = 'block';
        }
        if (orderDetailsDiv) orderDetailsDiv.style.display = 'none';
    });
});
