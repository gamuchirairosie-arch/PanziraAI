import React from 'react';
import { usePanzira } from '../context/PanziraContext';
import { CitizenHomeView } from './CitizenHomeView';
import { PublicSafetyMapView } from './PublicSafetyMapView';
import { CitizenDashboardView } from './CitizenDashboardView';

export const PublicDashboardView: React.FC = () => {
  const { publicView } = usePanzira();

  if (publicView === 'overview') {
    return <CitizenHomeView />;
  }

  if (publicView === 'my-reports') {
    return <CitizenDashboardView />;
  }

  return <PublicSafetyMapView />;
};

export default PublicDashboardView;
