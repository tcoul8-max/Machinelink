import React, { useState, useEffect } from 'react';
import { Worker, Machine } from './types';
import { getSavedWorkers, saveSavedWorkers, getSavedMachines, saveSavedMachines } from './data/defaultData';
import { getTailscaleIp } from './utils/offlineStore';
import { syncDefectsFromServer } from './utils/defectStore';
import { smartFetchApi } from './utils/apiClient';
import { Header } from './components/Header';
import { PrestartForm } from './components/PrestartForm';
import { JobDocketForm } from './components/JobDocketForm';
import { DefectManager } from './components/DefectManager';
import { ServiceManager } from './components/ServiceManager';
import { HistoryViewer } from './components/HistoryViewer';
import { ServerTowerAdmin } from './components/ServerTowerAdmin';

export default function App() {
  const [activeTab, setActiveTab] = useState<'prestart' | 'docket' | 'defects' | 'services' | 'history' | 'server'>('prestart');
  const [workers, setWorkers] = useState<Worker[]>(() => getSavedWorkers());
  const [machines, setMachines] = useState<Machine[]>(() => getSavedMachines());

  const fetchMasterLists = async () => {
    const targetIp = getTailscaleIp();
    try {
      const { data: wData } = await smartFetchApi('/api/master/workers', {}, targetIp);
      if (Array.isArray(wData) && wData.length > 0) {
        setWorkers(wData);
        saveSavedWorkers(wData);
      }

      const { data: mData } = await smartFetchApi('/api/master/machines', {}, targetIp);
      if (Array.isArray(mData) && mData.length > 0) {
        setMachines(mData);
        saveSavedMachines(mData);
      }

      await syncDefectsFromServer(targetIp);
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

        {activeTab === 'defects' && (
          <DefectManager
            machines={machines}
            workers={workers}
            onDefectsUpdated={fetchMasterLists}
          />
        )}

        {activeTab === 'services' && (
          <ServiceManager
            machines={machines}
            workers={workers}
            onDataUpdated={fetchMasterLists}
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
