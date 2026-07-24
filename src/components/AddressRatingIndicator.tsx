'use client';

import React from 'react';

export interface AddressRatingIndicatorProps {
  address: string;
  mode?: 'dashboard' | 'print';
  style?: React.CSSProperties;
  showCharCount?: boolean;
}

export const AddressRatingIndicator = ({ 
  address, 
  mode = 'dashboard', 
  style,
  showCharCount = false 
}: AddressRatingIndicatorProps) => {
  const len = (address || '').trim().length;

  let label = 'Good';
  let color = '#10B981'; // green
  let bgColor = 'rgba(16, 185, 129, 0.08)';
  let borderColor = 'rgba(16, 185, 129, 0.15)';
  let ratingText = 'Good Address';

  if (len < 15) {
    label = 'Poor';
    color = '#EF4444'; // red
    bgColor = 'rgba(239, 68, 68, 0.08)';
    borderColor = 'rgba(239, 68, 68, 0.15)';
    ratingText = 'Too Short (Critical NDR Risk)';
  } else if (len < 30) {
    label = 'Fair';
    color = '#F59E0B'; // orange/yellow
    bgColor = 'rgba(245, 158, 11, 0.08)';
    borderColor = 'rgba(245, 158, 11, 0.15)';
    ratingText = 'Fair (Needs Landmark)';
  }

  if (mode === 'print') {
    return (
      <span 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          border: '1px solid #000000',
          padding: '1px 3px',
          borderRadius: '2px',
          fontSize: '7px',
          fontWeight: 'bold',
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textTransform: 'uppercase',
          marginLeft: '6px',
          ...style
        }}
        title={`${ratingText} (Length: ${len} chars)`}
      >
        ADR: {label}{showCharCount ? ` (${len} Chars)` : ''}
      </span>
    );
  }

  return (
    <span 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        color,
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        verticalAlign: 'middle',
        ...style
      }}
      title={`${ratingText} (Length: ${len} chars)`}
    >
      <span>📍</span>
      <span>{label}{showCharCount ? ` (${len} Chars)` : ''}</span>
    </span>
  );
};
