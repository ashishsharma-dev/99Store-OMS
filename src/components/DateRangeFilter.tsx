import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

export interface DateRange {
  startDate: string;
  endDate: string;
  preset: string; // 'today' | 'this_week' | 'last_30_days' | 'custom' | 'all'
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export const DateRangeFilter = ({ value, onChange }: DateRangeFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update temp inputs when value changes or dropdown opens
  useEffect(() => {
    if (value.preset === 'custom') {
      setTempStart(value.startDate.substring(0, 10));
      setTempEnd(value.endDate.substring(0, 10));
    } else {
      setTempStart('');
      setTempEnd('');
    }
  }, [value, isOpen]);

  const calculatePresetRange = (preset: string): { startDate: string; endDate: string } => {
    const today = new Date();
    
    switch (preset) {
      case 'today': {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'this_week': {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday (0) to get Monday (1)
        const monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { startDate: monday.toISOString(), endDate: end.toISOString() };
      }
      case 'last_30_days': {
        const start = new Date();
        start.setDate(today.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'all':
      default:
        return { startDate: '', endDate: '' };
    }
  };

  const handlePresetClick = (preset: string) => {
    if (preset === 'custom') {
      return;
    }
    const range = calculatePresetRange(preset);
    onChange({
      preset,
      startDate: range.startDate,
      endDate: range.endDate
    });
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (!tempStart || !tempEnd) return;
    
    const start = new Date(tempStart);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(tempEnd);
    end.setHours(23, 59, 59, 999);

    onChange({
      preset: 'custom',
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
    setIsOpen(false);
  };

  const getLabel = () => {
    if (value.preset === 'today') return 'Today';
    if (value.preset === 'this_week') return 'This Week';
    if (value.preset === 'last_30_days') return 'Last 30 Days';
    if (value.preset === 'all') return 'All Time';
    if (value.preset === 'custom' && value.startDate && value.endDate) {
      const startStr = new Date(value.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const endStr = new Date(value.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    return 'Select Date Range';
  };

  const presets = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'this_week', label: 'This Week' },
    { id: 'last_30_days', label: 'Last 30 Days' },
    { id: 'custom', label: 'Custom Range' }
  ];

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="premium-btn premium-btn-secondary"
        style={{
          padding: '8px 14px',
          fontSize: '13.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: isOpen ? '#1A1A1A' : 'transparent',
          borderColor: isOpen ? '#444444' : '#222222',
        }}
      >
        <Calendar size={14} style={{ color: '#8A8A8A' }} />
        <span>{getLabel()}</span>
        <ChevronDown size={14} style={{ color: '#8A8A8A', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            backgroundColor: '#161618',
            border: '1px solid #2D2D30',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            minWidth: '380px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Presets Column */}
          <div
            style={{
              width: '150px',
              borderRight: '1px solid #2D2D30',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            {presets.map((preset) => {
              const isActive = value.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    if (preset.id === 'custom') {
                      onChange({ ...value, preset: 'custom' });
                    } else {
                      handlePresetClick(preset.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: isActive ? '#222222' : 'transparent',
                    color: isActive ? '#FAFAFA' : '#8A8A8A',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#1A1A1A';
                      e.currentTarget.style.color = '#FAFAFA';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#8A8A8A';
                    }
                  }}
                >
                  <span>{preset.label}</span>
                  {isActive && <Check size={12} style={{ color: '#FAFAFA' }} />}
                </button>
              );
            })}
          </div>

          {/* Custom Date Picker Column */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#131315',
              borderTopRightRadius: '8px',
              borderBottomRightRadius: '8px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Custom Range
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: '#8A8A8A' }}>Start Date</label>
              <input
                type="date"
                value={tempStart}
                onChange={(e) => setTempStart(e.target.value)}
                className="premium-input"
                style={{
                  padding: '6px 10px',
                  fontSize: '13px',
                  colorScheme: 'dark',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: '#8A8A8A' }}>End Date</label>
              <input
                type="date"
                value={tempEnd}
                onChange={(e) => setTempEnd(e.target.value)}
                className="premium-input"
                style={{
                  padding: '6px 10px',
                  fontSize: '13px',
                  colorScheme: 'dark',
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleApplyCustom}
              disabled={!tempStart || !tempEnd || tempStart > tempEnd}
              className="premium-btn premium-btn-primary"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '13px',
                marginTop: '4px',
                opacity: (!tempStart || !tempEnd || tempStart > tempEnd) ? 0.5 : 1,
                cursor: (!tempStart || !tempEnd || tempStart > tempEnd) ? 'not-allowed' : 'pointer'
              }}
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
