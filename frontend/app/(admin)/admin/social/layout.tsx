'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export default function Layout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <div><div style={{display:'flex',gap:8,padding:8,background:'white'}}><Link href="/admin/social">Overview</Link><Link href="/admin/social/analytics">Analytics</Link></div>{children}</div>;
}
