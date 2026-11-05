import React, { useState } from 'react';
import { usePanzira } from '../context/PanziraContext';
import { HazardCategoryKey } from '../types';

interface UssdSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UssdSimulatorModal: React.FC<UssdSimulatorModalProps> = ({ isOpen, onClose }) => {
  const { submitCitizenReport, navigateNewsroom, backendMode } = usePanzira();

  const [step, setStep] = useState<number>(1);
  const [userInput, setUserInput] = useState<string>('');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<HazardCategoryKey>('potholes');
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string>('Potholes / Road damage');
  const [selectedCorridor, setSelectedCorridor] = useState<string>('Khami Road Corridor');
  const [selectedLandmark, setSelectedLandmark] = useState<string>('Near flyover rail crossing');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendInput = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = userInput.trim();
    setErrorMsg(null);

    if (step === 1) {
      if (val === '1') {
        setStep(2);
        setUserInput('');
      } else if (val === '2') {
        setStep(10); // corridor status menu
        setUserInput('');
      } else if (val === '0') {
        onClose();
      } else {
        setErrorMsg('Invalid option. Enter 1 to report, 2 to check, or 0 to exit.');
      }
      return;
    }

    if (step === 2) {
      if (val === '1') {
        setSelectedCategoryKey('potholes');
        setSelectedCategoryLabel('Potholes / Road damage');
        setStep(3);
        setUserInput('');
      } else if (val === '2') {
        setSelectedCategoryKey('flooding');
        setSelectedCategoryLabel('Flooding');
        setStep(3);
        setUserInput('');
      } else if (val === '3') {
        setSelectedCategoryKey('collisions');
        setSelectedCategoryLabel('Collision or breakdown');
        setStep(3);
        setUserInput('');
      } else if (val === '4') {
        setSelectedCategoryKey('visibility');
        setSelectedCategoryLabel('Poor lighting / visibility');
        setStep(3);
        setUserInput('');
      } else {
        setErrorMsg('Invalid selection. Enter 1, 2, 3, or 4.');
      }
      return;
    }

    if (step === 3) {
      if (val === '1') {
        setSelectedCorridor('Khami Road Corridor');
        setSelectedLandmark('Near flyover rail crossing');
        setStep(4);
        setUserInput('');
      } else if (val === '2') {
        setSelectedCorridor('Harare Road (A5)');
        setSelectedLandmark('Cement Side turn-off');
        setStep(4);
        setUserInput('');
      } else if (val === '3') {
        setSelectedCorridor('Plumtree Road');
        setSelectedLandmark('Bellevue intersection');
        setStep(4);
        setUserInput('');
      } else if (val === '4') {
        setSelectedCorridor('Gwanda Road (A7)');
        setSelectedLandmark('Near NUST gate');
        setStep(4);
        setUserInput('');
      } else {
        setErrorMsg('Invalid corridor. Enter 1 to 4.');
      }
      return;
    }

