
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext'; // Import CartProvider
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'Zellow Enterprises',
  description: 'Zellow Enterprises for Customers and Staff',
  manifest: '/manifest.json',
  icons: {
    apple: "/icons/Zellow-icon-192.png", // Basic apple touch icon
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Zellow" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Zellow" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#34A7C1" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#34A7C1" />

        <link rel="manifest" href="/manifest.json" crossOrigin="anonymous" />
        
        {/* More specific apple touch icons (optional, but good practice) */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" /> */}
        {/* <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" /> */}
        {/* <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-167x167.png" /> */}

      </head>
      <body className="font-body antialiased" suppressHydrationWarning={true}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <CartProvider> {/* Wrap with CartProvider */}
              {children}
              <Toaster />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
