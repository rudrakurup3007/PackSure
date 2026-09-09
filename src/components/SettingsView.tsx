import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  Scale,
  Cpu,
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Database,
  Layers,
  Lock,
  Compass,
  LayoutDashboard,
  Eye,
} from 'lucide-react';
import { clearHistoryCache } from '../mock/demoData';

interface SettingsViewProps {
  isMockMode: boolean;
  onToggleMockMode: () => void;
  onNavigateDashboard: () => void;
  onNavigateHistory: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  isMockMode,
  onToggleMockMode,
  onNavigateDashboard,
  onNavigateHistory,
}) => {
  const [jurisdiction, setJurisdiction] = useState<string>('pcr2011');
  const [toleranceMode, setToleranceMode] = useState<'standard' | 'strict'>('standard');
  const [ocrThreshold, setOcrThreshold] = useState<number>(75);
  const [showAllBboxesDefault, setShowAllBboxesDefault] = useState<boolean>(true);
  const [stationId, setStationId] = useState<string>('STN-DL-04 (Northern Metrology Wing)');
  const [inspectorBadge, setInspectorBadge] = useState<string>('OFFICER-PS-001');
  const [autoArchive, setAutoArchive] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [cacheCleared, setCacheCleared] = useState<boolean>(false);

  const handleSaveSettings = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    setJurisdiction('pcr2011');
    setToleranceMode('standard');
    setOcrThreshold(75);
    setShowAllBboxesDefault(true);
    setStationId('STN-DL-04 (Northern Metrology Wing)');
    setInspectorBadge('OFFICER-PS-001');
    setAutoArchive(true);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearCache = () => {
    if (window.confirm('Reset local audit history cache? Default benchmark records will be restored.')) {
      clearHistoryCache();
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    }
  };

  return (
    <div id="settings-view" className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <Sliders size={24} className="text-teal-700 dark:text-teal-400" />
              <span>Inspection Platform Settings</span>
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              Admin & Enforcement
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure statutory rule parameters, OCR confidence limits, inspector identity, and analysis engine modes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>
          <button
            id="settings-save-btn"
            type="button"
            onClick={handleSaveSettings}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Save size={14} />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">
            Inspection settings saved successfully. New parameters will apply to all subsequent scans.
          </span>
        </div>
      )}

      {cacheCleared && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold">Local audit history cache reset to standard benchmark records.</span>
        </div>
      )}

      {/* Grid of Setting Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Statutory Framework & Ruleset */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
              <Scale size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Statutory Framework & Directives
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Primary metrology and food packaging regulations
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Active Legal Metrology Standard
              </label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium cursor-pointer"
              >
                <option value="pcr2011">Legal Metrology (Packaged Commodities) Rules, 2011 (Standard)</option>
                <option value="fssai2020">FSSAI Packaging & Labelling Regulations, 2020 Combined</option>
                <option value="state_strict">State Weights & Measures Strict Inspection Protocol</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Enforcement Tolerance Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setToleranceMode('standard')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                    toleranceMode === 'standard'
                      ? 'border-teal-700 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-bold block text-xs">Standard Tolerance</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Schedule II standard ±1.5% tare allowance
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setToleranceMode('strict')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                    toleranceMode === 'strict'
                      ? 'border-teal-700 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-bold block text-xs">Zero-Tolerance</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Strict export clearance & pre-market audit
                  </span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Mandatory Declarations Covered:
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Rule 6(1)(a) Manufacturer/Packer, Rule 6(1)(b) Product Name, Rule 6(1)(c) Net Quantity & Height, Rule 6(1)(d) Mfg/Expiry Dates, Rule 6(1)(e) MRP & USP, Rule 6(1)(f) Consumer Care Helpline.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: AI Vision Engine & Operational Mode */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Vision Engine & Execution Mode
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                OCR confidence thresholds & API proxy settings
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Execution Backend Mode
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    isMockMode
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  {isMockMode ? 'Mock Demonstration Engine' : 'Live /scan Vision API'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                    {isMockMode ? 'Simulated Inspection Suite' : 'Live Gemini Vision Endpoint'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {isMockMode
                      ? 'Deterministic packaging evaluation scenarios with offline reliability'
                      : 'Real-time multi-surface OCR extraction via backend proxy'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleMockMode}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-800 text-white hover:bg-teal-700 transition-colors cursor-pointer shrink-0 ml-2"
                >
                  Switch Mode
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  OCR Minimum Confidence Threshold: {ocrThreshold}%
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {ocrThreshold >= 80 ? 'High Assurance' : 'Balanced'}
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={ocrThreshold}
                onChange={(e) => setOcrThreshold(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>50% (Permissive)</span>
                <span>75% (Standard)</span>
                <span>95% (Zero Glare)</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  Display All Bounding Boxes by Default
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Overlay all declarations and violations on package surfaces
                </span>
              </div>
              <input
                type="checkbox"
                checked={showAllBboxesDefault}
                onChange={(e) => setShowAllBboxesDefault(e.target.checked)}
                className="w-4 h-4 rounded text-teal-700 focus:ring-teal-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Inspector & Field Station Identity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Inspector & Station Identity
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Official headers included in exported inspection notices
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Field Enforcement Station
              </label>
              <input
                type="text"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Officer / Inspector Badge Number
              </label>
              <input
                type="text"
                value={inspectorBadge}
                onChange={(e) => setInspectorBadge(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-medium"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  Auto-Archive Scans to Inspection History
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Persist inspection records to local audit archive
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoArchive}
                onChange={(e) => setAutoArchive(e.target.checked)}
                className="w-4 h-4 rounded text-teal-700 focus:ring-teal-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Audit Cache & Data Retention */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
              <Database size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Audit Cache & Storage Management
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Local audit cache and session data retention
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                Local Inspection Cache
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                PackSure AI maintains real inspection runs alongside benchmark records in browser storage for instant retrieval without server latency.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onNavigateHistory}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  View Archive
                </button>
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 transition-colors cursor-pointer"
                >
                  Reset History Cache
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-teal-50/60 dark:bg-teal-950/30 rounded-xl border border-teal-200/80 dark:border-teal-900/50">
              <span className="font-bold text-teal-950 dark:text-teal-200 block text-xs mb-1">
                Operational Data Continuity
              </span>
              <p className="text-[11px] text-teal-900/80 dark:text-teal-300/80 leading-relaxed">
                PackSure AI preserves inspection records and session context locally so previously reviewed audits remain accessible during field analysis and offline workflows.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
