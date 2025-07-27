"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { ReactNode } from 'react';

interface FinanceLayoutProps {
  children: ReactNode;
}

export default function FinanceLayout({ children }: FinanceLayoutProps) {
  return <>{children}</>;
} 