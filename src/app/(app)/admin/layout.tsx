"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <>{children}</>;
} 