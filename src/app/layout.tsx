import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '99Store Order Management System (OMS)',
  description: 'Premium Minimalist Order Management & Fulfillment Software for 99Store.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
