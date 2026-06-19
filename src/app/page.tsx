'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if the user is authenticated in localStorage session
    const storedUser = localStorage.getItem('99store_user');
    if (storedUser) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0A0A0A',
      color: '#FAFAFA',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        textAlign: 'center'
      }}>
        <h2 style={{ fontWeight: 400, letterSpacing: '0.05em', color: '#8A8A8A' }}>99STORE</h2>
        <p style={{ fontSize: '12px', marginTop: '8px', color: '#555' }}>Initializing secure terminal...</p>
      </div>
    </div>
  );
}
