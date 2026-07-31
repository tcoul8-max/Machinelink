import React, { useState, useEffect } from 'react';
import { Worker, Machine, PrestartSubmission, CheckStatus, ItemCheckResult, PrestartType } from '../types';
import { PRESTART_CHECK_ITEMS } from '../data/defaultData';
import { SignatureCanvas } from './SignatureCanvas';
import { saveOfflinePrestart, attemptServerSync, getSimulatedOffline } from '../utils/offlineStore';
import { CheckCircle2, AlertTriangle, XCircle, ShieldAlert, Truck, Wrench, Layers, Clock, Send, FileSpreadsheet, Check } from 'lucide-react';

interface PrestartFormProps {
  workers: Worker[];
  machines: Machine[];
  onSubmissionComplete: () => void;
}

export const PrestartForm: React.FC<PrestartFormProps> = ({ workers, machines, onSubmissionComplete }) => {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [engineHours, setEngineHours] = useState<string>('');
  const [checks, setChecks] = useState<Record<string, ItemCheckResult>>({});
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSubmission, setSubmittedSubmission] = useState<PrestartSubmission | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Set default worker if available
  useEffect(() => {
    if (workers.length > 0 && !selectedWorkerId) {
      setSelectedWorkerId(workers[0].id);
    }
    if (machines.length > 0 && !selectedMachineId) {
      setSelectedMachineId(machines[0].id);
      setEngineHours(''); // Left blank when starting a new prestart
    }
  }, [workers, machines]);

  const activeWorker = workers.find(w => w.id === selectedWorkerId);
  const activeMachine = machines.find(m => m.id === selectedMachineId);
  const prestartType: PrestartType = activeMachine ? activeMachine.prestartType : 1;

  const currentCheckItems = PRESTART_CHECK_ITEMS[prestartType] || PRESTART_CHECK_ITEMS[1];

  const handleMachineChange = (machineId: string) => {
    setSelectedMachineId(machineId);
    // Leave hours blank so operator enters current meter reading manually
    setEngineHours('');
    // Reset check state for new machine
    setChecks({});
  };

  const handleStatusChange = (itemId: string, status: CheckStatus) => {
    setChecks(prev => ({
      ...prev,
      [itemId]: {
        status,
        notes: prev[itemId]?.notes || '',
      }
    }));
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setChecks(prev => ({
      ...prev,
      [itemId]: {
        status: prev[itemId]?.status || 'FAIL',
        notes,
      }
    }));
  };

  const setAllItemsPass = () => {
    const updated: Record<string, ItemCheckResult> = {};
    currentCheckItems.forEach(item => {
      updated[item.id] = { status: 'PASS', notes: '' };
    });
    setChecks(updated);
  };

  // Determine Overall Status
  const getOverallStatus = (): 'SAFE_TO_OPERATE' | 'DEFECT_REPORTED' | 'UNSAFE_OUT_OF_SERVICE' => {
    let failCount = 0;
    let criticalFail = false;

    Object.entries(checks).forEach(([itemId, val]) => {
      const checkVal = val as ItemCheckResult;
      if (checkVal && checkVal.status === 'FAIL') {
        failCount++;
        // Critical safety checks
        if (['brakes', 'steering', 'seatbelt', 'fire_extinguisher', 'tracks', 'tires'].includes(itemId)) {
          criticalFail = true;
        }
      }
    });

    if (criticalFail) return 'UNSAFE_OUT_OF_SERVICE';
    if (failCount > 0) return 'DEFECT_REPORTED';
    return 'SAFE_TO_OPERATE';
  };

  const overallStatus = getOverallStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedWorkerId || !activeWorker) {
      setFormError('Please select the Worker / Operator filling this prestart.');
      return;
    }
    if (!selectedMachineId || !activeMachine) {
      setFormError('Please select a Machine from the Master List.');
      return;
    }
    const parsedHours = parseFloat(engineHours);
    if (!engineHours || isNaN(parsedHours) || parsedHours <= 0) {
      setFormError('Please enter the current Engine Hours meter reading before submitting.');
      return;
    }

    // Check if all items answered
    const unanswered = currentCheckItems.filter(item => !checks[item.id]);
    if (unanswered.length > 0) {
      setFormError(`Please complete all checklist items (${unanswered.length} items remaining). Or click 'Mark All PASS' if verified.`);
      return;
    }

    if (!signatureDataUrl) {
      setFormError('Operator digital signature is required before submitting.');
      return;
    }

    setIsSubmitting(true);

    const newSubmission: PrestartSubmission = {
      id: 'pre_' + Date.now(),
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      workerId: activeWorker.id,
      workerName: activeWorker.name,
      machineId: activeMachine.id,
      machineCode: activeMachine.unitCode,
      machineName: activeMachine.name,
      prestartType: activeMachine.prestartType,
      engineHours: parsedHours,
      overallStatus,
      checks,
      generalNotes,
      signatureDataUrl,
      synced: false,
    };

    // 1. Save locally
    saveOfflinePrestart(newSubmission);

    // 2. Try server sync
    const syncRes = await attemptServerSync();

    if (syncRes.success) {
      newSubmission.synced = true;
      newSubmission.syncedAt = new Date().toISOString();
    }

    setIsSubmitting(false);
    setSubmittedSubmission(newSubmission);
  };

  // Categories grouping
  const categories = Array.from(new Set(currentCheckItems.map(i => i.category)));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
            Daily Safety & Operations Checklist
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">
            Machinery Prestart Inspection
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete before operating plant equipment. Safety checks load automatically for the selected machine.
          </p>
        </div>

        <button
          type="button"
          onClick={setAllItemsPass}
          className="self-start md:self-center inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 hover:bg-emerald-500/20 transition shadow-sm cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Mark All PASS
        </button>
      </div>

      {formError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-3.5">
          <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0" />
          {formError}
        </div>
      )}

      {/* Submission Success Modal / Banner */}
      {submittedSubmission && (
        <div className="bg-slate-900 text-slate-100 p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Prestart Logged & Saved</h3>
                <p className="text-xs text-emerald-400 font-medium">
                  {submittedSubmission.synced
                    ? 'Synced to Tailscale Server Tower -> Appended row to prestarts.csv'
                    : 'Queued in Local Storage (Offline Mode) -> Will auto-sync when back in signal.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSubmittedSubmission(null);
                setChecks({});
                setGeneralNotes('');
                setSignatureDataUrl('');
                onSubmissionComplete();
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md cursor-pointer"
            >
              Start New Check
            </button>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono space-y-2">
            <div className="text-slate-400 font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              Server CSV Row Representation:
            </div>
            <div className="overflow-x-auto text-[11px] text-amber-300 whitespace-nowrap p-3 bg-slate-900 rounded-xl border border-slate-800">
              {`${submittedSubmission.id},${submittedSubmission.date},"${submittedSubmission.workerName}",${submittedSubmission.machineCode},"Type ${submittedSubmission.prestartType}",${submittedSubmission.engineHours},${submittedSubmission.overallStatus}`}
            </div>
          </div>
        </div>
      )}

      {!submittedSubmission && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Worker & Machine Selection */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              <Truck className="w-4 h-4 text-amber-500" />
              1. Operator & Machine Selection
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Worker Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Worker / Operator Name *
                </label>
                <select
                  value={selectedWorkerId}
                  onChange={e => setSelectedWorkerId(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">-- Select Worker from Master List --</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Machine Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Machine *
                </label>
                <select
                  value={selectedMachineId}
                  onChange={e => handleMachineChange(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>
                      [{m.unitCode}] {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Engine Hours Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Engine Hours Meter Reading *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Enter current hours..."
                    value={engineHours}
                    onChange={e => setEngineHours(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>
            </div>

            {/* Machine Operational Status */}
            {activeMachine && (
              <div className="mt-2 flex justify-end">
                <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                  activeMachine.status === 'Operational' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  Machine Status: {activeMachine.status}
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Dynamic Prestart Checklist Items */}
          <div className="space-y-5">
            {categories.map((category, catIdx) => {
              const categoryItems = currentCheckItems.filter(i => i.category === category);

              return (
                <div
                  key={category}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                >
                  <div className="bg-slate-900 text-white px-6 py-3.5 font-bold text-xs uppercase tracking-widest flex items-center justify-between border-b border-slate-800">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
                        {catIdx + 1}
                      </span>
                      {category}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      {categoryItems.filter(i => checks[i.id]?.status).length} / {categoryItems.length} checked
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {categoryItems.map(item => {
                      const currentVal = checks[item.id]?.status;
                      const hasNotes = checks[item.id]?.notes;

                      return (
                        <div key={item.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-white">
                                {item.label}
                              </div>
                              {item.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            {/* Touch-friendly PASS / FAIL / N/A Buttons */}
                            <div className="flex items-center gap-2 self-start sm:self-center">
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.id, 'PASS')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                  currentVal === 'PASS'
                                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                PASS
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.id, 'FAIL')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                  currentVal === 'FAIL'
                                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 font-black'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                FAIL
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.id, 'NA')}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                  currentVal === 'NA'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                N/A
                              </button>
                            </div>
                          </div>

                          {/* Defect / Comment Notes box if FAIL or note entered */}
                          {(currentVal === 'FAIL' || hasNotes) && (
                            <div className="mt-3 bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20">
                              <input
                                type="text"
                                placeholder="Describe defect, leak severity, or comment..."
                                value={checks[item.id]?.notes || ''}
                                onChange={e => handleNotesChange(item.id, e.target.value)}
                                className="w-full text-xs p-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step 3: Overall Status Summary & General Notes */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-black text-sm text-slate-900 dark:text-white">
                3. Overall Prestart Assessment
              </span>

              {/* Status Badge */}
              {overallStatus === 'SAFE_TO_OPERATE' && (
                <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-1.5 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  SAFE TO OPERATE
                </span>
              )}

              {overallStatus === 'DEFECT_REPORTED' && (
                <span className="px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-black flex items-center gap-1.5 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  DEFECT LOGGED (MONITOR)
                </span>
              )}

              {overallStatus === 'UNSAFE_OUT_OF_SERVICE' && (
                <span className="px-3.5 py-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center gap-1.5 border border-rose-500/20">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  CRITICAL DEFECT - OUT OF SERVICE
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                General Shift Notes or Additional Observations
              </label>
              <textarea
                rows={2}
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                placeholder="E.g. Cleaned cabin, topped up 2L hydraulic oil, grease pins serviced..."
                className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Operator Signature Pad */}
            <div className="pt-2">
              <SignatureCanvas
                label="Operator Digital Signature *"
                onSave={dataUrl => setSignatureDataUrl(dataUrl)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Saving & Syncing Prestart...' : 'Submit Prestart Checklist'}
          </button>
        </form>
      )}
    </div>
  );
};
