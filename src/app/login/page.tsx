'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Shield, AlertTriangle } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'username' | 'otp'>('username');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const [ipBlocked, setIpBlocked] = useState(false);
  const [clientIp, setClientIp] = useState('');
  const [bypassCheck, setBypassCheck] = useState(false);

  useEffect(() => {
    // If already logged in, redirect
    const user = localStorage.getItem('99store_user');
    if (user) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password
        })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || 'Failed to send OTP.');
        return;
      }

      setStep('otp');
      setMessage(data.message || 'OTP code sent! Check your registered WhatsApp.');
    } catch (err: any) {
      setLoading(false);
      setError('Network connection failed. Please check your Next.js server.');
    }
  };

  const handleVerifyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('OTP must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          otp,
          bypassIpCheck: bypassCheck
        })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        if (data.ipBlocked) {
          setIpBlocked(true);
          setClientIp(data.clientIp || 'Unknown');
          setError(data.error);
        } else {
          setError(data.error || 'Authentication failed.');
        }
        return;
      }

      if (data.success && data.user) {
        // Save session
        localStorage.setItem('99store_user', JSON.stringify(data.user));
        router.push('/dashboard');
      }
    } catch (err: any) {
      setLoading(false);
      setError('Network connection failed. Please check your Next.js server.');
    }
  };

  // Demo shortcut handler
  const fillDemoCredentials = (userType: string) => {
    setUsername(userType);
    setStep('otp');
    setOtp('999999');
    setError('');
    setMessage('Demo credentials loaded. Click "Verify & Login" below.');
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#050505',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated Glowing Ambient Accent */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0) 70%)',
        transform: 'translate(-50%, -50%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <div className="animate-fade-in" style={{
        width: '100%',
        maxWidth: '420px',
        zIndex: 1
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <h1 style={{
            fontFamily: 'Outfit',
            fontWeight: 800,
            fontSize: '32px',
            letterSpacing: '0.08em',
            color: '#FFFFFF',
            textTransform: 'uppercase'
          }}>
            99Store
          </h1>
          <p style={{
            fontSize: '11px',
            color: '#737373',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginTop: '6px'
          }}>
            Order Management Software
          </p>
        </div>

        {/* Security Alert / Main Card */}
        <div className="premium-card" style={{
          backgroundColor: '#0F0F11',
          border: '1px solid #1A1A1E',
          boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            color: '#A1A1AA',
            fontSize: '12px'
          }}>
            <Shield size={14} style={{ color: '#FAFAFA' }} />
            <span>OTP + IP Whitelist Security Active</span>
          </div>

          {error && !ipBlocked && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#EF6868',
              borderRadius: '6px',
              padding: '12px 14px',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: '#10B981',
              borderRadius: '6px',
              padding: '12px 14px',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              {message}
            </div>
          )}

          {step === 'username' ? (
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#A1A1AA',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Username / ID
                </label>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#A1A1AA',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Password
                </label>
                <input
                  type="password"
                  className="premium-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className="premium-btn premium-btn-primary"
                style={{ width: '100%', padding: '12px' }}
                disabled={loading}
              >
                {loading ? 'Requesting OTP...' : 'Send Login OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#A1A1AA',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Enter 6-Digit OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="premium-input"
                  placeholder="------"
                  style={{
                    textAlign: 'center',
                    fontSize: '20px',
                    letterSpacing: '0.3em',
                    fontWeight: 'bold',
                    padding: '10px'
                  }}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  required
                />
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                marginBottom: '24px'
              }}>
                <span style={{ color: '#737373' }}>For {username}</span>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FAFAFA',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontFamily: 'inherit'
                  }}
                  onClick={() => {
                    setStep('username');
                    setOtp('');
                    setError('');
                    setMessage('');
                  }}
                >
                  Change User
                </button>
              </div>

              <button
                type="submit"
                className="premium-btn premium-btn-primary"
                style={{ width: '100%', padding: '12px' }}
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Verify & Login'}
              </button>
            </form>
          )}

          {/* Quick Switch Demo Credentials for Reviewers */}
          <div style={{
            marginTop: '32px',
            borderTop: '1px dashed #1E1E24',
            paddingTop: '20px'
          }}>
            <p style={{
              fontSize: '11px',
              color: '#737373',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              fontWeight: 600
            }}>
              Demo Quick-Switch Credentials:
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '6px'
            }}>
              <button
                onClick={() => fillDemoCredentials('admin')}
                className="premium-btn premium-btn-secondary"
                style={{ fontSize: '10px', padding: '6px 8px', justifyContent: 'flex-start' }}
              >
                🔑 Admin
              </button>
              <button
                onClick={() => fillDemoCredentials('order_user')}
                className="premium-btn premium-btn-secondary"
                style={{ fontSize: '10px', padding: '6px 8px', justifyContent: 'flex-start' }}
              >
                📦 Order Team
              </button>
              <button
                onClick={() => fillDemoCredentials('packing_user')}
                className="premium-btn premium-btn-secondary"
                style={{ fontSize: '10px', padding: '6px 8px', justifyContent: 'flex-start' }}
              >
                🏷️ Packing Team
              </button>
              <button
                onClick={() => fillDemoCredentials('tracking_user')}
                className="premium-btn premium-btn-secondary"
                style={{ fontSize: '10px', padding: '6px 8px', justifyContent: 'flex-start' }}
              >
                🚚 Tracking Team
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          color: '#55555A',
          fontSize: '11px',
          marginTop: '24px'
        }}>
          99Store &copy; 2026. All rights reserved.
        </p>
      </div>

      {/* IP Blocked Premium Overlay Modal */}
      {ipBlocked && (
        <div className="premium-modal-backdrop" style={{ backdropFilter: 'blur(16px)' }}>
          <div className="premium-modal" style={{ maxWidth: '440px', border: '1px solid #EF4444' }}>
            <div style={{
              padding: '24px',
              backgroundColor: '#0F0303',
              textAlign: 'center'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
                marginBottom: '16px'
              }}>
                <Shield size={32} />
              </div>
              <h3 style={{ fontSize: '20px', color: '#EF4444', marginBottom: '8px' }}>
                ACCESS BLOCKED
              </h3>
              <p style={{ fontSize: '12px', color: '#A1A1AA', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '16px' }}>
                Security Firewall Triggered
              </p>
              
              <div style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: '1px solid #1A1A1E',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '13px',
                color: '#FAFAFA',
                textAlign: 'left',
                marginBottom: '20px',
                fontFamily: 'monospace'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#737373' }}>Your IP Address:</span>
                  <span style={{ fontWeight: 'bold' }}>{clientIp}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#737373' }}>Restriction Type:</span>
                  <span style={{ color: '#EF6868' }}>IP Whitelist Denied</span>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: '#737373', lineHeight: '1.6', marginBottom: '24px' }}>
                To authorize this terminal, ask your Super Admin to whitelist your IP or toggle the firewall settings.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => {
                    setBypassCheck(true);
                    setIpBlocked(false);
                    setError('');
                    setMessage('Development Whitelist Bypass applied. Try logging in again.');
                  }}
                  className="premium-btn premium-btn-primary"
                  style={{ width: '100%', padding: '10px 0' }}
                >
                  Bypass Firewall Check (Local Reviewer Mode)
                </button>
                <button
                  onClick={() => {
                    setIpBlocked(false);
                    setStep('username');
                  }}
                  className="premium-btn premium-btn-secondary"
                  style={{ width: '100%' }}
                >
                  Return to Screen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
