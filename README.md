
# ZellowLive - Customized Gifting Platform

ZellowLive is a comprehensive web application designed to streamline the process of creating, managing, and delivering customized gifts. This platform serves as a centralized hub for customers, staff, and administrators, offering a seamless experience from order placement to delivery. This project was developed as a final year student project.

## Core Features

*   **Admin Dashboard:** Enables administrators to manage users, products, orders, approve dispatches, oversee financial transactions, and view system reports.
*   **Customer Portal (PWA):** Allows customers to browse products, customize items with personal messages or images, place orders, make payments, and track their deliveries.
*   **Staff Portal (PWA):** Provides staff members (e.g., technicians, riders, finance, service managers) with role-specific access to view assigned tasks, update order statuses, upload proof of work/delivery, and receive real-time updates.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **UI:** ShadCN UI Components, Tailwind CSS
*   **Backend & Database:** Firebase (Firestore, Authentication, Storage for user-uploaded images)
*   **Generative AI:** Genkit (for features like gift notifications via email)
*   **PWA:** Enabled for Customer and Staff portals for an app-like experience with Push Notifications.
## Dashboard Screenshot
[![ZellowLive Dashboard](https://res.cloudinary.com/dwqwwb2fh/image/upload/v1753043502/wgwxd1qjbzmld0o6mdyi.png)](https://zellow-enterprises.vercel.app/)



## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   Node.js (v18 or newer recommended)
*   npm or yarn

### Installation

1.  **Clone the repository (if applicable):**
    ```bash
    # git clone [your-repo-url]
    # cd zellowlive
    ```

2.  **Install NPM packages:**
    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Generate VAPID Keys for Push Notifications:**
    Run the following command in your terminal to generate the necessary keys for sending web push notifications.
    ```bash
    npm run generate-vapid-keys
    ```
    This will output a Public Key and a Private Key. You will need to add these to your environment variables.

4.  **Set up Firebase & Environment Variables:**
    *   Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
    *   Enable Firestore, Firebase Authentication (Email/Password), and Firebase Storage.
    *   **Generate a private key for the Admin SDK:** In your Firebase project settings, go to "Service accounts", select "Node.js", and click "Generate new private key". This will download a JSON file.
    *   Create a `.env.local` file in the root of your project and add your configuration.

    **Example `.env.local`:**
    ```env
    # Firebase Client-Side Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
    NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID # Optional

    # Firebase Admin SDK (Server-Side) - from your downloaded JSON file
    FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
    FIREBASE_CLIENT_EMAIL=your-firebase-service-account-email@...
    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

    # Push Notifications (VAPID Keys) - from the 'generate-vapid-keys' command
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=YOUR_GENERATED_PUBLIC_KEY
    VAPID_PRIVATE_KEY=YOUR_GENERATED_PRIVATE_KEY

    # Genkit (AI Features) - Server-Side
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY

    # Email Notifications (SMTP) - Server-Side
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER=your-gmail-username@gmail.com
    SMTP_PASS=your-gmail-app-password
    SMTP_FROM_EMAIL=noreply@yourdomain.com
    SMTP_FROM_NAME="Zellow Notifications"

    # Mapbox Token (Client-Side)
    NEXT_PUBLIC_MAPBOX_TOKEN=YOUR_MAPBOX_ACCESS_TOKEN
    
    # Cloudinary (Client-Side)
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=YOUR_CLOUDINARY_UPLOAD_PRESET

    # Site URL - Crucial for links in emails/notifications
    NEXT_PUBLIC_SITE_URL=http://localhost:9002
    ```
    *   **Note:** For `FIREBASE_PRIVATE_KEY`, you must wrap the key in double quotes and ensure the `\n` characters are preserved. Copy the entire `private_key` value from your service account JSON file.

5.  **Configure Public Gift Tracking Page:**
    The public gift tracking page (`/public/gift-tracking-site/index.html`) requires your Firebase configuration to be added directly to the file. 
    
    *   Open `/public/gift-tracking-site/index.html`.
    *   Find the `firebaseConfig` object within the `<script>` tag.
    *   Replace the placeholder values (`"YOUR_API_KEY"`, `"YOUR_PROJECT_ID"`, etc.) with your actual Firebase project configuration values from your `.env.local` file.
    
    **IMPORTANT:** This page is publicly accessible and should only use client-safe Firebase keys. Do not expose any server-side keys here. For production deployments, it's recommended to automate this replacement using a build script or your CI/CD pipeline's environment variables to avoid committing keys to version control.

6.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application should now be running on `http://localhost:9002`.

7.  **Run the Genkit development server (for AI flows):**
    In a separate terminal:
    ```bash
    npm run genkit:dev
    ```

## Deployment to Vercel

This Next.js application is optimized for deployment on Vercel.

1.  **Create a Vercel Account:** Sign up at [vercel.com](https://vercel.com/).
2.  **Connect Git Repository:** Link your GitHub, GitLab, or Bitbucket repository to Vercel.
3.  **Configure Environment Variables:**
    *   In your Vercel project settings (Project > Settings > Environment Variables), add all the variables listed in the `.env.local` example above.
    *   **Crucially for `NEXT_PUBLIC_SITE_URL`**: Change its value to your Vercel production URL (e.g., `https://your-project-name.vercel.app`).
    *   **For the Public Gift Tracking Page**: You will need a build-step process to inject your public Firebase variables into the `public/gift-tracking-site/index.html` file. This can be done with a script using `sed` or `replace-in-file` that runs before your `next build` command.
4.  **Deploy:** Vercel will automatically detect Next.js settings and deploy your application. Subsequent pushes to your main branch will trigger redeployments.

## Key Functionalities

### Customer Experience
*   **Product Discovery:** Browse a catalog of giftable items and pre-designed gift boxes.
*   **Customization:** Personalize items with text, images, color choices, etc.
*   **Secure Checkout:** Multi-step checkout process including shipping details, gift options, and payment.
*   **Order Tracking:** Real-time updates on order status and delivery.
*   **Push Notifications:** Customers can opt-in to receive push notifications for important order status changes.
*   **Gift Options:** Send orders as gifts, with options to notify the recipient and hide prices.

### Admin & Staff Operations
*   **User Roles & Permissions:** Different user roles (Admin, Technician, Rider, etc.) have access to relevant modules.
*   **Product Management:** Admins can add, edit, and manage product listings and customization options.
*   **Order Processing:** Admins and Service Managers can view and update order statuses.
*   **Task Management:** Technicians receive tasks for customization (e.g., engraving, printing).
*   **Dispatch Management:** Dispatch Managers can view orders on a map, assign riders, and monitor deliveries.
*   **Financial Overview:** Finance Managers (and Admins) can view payment records and financial summaries.
*   **Inventory Control:** Inventory Managers (and Admins) can manage stock levels and request new stock.
*   **Supplier Interaction:** Suppliers can fulfill stock requests and submit invoices.

## Application Structure Overview

*   **`src/app/(app)/`**: Contains the main application routes and pages accessible after login.
*   **`src/app/api/`**: API routes for server-side logic like push notification subscriptions.
*   **`src/app/login/`**: Login page.
*   **`src/components/`**: Reusable UI components.
*   **`src/contexts/`**: React Context providers.
*   **`src/hooks/`**: Custom React hooks.
*   **`src/lib/`**: Utility functions and Firebase initialization.
*   **`src/ai/`**: Genkit flows and configuration.
*   **`public/`**: Static assets like icons, manifest.json, and the service worker (sw.js).

## Relational Database Schema (Example)

For developers who prefer a relational database like PostgreSQL or MySQL, here is an example SQL schema that reflects the application's data structure. This schema uses `JSON` types for flexible fields like customizations, which is a good compromise between relational and document-based models.

```sql
-- Users table stores all user types, from customers to staff and admins
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY, -- Corresponds to Firebase Auth UID
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    county VARCHAR(100),
    town VARCHAR(100),
    photo_url TEXT,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Customer', 'Engraving', 'Printing', 'Assembly', 'Quality Check', 'Packaging', 'Rider', 'Supplier', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager')),
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- pending, approved, rejected
    rejection_reason TEXT,
    disabled BOOLEAN DEFAULT FALSE NOT NULL,
    disabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Products table for all sellable items
CREATE TABLE products (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    supplier_price DECIMAL(10, 2), -- Cost price
    stock INT NOT NULL DEFAULT 0,
    published BOOLEAN DEFAULT TRUE NOT NULL,
    image_url TEXT,
    categories TEXT[], -- Using an array type for PostgreSQL
    supplier_info TEXT, -- Simplified supplier info
    customization_group_id VARCHAR(255) REFERENCES customization_groups(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ
);

-- Customization groups for reusable sets of options
CREATE TABLE customization_groups (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    options JSONB, -- Store the array of option definitions as JSON
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ
);

-- Orders table to track customer purchases
CREATE TABLE orders (
    id VARCHAR(255) PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL REFERENCES users(id),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    total_amount DECIMAL(10, 2) NOT NULL,
    sub_total DECIMAL(10, 2) NOT NULL,
    shipping_cost DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    shipping_address JSONB, -- Store shipping address object
    shipping_method_id VARCHAR(255) REFERENCES shipping_methods(id),
    rider_id VARCHAR(255) REFERENCES users(id),
    delivery_history JSONB, -- Array of history entries
    is_gift BOOLEAN DEFAULT FALSE NOT NULL,
    gift_details JSONB, -- Store gift recipient details
    rating JSONB, -- Store rating value, comment, etc.
    is_bulk_order BOOLEAN DEFAULT FALSE NOT NULL,
    bulk_order_request_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ
);

-- Order items, linking products to orders
CREATE TABLE order_items (
    id VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL REFERENCES products(id),
    product_name VARCHAR(255),
    quantity INT NOT NULL,
    price_per_unit DECIMAL(10, 2) NOT NULL, -- The price at the time of sale
    customizations JSONB -- Store selected customizations as a JSON object
);

-- Tasks for production workflow
CREATE TABLE tasks (
    id VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES orders(id),
    task_type VARCHAR(50) NOT NULL,
    description TEXT,
    assignee_id VARCHAR(255) REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    proof_of_work_url TEXT,
    service_manager_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ
);

-- Shipping regions and methods
CREATE TABLE shipping_regions (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    county VARCHAR(255),
    towns TEXT[] NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE shipping_methods (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration VARCHAR(100),
    base_price DECIMAL(10, 2) NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL
);

-- Shipping rates link regions and methods with specific prices
CREATE TABLE shipping_rates (
    id VARCHAR(255) PRIMARY KEY,
    region_id VARCHAR(255) NOT NULL REFERENCES shipping_regions(id),
    method_id VARCHAR(255) NOT NULL REFERENCES shipping_methods(id),
    custom_price DECIMAL(10, 2) NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    UNIQUE (region_id, method_id)
);

-- Stock management
CREATE TABLE stock_requests (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL REFERENCES products(id),
    requester_id VARCHAR(255) NOT NULL REFERENCES users(id),
    requested_quantity INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    bids JSONB, -- Array of bid objects from suppliers
    winning_bid_id VARCHAR(255),
    supplier_id VARCHAR(255) REFERENCES users(id),
    supplier_price DECIMAL(10, 2),
    fulfilled_quantity INT,
    received_quantity INT,
    invoice_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ
);

-- Invoices from suppliers
CREATE TABLE invoices (
    id VARCHAR(255) PRIMARY KEY,
    invoice_number VARCHAR(255) UNIQUE NOT NULL,
    supplier_id VARCHAR(255) NOT NULL REFERENCES users(id),
    stock_request_id VARCHAR(255) REFERENCES stock_requests(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    items JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ
);

-- Feedback and support threads
CREATE TABLE feedback_threads (
    id VARCHAR(255) PRIMARY KEY,
    subject TEXT,
    sender_id VARCHAR(255) NOT NULL REFERENCES users(id),
    target_role VARCHAR(50),
    target_user_id VARCHAR(255) REFERENCES users(id),
    status VARCHAR(50),
    last_message_snippet TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ
);

CREATE TABLE feedback_messages (
    id VARCHAR(255) PRIMARY KEY,
    thread_id VARCHAR(255) NOT NULL REFERENCES feedback_threads(id) ON DELETE CASCADE,
    sender_id VARCHAR(255) NOT NULL REFERENCES users(id),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Push notification subscriptions
CREATE TABLE push_subscriptions (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    subscription_details JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

## Future Considerations (Potential Enhancements)

*   Trigger push notifications automatically from the backend when an order status changes (e.g., using Firebase Functions).
*   More sophisticated email templates.
*   Advanced reporting and analytics.
*   Integration with actual payment gateways (e.g., Stripe, PayPal, or local Kenyan gateways).
*   Enhanced PWA features (offline caching strategies, background sync).
