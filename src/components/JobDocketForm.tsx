import React, { useState, useEffect } from 'react';
import { Worker, Machine, JobDocket, DocketLineItem } from '../types';
import { SignatureCanvas } from './SignatureCanvas';
import { DrawingCanvasPad } from './DrawingCanvasPad';
import { saveOfflineDocket, attemptServerSync, getTailscaleIp } from '../utils/offlineStore';
import { smartFetchApi } from '../utils/apiClient';
import { generateDocketPDF } from '../utils/pdfGenerator';
import { FileText, Plus, Trash2, Download, Send, Eye, ShieldCheck, Check, DollarSign, Clock, Building, Edit3, Grid } from 'lucide-react';

interface JobDocketFormProps {
  workers: Worker[];
  machines: Machine[];
  onSubmissionComplete: () => void;
}

export const JobDocketForm: React.FC<JobDocketFormProps> = ({ workers, machines, onSubmissionComplete }) => {
  const [docketMode, setDocketMode] = useState<'paper' | 'structured'>('paper');
  const [docketNumber, setDocketNumber] = useState<string>('8183');
  const [drawingDataUrl, setDrawingDataUrl] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  
  const [clientName, setClientName] = useState<string>('');
  const [jobSite, setJobSite] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  
  const [startTime, setStartTime] = useState<string>('');
  const [breakHours, setBreakHours] = useState<number>(0);
  const [finishTime, setFinishTime] = useState<string>('');

  const [startHours, setStartHours] = useState<number>(0);
  const [endHours, setEndHours] = useState<number>(0);
  const [loadCount, setLoadCount] = useState<number>(0);

  const [lineItems, setLineItems] = useState<DocketLineItem[]>([
    {
      id: 'li_1',
      description: '',
      itemType: 'Machine Hours',
      qtyOrHours: 0,
      unitRate: 0,
      totalAmount: 0,
    }
  ]);

  const [generalNotes, setGeneralNotes] = useState<string>('');

  const [operatorSignature, setOperatorSignature] = useState<string>('');
  const [clientSignature, setClientSignature] = useState<string>('');
  const [clientSignerName, setClientSignerName] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedDocket, setSubmittedDocket] = useState<JobDocket | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch unique sequential docket number from server tower
    const targetIp = getTailscaleIp();
    smartFetchApi('/api/dockets/next-number', {}, targetIp)
      .then(({ data }) => {
        if (data && data.nextDocketNumber) {
          setDocketNumber(data.nextDocketNumber);
        }
      })
      .catch(() => setDocketNumber('8183'));

    const todayStr = new Date().toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    setDate(todayStr);

    if (workers.length > 0 && !selectedWorkerId) setSelectedWorkerId(workers[0].id);
    if (machines.length > 0 && !selectedMachineId) {
      setSelectedMachineId(machines[0].id);
      const mac = machines[0];
      setStartHours(mac.currentHours);
      setEndHours(mac.currentHours + 8.5);
    }
  }, [workers, machines]);

  const activeWorker = workers.find(w => w.id === selectedWorkerId);
  const activeMachine = machines.find(m => m.id === selectedMachineId);

  const handleMachineSelect = (mId: string) => {
    setSelectedMachineId(mId);
    const mac = machines.find(m => m.id === mId);
    if (mac) {
      setStartHours(mac.currentHours);
      setEndHours(mac.currentHours + 8.5);
    }
  };

  // Calculations
  const totalMachineHours = Math.max(0, parseFloat((endHours - startHours).toFixed(1)));

  const updateLineItem = (id: string, field: keyof DocketLineItem, value: any) => {
    setLineItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'qtyOrHours' || field === 'unitRate') {
          updated.totalAmount = parseFloat(((updated.qtyOrHours || 0) * (updated.unitRate || 0)).toFixed(2));
        }
        return updated;
      })
    );
  };

  const addLineItem = () => {
    const newItem: DocketLineItem = {
      id: 'li_' + Date.now(),
      description: '',
      itemType: 'Machine Hours',
      qtyOrHours: 0,
      unitRate: 0,
      totalAmount: 0,
    };
    setLineItems(prev => [...prev, newItem]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = lineItems.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  const gstAmount = parseFloat((subtotal * 0.1).toFixed(2));
  const totalIncGst = parseFloat((subtotal + gstAmount).toFixed(2));

  const buildDocketObject = (): JobDocket => ({
    id: 'doc_' + Date.now(),
    docketNumber,
    date,
    workerId: activeWorker?.id || '',
    workerName: activeWorker?.name || '',
    machineId: activeMachine?.id || '',
    machineCode: activeMachine?.unitCode || '',
    machineName: activeMachine?.name || '',
    clientName,
    jobSite,
    poNumber,
    startHours,
    endHours,
    totalMachineHours,
    startTime,
    breakHours,
    finishTime,
    startHourMeter: startHours,
    finishHourMeter: endHours,
    loadCount,
    drawingDataUrl,
    lineItems,
    subtotal,
    gstAmount,
    totalIncGst,
    operatorSignature,
    clientSignature,
    clientSignerName,
    generalNotes,
    synced: false,
  });

  const handleDownloadPDF = () => {
    const docketObj = buildDocketObject();
    const pdf = generateDocketPDF(docketObj);
    pdf.save(`${docketNumber}_${activeMachine?.unitCode || 'docket'}.pdf`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedWorkerId || !activeWorker) {
      setFormError('Please select a Worker / Operator.');
      return;
    }
    if (!selectedMachineId || !activeMachine) {
      setFormError('Please select a Machine.');
      return;
    }
    if (!clientName || !jobSite) {
      setFormError('Client Name and Job Site location are required.');
      return;
    }
    if (lineItems.length === 0) {
      setFormError('Please add at least one line item to the docket.');
      return;
    }
    if (!operatorSignature) {
      setFormError('Plant Operator Signature is required.');
      return;
    }

    setIsSubmitting(true);

    const newDocket = buildDocketObject();

    // Save locally
    saveOfflineDocket(newDocket);

    // Sync to server tower
    const syncRes = await attemptServerSync();
    if (syncRes.success) {
      newDocket.synced = true;
      newDocket.syncedAt = new Date().toISOString();
    }

    setIsSubmitting(false);
    setSubmittedDocket(newDocket);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Title & Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
            Daily Operations & Docket Book
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight flex items-center gap-2">
            Daily Job Docket Pad
            <span className="font-mono text-xs font-black text-red-600 bg-red-50 dark:bg-red-950/50 px-2.5 py-1 rounded-full border border-red-500/30">
              NO. {docketNumber}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Draw, write freehand notes, or enter structured hours directly on the docket sheet.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex items-center gap-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setDocketMode('paper')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                docketMode === 'paper'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Paper Pad Canvas
            </button>
            <button
              type="button"
              onClick={() => setDocketMode('structured')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                docketMode === 'structured'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> Line Items Form
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadPDF}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 text-xs font-bold hover:bg-slate-800 transition shadow-md cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            PDF
          </button>
        </div>
      </div>

      {formError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-rose-500 flex-shrink-0" />
          {formError}
        </div>
      )}

      {submittedDocket ? (
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-5 animate-fadeIn">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Docket Submitted & Synced</h3>
                <p className="text-xs text-slate-300">
                  Docket <span className="font-mono text-amber-400 font-bold">{submittedDocket.docketNumber}</span> stored on Tailscale Server Tower.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  const pdf = generateDocketPDF(submittedDocket);
                  pdf.save(`${submittedDocket.docketNumber}.pdf`);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Docket PDF
              </button>

              <button
                onClick={() => {
                  setSubmittedDocket(null);
                  onSubmissionComplete();
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Fill Another Docket
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Client: <strong className="text-white">{submittedDocket.clientName}</strong></span>
              <span>Site: <strong className="text-white">{submittedDocket.jobSite}</strong></span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Machine: <strong className="text-white">{submittedDocket.machineCode} ({submittedDocket.totalMachineHours} hrs)</strong></span>
              <span>Total Billable: <strong className="text-amber-400 font-bold">${submittedDocket.totalIncGst.toFixed(2)} Inc GST</strong></span>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PAPER DOCKET PAD MODE */}
          {docketMode === 'paper' && (
            <div className="bg-[#fefcf8] dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative font-sans text-slate-900 dark:text-slate-100">
              {/* Paper Pad Top Corner Red Docket Number Stamp */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 dark:border-slate-700 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black shadow-lg">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      DAILY JOB DOCKET
                    </h1>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                      APEX CIVIL & MINING CONTRACTORS PTY LTD
                    </p>
                  </div>
                </div>

                {/* Unique Red Incremental Docket Number Stamp */}
                <div className="bg-red-50 dark:bg-red-950/40 border-2 border-red-600 px-5 py-2 rounded-2xl text-right shadow-sm self-end sm:self-auto">
                  <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest block">
                    DOCKET NUMBER
                  </span>
                  <span className="font-mono text-2xl md:text-3xl font-black text-red-600 dark:text-red-400 tracking-wider block">
                    NO. {docketNumber}
                  </span>
                </div>
              </div>

              {/* Printed Paper Field Lines */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-bold uppercase tracking-wider">
                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300">Customer / Client:</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-amber-500/5 dark:bg-slate-800 border-b-2 border-slate-900 dark:border-slate-600 px-3 py-2 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300">Date:</label>
                  <input
                    type="text"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-amber-500/5 dark:bg-slate-800 border-b-2 border-slate-900 dark:border-slate-600 px-3 py-2 text-sm font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300">Location / Job Site:</label>
                  <input
                    type="text"
                    value={jobSite}
                    onChange={e => setJobSite(e.target.value)}
                    className="w-full bg-amber-500/5 dark:bg-slate-800 border-b-2 border-slate-900 dark:border-slate-600 px-3 py-2 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300">Operator's Name:</label>
                  <select
                    value={selectedWorkerId}
                    onChange={e => setSelectedWorkerId(e.target.value)}
                    className="w-full bg-amber-500/5 dark:bg-slate-800 border-b-2 border-slate-900 dark:border-slate-600 px-3 py-2 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300">Machine Unit:</label>
                  <select
                    value={selectedMachineId}
                    onChange={e => handleMachineSelect(e.target.value)}
                    className="w-full bg-amber-500/5 dark:bg-slate-800 border-b-2 border-slate-900 dark:border-slate-600 px-3 py-2 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    {machines.map(m => (
                      <option key={m.id} value={m.id}>
                        [{m.unitCode}] {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300">Order / PO #:</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                    className="w-full bg-amber-500/5 dark:bg-slate-800 border-b-2 border-slate-900 dark:border-slate-600 px-3 py-2 text-sm font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Freehand Drawing Canvas Overlay Section */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-amber-500" />
                    Job Description & Freehand Sketch Pad
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    (Use stylus, mouse or touch to write or draw notes directly)
                  </span>
                </div>

                <DrawingCanvasPad
                  height={220}
                  onSave={dataUrl => setDrawingDataUrl(dataUrl)}
                  initialDataUrl={drawingDataUrl}
                />

                <textarea
                  rows={2}
                  placeholder="Additional typed comments or work details..."
                  value={generalNotes}
                  onChange={e => setGeneralNotes(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* OPERATOR Shift Breakdown Grid */}
              <div className="border-2 border-slate-900 dark:border-slate-700 rounded-2xl overflow-hidden">
                <div className="bg-slate-900 text-amber-400 px-4 py-2 font-black text-xs uppercase tracking-wider">
                  OPERATOR SHIFT BREAKDOWN
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x-2 divide-y-2 sm:divide-y-0 divide-slate-900 dark:divide-slate-700 text-center bg-white dark:bg-slate-800">
                  <div className="p-2.5 space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">START TIME</span>
                    <input
                      type="text"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full text-center font-mono text-xs font-black bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="p-2.5 space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">BREAK (HRS)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={breakHours}
                      onChange={e => setBreakHours(parseFloat(e.target.value) || 0)}
                      className="w-full text-center font-mono text-xs font-black bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="p-2.5 space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">FINISH TIME</span>
                    <input
                      type="text"
                      value={finishTime}
                      onChange={e => setFinishTime(e.target.value)}
                      className="w-full text-center font-mono text-xs font-black bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="p-2.5 space-y-1 bg-amber-500/10 dark:bg-amber-950/30">
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase block">SHIFT HOURS</span>
                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white block">
                      {Math.max(0, 10.5 - breakHours).toFixed(1)} hrs
                    </span>
                  </div>
                </div>
              </div>

              {/* MACHINE Hour Meter Grid */}
              <div className="border-2 border-slate-900 dark:border-slate-700 rounded-2xl overflow-hidden">
                <div className="bg-slate-900 text-amber-400 px-4 py-2 font-black text-xs uppercase tracking-wider">
                  MACHINE HOUR METER & LOAD COUNT
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x-2 divide-y-2 sm:divide-y-0 divide-slate-900 dark:divide-slate-700 text-center bg-white dark:bg-slate-800">
                  <div className="p-2.5 space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">START METER</span>
                    <input
                      type="number"
                      step="0.1"
                      value={startHours}
                      onChange={e => setStartHours(parseFloat(e.target.value) || 0)}
                      className="w-full text-center font-mono text-xs font-black bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="p-2.5 space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">FINISH METER</span>
                    <input
                      type="number"
                      step="0.1"
                      value={endHours}
                      onChange={e => setEndHours(parseFloat(e.target.value) || 0)}
                      className="w-full text-center font-mono text-xs font-black bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="p-2.5 space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">LOAD COUNT</span>
                    <input
                      type="number"
                      value={loadCount}
                      onChange={e => setLoadCount(parseInt(e.target.value, 10) || 0)}
                      className="w-full text-center font-mono text-xs font-black bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="p-2.5 space-y-1 bg-amber-500/10 dark:bg-amber-950/30">
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase block">TOTAL MACHINE HRS</span>
                    <span className="font-mono text-sm font-black text-amber-500 block">
                      {totalMachineHours} hrs
                    </span>
                  </div>
                </div>
              </div>

              {/* Dual Signatures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <SignatureCanvas
                  label="OPERATOR'S SIGNATURE *"
                  onSave={dataUrl => setOperatorSignature(dataUrl)}
                />

                <div className="space-y-2">
                  <SignatureCanvas
                    label="SUPERVISOR'S SIGNATURE"
                    onSave={dataUrl => setClientSignature(dataUrl)}
                  />
                  <input
                    type="text"
                    placeholder="Supervisor Name & Title..."
                    value={clientSignerName}
                    onChange={e => setClientSignerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STRUCTURED FORM MODE */}
          {docketMode === 'structured' && (
            <>
              {/* Header Metadata Block */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-500" />
                1. Job Details & Client Information
              </span>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Docket #:</span>
                <span className="font-mono text-xs font-extrabold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  {docketNumber}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Client / Contractor Name *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Job Site / Location *
                </label>
                <input
                  type="text"
                  value={jobSite}
                  onChange={e => setJobSite(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Purchase Order / Contract #
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Operator / Worker *
                </label>
                <select
                  value={selectedWorkerId}
                  onChange={e => setSelectedWorkerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Machine Unit *
                </label>
                <select
                  value={selectedMachineId}
                  onChange={e => handleMachineSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>
                      [{m.unitCode}] {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Machine Start / End Hours Reading */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              <Clock className="w-4 h-4 text-amber-500" />
              2. Hour Meter Readings & Shift Duration
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Start Engine Hours
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={startHours}
                  onChange={e => setStartHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  End Engine Hours
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={endHours}
                  onChange={e => setEndHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold"
                />
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 text-center shadow-inner">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                  Total Operating Hours
                </span>
                <span className="text-2xl font-black text-white mt-1 block">
                  {totalMachineHours} <span className="text-xs text-slate-400 font-normal">Hrs</span>
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" />
                3. Work Line Items & Charges
              </span>

              <button
                type="button"
                onClick={addLineItem}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                >
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Description #{index + 1}
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Item Type</label>
                    <select
                      value={item.itemType}
                      onChange={e => updateLineItem(item.id, 'itemType', e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                    >
                      <option value="Machine Hours">Machine Hours</option>
                      <option value="Travel/Mob">Travel / Mob</option>
                      <option value="Attachment">Attachment</option>
                      <option value="Materials">Materials</option>
                      <option value="Fuel/Consumables">Fuel / Consumables</option>
                      <option value="Standby">Standby</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Qty / Hrs</label>
                    <input
                      type="number"
                      step="0.5"
                      value={item.qtyOrHours}
                      onChange={e => updateLineItem(item.id, 'qtyOrHours', parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Rate ($)</label>
                    <input
                      type="number"
                      step="1"
                      value={item.unitRate}
                      onChange={e => updateLineItem(item.id, 'unitRate', parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="md:col-span-1 flex items-center justify-between md:justify-center">
                    <span className="md:hidden text-xs font-bold text-slate-500">
                      Total: ${item.totalAmount.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      disabled={lineItems.length <= 1}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotal & GST Summary Card */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
              <div className="text-slate-400 font-bold">
                Line Items Count: <strong className="text-amber-400 font-mono">{lineItems.length}</strong>
              </div>

              <div className="text-right space-y-1.5 w-full sm:w-auto">
                <div className="flex justify-between sm:justify-end gap-6 text-slate-300">
                  <span>Subtotal (Ex GST):</span>
                  <span className="font-mono font-bold text-white">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between sm:justify-end gap-6 text-slate-300">
                  <span>GST (10%):</span>
                  <span className="font-mono font-bold text-white">${gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between sm:justify-end gap-6 text-white text-base font-black border-t border-slate-800 pt-2">
                  <span>Total Inc GST:</span>
                  <span className="font-mono text-amber-400">${totalIncGst.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Dual Signatures */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <span className="font-black text-sm text-slate-900 dark:text-white">
              4. Shift Notes & Client Sign-Off
            </span>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Shift Description / Works Executed
              </label>
              <textarea
                rows={2}
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <SignatureCanvas
                label="Plant Operator Signature *"
                onSave={dataUrl => setOperatorSignature(dataUrl)}
              />

              <div className="space-y-2">
                <SignatureCanvas
                  label="Client / Site Supervisor Sign-Off"
                  onSave={dataUrl => setClientSignature(dataUrl)}
                />
                <input
                  type="text"
                  placeholder="Client Signer Name & Title..."
                  value={clientSignerName}
                  onChange={e => setClientSignerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>
            </div>
          </div>
          </>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex-1 py-4 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4 text-amber-400" />
              Download Local PDF
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Syncing Docket to Server...' : 'Submit & Sync Docket'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
