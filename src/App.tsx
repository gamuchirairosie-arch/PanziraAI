import React from 'react';
import 'leaflet/dist/leaflet.css';
import { AppShell } from './components/AppShell';
import { PanziraProvider, usePanzira } from './context/PanziraContext';
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
    default:
      return <SignalMonitorView />;
  }
};

export const App: React.FC = () => {
  return (
    <PanziraProvider>
      <AppShell>
        <ActiveRouteRenderer />
      </AppShell>
    </PanziraProvider>
  );
};

export default App;

