import React from 'react';
import 'leaflet/dist/leaflet.css';
import { AppShell } from './components/AppShell';
import { PanziraProvider, usePanzira } from './context/PanziraContext';
import { CardFocusProvider } from './context/CardFocusContext';
import { GlobalCardFocusModal } from './components/GlobalCardFocusModal';
import {
  FleetCorridorDeskView,
  HotspotIntelligenceView,
  InvestigativeBriefView,
} from './views/HotspotsAndBriefsView';
import { PublicDashboardView } from './views/PublicDashboardView';
import { ReportHazardView } from './views/ReportHazardView';
import {
  IncidentVerificationView,
  SignalInboxView,
} from './views/SignalInboxAndVerifyView';
import { SignalMonitorView } from './views/SignalMonitorView';
import { NewsSourceMonitorView } from './views/NewsSourceMonitorView';

const ActiveRouteRenderer: React.FC = () => {
  const { portal, newsroomView, publicView } = usePanzira();

  if (portal === 'public') {
    if (publicView === 'report') {
      return <ReportHazardView />;
    }
    return <PublicDashboardView />;
  }

  switch (newsroomView) {
    case 'monitor':
      return <SignalMonitorView />;
    case 'inbox':
      return <SignalInboxView />;
    case 'verify':
      return <IncidentVerificationView />;
    case 'hotspots':
      return <HotspotIntelligenceView />;
    case 'fleet':
      return <FleetCorridorDeskView />;
    case 'briefs':
      return <InvestigativeBriefView />;
    case 'sources':
      return <NewsSourceMonitorView />;
    default:
      return <SignalMonitorView />;
  }
};

export const App: React.FC = () => {
  return (
    <PanziraProvider>
      <CardFocusProvider>
        <AppShell>
          <ActiveRouteRenderer />
        </AppShell>
        <GlobalCardFocusModal />
      </CardFocusProvider>
    </PanziraProvider>
  );
};

export default App;

