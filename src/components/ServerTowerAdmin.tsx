import React, { useState, useEffect } from 'react';
import { Worker, Machine, JobDocket, PrestartType, PrestartSubmission, DocketTemplateConfig, PrestartTemplateStore, CheckItemDefinition, PrestartTypeDefinition } from '../types';
import { DocketViewerModal } from './DocketViewerModal';
import { TailscaleIpModal } from './TailscaleIpModal';
import { generateDocketPDF } from '../utils/pdfGenerator';
import { getTailscaleIp, getOfflinePrestarts } from '../utils/offlineStore';
import { smartFetchApi, buildDirectUrl } from '../utils/apiClient';
import { getSavedDocketTemplate, saveSavedDocketTemplate, getSavedPrestartTemplates, saveSavedPrestartTemplates } from '../data/defaultData';
import { Server, Database, FileSpreadsheet, Download, RefreshCw, Users, Truck, Plus, Check, Edit2, ShieldCheck, Wifi, Eye, Building2, Sliders, CheckSquare, Square, Search, Trash2, Sparkles, Layers, ListChecks } from 'lucide-react';

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
  const [activeAdminSubtab, setActiveAdminSubtab] = useState<'csv' | 'prestart_templates' | 'machines' | 'workers' | 'dockets' | 'branding'>('csv');
  const [serverIp, setServerIp] = useState<string>(getTailscaleIp());
  const [showIpModal, setShowIpModal] = useState<boolean>(false);
  
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][]; rawContent: string } | null>(null);
  const [serverDockets, setServerDockets] = useState<JobDocket[]>([]);
  const [selectedInspectDocket, setSelectedInspectDocket] = useState<JobDocket | null>(null);
  
  const [templateConfig, setTemplateConfig] = useState<DocketTemplateConfig>(() => getSavedDocketTemplate());
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Prestart Templates & Questions Manager State
  const [templateStore, setTemplateStore] = useState<PrestartTemplateStore>(() => getSavedPrestartTemplates());
  const [selectedPrestartTypeId, setSelectedPrestartTypeId] = useState<number>(1);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [questionSearchQuery, setQuestionSearchQuery] = useState<string>('');
  const [prestartSaveSuccess, setPrestartSaveSuccess] = useState<boolean>(false);

  // Add Prestart Type Modal
  const [showAddPrestartTypeModal, setShowAddPrestartTypeModal] = useState<boolean>(false);
  const [newTypeName, setNewTypeName] = useState<string>('');
  const [newTypeDesc, setNewTypeDesc] = useState<string>('');

  // Add Custom Question Modal
  const [showAddQuestionModal, setShowAddQuestionModal] = useState<boolean>(false);
  const [newQCategory, setNewQCategory] = useState<'Fluid Levels' | 'Ground & Mechanical' | 'Cab & Safety' | 'Operational Checks' | 'Special & Rigging'>('Fluid Levels');
  const [newQLabel, setNewQLabel] = useState<string>('');
  const [newQDesc, setNewQDesc] = useState<string>('');

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

          // Additional JSON fallback if CSV is empty
          if (fetchedRows.length === 0) {
            const { data: jsonPrestarts } = await smartFetchApi('/api/prestarts', {}, currentIp);
            if (Array.isArray(jsonPrestarts) && jsonPrestarts.length > 0) {
              fetchedRows = jsonPrestarts.map(p => convertSubmissionToCsvRow(p));
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
      if (rows.length > 0) {
        setServerInfo((prev: any) => ({
          ...(prev || {}),
          serverPrestartsCount: Math.max(prev?.serverPrestartsCount || 0, rows.length),
        }));
      }

      const { data: dockets } = await smartFetchApi('/api/dockets', {}, currentIp);
      if (Array.isArray(dockets)) setServerDockets(dockets);

      const { data: tmpl } = await smartFetchApi('/api/dockets/template', {}, currentIp);
      if (tmpl && tmpl.companyName) {
        setTemplateConfig(tmpl);
        saveSavedDocketTemplate(tmpl);
      }

      const { data: prestartStore } = await smartFetchApi('/api/prestart-templates', {}, currentIp);
      if (prestartStore && prestartStore.types && prestartStore.questions) {
        setTemplateStore(prestartStore);
        saveSavedPrestartTemplates(prestartStore);
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

  const handleSavePrestartTemplates = async (updatedStore?: PrestartTemplateStore) => {
    const storeToSave = updatedStore || templateStore;
    saveSavedPrestartTemplates(storeToSave);
    try {
      const currentIp = getTailscaleIp();
      await smartFetchApi('/api/prestart-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeToSave),
      }, currentIp);
    } catch (e) {
      console.warn('Saved prestart template locally:', e);
    }
    setPrestartSaveSuccess(true);
    setTimeout(() => setPrestartSaveSuccess(false), 3000);
  };

  const handleToggleQuestion = (questionId: string) => {
    const currentAssignments = templateStore.assignments[selectedPrestartTypeId] || [];
    const isCurrentlyActive = currentAssignments.includes(questionId);
    let updatedAssignments: string[];

    if (isCurrentlyActive) {
      updatedAssignments = currentAssignments.filter(id => id !== questionId);
    } else {
      updatedAssignments = [...currentAssignments, questionId];
    }

    const newStore: PrestartTemplateStore = {
      ...templateStore,
      assignments: {
        ...templateStore.assignments,
        [selectedPrestartTypeId]: updatedAssignments,
      }
    };

    setTemplateStore(newStore);
    handleSavePrestartTemplates(newStore);
  };

  const handleToggleCategory = (categoryName: string, enable: boolean) => {
    const currentAssignments = templateStore.assignments[selectedPrestartTypeId] || [];
    const categoryQuestionIds = templateStore.questions
      .filter(q => q.category === categoryName)
      .map(q => q.id);

    let updatedAssignments: string[];
    if (enable) {
      // Add all category items that aren't already included
      const toAdd = categoryQuestionIds.filter(id => !currentAssignments.includes(id));
      updatedAssignments = [...currentAssignments, ...toAdd];
    } else {
      // Remove all category items
      updatedAssignments = currentAssignments.filter(id => !categoryQuestionIds.includes(id));
    }

    const newStore: PrestartTemplateStore = {
      ...templateStore,
      assignments: {
        ...templateStore.assignments,
        [selectedPrestartTypeId]: updatedAssignments,
      }
    };

    setTemplateStore(newStore);
    handleSavePrestartTemplates(newStore);
  };

  const handleAddPrestartType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    const newId = Math.max(...templateStore.types.map(t => t.id), 0) + 1;
    const newTypeObj: PrestartTypeDefinition = {
      id: newId,
      name: newTypeName.trim(),
      description: newTypeDesc.trim() || 'Custom Plant Inspection Checklist',
      badgeColor: 'amber',
    };

    // Default with core safety items
    const defaultCoreIds = ['engine_oil', 'coolant', 'fuel_level', 'brakes', 'lights_beacons', 'seatbelt', 'fire_extinguisher', 'horn_beeper', 'controls_estop'];

    const newStore: PrestartTemplateStore = {
      ...templateStore,
      types: [...templateStore.types, newTypeObj],
      assignments: {
        ...templateStore.assignments,
        [newId]: defaultCoreIds,
      }
    };

    setTemplateStore(newStore);
    setSelectedPrestartTypeId(newId);
    setNewTypeName('');
    setNewTypeDesc('');
    setShowAddPrestartTypeModal(false);
    handleSavePrestartTemplates(newStore);
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQLabel.trim()) return;

    const newId = 'custom_q_' + Date.now();
    const newQuestion: CheckItemDefinition = {
      id: newId,
      category: newQCategory,
      label: newQLabel.trim(),
      description: newQDesc.trim() || undefined,
    };

    const currentAssignments = templateStore.assignments[selectedPrestartTypeId] || [];
    const updatedAssignments = [...currentAssignments, newId];

    const newStore: PrestartTemplateStore = {
      ...templateStore,
      questions: [...templateStore.questions, newQuestion],
      assignments: {
        ...templateStore.assignments,
        [selectedPrestartTypeId]: updatedAssignments,
      }
    };

    setTemplateStore(newStore);
    setNewQLabel('');
    setNewQDesc('');
    setShowAddQuestionModal(false);
    handleSavePrestartTemplates(newStore);
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
          onClick={() => setActiveAdminSubtab('prestart_templates')}
          className={`pb-3.5 px-5 text-xs font-black transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeAdminSubtab === 'prestart_templates'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ListChecks className="w-4 h-4 text-amber-500" />
          Prestart Questions & Templates ({templateStore.types.length} Types, {templateStore.questions.length} Items)
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

      {/* Subtab: Prestart Questions & Templates Manager */}
      {activeAdminSubtab === 'prestart_templates' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            {/* Header & Save Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    Prestart Master Config
                  </span>
                  {prestartSaveSuccess && (
                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1 animate-pulse">
                      <Check className="w-3.5 h-3.5" /> Saved & Synced to Server Tower!
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  Prestart Types & Question Checklist Admin
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                  Select a machinery type below to tick which prestart questions apply. You can also add unlimited prestart types or custom questions for specific site equipment.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowAddPrestartTypeModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-500" /> New Prestart Type
                </button>

                <button
                  onClick={() => setShowAddQuestionModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-500" /> Add Custom Question
                </button>

                <button
                  onClick={() => handleSavePrestartTemplates()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" /> Save Configuration
                </button>
              </div>
            </div>

            {/* Prestart Type Selection Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-500" />
                  Select Prestart Machine Type to Configure
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {templateStore.types.length} Machine Types Available
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {templateStore.types.map((typeObj) => {
                  const isSelected = selectedPrestartTypeId === typeObj.id;
                  const assignedCount = (templateStore.assignments[typeObj.id] || []).length;
                  const totalQuestionsCount = templateStore.questions.length;

                  return (
                    <button
                      key={typeObj.id}
                      onClick={() => setSelectedPrestartTypeId(typeObj.id)}
                      className={`p-4 rounded-2xl border text-left transition relative cursor-pointer flex flex-col justify-between h-full ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/60 ring-2 ring-amber-500/30'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            Type {typeObj.id}
                          </span>

                          <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 font-mono">
                            {assignedCount}/{totalQuestionsCount} items
                          </span>
                        </div>

                        <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                          {typeObj.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {typeObj.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-medium">Click to configure questions</span>
                        {isSelected && (
                          <span className="text-amber-500 font-black flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> ACTIVE
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Questions Filter & Search Toolbar */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {['ALL', 'Fluid Levels', 'Ground & Mechanical', 'Cab & Safety', 'Operational Checks', 'Special & Rigging'].map((cat) => {
                  const isActive = categoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter question text..."
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            {/* Question Bank Ticking Grid */}
            <div className="space-y-6">
              {['Fluid Levels', 'Ground & Mechanical', 'Cab & Safety', 'Operational Checks', 'Special & Rigging'].map((categoryName) => {
                // Check if this category matches current categoryFilter
                if (categoryFilter !== 'ALL' && categoryFilter !== categoryName) return null;

                const categoryQuestions = templateStore.questions.filter((q) => {
                  if (q.category !== categoryName) return false;
                  if (questionSearchQuery.trim()) {
                    const query = questionSearchQuery.toLowerCase();
                    return q.label.toLowerCase().includes(query) || (q.description && q.description.toLowerCase().includes(query));
                  }
                  return true;
                });

                if (categoryQuestions.length === 0) return null;

                const activeAssignmentsForType = templateStore.assignments[selectedPrestartTypeId] || [];
                const activeCountInCategory = categoryQuestions.filter(q => activeAssignmentsForType.includes(q.id)).length;
                const allEnabled = activeCountInCategory === categoryQuestions.length;

                return (
                  <div key={categoryName} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          {categoryName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {activeCountInCategory} of {categoryQuestions.length} ticked
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleCategory(categoryName, true)}
                          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Tick All
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button
                          onClick={() => handleToggleCategory(categoryName, false)}
                          className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                        >
                          Untick All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {categoryQuestions.map((q) => {
                        const isTicked = activeAssignmentsForType.includes(q.id);

                        return (
                          <div
                            key={q.id}
                            onClick={() => handleToggleQuestion(q.id)}
                            className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                              isTicked
                                ? 'bg-white dark:bg-slate-900 border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                                : 'bg-slate-50/70 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800/80 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition ${
                              isTicked
                                ? 'bg-emerald-500 text-slate-950 font-black'
                                : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}>
                              {isTicked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h5 className={`text-xs font-bold leading-snug ${
                                  isTicked ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                  {q.label}
                                </h5>
                                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                  isTicked ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                }`}>
                                  {isTicked ? 'Active' : 'Off'}
                                </span>
                              </div>
                              {q.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                  {q.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Machine Prestart Type Mapping Quick Reference */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-500" />
                Fleet Machine Prestart Type Mapping
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Assigned Prestart Types for all current fleet machines. Change any machine's type here to immediately update its prestart checklist.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {machines.map((m) => (
                  <div key={m.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black text-amber-500 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {m.unitCode}
                      </span>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">
                        {m.name}
                      </h5>
                    </div>

                    <select
                      value={m.prestartType}
                      onChange={(e) => {
                        const newTypeNum = parseInt(e.target.value, 10);
                        m.prestartType = newTypeNum;
                        onReloadMasterData();
                      }}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {templateStore.types.map(t => (
                        <option key={t.id} value={t.id}>
                          Type {t.id}: {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Prestart Type Modal */}
      {showAddPrestartTypeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-500" />
              Create New Prestart Machine Type
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Define a custom prestart type for specific site machinery (e.g. Scaffolding Towers, Hydro-Excavators, Mobile Lighting Towers).
            </p>

            <form onSubmit={handleAddPrestartType} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Type Name <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hydro-Vacuum Excavators"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Description / Applicability
                </label>
                <input
                  type="text"
                  placeholder="e.g. Non-destructive digging units and high pressure pumps"
                  value={newTypeDesc}
                  onChange={(e) => setNewTypeDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPrestartTypeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer shadow-sm"
                >
                  Create Prestart Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Question Modal */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              Add Custom Question to Master Bank
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create a custom site inspection question. It will be added to the Master Bank and enabled for the currently selected Prestart Type.
            </p>

            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Category
                </label>
                <select
                  value={newQCategory}
                  onChange={(e) => setNewQCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                >
                  <option value="Fluid Levels">Fluid Levels</option>
                  <option value="Ground & Mechanical">Ground & Mechanical</option>
                  <option value="Cab & Safety">Cab & Safety</option>
                  <option value="Operational Checks">Operational Checks</option>
                  <option value="Special & Rigging">Special & Rigging</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Question Label <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. High Voltage Earth Cable Integrity"
                  value={newQLabel}
                  onChange={(e) => setNewQLabel(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Detailed Instructions / Hint
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inspect bonding clamp connection and insulation sheath"
                  value={newQDesc}
                  onChange={(e) => setNewQDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer shadow-sm"
                >
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
                    {templateStore.types.map(t => (
                      <option key={t.id} value={t.id}>
                        Type {t.id}: {t.name}
                      </option>
                    ))}
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
                        Prestart Type {m.prestartType}: {templateStore.types.find(t => t.id === m.prestartType)?.name || `Type ${m.prestartType}`}
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
