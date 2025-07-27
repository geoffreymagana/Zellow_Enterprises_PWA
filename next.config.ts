
import type {NextConfig} from 'next';
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  sw: 'sw.js', 
  fallbacks: {
    document: "/offline",
    // Add fallbacks for other content types as needed.
    // data: "/offline.json", // Example for data fallbacks
    // image: "/static/images/fallback.png",
    // font: "/static/fonts/fallback.woff2",
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable static generation for problematic routes
  experimental: {
    // Force dynamic rendering for routes with client-side auth
    serverComponentsExternalPackages: ['firebase', 'firebase-admin'],
  },
  webpack: (config, { isServer }) => {
    // Ignore handlebars require.extensions warning for genkit
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    
    // Suppress specific warnings
    config.ignoreWarnings = [
      /require\.extensions/,
      /handlebars/,
    ];
    
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imgur.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com', 
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'photos.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com', // Added for Cloudinary
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com', // Added for Firebase Storage
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default withPWA(nextConfig);
