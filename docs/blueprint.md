# **App Name**: ZellowLive

## Core Features:

- Admin Dashboard: Admin dashboard with real-time data display for user management, dispatch approval, financial transactions, and report viewing.
- Customer Portal: PWA for customers to view products, customize items, place orders, and make payments.
- Staff Portal: PWA for staff to view assigned tasks, update statuses, upload proof, and receive real-time updates. Each staff role sees only the relevant modules based on Firebase Auth custom claims.
- Image Handling: Google Drive API integration for uploading product images via the admin dashboard and serving them via URL in both apps.
- Authentication: Firebase Authentication to authenticate users with email/password, and route them to screens appropriate for their user role.

## Style Guidelines:

- Primary color: HSL(195, 70%, 50%) which converts to #34A7C1. This color will create a calm yet modern feel.
- Background color: HSL(195, 20%, 95%) which converts to #F0F8FA. This provides a light and clean backdrop that enhances the visibility of the interface elements.
- Accent color: HSL(165, 50%, 40%) which converts to #33A67F. This color draws attention to important UI elements such as CTAs or status indicators.
- Headline font: 'Poppins', a geometric sans-serif that offers a contemporary and fashionable look. Body font: 'Inter', a grotesque sans-serif to create a neutral look.
- Responsive layout with a bottom tab navigation for the PWA and a sidebar for the Admin Dashboard. Consistent use of toasts, modals, and real-time status indicators to provide immediate feedback.