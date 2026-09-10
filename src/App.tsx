/**
 * PackSure AI - Compliance Intelligence & Packaged Commodity Scanner
 * Frontend Application Entry Point
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanResult, UploadedImageFile } from './types/inspection';
import { scanPackage, ApiError, isMockModeConfigured } from './lib/api';
import {
  createSamplePackageFiles,
  createCompliantPackageFiles,
  createReviewRequiredPackageFiles,
} from './utils/sampleImages';
import {
  DEFAULT_MOCK_SCAN_RESULT,
  COMPLIANT_MOCK_SCAN_RESULT,
  REVIEW_REQUIRED_MOCK_SCAN_RESULT,
} from './mock/scanResult';
import { saveInspectionToHistory } from './mock/demoData';
import { Header } from './components/Header';
import { LandingTopBar } from './components/LandingTopBar';
import { LandingPage } from './components/LandingPage';
import { WorkspaceTransition } from './components/WorkspaceTransition';
import { Dashboard } from './components/Dashboard';
import { NewInspection } from './components/NewInspection';
import { ProcessingState } from './components/ProcessingState';
import { ResultsDashboard } from './components/ResultsDashboard';
import { InspectionHistory } from './components/InspectionHistory';
import { AnalyticsView } from './components/AnalyticsView';
import { RuleLibrary } from './components/RuleLibrary';
import { SettingsView } from './components/SettingsView';
import { ErrorState } from './components/ErrorState';
import { ThemeProvider } from './context/ThemeContext';
import { BackgroundMotion } from './components/BackgroundMotion';

type AppView =
  | 'landing'
  | 'dashboard'
  | 'new-inspection'
  | 'processing'
  | 'results'
  | 'report'
  | 'history'
  | 'analytics'
  | 'rules'
  | 'settings'
  | 'error';

export default function App() {
  // Starts on the product entry experience (Landing Page)
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [isInitializingWorkspace, setIsInitializingWorkspace] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageFile[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isMockMode, setIsMockMode] = useState<boolean>(() => isMockModeConfigured());
  const [errorMessage, setErrorMessage] = useState<{
    title: string;
    message: string;
    isNetwork?: boolean;
  } | null>(null);
  const [lastAttemptedFiles, setLastAttemptedFiles] = useState<File[]>([]);
  const navLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize mock mode from environment
  useEffect(() => {
    setIsMockMode(isMockModeConfigured());
  }, []);

  // Clean up navigation lock on unmount
  useEffect(() => {
    return () => {
      if (navLockTimeoutRef.current) {
        clearTimeout(navLockTimeoutRef.current);
      }
    };
  }, []);

  // Safe navigation helper with double-click prevention
  const handleSafeNavigate = (targetView: AppView) => {
    if (isNavigating || isInitializingWorkspace) return;
    setIsNavigating(true);
    setCurrentView(targetView);
    if (navLockTimeoutRef.current) {
      clearTimeout(navLockTimeoutRef.current);
    }
    navLockTimeoutRef.current = setTimeout(() => {
      setIsNavigating(false);
    }, 350);
  };

  // Dedicated Landing Page -> Dashboard transition with compliance initialization HUD
  const handleEnterDashboardWithTransition = () => {
    if (isInitializingWorkspace || isNavigating) return;
    setIsInitializingWorkspace(true);
  };

  const handleWorkspaceTransitionComplete = () => {
    setIsInitializingWorkspace(false);
    setCurrentView('dashboard');
  };

  const handleStartNewInspection = () => {
    // Clean up previous image URLs if any
    uploadedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setUploadedImages([]);
    setScanResult(null);
    setErrorMessage(null);
    setCurrentView('new-inspection');
  };

  const handleExecuteScan = async (files: File[]) => {
    setLastAttemptedFiles(files);
    setErrorMessage(null);

    // Build UploadedImageFile representation
    const indexedImages: UploadedImageFile[] = files.map((file, idx) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      index: idx + 1,
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    setUploadedImages(indexedImages);
    setCurrentView('processing');

    try {
      const result = await scanPackage(files, isMockMode);
      setScanResult(result);
      saveInspectionToHistory(result);
      setCurrentView('results');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setErrorMessage({
        title: apiErr.isNetworkError ? 'Connection Failure' : 'Scan Error',
        message: apiErr.message || 'An unexpected error occurred while analyzing the package.',
        isNetwork: apiErr.isNetworkError,
      });
      setCurrentView('error');
    }
  };

  const handleRunScenario = async (scenario: 'compliant' | 'non-compliant' | 'review-required') => {
    setErrorMessage(null);
    setCurrentView('processing');

    try {
      let files: File[];
      let targetResult: ScanResult;

      if (scenario === 'compliant') {
        files = await createCompliantPackageFiles();
        targetResult = COMPLIANT_MOCK_SCAN_RESULT;
      } else if (scenario === 'review-required') {
        files = await createReviewRequiredPackageFiles();
        targetResult = REVIEW_REQUIRED_MOCK_SCAN_RESULT;
      } else {
        files = await createSamplePackageFiles();
        targetResult = DEFAULT_MOCK_SCAN_RESULT;
      }

      setLastAttemptedFiles(files);
      const indexedImages: UploadedImageFile[] = files.map((file, idx) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        index: idx + 1,
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      setUploadedImages(indexedImages);

      if (isMockMode) {
        setTimeout(() => {
          setScanResult(targetResult);
          saveInspectionToHistory(targetResult);
          setCurrentView('results');
        }, 1600);
      } else {
        const result = await scanPackage(files, false);
        setScanResult(result);
        saveInspectionToHistory(result);
        setCurrentView('results');
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setErrorMessage({
        title: 'Demo Execution Error',
        message: apiErr.message || 'Unable to execute scenario package analysis.',
        isNetwork: apiErr.isNetworkError,
      });
      setCurrentView('error');
    }
  };

  const handleQuickInspectScenario = async (
    mockRes: ScanResult,
    scenario: 'compliant' | 'non-compliant' | 'review-required'
  ) => {
    setScanResult(mockRes);
    saveInspectionToHistory(mockRes);
    try {
      let files: File[];
      if (scenario === 'compliant') {
        files = await createCompliantPackageFiles();
      } else if (scenario === 'review-required') {
        files = await createReviewRequiredPackageFiles();
      } else {
        files = await createSamplePackageFiles();
      }
      const indexedImages: UploadedImageFile[] = files.map((file, idx) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        index: idx + 1,
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      setUploadedImages(indexedImages);
    } catch {
      // Continue with empty images if canvas generation fails
    }
    setCurrentView('results');
  };

  const handleLoadSampleFromDashboard = async () => {
    handleRunScenario('non-compliant');
  };

  const handleSelectRecentInspection = async (selectedResult: ScanResult) => {
    setScanResult(selectedResult);
    if (uploadedImages.length === 0) {
      try {
        let sampleFiles: File[];
        if (selectedResult.overall_status === 'COMPLIANT') {
          sampleFiles = await createCompliantPackageFiles();
        } else if (selectedResult.overall_status === 'WARNING') {
          sampleFiles = await createReviewRequiredPackageFiles();
        } else {
          sampleFiles = await createSamplePackageFiles();
        }

        const indexedImages: UploadedImageFile[] = sampleFiles.map((file, idx) => ({
          file,
          previewUrl: URL.createObjectURL(file),
          index: idx + 1,
          name: file.name,
          size: file.size,
          type: file.type,
        }));
        setUploadedImages(indexedImages);
      } catch {
        // Continue with empty images if canvas generation fails
      }
    }
    setCurrentView('results');
  };

  const handleRetryScan = () => {
    if (lastAttemptedFiles.length > 0) {
      handleExecuteScan(lastAttemptedFiles);
    } else {
      setCurrentView('new-inspection');
    }
  };

  const handleToggleMockMode = () => {
    setIsMockMode((prev) => !prev);
  };

  return (
    <ThemeProvider>
      <div className="packsure-app-shell min-h-screen text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-teal-600 selection:text-white transition-colors duration-200">
        <BackgroundMotion />
        {/* Workspace Initialization Transition Screen (2-3 seconds, PackSure-themed) */}
        {isInitializingWorkspace && (
          <WorkspaceTransition
            onComplete={handleWorkspaceTransitionComplete}
            durationMs={2400}
          />
        )}

        {/* Top Shell Bar: Minimal Brand + Theme Switcher on Landing; Full Operational Header in App */}
        {currentView === 'landing' ? (
          <LandingTopBar />
        ) : (
          <Header
            onNavigateLanding={() => handleSafeNavigate('landing')}
            onNavigateDashboard={() => handleSafeNavigate('dashboard')}
            onNavigateHistory={() => handleSafeNavigate('history')}
            onNavigateAnalytics={() => handleSafeNavigate('analytics')}
            onNavigateRules={() => handleSafeNavigate('rules')}
            onNavigateSettings={() => handleSafeNavigate('settings')}
            onNavigateReport={() => handleSafeNavigate('results')}
            currentView={currentView}
            isScanning={currentView === 'processing'}
            isMockMode={isMockMode}
            onToggleMockMode={handleToggleMockMode}
          />
        )}

        {/* Main View Router with Smooth Micro-Transitions */}
        <main className="flex-1 w-full max-w-full min-w-0 flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex-1 flex flex-col"
            >
              {/* PART 1: PRODUCT ENTRY EXPERIENCE / LANDING */}
              {currentView === 'landing' && (
                <LandingPage
                  onNavigateDashboard={handleEnterDashboardWithTransition}
                  onRunInteractiveDemo={handleLoadSampleFromDashboard}
                  isTransitioningToDashboard={isInitializingWorkspace}
                />
              )}

              {/* PART 2: UPGRADED OPERATIONAL OVERVIEW DASHBOARD */}
              {currentView === 'dashboard' && (
                <Dashboard
                  onStartNewInspection={handleStartNewInspection}
                  onLoadSampleInspection={handleLoadSampleFromDashboard}
                  onSelectInspection={handleSelectRecentInspection}
                  onNavigateHistory={() => handleSafeNavigate('history')}
                  onNavigateAnalytics={() => handleSafeNavigate('analytics')}
                  onNavigateRules={() => handleSafeNavigate('rules')}
                  onRunScenario={handleRunScenario}
                  currentScanResult={scanResult}
                />
              )}

              {/* PART 3: INSPECTION HISTORY ARCHIVE */}
              {currentView === 'history' && (
                <InspectionHistory
                  onSelectInspection={handleSelectRecentInspection}
                />
              )}

              {/* PART 4: ANALYTICS & STATUTORY INTELLIGENCE */}
              {currentView === 'analytics' && (
                <AnalyticsView
                  onNavigateHistory={() => handleSafeNavigate('history')}
                  onNavigateRules={() => handleSafeNavigate('rules')}
                />
              )}

              {/* PART 5: STATUTORY RULE LIBRARY & ENFORCEMENT SEARCH */}
              {currentView === 'rules' && (
                <RuleLibrary
                  onStartInspection={() => handleSafeNavigate('new-inspection')}
                  onNavigateDashboard={() => handleSafeNavigate('dashboard')}
                />
              )}

              {/* PART 6: SYSTEM & INSPECTION SETTINGS */}
              {currentView === 'settings' && (
                <SettingsView
                  isMockMode={isMockMode}
                  onToggleMockMode={handleToggleMockMode}
                  onNavigateDashboard={() => handleSafeNavigate('dashboard')}
                  onNavigateHistory={() => handleSafeNavigate('history')}
                />
              )}

              {/* NEW INSPECTION UPLOAD WORKFLOW (LOCKED & PRESERVED) */}
              {currentView === 'new-inspection' && (
                <NewInspection
                  onStartScan={handleExecuteScan}
                  onCancel={() => handleSafeNavigate('dashboard')}
                  isScanning={currentView === 'processing'}
                />
              )}

              {/* PROCESSING SCANNER PIPELINE (LOCKED & PRESERVED) */}
              {currentView === 'processing' && (
                <ProcessingState
                  imageCount={uploadedImages.length || 1}
                  images={uploadedImages}
                  isMockMode={isMockMode}
                />
              )}

              {/* EVIDENCE VIEWER & OFFICIAL COMPLIANCE AUDIT REPORT */}
              {(currentView === 'results' || currentView === 'report') && (
                <ResultsDashboard
                  scanResult={scanResult}
                  uploadedImages={uploadedImages}
                  onStartInspection={() => handleSafeNavigate('new-inspection')}
                />
              )}

              {/* ERROR STATE RECOVERY (LOCKED & PRESERVED) */}
              {currentView === 'error' && errorMessage && (
                <ErrorState
                  title={errorMessage.title}
                  message={errorMessage.message}
                  isNetworkError={errorMessage.isNetwork}
                  onRetry={handleRetryScan}
                  onGoBack={() => handleSafeNavigate('new-inspection')}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      {/* Statutory Regulatory Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PackSure AI — Statutory Commodity Compliance Intelligence</span>
          <span className="font-mono text-[11px]">
            Legal Metrology (Packaged Commodities) Rules, 2011 & FSSAI Directives
          </span>
        </div>
      </footer>
    </div>
  </ThemeProvider>
);
}
