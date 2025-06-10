
// Ensure you have configured Firebase in your project and included the SDKs in index.html
// For v9 modular SDK, the initialization would look like:
// import { initializeApp } from "firebase/app";
// import { getFirestore, doc, onSnapshot, query, collection, where, limit } from "firebase/firestore";

// ** IMPORTANT: Replace with your actual Firebase project configuration **
const firebaseConfig = {
  apiKey: "YOUR_NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "YOUR_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_NEXT_PUBLIC_FIREBASE_APP_ID",
};

// Initialize Firebase (Compat version for global SDKs)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const errorMessageDiv = document.getElementById('error-message');
    const orderDetailsDiv = document.getElementById('order-details');
    
    const recipientNameEl = document.getElementById('recipient-name');
    const orderStatusEl = document.getElementById('order-status');
    const expectedDeliveryEl = document.getElementById('expected-delivery-date');
    const messageCardEl = document.getElementById('message-card');
    const messageFromSenderEl = document.getElementById('message-from-sender');
    document.getElementById('current-year').textContent = new Date().getFullYear();

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        showError("No tracking token provided. Please check the link.");
        return;
    }

    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_NEXT_PUBLIC_FIREBASE_API_KEY") {
        showError("Firebase is not configured in script.js. Please add your project credentials.");
        return;
    }
    
    // Query Firestore for the order using the giftTrackingToken
    const ordersRef = db.collection("orders");
    const q = ordersRef.where("giftTrackingToken", "==", token).limit(1);

    q.onSnapshot((snapshot) => {
        loader.style.display = 'none';
        if (snapshot.empty) {
            showError("Gift tracking information not found. The link may be invalid or expired.");
            return;
        }

        let orderData;
        snapshot.forEach(doc => {
            orderData = doc.data();
            // Store orderId if needed globally, e.g., for further actions not shown here
            // window.currentTrackingOrderId = doc.id; 
        });

        if (orderData) {
            orderDetailsDiv.style.display = 'block';
            errorMessageDiv.style.display = 'none';

            if (recipientNameEl) recipientNameEl.textContent = orderData.giftDetails?.recipientName || 'Valued Recipient';
            if (orderStatusEl) orderStatusEl.textContent = orderData.status ? orderData.status.replace(/_/g, ' ') : 'N/A';
            
            if (expectedDeliveryEl) {
                if (orderData.estimatedDeliveryTime && orderData.estimatedDeliveryTime.toDate) {
                    expectedDeliveryEl.textContent = orderData.estimatedDeliveryTime.toDate().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                } else if (orderData.status === 'delivered' && orderData.actualDeliveryTime && orderData.actualDeliveryTime.toDate) {
                     expectedDeliveryEl.textContent = 'Delivered on ' + orderData.actualDeliveryTime.toDate().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                } else {
                    expectedDeliveryEl.textContent = 'To be updated';
                }
            }

            if (orderData.giftDetails?.giftMessage) {
                if (messageCardEl) messageCardEl.style.display = 'block';
                if (messageFromSenderEl) messageFromSenderEl.textContent = orderData.giftDetails.giftMessage;
            } else {
                if (messageCardEl) messageCardEl.style.display = 'none';
            }
        } else {
             showError("Could not retrieve gift details at this time.");
        }

    }, (error) => {
        console.error("Error fetching gift details:", error);
        showError("An error occurred while fetching gift details. Please try again later.");
    });

    function showError(message) {
        loader.style.display = 'none';
        orderDetailsDiv.style.display = 'none';
        if (errorMessageDiv) {
            errorMessageDiv.textContent = message;
            errorMessageDiv.style.display = 'block';
        }
    }
});
