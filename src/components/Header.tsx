import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Server, ClipboardCheck, FileText, Database, History, Edit2, Download } from 'lucide-react';
import { getTailscaleIp, getOfflinePrestarts, getOfflineDockets, attemptServerSync } from '../utils/offlineStore';
import { smartFetchApi } from '../utils/apiClient';
import { TailscaleIpModal } from './TailscaleIpModal';
import { InstallPwaModal } from './InstallPwaModal';

interface HeaderProps {
  activeTab: 'prestart' | 'docket' | 'history' | 'server';
  setActiveTab: (tab: 'prestart' | 'docket' | 'history' | 'server') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const [serverIp, setServerIp] = useState<string>(getTailscaleIp());
  const [showIpModal, setShowIpModal] = useState<boolean>(false);
  const [showPwaModal, setShowPwaModal] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<{
    isOnline: boolean;
    isChecking: boolean;
    error?: string;
  }>({
    isOnline: true,
    isChecking: false
  });

  const testServerConnection = async (ipToTest: string) => {
    setConnectionStatus(prev => ({ ...prev, isChecking: true }));
    try {
      const { res, data } = await smartFetchApi('/api/server-info', {}, ipToTest);
      const isOnline = res.ok && !!data;
      setConnectionStatus({
        isOnline,
        isChecking: false,
        error: isOnline ? undefined : 'Unable to connect to Tailscale server node.'
      });
    } catch (e: any) {
      setConnectionStatus({
        isOnline: false,
        isChecking: false,
        error: e?.message || 'Server connection unreachable'
      });
    }
  };

  const refreshCounts = () => {
    const pCount = getOfflinePrestarts().filter(p => !p.synced).length;
    const dCount = getOfflineDockets().filter(d => !d.synced).length;
    setPendingCount(pCount + dCount);
  };

  useEffect(() => {
    refreshCounts();
    testServerConnection(serverIp);

    const handleIpChange = () => {
      const newIp = getTailscaleIp();
      setServerIp(newIp);
      testServerConnection(newIp);
    };

    const handleSyncChange = () => {
      refreshCounts();
      testServerConnection(serverIp);
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('tailscale-ip-changed', handleIpChange);
    window.addEventListener('sync-completed', handleSyncChange);

    // Periodic health check interval (every 15 seconds)
    const intervalId = setInterval(() => {
      testServerConnection(getTailscaleIp());
    }, 15000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('tailscale-ip-changed', handleIpChange);
      window.removeEventListener('sync-completed', handleSyncChange);
      clearInterval(intervalId);
    };
  }, [serverIp]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
      }
      setDeferredPrompt(null);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncToast(`Connecting to Tailscale Server Tower (${serverIp})...`);
    
    const res = await attemptServerSync();
    setIsSyncing(false);
    setSyncToast(res.message);
    refreshCounts();
    testServerConnection(serverIp);

    setTimeout(() => {
      setSyncToast(null);
    }, 4500);
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-lg">
      {/* Top Banner with Connection & Sync Info */}
      <div className="bg-slate-950 px-4 py-2.5 text-xs border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Server Connection Badge (Clickable to change IP) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowIpModal(true)}
              title="Click to change Tailscale Tower Server IP"
              className="flex items-center gap-2 px-3 py-1 bg-slate-900 hover:bg-slate-800 transition rounded-full border border-slate-800 cursor-pointer group"
            >
              <Server className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition" />
              <span className="font-bold text-slate-300">Tailscale Tower:</span>
              <span className="font-mono text-[11px] text-amber-400 font-extrabold">{serverIp}</span>
              <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition" />
            </button>
            
            {connectionStatus.isChecking ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold border border-amber-500/20">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> Testing Connection...
              </span>
            ) : connectionStatus.isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Tower Connected
              </span>
            ) : (
              <button
                onClick={() => testServerConnection(serverIp)}
                title={`Error: ${connectionStatus.error || 'Server unreachable'}. Click to re-test.`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-bold border border-rose-500/30 hover:bg-rose-500/20 transition cursor-pointer"
              >
                <WifiOff className="w-3.5 h-3.5 text-rose-400" /> No Connection ({connectionStatus.error || 'Unreachable'})
              </button>
            )}
          </div>

          {/* Sync Actions & PWA Install */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowPwaModal(true)}
              title="Install MachineLink Web App to Phone or Home Screen"
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-amber-400 text-[11px] font-bold px-3 py-1.5 rounded-full border border-slate-800 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              <span>Install App</span>
            </button>

            {pendingCount > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-[11px] font-bold px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
                {pendingCount} Pending Sync
              </span>
            )}

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold px-3.5 py-1.5 rounded-full transition shadow-md shadow-amber-500/10 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Server'}
            </button>
          </div>
        </div>
      </div>

      {/* Tailscale IP Change Modal */}
      <TailscaleIpModal
        isOpen={showIpModal}
        onClose={() => setShowIpModal(false)}
        onIpUpdated={(newIp) => setServerIp(newIp)}
      />

      {/* PWA Installation Modal */}
      <InstallPwaModal
        isOpen={showPwaModal}
        onClose={() => setShowPwaModal(false)}
        deferredPrompt={deferredPrompt}
        onInstallClick={handleInstallClick}
      />

      {/* Sync Toast Feedback */}
      {syncToast && (
        <div className="bg-slate-800 text-amber-300 px-4 py-2 text-xs font-semibold text-center border-b border-amber-500/30 animate-fadeIn flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
          {syncToast}
        </div>
      )}

      {/* Main Header & Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-lg shadow-lg shadow-amber-500/20 tracking-tighter">
            ML
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight text-white flex items-center gap-2">
              MACHINELINK
              <span className="text-[10px] font-extrabold tracking-widest uppercase bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                FIELD OPERATOR
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Heavy Machinery Prestarts & Digital Job Dockets
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <nav className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('prestart')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'prestart'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Prestart Check
          </button>

          <button
            onClick={() => setActiveTab('docket')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'docket'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            Job Docket
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-4 h-4" />
            Local Log
          </button>

          <button
            onClick={() => setActiveTab('server')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'server'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            Server Tower
          </button>
        </nav>
      </div>
    </header>
  );
};
