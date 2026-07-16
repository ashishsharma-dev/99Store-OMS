'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface TrackingHistoryItem {
  status: string;
  timestamp: string;
  remarks: string;
}

interface OrderTrackingData {
  orderId: string;
  customerName: string;
  status: string;
  courier?: string;
  awb?: string;
  eta?: string;
  createdAt: string;
  updatedAt: string;
  history: TrackingHistoryItem[];
}

function TrackingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Try 'id' first, then fall back to 'awb' or 'order'
  const trackingId = searchParams.get('id') || searchParams.get('awb') || searchParams.get('order') || '';
  
  const [searchVal, setSearchVal] = useState(trackingId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trackingData, setTrackingData] = useState<OrderTrackingData | null>(null);

  const fetchTracking = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError('');
    setTrackingData(null);
    try {
      const res = await fetch(`/api/track?id=${encodeURIComponent(id.trim())}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTrackingData(data.order);
      } else {
        setError(data.error || 'Failed to fetch tracking details. Please verify your ID.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trackingId) {
      setSearchVal(trackingId);
      fetchTracking(trackingId);
    }
  }, [trackingId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchVal.trim()) return;
    // Update the URL to trigger the useEffect
    router.push(`/track?id=${encodeURIComponent(searchVal.trim())}`);
  };

  // Helper: Format date string
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper: Get status step index
  const getStepIndex = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('delivered')) return 4;
    if (s.includes('ofd') || s.includes('out for delivery')) return 3;
    if (s.includes('dispatched') || s.includes('shipped') || s.includes('in transit')) return 2;
    if (s.includes('packing') || s.includes('label generated') || s.includes('manifested')) return 1;
    return 0; // Created
  };

  const currentStep = trackingData ? getStepIndex(trackingData.status) : 0;
  const steps = [
    { label: 'Ordered', desc: 'Order Placed' },
    { label: 'Packed', desc: 'Ready for Shipment' },
    { label: 'Dispatched', desc: 'Handed over to courier' },
    { label: 'Out for Delivery', desc: 'Out for delivery' },
    { label: 'Delivered', desc: 'Successfully delivered' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #141414 0%, #080808 100%)',
      color: '#FAFAFA',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {/* Brand header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }} onClick={() => router.push('/')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
          <img src="/99-logo.png" alt="99Store Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, margin: 0, letterSpacing: '0.05em' }}>99STORE</h1>
            <span style={{ fontSize: '10px', color: '#888', display: 'block', fontWeight: 600, letterSpacing: '0.1em' }}>HEALTH & WELLNESS</span>
          </div>
        </div>
      </div>

      {/* Tracker search card */}
      <div style={{
        width: '100%',
        maxWidth: '650px',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', textAlign: 'center' }}>Track Your Order</h2>
        <p style={{ fontSize: '12px', color: '#8A8A8A', margin: '0 0 20px 0', textAlign: 'center' }}>
          Enter your Order ID (e.g. 99S-1001) or AWB Tracking Number.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="e.g. 99S-1001 or DTDC901238912"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#FFF',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#E53E3E',
              color: '#FFF',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              padding: '0 24px',
              fontSize: '14px',
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: 'rgba(229, 62, 62, 0.1)',
            border: '1px solid rgba(229, 62, 62, 0.2)',
            borderRadius: '8px',
            color: '#F56565',
            fontSize: '13px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#E53E3E',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ fontSize: '13px', color: '#888', marginTop: '12px' }}>Locating your shipment details...</span>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}} />
        </div>
      )}

      {/* Active Tracking Details */}
      {trackingData && (
        <div style={{
          width: '100%',
          maxWidth: '650px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Status Header Overview Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</span>
                <h3 style={{ fontSize: '18px', fontWeight: 850, margin: '2px 0 0 0' }}>{trackingData.orderId}</h3>
              </div>
              {trackingData.awb && (
                <div>
                  <span style={{ fontSize: '11px', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Courier & AWB</span>
                  <h3 style={{ fontSize: '18px', fontWeight: 850, margin: '2px 0 0 0' }}>
                    <span style={{ textTransform: 'uppercase', color: '#E53E3E', marginRight: '6px' }}>{trackingData.courier}</span>
                    {trackingData.awb}
                  </h3>
                </div>
              )}
              <div>
                <span style={{ fontSize: '11px', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Delivery</span>
                <h3 style={{ fontSize: '18px', fontWeight: 850, margin: '2px 0 0 0', color: '#48BB78' }}>
                  {trackingData.eta ? formatDateTime(trackingData.eta).split(',')[0] : 'In Transit'}
                </h3>
              </div>
            </div>

            {/* Stepper progress bar */}
            <div style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: '10px' }}>
                {/* Horizontal track line */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '20px',
                  right: '20px',
                  height: '4px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  zIndex: 0
                }} />
                
                {/* Filled progress line */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '20px',
                  width: `${(currentStep / (steps.length - 1)) * 90}%`,
                  height: '4px',
                  backgroundColor: '#E53E3E',
                  zIndex: 0,
                  transition: 'width 0.4s ease'
                }} />

                {steps.map((step, idx) => {
                  const isActive = idx <= currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1 }}>
                      {/* Stepper node circle */}
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: isCurrent ? '#E53E3E' : isActive ? '#E53E3E' : '#1F1F1F',
                        border: `2px solid ${isActive ? '#E53E3E' : 'rgba(255,255,255,0.1)'}`,
                        boxShadow: isCurrent ? '0 0 12px #E53E3E' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFF',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        transition: 'background-color 0.2s, border-color 0.2s'
                      }}>
                        {isActive ? '✓' : idx + 1}
                      </div>
                      
                      {/* Node labels */}
                      <span style={{
                        fontSize: '11px',
                        fontWeight: isCurrent ? 700 : 500,
                        color: isActive ? '#FFF' : '#666',
                        marginTop: '8px',
                        textAlign: 'center'
                      }}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detailed Transit History Log */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0' }}>Transit History</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '16px' }}>
              {/* Vertical timeline bar */}
              <div style={{
                position: 'absolute',
                top: '6px',
                bottom: '6px',
                left: '4px',
                width: '2px',
                backgroundColor: 'rgba(255,255,255,0.06)'
              }} />

              {trackingData.history.slice().reverse().map((item, index) => (
                <div key={index} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: '-16px',
                    top: '4px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: index === 0 ? '#E53E3E' : '#2A2A2A',
                    border: `2px solid ${index === 0 ? '#E53E3E' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: index === 0 ? '0 0 6px #E53E3E' : 'none',
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: index === 0 ? '#FFF' : '#BBB' }}>
                      {item.status}
                    </span>
                    <span style={{ fontSize: '11px', color: '#8A8A8A' }}>
                      {formatDateTime(item.timestamp)}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#8A8A8A', margin: 0 }}>
                    {item.remarks}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#080808',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8A8A8A',
        fontFamily: 'sans-serif'
      }}>
        Loading page content...
      </div>
    }>
      <TrackingContent />
    </Suspense>
  );
}
