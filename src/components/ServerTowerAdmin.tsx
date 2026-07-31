import React, { useState, useEffect } from 'react';
import { Worker, Machine, JobDocket, PrestartType, PrestartSubmission, DocketTemplateConfig } from '../types';
import { DocketViewerModal } from './DocketViewerModal';
import { TailscaleIpModal } from './TailscaleIpModal';
import { generateDocketPDF } from '../utils/pdfGenerator';
import { getTailscaleIp, getOfflinePrestarts } from '../utils/offlineStore';
import { smartFetchApi, buildDirectUrl } from '../utils/apiClient';
import { getSavedDocketTemplate, saveSavedDocketTemplate } from '../data/defaultData';
import { Server, Database, FileSpreadsheet, Download, RefreshCw, Users, Truck, Plus, Check, Edit2, ShieldCheck, Wifi, Eye, Building2 } from 'lucide-react';

interface ServerTowerAdminProps {
  workers: Worker[];
  machines: Machine[];
  onReloadMasterData: () => void;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else if (char !== '\r') {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function convertSubmissionToCsvRow(p: PrestartSubmission): string[] {
  const getStatus = (itemId: string) => {
    if (!p.checks || !p.checks[itemId]) return 'N/A';
    const c = p.checks[itemId];
    return c.notes ? `${c.status} (${c.notes})` : c.status;
  };

  return [
    p.id || 'PRE-' + Date.now().toString().slice(-4),
    p.syncedAt || new Date().toISOString(),
    p.date || new Date().toLocaleDateString('en-AU'),
    p.workerName || 'Operator',
    p.machineCode || 'N/A',
    p.machineName || 'N/A',
    `Type ${p.prestartType || 1}`,
    String(p.engineHours || 0),
    p.overallStatus || 'SAFE_TO_OPERATE',
    getStatus('engine_oil'),
    getStatus('hydraulic_oil'),
    getStatus('coolant'),
    getStatus('transmission_oil') !== 'N/A' ? getStatus('transmission_oil') : getStatus('final_drive_oil'),
    getStatus('fuel_level'),
    getStatus('tracks') !== 'N/A' ? getStatus('tracks') : getStatus('undercarriage'),
    getStatus('tires'),
    getStatus('steering'),
    getStatus('brakes'),
    getStatus('air_cleaner'),
    getStatus('attachment_bucket'),
    getStatus('lights_beacons'),
    getStatus('seatbelt'),
    getStatus('mirrors_glass'),
    getStatus('fire_extinguisher'),
    getStatus('horn_beeper'),
    getStatus('controls_estop'),
    p.generalNotes || '',
    p.signatureDataUrl ? 'YES' : 'NO'
  ];
}

export const ServerTowerAdmin: React.FC<ServerTowerAdminProps> = ({ workers, machines, onReloadMasterData }) => {
  const [activeAdminSubtab, setActiveAdminSubtab] = useState<'csv' | 'machines' | 'workers' | 'dockets' | 'branding'>('csv');
  const [serverIp, setServerIp] = useState<string>(getTailscaleIp());
  const [showIpModal, setShowIpModal] = useState<boolean>(false);
  
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][]; rawContent: string } | null>(null);
  const [serverDockets, setServerDockets] = useState<JobDocket[]>([]);
  const [selectedInspectDocket, setSelectedInspectDocket] = useState<JobDocket | null>(null);
  
