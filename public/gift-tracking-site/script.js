import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Element Selectors ---
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const successState = document.getElementById('success-state');
const errorMessageEl = document.getElementById('error-message');

const senderNameEl = document.getElementById('sender-name');
const orderStatusEl = document.getElementById('order-status');
const statusNoteEl = document.getElementById('status-note');
const statusIconSvg = document.getElementById('status-icon-svg');

const giftItemsListEl = document.getElementById('gift-items-list');
const orderIdEl = document.getElementById('order-id');
const shippingAddressEl = document.getElementById('shipping-address');
const deliveryEstimateEl = document.getElementById('delivery-estimate');
const trackingHistoryEl = document.getElementById('tracking-history');


// --- Helper Functions ---
function getOrderIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
}

function showState(state) {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    successState.style.display = 'none';

    if (state === 'loading') loadingState.style.display = 'block';
    if (state === 'error') errorState.style.display = 'block';
    if (state === 'success') successState.style.display = 'block';
}

function displayError(message) {
    errorMessageEl.textContent = message;
    showState('error');
}

function updateStatusIcon(status) {
    const truckIcon = `<path d="M10 17h4V5H2v12h2v-2h4v2h2v-3l-3-3H2V7h8v10Z"/><path d="M22 17h-2v-7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v7h-2v-2h-1v2h-1v-4h-2v4h-1v-2H6v2H5v-3H2v3h1v2H2a2 2 0 0 0-2 2v1h22v-1a2 2 0 0 0-2-2Z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>`;
    const checkIcon = `<path d="M20 6 9 17l-5-5"/>`;

    if (status === 'delivered') {
        statusIconSvg.innerHTML = checkIcon;
        statusIconSvg.parentElement.style.backgroundColor = 'var(--success-color)';
    } else {
        statusIconSvg.innerHTML = truckIcon;
        statusIconSvg.parentElement.style.backgroundColor = 'var(--primary-color)';
    }
}

function populateOrderDetails(orderData) {
    senderNameEl.textContent = orderData.senderName || 'A friend';
    const statusText = orderData.status.replace(/_/g, ' ');
    orderStatusEl.textContent = statusText;
    statusNoteEl.textContent = orderData.deliveryHistory?.slice(-1)[0]?.notes || `Your gift is ${statusText}.`;
    updateStatusIcon(orderData.status);

    orderIdEl.textContent = `#${orderData.id.substring(0, 8)}...`;
    
    // Shipping Address
    const addr = orderData.shippingAddress;
    shippingAddressEl.innerHTML = `
        ${addr.fullName}<br>
        ${addr.addressLine1}${addr.addressLine2 ? `<br>${addr.addressLine2}` : ''}<br>
        ${addr.city}, ${addr.county}
    `;

    deliveryEstimateEl.textContent = orderData.shippingMethodName ? `via ${orderData.shippingMethodName}` : 'Standard Delivery';

    // Gift Items
    giftItemsListEl.innerHTML = '';
    orderData.items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'gift-item';
        li.innerHTML = `
            <img src="${item.imageUrl || 'https://placehold.co/64x64.png'}" alt="${item.name}" />
            <div class="item-details">
                <p>${item.name}</p>
            </div>
        `;
        giftItemsListEl.appendChild(li);
    });

    // Tracking History
    trackingHistoryEl.innerHTML = '';
    if (orderData.deliveryHistory && orderData.deliveryHistory.length > 0) {
        const sortedHistory = [...orderData.deliveryHistory].sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
        sortedHistory.forEach((entry, index) => {
            const li = document.createElement('li');
            li.className = index === 0 ? 'completed' : '';
            li.innerHTML = `
                <div class="history-time">${formatDate(entry.timestamp)}</div>
                <p class="history-title">${entry.status.replace(/_/g, ' ')}</p>
            `;
            trackingHistoryEl.appendChild(li);
        });
    }
}


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', async () => {
    showState('loading');
    const orderId = getOrderIdFromUrl();

    if (!orderId) {
        displayError('No gift tracking token was found in the URL. Please use the link provided by the sender.');
        return;
    }

    if (!window.firebaseConfig || !window.firebaseConfig.apiKey || window.firebaseConfig.apiKey.includes("YOUR_")) {
        displayError('The tracking page is not configured correctly. Please inform the sender of this issue.');
        console.error("Firebase config is missing or contains placeholder values.");
        return;
    }
    
    try {
        const app = initializeApp(window.firebaseConfig);
        const db = getFirestore(app);

        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
            displayError('Could not find tracking details for this gift. Please check the link or contact the sender.');
            return;
        }

        const orderData = orderSnap.data();

        // Security check based on Firestore Rules
        if (!orderData.isGift) {
            displayError('This order is not marked as a gift and cannot be tracked publicly.');
            return;
        }

        populateOrderDetails({ id: orderSnap.id, ...orderData });
        showState('success');

    } catch (error) {
        console.error("Error fetching gift details:", error);
        displayError('An unexpected error occurred while trying to fetch gift details.');
    }
});