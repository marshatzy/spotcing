/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { CustomSonarCursor } from './components/InteractiveCursorAndParticles';
import { TegalPlacesBootstrap } from './components/TegalPlacesBootstrap';
import { KailSpotProvider, useKailSpot } from './context/KailSpotContext';
import { getGoogleMapsApiKey } from './lib/mapsConfig';
import { AdminVerificationPage } from './pages/AdminVerificationPage';
import { InteractiveMapPage } from './pages/InteractiveMapPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';

function KailSpotRouter() {
  const { route } = useKailSpot();

  const renderRoute = () => {
    switch (route) {
      case 'map':
        return <InteractiveMapPage />;
      case 'login':
        return <LoginPage />;
      case 'admin':
        return <AdminVerificationPage />;
      case 'landing':
      default:
        return <LandingPage />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={route}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {renderRoute()}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  const appTree = (
    <MotionConfig reducedMotion="user">
      <KailSpotProvider>
        {apiKey ? <TegalPlacesBootstrap /> : null}
        <CustomSonarCursor />
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        <KailSpotRouter />
      </KailSpotProvider>
    </MotionConfig>
  );

  if (!apiKey) {
    return appTree;
  }

  return (
    <APIProvider
      apiKey={apiKey}
      language="id"
      region="ID"
      libraries={['places', 'marker', 'core']}
    >
      {appTree}
    </APIProvider>
  );
}
