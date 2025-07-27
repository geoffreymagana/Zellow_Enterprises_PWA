"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { ReactNode } from 'react';

interface InventoryLayoutProps {
  children: ReactNode;
}

export default function InventoryLayout({ children }: InventoryLayoutProps) {
  return <>{children}</>;
} 