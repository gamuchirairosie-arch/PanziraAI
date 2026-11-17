import React from 'react';
import { ASSETS } from '../assetsMap';
import { usePanzira } from '../context/PanziraContext';

export const HumanVerifiedShieldBadge: React.FC = () => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: '#ffffff',
      padding: '8px 12px 8px 10px',
      borderRadius: '6px',
    }}
    data-node-id="75:412"
  >
    <svg
      width="28"
      height="32"
      viewBox="0 0 28 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M14 1.5L3 6.2V14.8C3 22.1 7.69 28.83 14 30.8C20.31 28.83 25 22.1 25 14.8V6.2L14 1.5Z"
        fill="#142C43"
        stroke="#D4A73F"
        strokeWidth="2"
      />
      <path
        d="M9.5 16.2L12.5 19.2L18.8 12.9"
        stroke="#FFFFFF"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span
      style={{
        fontFamily: 'var(--pz-font-sans)',
        fontWeight: 500,
        fontSize: '14px',
        lineHeight: 1.5,
        color: '#142c43',
        whiteSpace: 'nowrap',
      }}
    >
      Human verified
    </span>
  </div>
);

export const CitizenHomeView: React.FC = () => {
  const { navigatePublic, verifiedAlerts } = usePanzira();

  const alertCount = verifiedAlerts.length > 0 ? verifiedAlerts.length : 12;

  return (
    <div
      className="pz-v3-home"
      data-node-id="75:371"
      style={{
        width: '100%',
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '64px 24px 36px',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
      }}
    >
      {/* Hero Introduction */}
      <section
        data-node-id="75:389"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '820px',
        }}
      >
        <p
          data-node-id="75:390"
          style={{
            margin: 0,
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 500,
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#176b45',
          }}
        >
          Road safety around Bulawayo
        </p>
        <h1
          data-node-id="75:391"
          style={{
            margin: 0,
            fontFamily: "'Newsreader', Georgia, serif",
            fontWeight: 500,
            fontSize: 'clamp(34px, 4.5vw, 48px)',
            lineHeight: 1.05,
            letterSpacing: '-0.96px',
            color: '#202a24',
          }}
        >
          Know your roads. Report a hazard.
        </h1>
        <p
          data-node-id="75:392"
          style={{
            margin: 0,
            fontFamily: 'var(--pz-font-sans)',
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: 1.5,
            color: '#5d6b63',
          }}
        >
          Check reviewed road alerts before you travel, or tell us about a hazard you have seen.
        </p>
      </section>

      {/* Primary Tasks (2-Column Cards on Desktop, Stacked on Mobile) */}
      <section
        data-node-id="75:393"
        className="pz-v3-home-tasks"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '24px',
          width: '100%',
        }}
      >
        {/* Left Card: Plan a safer journey */}
        <div
          data-node-id="75:394"
          style={{
            background: '#edf4ef',
            borderRadius: '8px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '20px',
          }}
        >
          <img
            src={ASSETS.mobMap}
            alt=""
            style={{ width: '28px', height: '28px', display: 'block' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <h2
              data-node-id="75:398"
              style={{
                margin: 0,
                fontFamily: "'Newsreader', Georgia, serif",
                fontWeight: 600,
                fontSize: '23px',
                lineHeight: 1.05,
                letterSpacing: '-0.46px',
                color: '#202a24',
              }}
            >
              Plan a safer journey
            </h2>
            <p
              data-node-id="75:399"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: 1.5,
                color: '#5d6b63',
              }}
            >
              Browse approved alerts on roads around Bulawayo.
            </p>
          </div>
          <button
            type="button"
            data-node-id="75:400"
            onClick={() => navigatePublic('map')}
            style={{
              background: '#176b45',
              color: '#ffffff',
              border: '1px solid #176b45',
              borderRadius: '6px',
              height: '48px',
              padding: '0 22px',
              fontFamily: 'var(--pz-font-sans)',
              fontWeight: 500,
              fontSize: '16px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Check road conditions
          </button>
        </div>

        {/* Right Card: Share what you have seen */}
        <div
          data-node-id="75:402"
          style={{
            background: '#ffffff',
            border: '1px solid #d9e1db',
            borderRadius: '8px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '20px',
          }}
        >
          <img
            src={ASSETS.triangleAlertGreen}
            alt=""
            style={{ width: '28px', height: '28px', display: 'block' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <h2
              data-node-id="75:406"
              style={{
                margin: 0,
                fontFamily: "'Newsreader', Georgia, serif",
                fontWeight: 600,
                fontSize: '23px',
                lineHeight: 1.05,
                letterSpacing: '-0.46px',
                color: '#202a24',
              }}
            >
              Share what you have seen
            </h2>
            <p
              data-node-id="75:407"
              style={{
                margin: 0,
                fontFamily: 'var(--pz-font-sans)',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: 1.5,
                color: '#5d6b63',
              }}
            >
              A short, three-step report. Photos are optional.
            </p>
          </div>
          <button
            type="button"
            data-node-id="75:408"
            onClick={() => navigatePublic('report')}
            style={{
              background: '#ffffff',
              color: '#176b45',
              border: '1px solid #176b45',
              borderRadius: '6px',
              height: '48px',
              minWidth: '220px',
              padding: '0 18px',
              fontFamily: 'var(--pz-font-sans)',
              fontWeight: 400,
              fontSize: '16px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <img
              src={ASSETS.triangleAlertGreen}
              alt=""
              style={{ width: '16px', height: '16px' }}
            />
            <span>Report a hazard</span>
          </button>
        </div>
      </section>

      {/* Latest Reviewed Alerts Summary */}
      <section
        data-node-id="75:409"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
        }}
      >
        <div
          data-node-id="75:410"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          <h2
            data-node-id="75:411"
            style={{
              margin: 0,
              fontFamily: "'Newsreader', Georgia, serif",
              fontWeight: 600,
              fontSize: '24px',
              lineHeight: 1.05,
              letterSpacing: '-0.48px',
              color: '#202a24',
            }}
          >
            Latest reviewed alerts
          </h2>
          <HumanVerifiedShieldBadge />
        </div>

        <p
          data-node-id="75:413"
          style={{
            margin: 0,
            fontFamily: 'var(--pz-font-sans)',
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#5d6b63',
          }}
        >
          {alertCount} example alerts · 3 corridors · Demo data
        </p>

        <div
          data-node-id="75:414"
          style={{
            height: '1px',
            width: '100%',
            background: '#d9e1db',
          }}
        />

        {/* 2-Column Recent Alerts */}
        <div
          data-node-id="75:415"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px 48px',
            width: '100%',
          }}
        >
          <button
            type="button"
            data-node-id="75:416"
            onClick={() => navigatePublic('map')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '18px 0',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={ASSETS.triangleAlertGreen}
                alt=""
                style={{ width: '20px', height: '20px', flexShrink: 0 }}
              />
              <span
                data-node-id="75:420"
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontWeight: 600,
                  fontSize: '18px',
                  lineHeight: 1.05,
                  letterSpacing: '-0.36px',
                  color: '#202a24',
                }}
              >
                Road surface damage
              </span>
            </div>
            <span
              data-node-id="75:421"
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '14px',
                lineHeight: 1.5,
                color: '#5d6b63',
              }}
            >
              Khami Road, Mzilikazi · Demo sample
            </span>
          </button>

          <button
            type="button"
            data-node-id="75:422"
            onClick={() => navigatePublic('map')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '18px 0',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={ASSETS.wavesGreen}
                alt=""
                style={{ width: '20px', height: '20px', flexShrink: 0 }}
              />
              <span
                data-node-id="75:426"
                style={{
                  fontFamily: 'var(--pz-font-sans)',
                  fontWeight: 500,
                  fontSize: '16px',
                  lineHeight: 1.5,
                  color: '#202a24',
                }}
              >
                Flooding near junction
              </span>
            </div>
            <span
              data-node-id="75:427"
              style={{
                fontFamily: 'var(--pz-font-sans)',
                fontSize: '14px',
                lineHeight: 1.5,
                color: '#5d6b63',
              }}
            >
              Lobengula St &amp; 12th Ave · Demo sample
            </span>
          </button>
        </div>

        <div>
          <button
            type="button"
            data-node-id="75:428"
            onClick={() => navigatePublic('map')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontFamily: 'var(--pz-font-sans)',
              fontWeight: 500,
              fontSize: '15px',
              lineHeight: 1.5,
              color: '#176b45',
              cursor: 'pointer',
            }}
          >
            View all road alerts →
          </button>
        </div>

        <p
          data-node-id="75:429"
          style={{
            margin: 0,
            fontFamily: 'var(--pz-font-sans)',
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#5d6b63',
          }}
        >
          Only independently reviewed, editorially approved alerts appear here. Reports awaiting
          review are not public.
        </p>
      </section>
    </div>
  );
};

export default CitizenHomeView;
