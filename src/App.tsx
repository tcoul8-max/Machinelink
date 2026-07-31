import React, { useState, useEffect } from 'react';
import { Worker, Machine } from './types';
import { INITIAL_WORKERS, INITIAL_MACHINES } from './data/defaultData';
import { getTailscaleIp } from './utils/offlineStore';
import { Header } from './components/Header';
import { PrestartForm } from './components/PrestartForm';
import { JobDocketForm } from './components/JobDocketForm';
import { HistoryViewer } from './components/HistoryViewer';
import { ServerTowerAdmin } from './components/ServerTowerAdmin';

export default function App() {
  const [activeTab, setActiveTab] = useState<'prestart' | 'docket' | 'history' | 'server'>('prestart');
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [machines, setMachines] = useState<Machine[]>(INITIAL_MACHINES);

  const fetchMasterLists = async () => {
    const targetIp = getTailscaleIp();
    try {
      const wRes = await fetch(`/api/master/workers?ip=${encodeURIComponent(targetIp)}`);
      const wText = await wRes.text();
      if (wRes.ok && !wText.trim().startsWith('<')) {
        const wData = JSON.parse(wText);
        if (Array.isArray(wData) && wData.length > 0) setWorkers(wData);
      }

      const mRes = await fetch(`/api/master/machines?ip=${encodeURIComponent(targetIp)}`);
      const mText = await mRes.text();
      if (mRes.ok && !mText.trim().startsWith('<')) {
        const mData = JSON.parse(mText);
        if (Array.isArray(mData) && mData.length > 0) setMachines(mData);
      }
    } catch (e) {
      console.log('Using local cached master lists (offline/initial startup)');
    }
  };

  useEffect(() => {
    fetchMasterLists();

    const handleIpChange = () => fetchMasterLists();
    const handleSyncChange = () => fetchMasterLists();

    window.addEventListener('tailscale-ip-changed', handleIpChange);
    window.addEventListener('sync-completed', handleSyncChange);

    return () => {
      window.removeEventListener('tailscale-ip-changed', handleIpChange);
      window.removeEventListener('sync-completed', handleSyncChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-amber-500 selection:text-slate-950">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'prestart' && (
          <PrestartForm
            workers={workers}
            machines={machines}
            onSubmissionComplete={fetchMasterLists}
          />
        )}

        {activeTab === 'docket' && (
          <JobDocketForm
            workers={workers}
            machines={machines}
            onSubmissionComplete={fetchMasterLists}
          />
        )}

        {activeTab === 'history' && <HistoryViewer />}

        {activeTab === 'server' && (
          <ServerTowerAdmin
            workers={workers}
            machines={machines}
            onReloadMasterData={fetchMasterLists}
          />
        )}
      </main>
    </div>
  );
}
