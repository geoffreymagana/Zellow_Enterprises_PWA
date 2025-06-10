
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
*   **PWA:** Enabled for Customer and Staff portals for an app-like experience.

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

3.  **Set up Firebase:**
    *   Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
    *   Enable Firestore, Firebase Authentication (Email/Password), and Firebase Storage.
    *   Obtain your Firebase project configuration (API key, authDomain, etc.).
    *   Create a `.env.local` file in the root of your project and add your Firebase configuration keys. Example:
        ```env
        # Firebase Client-Side Configuration
        NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
        NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID # Optional, for Analytics

        # Genkit (AI Features) - Server-Side
        GEMINI_API_KEY=YOUR_GEMINI_API_KEY

        # Email Notifications (SMTP) - Server-Side
        SMTP_HOST=smtp.gmail.com
        SMTP_PORT=587
        SMTP_SECURE=false # For STARTTLS on port 587
        SMTP_USER=your-gmail-username@gmail.com
        SMTP_PASS=your-gmail-app-password # Use an App Password for Gmail
        SMTP_FROM_EMAIL=noreply@yourdomain.com # Gmail might override this
        SMTP_FROM_NAME="Zellow Notifications"

        # Mapbox Token (Client-Side)
        NEXT_PUBLIC_MAPBOX_TOKEN=YOUR_MAPBOX_ACCESS_TOKEN
        
        # Cloudinary (if used for image uploads during customization)
        NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
        NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=YOUR_CLOUDINARY_UPLOAD_PRESET

        # Site URL - Crucial for links in emails/notifications
        # For local development:
        NEXT_PUBLIC_SITE_URL=http://localhost:9002
        # For Vercel/Production deployment, update this to your actual deployed URL on Vercel, e.g.:
        # NEXT_PUBLIC_SITE_URL=https://your-zellowlive-project.vercel.app 
        ```
    *   **Note:** For `SMTP_PASS` with Gmail, you'll need to generate an "App Password" if you have 2-Step Verification enabled on your Google account.

4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
    The application should now be running on `http://localhost:9002` (or your configured port).

5.  **Run the Genkit development server (for AI flows):**
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
5.  The `apphosting.yaml` file is for Firebase App Hosting and is not used by Vercel.

## Key Functionalities

### Customer Experience
*   **Product Discovery:** Browse a catalog of giftable items and pre-designed gift boxes.
*   **Customization:** Personalize items with text, images, color choices, etc.
*   **Secure Checkout:** Multi-step checkout process including shipping details, gift options, and payment.
*   **Order Tracking:** Real-time updates on order status and delivery.
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
    *   **`admin/`**: Admin-specific dashboards and management pages.
    *   **`checkout/`**: Customer checkout flow.
    *   **`products/`**: Product listing and detail pages.
    *   **`orders/`**: Customer order history and cart.
    *   **`dashboard/`**: Role-based dashboards for staff.
    *   ...and other role-specific pages like `deliveries/`, `tasks/`, `inventory/`, `finance/`, `supplier/`.
*   **`src/app/login/`**: Login page.
*   **`src/components/`**: Reusable UI components (auth, common, navigation, ui, charts).
*   **`src/contexts/`**: React Context providers (AuthContext, CartContext).
*   **`src/hooks/`**: Custom React hooks.
*   **`src/lib/`**: Utility functions and Firebase initialization.
*   **`src/ai/`**: Genkit flows and configuration.
*   **`public/`**: Static assets like icons and manifest.json.

## Future Considerations (Potential Enhancements)

*   More sophisticated email templates.
*   Advanced reporting and analytics.
*   Direct image uploads to Firebase Storage instead of URL pasting for product images (or better Cloudinary integration for product image management by admin).
*   Integration with actual payment gateways (e.g., Stripe, PayPal, or local Kenyan gateways).
*   Push notifications for real-time updates.
*   Enhanced PWA features (offline caching strategies, background sync).

    