    if (step === 4) {
      if (val === '1') {
        // Complete USSD submission!
        try {
          const created = await submitCitizenReport({
            categoryKey: selectedCategoryKey,
            categoryLabel: selectedCategoryLabel,
            roadArea: selectedCorridor,
            landmark: selectedLandmark,
            description: `USSD *140# submission: ${selectedCategoryLabel} along ${selectedCorridor} near ${selectedLandmark}. (Low-bandwidth citizen input).`,
            reportedDateTime: '04 Nov 2026, 16:35',
            observedIso: new Date().toISOString(),
            language: 'English',
            photoType: 'none',
          });

          setReceiptId(created.id);
          setStep(5);
          setUserInput('');
        } catch (error) {
          setErrorMsg(
            error instanceof Error
              ? error.message
              : 'The backend did not acknowledge this simulated USSD report.'
          );
        }
      } else if (val === '2') {
        onClose();
      } else {
        setErrorMsg('Enter 1 to confirm submission, or 2 to cancel.');
      }
      return;
    }
  };

  const handleReset = () => {
    setStep(1);
    setUserInput('');
    setReceiptId(null);
    setErrorMsg(null);
  };

  return (
    <div
      className="pz-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="USSD reporting simulator"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#202a24',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 48px rgba(0,0,0,0.45)',
          border: '2px solid #33443a',
          fontFamily: 'monospace',
        }}
      >
        {/* USSD Phone Frame Header */}
        <div
          style={{
            background: '#141c17',
            color: '#a0b3a6',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #2d3b32',
            fontSize: '12px',
          }}
        >
          <span>📱 USSD Gateway · *140#</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Close USSD simulator"
          >
            ×
          </button>
        </div>

        {/* Demo Tag */}
        <div
          style={{
            background: '#2b2612',
            color: '#f0c654',
            padding: '6px 14px',
            fontSize: '11px',
            textAlign: 'center',
            borderBottom: '1px solid #473a11',
          }}
        >
          <strong>Interactive Demo</strong> · Simulates offline feature phone reporting
        </div>

        {/* Retro Monochrome USSD Screen */}
        <div
          style={{
            margin: '16px',
            background: '#0d130f',
            border: '2px solid #25382b',
            borderRadius: '8px',
            padding: '16px',
            minHeight: '220px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: '#76e09a',
            fontSize: '13.5px',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          <div>
            {step === 1 && (
              <>
                <div>--- PANZIRA AI ROAD SAFETY ---</div>
                <div>Greater Bulawayo (*140#)</div>
                <br />
                <div>1. Report road hazard</div>
                <div>2. Check corridor status</div>
                <div>0. Exit</div>
              </>
            )}

            {step === 2 && (
              <>
                <div>--- SELECT HAZARD TYPE ---</div>
                <div>1. Potholes / Road damage</div>
                <div>2. Flooding / Water hazard</div>
                <div>3. Collision / Breakdown</div>
                <div>4. Poor lighting / Visibility</div>
              </>
            )}

            {step === 3 && (
              <>
                <div>--- SELECT CORRIDOR ---</div>
                <div>1. Khami Road</div>
                <div>2. A5 Harare Road</div>
                <div>3. Plumtree Road</div>
                <div>4. Gwanda Road (A7)</div>
              </>
            )}

            {step === 4 && (
              <>
                <div>--- CONFIRM SUBMISSION ---</div>
                <div>Type: {selectedCategoryLabel}</div>
                <div>Road: {selectedCorridor}</div>
                <div>Near: {selectedLandmark}</div>
                <br />
                <div>1. Confirm & Send</div>
                <div>2. Cancel</div>
              </>
            )}

            {step === 5 && (
              <>
                <div>--- {backendMode === 'demo' ? 'DEMO RECEIPT' : 'SERVER ACKNOWLEDGED'} ---</div>
                <div>Reference ID: {receiptId}</div>
                <div>Status: Queued for review</div>
                <br />
                <div>
                  {backendMode === 'demo'
                    ? 'Stored only in this browser. No USSD or SMS network was contacted.'
                    : 'The backend confirmed receipt for newsroom review.'}
                </div>
              </>
            )}

            {step === 10 && (
              <>
                <div>--- BULAWAYO CORRIDORS ---</div>
                <div>• A5 Harare Rd: Caution (Potholes)</div>
                <div>• Khami Rd: Caution (Flyover works)</div>
                <div>• Plumtree Rd: Normal</div>
                <br />
                <div>0. Back</div>
              </>
            )}

            {errorMsg && (
              <div style={{ color: '#ff6b6b', marginTop: '10px' }}>⚠️ {errorMsg}</div>
            )}
          </div>

          <div style={{ fontSize: '11px', color: '#4a7556', marginTop: '12px' }}>
            Session active · Dialling from Bulawayo network
          </div>
        </div>

        {/* Input & Keypad Controls */}
        <div style={{ padding: '12px 16px', background: '#17221b', borderTop: '1px solid #2d3b32' }}>
          {step < 5 ? (
            <form onSubmit={handleSendInput} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                autoFocus
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Enter option (e.g. 1)..."
                maxLength={2}
                style={{
                  flex: 1,
                  background: '#0d130f',
                  border: '1px solid #25382b',
                  color: '#76e09a',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="submit"
                className="pz-btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', background: '#1b6338' }}
              >
                Send
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="pz-btn-primary"
                style={{ flex: 1, fontSize: '12.5px' }}
                onClick={() => {
                  onClose();
                  if (receiptId) navigateNewsroom('verify', receiptId);
                }}
              >
                Inspect in Newsroom Inbox →
              </button>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12.5px', color: '#ffffff', borderColor: '#4a7556' }}
                onClick={handleReset}
              >
                New session
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
