
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

5.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application should now be running on `http://localhost:9002`.

6.  **Run the Genkit development server (for AI flows):**
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

## Future Considerations (Potential Enhancements)

*   Trigger push notifications automatically from the backend when an order status changes (e.g., using Firebase Functions).
*   More sophisticated email templates.
*   Advanced reporting and analytics.
*   Integration with actual payment gateways (e.g., Stripe, PayPal, or local Kenyan gateways).
*   Enhanced PWA features (offline caching strategies, background sync).
