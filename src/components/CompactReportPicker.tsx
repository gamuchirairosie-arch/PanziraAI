import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SignalReport } from '../types';

interface CompactReportPickerProps {
  signals: SignalReport[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const CompactReportPicker: React.FC<CompactReportPickerProps> = ({
  signals,
  selectedId,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'actionable' | 'verified' | 'rejected'>('actionable');
  const [channelFilter, setChannelFilter] = useState<'all' | 'web' | 'whatsapp' | 'ussd'>('all');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentSignal = useMemo(() => {
    return signals.find((s) => s.id === selectedId) || signals[0];
  }, [signals, selectedId]);

  // Click outside to dismiss
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Filter and sort signals: newest actionable leads first!
  const filteredSignals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return signals
      .filter((s) => {
        // Status filter
        if (statusFilter === 'actionable' && s.workflowStatus !== 'lead' && s.workflowStatus !== 'verifying') {
          return false;
        }
        if (statusFilter === 'verified' && s.workflowStatus !== 'verified') return false;
        if (statusFilter === 'rejected' && s.workflowStatus !== 'rejected') return false;

        // Channel filter
        const ch = (s.sourceChannelLabel || '').toLowerCase();
        if (channelFilter === 'web' && !ch.includes('web')) return false;
        if (channelFilter === 'whatsapp' && !ch.includes('whatsapp')) return false;
        if (channelFilter === 'ussd' && !ch.includes('ussd')) return false;

        // Search text
        if (!q) return true;
        return (
          s.id.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.roadArea.toLowerCase().includes(q) ||
          s.landmark.toLowerCase().includes(q) ||
          s.originalLanguage.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Priority 1: Actionable leads before verified/rejected
        const aActionable = a.workflowStatus === 'lead' || a.workflowStatus === 'verifying';
        const bActionable = b.workflowStatus === 'lead' || b.workflowStatus === 'verifying';
        if (aActionable && !bActionable) return -1;
        if (!aActionable && bActionable) return 1;
        // Priority 2: User submitted demo reports first
        if (a.isUserSubmitted && !b.isUserSubmitted) return -1;
        if (!a.isUserSubmitted && b.isUserSubmitted) return 1;
        return 0;
      });
  }, [signals, search, statusFilter, channelFilter]);

  // Reset highlighted index on filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, statusFilter, channelFilter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(filteredSignals.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && filteredSignals[highlightedIndex]) {
      e.preventDefault();
      onSelect(filteredSignals[highlightedIndex].id);
      setIsOpen(false);
    }
  };

