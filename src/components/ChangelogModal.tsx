'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  CreditCard,
  FileSpreadsheet,
  Tag,
  Calendar,
  Truck,
  MessageSquare,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { SHOW_FULL_CLIENT_RELEASE } from '@/lib/utils';

const RELEASE_VERSION = 'v2.5';
const STORAGE_KEY_PREFIX = `99store_oms_changelog_seen_${RELEASE_VERSION}`;

interface ChangelogItem {
  category: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  accentColor: string;
  accentBg: string;
}

const RELEASE_HIGHLIGHTS: ChangelogItem[] = [
  {
    category: 'New Module',
    title: 'Accounts & Payment Settlements',
    description:
      'Dedicated Accounts & Payments workspace with COD settlement tracking, Paid badges, and inline payment settlement controls across orders.',
    icon: CreditCard,
    accentColor: '#10B981',
    accentBg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    category: 'New Module',
    title: 'Reports & Full-Scale Analytics',
    description:
      'Unlocked Reports & Performance dashboards with courier metrics, team productivity breakdowns, and full-database order counts with no 1,000-order cap.',
    icon: FileSpreadsheet,
    accentColor: '#3B82F6',
    accentBg: 'rgba(59, 130, 246, 0.12)',
  },
  {
    category: 'Operations',
    title: 'Label Print & Booking Status Filters',
    description:
      'Track Printed/Unprinted labels and Booked/Not Booked shipments directly across Orders, Packing, Shipments, and Tracking — plus Created By & Settlement filters.',
    icon: Tag,
    accentColor: '#F59E0B',
    accentBg: 'rgba(245, 158, 11, 0.12)',
  },
  {
    category: 'Navigation',
    title: 'Day-Wise Date Picker & Quick Stepping',
    description:
      'Jump between individual days with one-click Previous/Next Day controls, Yesterday preset, and a dedicated Single-Day filter across all operational tables.',
    icon: Calendar,
    accentColor: '#60A5FA',
    accentBg: 'rgba(96, 165, 250, 0.12)',
  },
  {
    category: 'Couriers',
    title: 'Velocity Live & 200gm Default Weight',
    description:
      'Velocity multi-courier serviceability and live booking are active with your Agra pickup warehouse, alongside a standardized 200gm default parcel weight across all 5 couriers.',
    icon: Truck,
    accentColor: '#34D399',
    accentBg: 'rgba(52, 211, 153, 0.12)',
  },
  {
    category: 'Messaging & Auth',
    title: 'Approved WhatsApp Templates & Email OTP',
    description:
      'All 7 Meta-approved WhatsApp lifecycle templates (Order Confirmation, Dispatch, OFD, Delivered, NDR, RDC, Login OTP) are live alongside Resend Email OTP delivery.',
    icon: MessageSquare,
    accentColor: '#A78BFA',
    accentBg: 'rgba(167, 139, 250, 0.12)',
  },
];

interface ChangelogModalProps {
  username?: string;
}

export function ChangelogModal({ username }: ChangelogModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}_${(username || 'user').toLowerCase()}`;

  useEffect(() => {
    if (!SHOW_FULL_CLIENT_RELEASE) return;
    if (typeof window === 'undefined') return;
    try {
      const alreadySeen = window.localStorage.getItem(storageKey);
      if (!alreadySeen) {
        setIsOpen(true);
      }
    } catch {
      // If localStorage is restricted, avoid repeatedly blocking the user
    }
  }, [storageKey]);

  const handleClose = () => {
    try {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // Ignore storage errors
    }
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oms-changelog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'rgba(5, 5, 7, 0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="oms-changelog-card"
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#111114',
          border: '1px solid #26262C',
          borderRadius: '14px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px 20px',
            borderBottom: '1px solid #222227',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: '#141418',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34D399',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              <CheckCircle2 size={13} />
              Release {RELEASE_VERSION} · Major Platform Update
            </div>
            <h2
              id="oms-changelog-title"
              style={{
                margin: 0,
                fontSize: '21px',
                fontWeight: 700,
                color: '#FAFAFA',
                letterSpacing: '-0.02em',
              }}
            >
              What&apos;s New in 99Store OMS
            </h2>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '13.5px',
                color: '#A1A1AA',
                lineHeight: 1.5,
              }}
            >
              The full Phase 2 release is now live across your workspace. Here is a summary of the new modules and workflow upgrades now available.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close release notes"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: '1px solid #2A2A32',
              backgroundColor: '#1A1A20',
              color: '#A1A1AA',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '22px 28px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          <div className="oms-changelog-grid">
            {RELEASE_HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: '#17171C',
                    border: '1px solid #24242B',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: item.accentBg,
                        color: item.accentColor,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={17} />
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: '#71717A',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#1F1F26',
                      }}
                    >
                      {item.category}
                    </span>
                  </div>

                  <div>
                    <h3
                      style={{
                        margin: '0 0 5px',
                        fontSize: '14px',
                        fontWeight: 650,
                        color: '#F4F4F5',
                        lineHeight: 1.35,
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12.5px',
                        color: '#A1A1AA',
                        lineHeight: 1.55,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #222227',
            backgroundColor: '#141418',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#71717A' }}>
            This summary is shown once per user and won&apos;t reappear after closing.
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="premium-btn premium-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Continue to Dashboard
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .oms-changelog-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 680px) {
          .oms-changelog-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
