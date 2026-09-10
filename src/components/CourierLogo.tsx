import React from 'react';

interface CourierLogoProps {
  courier?: string;
  showName?: boolean;
  size?: number;
}

export function CourierLogo({ courier = '', showName = true, size = 18 }: CourierLogoProps) {
  const name = courier.trim();
  const lower = name.toLowerCase();

  let logoSrc = '';
  let displayName = name;

  if (lower.includes('dtdc')) {
    logoSrc = '/dtdc.webp';
    displayName = 'DTDC';
  } else if (lower.includes('xpressbees') || lower.includes('xbees')) {
    logoSrc = '/xpressbees.png';
    displayName = name;
  } else if (lower.includes('delhivery')) {
    logoSrc = '/delhivery.webp';
    displayName = 'Delhivery';
  } else if (lower.includes('shadowfax') || lower.includes('sfx')) {
    displayName = 'Shadowfax';
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', verticalAlign: 'middle' }}>
        <span 
          style={{ 
            backgroundColor: '#FF6B00', 
            color: '#FFFFFF', 
            fontSize: `${Math.max(10, size - 4)}px`, 
            fontWeight: 700, 
            padding: '3px 8px', 
            borderRadius: '4px',
            letterSpacing: '0.5px'
          }}
        >
          SFX
        </span>
        {showName && <span style={{ fontWeight: 500 }}>Shadowfax</span>}
      </div>
    );
  } else if (lower.includes('velocity') || lower.includes('vel')) {
    displayName = 'Velocity';
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', verticalAlign: 'middle' }}>
        <span 
          style={{ 
            backgroundColor: '#6366F1', 
            color: '#FFFFFF', 
            fontSize: `${Math.max(10, size - 4)}px`, 
            fontWeight: 700, 
            padding: '3px 8px', 
            borderRadius: '4px',
            letterSpacing: '0.5px'
          }}
        >
          VEL
        </span>
        {showName && <span style={{ fontWeight: 500 }}>Velocity</span>}
      </div>
    );
  }

  if (!logoSrc) {
    return <span style={{ fontWeight: 500 }}>{displayName || 'Unassigned'}</span>;
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', verticalAlign: 'middle' }}>
      <div 
        style={{ 
          width: `${size + 12}px`, 
          height: `${size + 12}px`, 
          borderRadius: '4px', 
          backgroundColor: '#FFFFFF', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '0px',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          flexShrink: 0
        }}
      >
        <img
          src={logoSrc}
          alt={`${displayName} logo`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block'
          }}
        />
      </div>
      {showName && <span style={{ fontWeight: 500 }}>{displayName}</span>}
    </div>
  );
}
