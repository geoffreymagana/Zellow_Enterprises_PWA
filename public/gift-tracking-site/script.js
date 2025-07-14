document.addEventListener('DOMContentLoaded', function() {
    const loader = document.getElementById('loader');
    const content = document.getElementById('content');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');

    const db = firebase.firestore();

    const getOrderIdFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('token');
    };

    const orderId = getOrderIdFromUrl();

    if (!orderId) {
        showError("No gift ID provided in the link.");
        return;
    }

    const orderRef = db.collection('orders').doc(orderId);

    const unsubscribe = orderRef.onSnapshot(doc => {
        if (doc.exists) {
            const orderData = doc.data();
            if (orderData.isGift) {
                renderOrderDetails(orderData);
                hideError();
            } else {
                showError("This order is not marked as a gift.");
            }
        } else {
            showError("Gift details could not be found. Please check the link or contact the sender.");
        }
        hideLoader();
    }, err => {
        console.error("Error fetching gift details:", err);
        showError("There was a problem retrieving your gift details. Please try again later.");
        hideLoader();
    });

    function renderOrderDetails(order) {
        const { senderName, status, deliveryHistory, giftDetails, items } = order;
        const showPrices = giftDetails?.showPricesToRecipient === true;

        let itemsHtml = items.map(item => `
            <div class="item">
                <img src="${item.imageUrl || 'https://placehold.co/100x100.png'}" alt="${item.name}" class="item-image">
                <div class="item-info">
                    <p class="item-name">${item.name} (x${item.quantity})</p>
                    ${showPrices ? `<p class="item-price">${formatPrice(item.price * item.quantity)}</p>` : ''}
                </div>
            </div>
        `).join('');

        let historyHtml = deliveryHistory ? deliveryHistory.slice().reverse().map(entry => `
            <li class="timeline-item">
                <div class="timeline-marker ${status === entry.status ? 'active' : ''}"></div>
                <div class="timeline-content">
                    <p class="status">${entry.status.replace(/_/g, ' ')}</p>
                    <p class="timestamp">${formatDate(entry.timestamp)}</p>
                    ${entry.notes ? `<p class="notes">${entry.notes}</p>` : ''}
                </div>
            </li>
        `).join('') : '';

        content.innerHTML = `
            <div class="card sender-info">
                <h2>A Gift For You!</h2>
                <p>From: <strong>${senderName || 'A friend'}</strong></p>
                ${giftDetails?.giftMessage ? `<p class="message">"${giftDetails.giftMessage}"</p>` : ''}
            </div>

            <div class="card status-overview">
                <h3>Current Status: <span class="status-badge ${status}">${status.replace(/_/g, ' ')}</span></h3>
            </div>

            <div class="card timeline">
                <h3>Your Gift's Journey</h3>
                <ul>${historyHtml}</ul>
            </div>
            
            ${showPrices ? `
            <div class="card items-summary">
                <h3>Items in this Gift</h3>
                ${itemsHtml}
            </div>
            ` : ''}
        `;
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorContainer.classList.remove('hidden');
        content.classList.add('hidden');
        hideLoader();
    }
    
    function hideError() {
        errorContainer.classList.add('hidden');
        content.classList.remove('hidden');
    }

    function hideLoader() {
        loader.classList.add('hidden');
    }

    function formatDate(timestamp) {
        if (!timestamp || !timestamp.toDate) return 'Just now';
        return timestamp.toDate().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    function formatPrice(price) {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
    }
});
