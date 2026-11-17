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
import { AuthView } from './views/AuthView';
import { CitizenDashboardView } from './views/CitizenDashboardView';
import { AdminDashboardView } from './views/AdminDashboardView';

const ActiveRouteRenderer: React.FC = () => {
  const { portal, newsroomView, publicView, currentUser } = usePanzira();

  if (portal === 'auth') {
    return <AuthView />;
  }

  if (portal === 'citizen') {
    if (!currentUser) {
      return <AuthView />;
    }
    return <CitizenDashboardView />;
  }

  if (portal === 'admin') {
    if (!currentUser || currentUser.role !== 'admin') {
      return <AuthView />;
    }
    return <AdminDashboardView />;
  }

  if (portal === 'public') {
    if (publicView === 'report') {
      return <ReportHazardView />;
    }
    return <PublicDashboardView />;
  }

  if (!currentUser || currentUser.role === 'citizen') {
    return <AuthView />;
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
      return <SignalInboxView />;
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

