import React, { useState } from 'react';
import { usePanzira } from '../context/PanziraContext';
import { HazardCategoryKey } from '../types';

interface WhatsAppSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  time: string;
  options?: { label: string; action: () => void }[];
}

export const WhatsAppSimulatorModal: React.FC<WhatsAppSimulatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { submitCitizenReport, navigateNewsroom, backendMode } = usePanzira();

  const [step, setStep] = useState<number>(1);
  const [categoryKey, setCategoryKey] = useState<HazardCategoryKey>('potholes');
  const [categoryLabel, setCategoryLabel] = useState<string>('Road surface damage');
  const [roadArea, setRoadArea] = useState<string>('Khami Road');
  const [landmark, setLandmark] = useState<string>('Near flyover rail crossing');
  const [description, setDescription] = useState<string>('');
  const [hasPhoto, setHasPhoto] = useState<boolean>(true);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  // Initial chat history
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'bot',
      text: '👋 Welcome to Panzira AI Road Safety Desk (Bulawayo).\n\nYou can report road hazards, accidents, and flooding for independent journalist verification.\n\nWhat kind of hazard did you observe?',
      time: 'Just now',
    },
  ]);

  if (!isOpen) return null;

  const nowTime = () =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Harare',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());

  const handleSelectCategory = (key: HazardCategoryKey, label: string) => {
    setCategoryKey(key);
    setCategoryLabel(label);
    setStep(2);

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: label, time: nowTime() },
      {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: `Got it: ${label}.\n\nWhich road or corridor in Bulawayo? Please specify the road and a landmark.`,
        time: nowTime(),
      },
    ]);
  };

  const handleSelectLocation = (road: string, lmark: string) => {
    setRoadArea(road);
    setLandmark(lmark);
    setStep(3);

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: `${road} (${lmark})`, time: nowTime() },
      {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: 'Please describe the hazard condition in a few words.',
        time: nowTime(),
      },
    ]);
  };

  const handleSendDescription = (desc: string) => {
    setDescription(desc);
    setStep(4);

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: desc, time: nowTime() },
      {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: 'Would you like to attach an on-site scene photograph?',
        time: nowTime(),
      },
    ]);
  };

  const handleSelectPhoto = (attach: boolean) => {
    setHasPhoto(attach);
    setStep(5);

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        sender: 'user',
        text: attach ? '📷 [Attached: road_hazard_survey.jpg]' : 'Text-only (no photo)',
        time: nowTime(),
      },
      {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: '🔒 Privacy & Verification Consent:\nDo you confirm this report is submitted for independent editorial verification? (Never auto-published by AI).\n\nReply YES to confirm.',
        time: nowTime(),
      },
    ]);
  };

  const handleConfirmSubmit = async () => {
    setStep(6);

    try {
      const created = await submitCitizenReport({
        categoryKey,
        categoryLabel,
        roadArea,
        landmark,
        description: description || 'Hazard observed by citizen via WhatsApp conversation.',
        reportedDateTime: '04 Nov 2026, 16:30',
        observedIso: new Date().toISOString(),
        language: 'English',
        photoType: hasPhoto ? 'figma-road-damage' : 'none',
        photoFilename: hasPhoto ? 'whatsapp_intake.jpg' : undefined,
      });

      setReceiptId(created.id);
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, sender: 'user', text: 'YES, I consent', time: nowTime() },
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text:
            backendMode === 'demo'
              ? `DEMO ONLY: Report ${created.id} was stored in this browser. It was not sent through WhatsApp, saved to a backend, or published.`
              : `Server acknowledged report ${created.id}. Status: Pending Editorial Review. Nothing has been published.`,
          time: nowTime(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: `Submission failed. ${error instanceof Error ? error.message : 'The backend did not acknowledge the report.'}`,
          time: nowTime(),
        },
      ]);
    }
  };

  const handleReset = () => {
    setStep(1);
    setReceiptId(null);
    setMessages([
      {
        id: 'm1',
        sender: 'bot',
        text: '👋 Welcome to Panzira AI Road Safety Desk (Bulawayo).\n\nYou can report road hazards, accidents, and flooding for independent journalist verification.\n\nWhat kind of hazard did you observe?',
        time: nowTime(),
      },
    ]);
  };

  return (
    <div
      className="pz-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="WhatsApp reporting simulator"
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
          maxWidth: '460px',
          background: '#efeae2',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
          border: '1px solid #c8d3cc',
        }}
      >
        {/* WhatsApp Header */}
        <div
          style={{
            background: '#075e54',
            color: '#ffffff',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#25d366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#ffffff',
                fontSize: '18px',
              }}
            >
              P
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Panzira AI Road Safety</div>
              <div style={{ fontSize: '11.5px', color: '#c5e2dd' }}>
                Online · WhatsApp Bot Simulator
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Close WhatsApp simulator"
          >
            ×
          </button>
        </div>

        {/* Demo Disclaimer Strip */}
        <div
          style={{
            background: '#fff3cd',
            color: '#856404',
            padding: '6px 14px',
            fontSize: '11px',
            borderBottom: '1px solid #ffeeba',
            textAlign: 'center',
          }}
        >
          <strong>Demo Simulation</strong> · Live webhook active at{' '}
          <code>/api/integrations/whatsapp/webhook</code>
        </div>

        {/* Chat History Container */}
        <div
          style={{
            padding: '16px',
            maxHeight: '380px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                background: m.sender === 'user' ? '#dcf8c6' : '#ffffff',
                color: '#111b21',
                borderRadius: '8px',
                padding: '8px 12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                fontSize: '13.5px',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
              }}
            >
              <div>{m.text}</div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#667781',
                  textAlign: 'right',
                  marginTop: '4px',
                }}
              >
                {m.time}
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Controls Bar based on Step */}
        <div
          style={{
            padding: '12px',
            background: '#f0f2f5',
            borderTop: '1px solid #d1d7db',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px', padding: '6px' }}
                onClick={() => handleSelectCategory('potholes', 'Potholes / Road damage')}
              >
                1. Potholes / Damage
              </button>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px', padding: '6px' }}
                onClick={() => handleSelectCategory('collisions', 'Collision / Crash')}
              >
                2. Collision / Crash
              </button>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px', padding: '6px' }}
                onClick={() => handleSelectCategory('flooding', 'Flooding / Water hazard')}
              >
                3. Flooding
              </button>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px', padding: '6px' }}
                onClick={() => handleSelectCategory('visibility', 'Streetlighting / Visibility')}
              >
                4. Visibility
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px', textAlign: 'left' }}
                onClick={() =>
                  handleSelectLocation('Khami Road', 'Near flyover rail crossing')
                }
              >
                📍 Khami Road (Near flyover rail crossing)
              </button>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px', textAlign: 'left' }}
                onClick={() =>
                  handleSelectLocation('A5 Harare Road', 'Near Cement Side turn-off')
                }
              >
                📍 A5 Harare Road (Near Cement Side)
              </button>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px', textAlign: 'left' }}
                onClick={() =>
                  handleSelectLocation('Plumtree Road', 'Bellevue intersection')
                }
              >
                📍 Plumtree Road (Bellevue intersection)
              </button>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px', textAlign: 'left' }}
                onClick={() =>
                  handleSendDescription(
                    'Deep trench-like potholes across both lanes, vehicles swerving into oncoming traffic.'
                  )
                }
              >
                “Deep trench potholes across both lanes”
              </button>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px', textAlign: 'left' }}
                onClick={() =>
                  handleSendDescription(
                    'Two vehicles involved in collision, blocking eastbound lane. Traffic backing up.'
                  )
                }
              >
                “Two vehicles collision, traffic backing up”
              </button>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px' }}
                onClick={() => handleSelectPhoto(true)}
              >
                📷 Attach scene photo
              </button>
              <button
                type="button"
                className="pz-btn-secondary"
                style={{ fontSize: '12px' }}
                onClick={() => handleSelectPhoto(false)}
              >
                Skip photo (Text only)
              </button>
            </div>
          )}

          {step === 5 && (
            <button
              type="button"
              className="pz-btn-primary"
              style={{ background: '#25d366', borderColor: '#25d366' }}
              onClick={handleConfirmSubmit}
            >
              Reply "YES" & Submit Report →
            </button>
          )}

          {step === 6 && (
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
                style={{ fontSize: '12.5px' }}
                onClick={handleReset}
              >
                New report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