  const getChannelTag = (s: SignalReport) => {
    const ch = (s.sourceChannelLabel || '').toLowerCase();
    if (ch.includes('whatsapp')) {
      return <span className="pz-badge pz-badge-whatsapp" style={{ fontSize: '11px', padding: '2px 6px' }}>WhatsApp</span>;
    }
    if (ch.includes('ussd')) {
      return <span className="pz-badge pz-badge-ussd" style={{ fontSize: '11px', padding: '2px 6px' }}>USSD (*140#)</span>;
    }
    return <span className="pz-badge pz-badge-web" style={{ fontSize: '11px', padding: '2px 6px' }}>Web</span>;
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onKeyDown={handleKeyDown}
    >
      <label
        htmlFor="pz-compact-picker-trigger"
        style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--pz-muted)', marginRight: '8px' }}
      >
        Inspect submission:
      </label>

      {/* Trigger Button */}
      <button
        id="pz-compact-picker-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="pz-btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          minHeight: '38px',
          padding: '6px 12px',
          background: 'var(--pz-white)',
          borderColor: isOpen ? 'var(--pz-primary-green)' : 'var(--pz-border)',
          boxShadow: isOpen ? '0 0 0 2px rgba(20, 84, 56, 0.15)' : 'none',
          textAlign: 'left',
          maxWidth: '460px',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--pz-primary-green)', fontSize: '13px' }}>
          {currentSignal?.id}
        </span>
        {currentSignal && getChannelTag(currentSignal)}
        <span
          style={{
            fontSize: '13px',
            color: 'var(--pz-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '180px',
          }}
        >
          {currentSignal?.title}
        </span>
        <span
          className={`pz-badge ${
            currentSignal?.workflowStatus === 'verified'
              ? 'pz-badge-panzira-verified'
              : currentSignal?.workflowStatus === 'rejected'
                ? 'pz-badge-critical'
                : 'pz-badge-amber'
          }`}
          style={{ fontSize: '11px', padding: '2px 6px' }}
        >
          {currentSignal?.workflowStatus === 'verified'
            ? 'Verified'
            : currentSignal?.workflowStatus === 'rejected'
              ? 'Rejected'
              : 'Lead'}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--pz-muted)', marginLeft: 'auto' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Compact Popover Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Select report to inspect"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            width: '440px',
            maxWidth: '92vw',
            background: 'var(--pz-white)',
            border: '1px solid var(--pz-border)',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            zIndex: 1050,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search Header */}
          <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid var(--pz-border)' }}>
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, road, landmark, or language..."
              aria-label="Filter report list"
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '13px',
                border: '1px solid var(--pz-border)',
                borderRadius: '4px',
                outline: 'none',
              }}
            />

            {/* Status Filter Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginTop: '8px',
                flexWrap: 'wrap',
              }}
            >
              {[
                { key: 'actionable', label: 'Actionable Leads' },
                { key: 'all', label: 'All' },
                { key: 'verified', label: 'Verified' },
                { key: 'rejected', label: 'Rejected' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  style={{
                    border: 'none',
                    background: statusFilter === tab.key ? 'var(--pz-primary-green)' : 'var(--pz-pale)',
                    color: statusFilter === tab.key ? '#ffffff' : 'var(--pz-text)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Channel Filters */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--pz-muted)', fontWeight: 600 }}>Channel:</span>
              {[
                { key: 'all', label: 'All' },
                { key: 'web', label: 'Web' },
                { key: 'whatsapp', label: 'WhatsApp' },
                { key: 'ussd', label: 'USSD' },
              ].map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => setChannelFilter(ch.key as any)}
                  style={{
                    border: channelFilter === ch.key ? '1px solid var(--pz-primary-green)' : '1px solid var(--pz-border)',
                    background: channelFilter === ch.key ? 'var(--pz-active-surface)' : 'transparent',
                    color: 'var(--pz-text)',
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Report List (Capped at 280px) */}
          <div
            style={{
              maxHeight: '280px',
              overflowY: 'auto',
              padding: '4px',
            }}
          >
            {filteredSignals.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--pz-muted)' }}>
                No reports match your search or filter.
              </div>
            ) : (
              filteredSignals.map((sig, idx) => {
                const isSelected = sig.id === selectedId;
                const isHighlighted = idx === highlightedIndex;
                const metCount = Object.values(sig.checklist || {}).filter(Boolean).length;

                return (
                  <div
                    key={sig.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(sig.id);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'var(--pz-active-surface)'
                        : isHighlighted
                          ? 'var(--pz-pale)'
                          : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--pz-primary-green)' : '3px solid transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      marginBottom: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '12.5px', color: 'var(--pz-primary-green)' }}>
                          {sig.id}
                        </strong>
                        {getChannelTag(sig)}
                        {sig.isUserSubmitted && (
                          <span style={{ fontSize: '10.5px', color: 'var(--pz-primary-green)', fontWeight: 600 }}>
                            ● Demo Intake
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--pz-muted)' }}>
                        {sig.timeShort}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pz-text)', lineHeight: 1.3 }}>
                      {sig.title}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--pz-muted)' }}>
                      <span>{sig.landmark || sig.roadArea}</span>
                      <span>
                        {sig.workflowStatus === 'verified' ? (
                          <span style={{ color: 'var(--pz-primary-green)', fontWeight: 700 }}>✓ Verified</span>
                        ) : sig.workflowStatus === 'rejected' ? (
                          <span style={{ color: 'var(--pz-red)' }}>Rejected</span>
                        ) : (
                          <span>{metCount}/4 checks</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div
            style={{
              padding: '6px 10px',
              borderTop: '1px solid var(--pz-border)',
              background: 'var(--pz-pale)',
              fontSize: '11.5px',
              color: 'var(--pz-muted)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Showing {filteredSignals.length} of {signals.length} reports</span>
            <span>Use ↑↓ keys + Enter</span>
          </div>
        </div>
      )}
    </div>
  );
};

