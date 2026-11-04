import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type FocusCardType =
  | 'signal'
  | 'alert'
  | 'corridor'
  | 'metric'
  | 'ai-evidence'
  | 'pipeline'
  | 'missing-info'
  | 'hotspot'
  | 'brief'
  | 'multichannel'
  | 'custom';

export interface FocusedCardAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'critical' | 'channel-whatsapp' | 'channel-ussd';
  icon?: string;
}

export interface FocusedCardData {
  type: FocusCardType;
  title: string;
  subtitle?: string;
  categoryLabel?: string;
  badge?: string;
  badgeColor?: 'green' | 'amber' | 'red' | 'neutral' | 'gold';
  signalId?: string;
  alertId?: string;
  corridorId?: string;
  metricKey?: string;
  metricValue?: string | number;
  metricDescription?: string;
  description?: string;
  metadata?: Array<{ label: string; value: React.ReactNode; color?: string }>;
  actions?: FocusedCardAction[];
  customContent?: React.ReactNode;
}

interface CardFocusContextValue {
  focusedCard: FocusedCardData | null;
  isFocused: boolean;
  focusCard: (data: FocusedCardData) => void;
  closeFocus: () => void;
  setFocusedSignalId: (id: string) => void;
  setFocusedAlertId: (id: string) => void;
  setFocusedCorridorId: (id: string) => void;
}

const CardFocusContext = createContext<CardFocusContextValue | null>(null);

export const CardFocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [focusedCard, setFocusedCard] = useState<FocusedCardData | null>(null);

  const focusCard = useCallback((data: FocusedCardData) => {
    setFocusedCard(data);
  }, []);

  const closeFocus = useCallback(() => {
    setFocusedCard(null);
  }, []);

  const setFocusedSignalId = useCallback((id: string) => {
    setFocusedCard((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        signalId: id,
      };
    });
  }, []);

  const setFocusedAlertId = useCallback((id: string) => {
    setFocusedCard((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        alertId: id,
      };
    });
  }, []);

  const setFocusedCorridorId = useCallback((id: string) => {
    setFocusedCard((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        corridorId: id,
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      focusedCard,
      isFocused: Boolean(focusedCard),
      focusCard,
      closeFocus,
      setFocusedSignalId,
      setFocusedAlertId,
      setFocusedCorridorId,
    }),
    [focusedCard, focusCard, closeFocus, setFocusedSignalId, setFocusedAlertId, setFocusedCorridorId]
  );

  return <CardFocusContext.Provider value={value}>{children}</CardFocusContext.Provider>;
};

export const useCardFocus = (): CardFocusContextValue => {
  const context = useContext(CardFocusContext);
  if (!context) {
    throw new Error('useCardFocus must be used within a CardFocusProvider');
  }
  return context;
};