  const [templateConfig, setTemplateConfig] = useState<DocketTemplateConfig>(() => getSavedDocketTemplate());
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const handleIpChange = () => {
      setServerIp(getTailscaleIp());
    };
    window.addEventListener('tailscale-ip-changed', handleIpChange);
    return () => window.removeEventListener('tailscale-ip-changed', handleIpChange);
  }, []);

  // New Machine Modal/Form State
  const [showAddMachine, setShowAddMachine] = useState<boolean>(false);
  const [newUnitCode, setNewUnitCode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newRego, setNewRego] = useState<string>('');
  const [newPrestartType, setNewPrestartType] = useState<PrestartType>(2);
  const [newCurrentHours, setNewCurrentHours] = useState<number>(1000);

  // New Worker State
  const [showAddWorker, setShowAddWorker] = useState<boolean>(false);
  const [newWorkerName, setNewWorkerName] = useState<string>('');
  const [newWorkerRole, setNewWorkerRole] = useState<string>('Plant Operator');
  const [newWorkerPin, setNewWorkerPin] = useState<string>('1234');

  const fetchServerInfo = async () => {
    setIsLoading(true);
    try {
      const currentIp = getTailscaleIp();

      const { data: infoData } = await smartFetchApi('/api/server-info', {}, currentIp);
      if (infoData) setServerInfo(infoData);

      let fetchedHeaders: string[] = [];
      let fetchedRows: string[][] = [];
      let rawTextContent = '';

      try {
        const { data: csv } = await smartFetchApi('/api/prestarts/csv-data', {}, currentIp);
        if (csv && csv.headers && csv.rows && csv.rows.length > 0) {
          fetchedHeaders = csv.headers;
          fetchedRows = csv.rows;
          rawTextContent = csv.rawContent || '';
        } else {
          // Direct fallback: fetch raw CSV and parse
          const directCsvUrl = buildDirectUrl('/api/reports/prestarts.csv', currentIp);
          const rawRes = await fetch(directCsvUrl);
          if (rawRes.ok) {
            const rawText = await rawRes.text();
            if (rawText && !rawText.trim().startsWith('<')) {
              const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
              if (lines.length > 0) {
                fetchedHeaders = parseCsvLine(lines[0]);
                fetchedRows = lines.slice(1).map(l => parseCsvLine(l));
                rawTextContent = rawText;
              }
            }
          }
        }
      } catch (csvErr) {
        console.warn('Error fetching CSV data:', csvErr);
      }

      const defaultHeaders = [
        'Submission_ID', 'Timestamp', 'Date', 'Worker_Name', 'Machine_Code', 'Machine_Name',
        'Prestart_Type', 'Engine_Hours', 'Overall_Status', 'Engine_Oil', 'Hydraulic_Oil',
        'Coolant', 'Transmission_Drive_Oil', 'Fuel_Water_Trap', 'Tracks_Undercarriage',
        'Tires_Wheel_Nuts', 'Steering_Linkages', 'Brakes_Park_Brake', 'Air_Cleaner',
        'Bucket_Pins_Attachment', 'Lights_Beacons', 'Seatbelt', 'Mirrors_Glass',
        'Fire_Extinguisher', 'Horn_Reverse_Alarm', 'Controls_EStop', 'General_Notes',
        'Operator_Signature_Attached'
      ];

      const headers = fetchedHeaders.length > 0 ? fetchedHeaders : defaultHeaders;
      const rows = [...fetchedRows];

      // Merge local offline prestarts if any exist that aren't already in fetched rows
      const offlinePrestarts = getOfflinePrestarts();
      if (offlinePrestarts.length > 0) {
        const existingIds = new Set(rows.map(r => r[0]));
        for (const offP of offlinePrestarts) {
          if (!existingIds.has(offP.id)) {
            rows.unshift(convertSubmissionToCsvRow(offP));
          }
        }
      }

      setCsvData({ headers, rows, rawContent: rawTextContent });

      const { data: dockets } = await smartFetchApi('/api/dockets', {}, currentIp);
      if (Array.isArray(dockets)) setServerDockets(dockets);

      const { data: tmpl } = await smartFetchApi('/api/dockets/template', {}, currentIp);
      if (tmpl && tmpl.companyName) {
        setTemplateConfig(tmpl);
        saveSavedDocketTemplate(tmpl);
      }
    } catch (e) {
      console.error('Failed to fetch server tower data', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    saveSavedDocketTemplate(templateConfig);
    try {
      const currentIp = getTailscaleIp();
      await smartFetchApi('/api/dockets/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateConfig),
      }, currentIp);
    } catch (e) {
      console.warn('Saved template locally:', e);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  useEffect(() => {
    fetchServerInfo();
  }, [serverIp]);

  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitCode || !newName) return;

    const currentIp = getTailscaleIp();
    const newMac: Machine = {
      id: 'm_' + Date.now(),
      unitCode: newUnitCode,
      name: newName,
      regoOrSerial: newRego || 'N/A',
      prestartType: newPrestartType,
      currentHours: newCurrentHours,
      status: 'Operational',
    };

    try {
      await smartFetchApi('/api/master/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMac, ip: currentIp }),
      }, currentIp);

      setShowAddMachine(false);
      setNewUnitCode('');
      setNewName('');
      onReloadMasterData();
      fetchServerInfo();
    } catch (e) {
      alert('Failed to save machine to master list');
    }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName) return;

    const currentIp = getTailscaleIp();
    const newWorker: Worker = {
      id: 'w_' + Date.now(),
      name: newWorkerName,
      role: newWorkerRole,
      pin: newWorkerPin,
      active: true,
    };

    try {
      await smartFetchApi('/api/master/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newWorker, ip: currentIp }),
      }, currentIp);

      setShowAddWorker(false);
      setNewWorkerName('');
      onReloadMasterData();
      fetchServerInfo();
    } catch (e) {
      alert('Failed to save worker');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Server Tower Tailscale Header Card */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <Server className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black tracking-tight text-white">
                  TAILSCALE SERVER TOWER NODE
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black tracking-wide">
                  ONLINE & ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                Connected via Tailscale Mesh Network IP:
                <button
                  onClick={() => setShowIpModal(true)}
                  className="font-mono text-amber-400 font-extrabold hover:underline flex items-center gap-1 cursor-pointer bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800"
                >
                  {serverIp} <Edit2 className="w-3 h-3 text-slate-400" />
                </button>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchServerInfo}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Server Data
            </button>

            <a
              href={buildDirectUrl('/api/reports/prestarts.csv', getTailscaleIp())}
              download="prestarts_master.csv"
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Master CSV
            </a>
          </div>
        </div>

        {/* Quick Server Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Stored CSV Rows</span>
            <span className="text-2xl font-black text-white mt-1 block font-mono">{serverInfo?.serverPrestartsCount || 0}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Server Dockets</span>
            <span className="text-2xl font-black text-white mt-1 block font-mono">{serverInfo?.serverDocketsCount || 0}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Master Machines</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block font-mono">{machines.length}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Registered Workers</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block font-mono">{workers.length}</span>
          </div>
        </div>
      </div>

      {/* Admin Navigation Subtabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-3 overflow-x-auto">
        <button
          onClick={() => setActiveAdminSubtab('csv')}
          className={`pb-3.5 px-5 text-xs font-black transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeAdminSubtab === 'csv'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Server prestarts.csv Viewer ({csvData?.rows?.length || 0})
        </button>

        <button
          onClick={() => setActiveAdminSubtab('machines')}
          className={`pb-3.5 px-5 text-xs font-black transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeAdminSubtab === 'machines'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          Machine Master List ({machines.length})
        </button>

        <button
          onClick={() => setActiveAdminSubtab('workers')}
          className={`pb-3.5 px-5 text-xs font-black transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeAdminSubtab === 'workers'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Worker Master List ({workers.length})
        </button>

        <button
          onClick={() => setActiveAdminSubtab('dockets')}
          className={`pb-3.5 px-5 text-xs font-black transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeAdminSubtab === 'dockets'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          Server Dockets ({serverDockets.length})
        </button>

        <button
          onClick={() => setActiveAdminSubtab('branding')}
          className={`pb-3.5 px-5 text-xs font-black transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeAdminSubtab === 'branding'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-500" />
          Company Branding & Details
        </button>
      </div>

      {/* Subtab 1: prestarts.csv Viewer */}
      {activeAdminSubtab === 'csv' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                Live prestarts.csv File ({csvData?.rows?.length || 0} Entries Logged)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                All prestarts submitted by operators are stored in standard CSV format on the server.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchServerInfo}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh CSV
              </button>

              <a
                href={buildDirectUrl('/api/reports/prestarts.csv', getTailscaleIp())}
                download="prestarts_master.csv"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-500 transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Direct Export CSV
              </a>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl max-h-96">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase sticky top-0">
                <tr>
                  {csvData?.headers.map((h, i) => (
                    <th key={i} className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {csvData?.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2.5 whitespace-nowrap">
                        {cell === 'N/A' ? (
                          <span className="text-slate-400 font-sans italic">N/A</span>
                        ) : cell.includes('SAFE_TO_OPERATE') ? (
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                            {cell}
                          </span>
                        ) : cell.includes('DEFECT') || cell.includes('UNSAFE') ? (
                          <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                            {cell}
                          </span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {(!csvData || csvData.rows.length === 0) && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-sans text-xs">
                      No prestart entries logged on server tower yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Machine Master List Management */}
      {activeAdminSubtab === 'machines' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white">
                Machine Master List & Prestart Form Types
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure prestart template assignment for each machine (<code className="font-bold text-amber-500">prestartType = 1, 2, or 3</code>).
              </p>
            </div>

            <button
              onClick={() => setShowAddMachine(!showAddMachine)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add New Machine
            </button>
          </div>

          {/* Add Machine Form */}
          {showAddMachine && (
            <form onSubmit={handleAddMachine} className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="font-black text-xs text-slate-900 dark:text-white">Register New Machinery Item</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Unit Code (e.g. EX-301)</label>
                  <input
                    type="text"
                    required
                    value={newUnitCode}
                    onChange={e => setNewUnitCode(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Machine Name / Description</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Assigned Prestart Form Type</label>
                  <select
                    value={newPrestartType}
                    onChange={e => setNewPrestartType(parseInt(e.target.value) as PrestartType)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-extrabold text-amber-500"
                  >
                    <option value={1}>Type 1: Wheeled Heavy (Tires, Brakes, Steering)</option>
                    <option value={2}>Type 2: Tracked Heavy (Tracks, Undercarriage)</option>
                    <option value={3}>Type 3: Auxiliary / Light Vehicle (Tires, Tow Hitch)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Initial Engine Hours</label>
                  <input
                    type="number"
                    value={newCurrentHours}
                    onChange={e => setNewCurrentHours(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMachine(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer shadow-sm"
                >
                  Save Machine
                </button>
              </div>
            </form>
          )}

          {/* Machines Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Prestart Form Assigned</th>
                  <th className="p-3">Engine Hours</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {machines.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-black text-amber-500">{m.unitCode}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{m.name}</td>
                    <td className="p-3 font-bold">
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[11px]">
                        Prestart Type {m.prestartType}: {m.prestartType === 1 ? 'Wheeled' : m.prestartType === 2 ? 'Tracked' : 'Aux/Light'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">{m.currentHours} hrs</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        m.status === 'Operational' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: Worker Master List Management */}
      {activeAdminSubtab === 'workers' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white">
                Worker & Operator Master List
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Operators registered on server tower who can complete prestart inspections and sign job dockets.
              </p>
            </div>

            <button
              onClick={() => setShowAddWorker(!showAddWorker)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Worker
            </button>
          </div>

          {showAddWorker && (
            <form onSubmit={handleAddWorker} className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="font-black text-xs text-slate-900 dark:text-white">Register New Team Member</h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newWorkerName}
                    onChange={e => setNewWorkerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Role / Designation</label>
                  <input
                    type="text"
                    value={newWorkerRole}
                    onChange={e => setNewWorkerRole(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Security PIN</label>
                  <input
                    type="text"
                    value={newWorkerPin}
                    onChange={e => setNewWorkerPin(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWorker(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer shadow-sm"
                >
                  Save Worker
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workers.map(w => (
              <div key={w.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-xs text-slate-900 dark:text-white">{w.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{w.role}</div>
                </div>
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtab 4: Server Dockets Repository */}
      {activeAdminSubtab === 'dockets' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h3 className="font-black text-sm text-slate-900 dark:text-white">
            Server Tower Job Dockets Directory
          </h3>

          <div className="space-y-3">
            {serverDockets.map(doc => (
              <div key={doc.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-amber-500 text-xs bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">{doc.docketNumber}</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{doc.clientName}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Machine: <strong>{doc.machineCode}</strong> | Operator: {doc.workerName} | Hours: {doc.totalMachineHours} hrs
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-black text-slate-900 dark:text-white font-mono mr-2">
                    ${doc.totalIncGst?.toFixed(2)}
                  </span>

                  <button
                    onClick={() => setSelectedInspectDocket(doc)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Open Docket
                  </button>

                  <button
                    onClick={() => {
                      const pdf = generateDocketPDF(doc);
                      pdf.save(`${doc.docketNumber}.pdf`);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" /> PDF
                  </button>
                </div>
              </div>
            ))}

            {serverDockets.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No job dockets submitted to server tower yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtab 5: Company Branding & Details */}
      {activeAdminSubtab === 'branding' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                Company Branding & Docket Headers
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Edit your company name, ABN, and contact information used across Daily Job Dockets and PDF exports.
              </p>
            </div>
            {saveSuccess && (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-1.5 animate-fade-in">
                <Check className="w-4 h-4" /> Company Details Saved & Synced!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                Company Legal Name
              </label>
              <input
                type="text"
                value={templateConfig.companyName}
                onChange={e => setTemplateConfig({ ...templateConfig, companyName: e.target.value })}
                placeholder="e.g. YOUR COMPANY NAME PTY LTD"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                App / Header Short Name
              </label>
              <input
                type="text"
                value={templateConfig.logoText}
                onChange={e => setTemplateConfig({ ...templateConfig, logoText: e.target.value })}
                placeholder="e.g. APEX CIVIL or MY CONTRACTING"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                ABN / Registration Number
              </label>
              <input
                type="text"
                value={templateConfig.companyAbn}
                onChange={e => setTemplateConfig({ ...templateConfig, companyAbn: e.target.value })}
                placeholder="e.g. ABN: 00 000 000 000"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                Business Address
              </label>
              <input
                type="text"
                value={templateConfig.companyAddress}
                onChange={e => setTemplateConfig({ ...templateConfig, companyAddress: e.target.value })}
                placeholder="e.g. 100 Field Depot Way, Perth WA 6000"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                Contact Phone
              </label>
              <input
                type="text"
                value={templateConfig.companyPhone}
                onChange={e => setTemplateConfig({ ...templateConfig, companyPhone: e.target.value })}
                placeholder="e.g. (08) 9000 1122"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                Contact Email
              </label>
              <input
                type="email"
                value={templateConfig.companyEmail}
                onChange={e => setTemplateConfig({ ...templateConfig, companyEmail: e.target.value })}
                placeholder="e.g. dockets@mycompany.com.au"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSaveTemplate}
              className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" /> Save Company Branding Settings
            </button>
          </div>
        </div>
      )}

      {/* Admin Docket Viewer Modal */}
      <DocketViewerModal
        docket={selectedInspectDocket}
        onClose={() => setSelectedInspectDocket(null)}
      />

      {/* Tailscale IP Config Modal */}
      <TailscaleIpModal
        isOpen={showIpModal}
        onClose={() => setShowIpModal(false)}
        onIpUpdated={(newIp) => setServerIp(newIp)}
      />
    </div>
  );
};
