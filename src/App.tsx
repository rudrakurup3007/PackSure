/**
 * PackSure AI - Compliance Intelligence & Packaged Commodity Scanner
 * Frontend Application Entry Point
 */

import React, { useState, useEffect } from 'react';
import { ScanResult, UploadedImageFile } from './types/inspection';
import { scanPackage, ApiError, isMockModeConfigured } from './lib/api';
import { createSamplePackageFiles } from './utils/sampleImages';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { NewInspection } from './components/NewInspection';
import { ProcessingState } from './components/ProcessingState';
import { ResultsDashboard } from './components/ResultsDashboard';
import { ErrorState } from './components/ErrorState';

type AppView = 'dashboard' | 'new-inspection' | 'processing' | 'results' | 'error';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [uploadedImages, setUploadedImages] = useState<UploadedImageFile[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isMockMode, setIsMockMode] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<{
    title: string;
    message: string;
    isNetwork?: boolean;
  } | null>(null);
  const [lastAttemptedFiles, setLastAttemptedFiles] = useState<File[]>([]);

  // Initialize mock mode from environment
  useEffect(() => {
    setIsMockMode(isMockModeConfigured());
  }, []);

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

  const handleLoadSampleFromDashboard = async () => {
    try {
      setCurrentView('processing');
      const sampleFiles = await createSamplePackageFiles();
      await handleExecuteScan(sampleFiles);
    } catch {
      setErrorMessage({
        title: 'Demo Error',
        message: 'Unable to initialize sample package files.',
      });
      setCurrentView('error');
    }
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Universal Top Header */}
      <Header
        onNavigateDashboard={() => setCurrentView('dashboard')}
        onNewInspection={handleStartNewInspection}
        currentView={currentView}
        isScanning={currentView === 'processing'}
        isMockMode={isMockMode}
        onToggleMockMode={handleToggleMockMode}
        showNewInspectionBtn={currentView === 'results' || currentView === 'error'}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'dashboard' && (
          <Dashboard
            onStartNewInspection={handleStartNewInspection}
            onLoadSampleInspection={handleLoadSampleFromDashboard}
          />
        )}

        {currentView === 'new-inspection' && (
          <NewInspection
            onStartScan={handleExecuteScan}
            onCancel={() => setCurrentView('dashboard')}
            isScanning={currentView === 'processing'}
          />
        )}

        {currentView === 'processing' && (
          <ProcessingState imageCount={uploadedImages.length || 1} />
        )}

        {currentView === 'results' && scanResult && (
          <ResultsDashboard
            scanResult={scanResult}
            uploadedImages={uploadedImages}
            onNewInspection={handleStartNewInspection}
          />
        )}

        {currentView === 'error' && errorMessage && (
          <ErrorState
            title={errorMessage.title}
            message={errorMessage.message}
            isNetworkError={errorMessage.isNetwork}
            onRetry={handleRetryScan}
            onGoBack={handleStartNewInspection}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PackSure AI — Statutory Commodity Compliance Intelligence</span>
          <span className="font-mono text-[11px]">
            Legal Metrology (Packaged Commodities) Rules, 2011
          </span>
        </div>
      </footer>
    </div>
  );
}
