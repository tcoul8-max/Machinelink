import React, { useState, useEffect, useRef } from 'react';
import { DefectRecord, Machine, Worker } from '../types';
import { getSavedDefects, updateDefect, syncDefectsFromServer } from '../utils/defectStore';
import { AlertTriangle, CheckCircle, Wrench, Clock, Search, Filter, RefreshCw, UserCheck, ShieldCheck, X } from 'lucide-react';

interface DefectManagerProps {
  machines: Machine[];
  workers: Worker[];
  onDefectsUpdated?: () => void;
}

export const DefectManager: React.FC<DefectManagerProps> = ({ machines, workers, onDefectsUpdated }) => {
  const [defects, setDefects] = useState<DefectRecord[]>(() => getSavedDefects());
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'REPAIRED' | 'ALL'>('OPEN');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Fitter Sign-off Modal State
  const [activeDefectForRepair, setActiveDefectForRepair] = useState<DefectRecord | null>(null);
  const [fitterWorkerId, setFitterWorkerId] = useState<string>('');
  const [repairNotes, setRepairNotes] = useState<string>('');
  const [fitterPinInput, setFitterPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Simple Signature Pad Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const reloadDefects = async () => {
    setIsSyncing(true);
    const updated = await syncDefectsFromServer();
    setDefects(updated);
    setIsSyncing(false);
    if (onDefectsUpdated) onDefectsUpdated();
  };

  useEffect(() => {
    reloadDefects();
    const handleSync = () => reloadDefects();
    window.addEventListener('sync-completed', handleSync);
    return () => window.removeEventListener('sync-completed', handleSync);
  }, []);

  // Filter defects
  const filteredDefects = defects.filter(d => {
    if (statusFilter === 'OPEN' && d.status === 'REPAIRED') return false;
    if (statusFilter === 'REPAIRED' && d.status !== 'REPAIRED') return false;
    if (selectedMachineId !== 'ALL' && d.machineId !== selectedMachineId) return false;

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchMachine = d.unitCode.toLowerCase().includes(q) || d.machineName.toLowerCase().includes(q);
      const matchLabel = d.checkItemLabel.toLowerCase().includes(q);
      const matchReporter = d.reportedByWorkerName.toLowerCase().includes(q);
      const matchNotes = d.notes.toLowerCase().includes(q);
      return matchMachine || matchLabel || matchReporter || matchNotes;
    }
    return true;
  });

  const openRepairModal = (defect: DefectRecord) => {
    setActiveDefectForRepair(defect);
    setRepairNotes('');
    setFitterPinInput('');
    setPinError(null);
    setHasSignature(false);

    // Pick first fitter or first worker
    const defaultFitter = workers.find(w => w.role.toLowerCase().includes('fitter') || w.role.toLowerCase().includes('supervisor')) || workers[0];
    if (defaultFitter) setFitterWorkerId(defaultFitter.id);
  };

  // Canvas drawing handlers for fitter signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleCompleteRepair = async () => {
    if (!activeDefectForRepair) return;
    const selectedFitter = workers.find(w => w.id === fitterWorkerId);
    if (!selectedFitter) {
      setPinError('Please select a fitter or supervisor.');
      return;
    }

    if (selectedFitter.pin && fitterPinInput !== selectedFitter.pin) {
      setPinError('Invalid PIN code for selected worker.');
      return;
    }

    if (!repairNotes.trim()) {
      setPinError('Please enter details of the repair work done.');
      return;
    }

    let signatureData = '';
    if (canvasRef.current && hasSignature) {
      signatureData = canvasRef.current.toDataURL('image/png');
    }

    const patch: Partial<DefectRecord> = {
      status: 'REPAIRED',
      repairedByWorkerId: selectedFitter.id,
      repairedByWorkerName: selectedFitter.name,
      repairedAt: new Date().toISOString(),
      repairNotes: repairNotes.trim(),
      fitterSignature: signatureData
    };

    const updatedList = await updateDefect(activeDefectForRepair.id, patch);
    setDefects(updatedList);
    setActiveDefectForRepair(null);
    if (onDefectsUpdated) onDefectsUpdated();

    // Trigger window event
    window.dispatchEvent(new CustomEvent('defects-updated'));
  };

  const openDefectsCount = defects.filter(d => d.status !== 'REPAIRED').length;
  const repairedCount = defects.filter(d => d.status === 'REPAIRED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Wrench className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                  Defect & Maintenance Log
                  <span className="text-xs font-bold bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30">
                    Fitter Accountability
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Track reported machinery defects, pre-fill items for operators, and sign off completed repairs.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={reloadDefects}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-extrabold border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
              Sync Server
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-rose-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-rose-400 uppercase tracking-wider block">Active Defects</span>
              <span className="text-2xl font-black text-rose-500 font-mono">{openDefectsCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider block">Repaired & Signed Off</span>
              <span className="text-2xl font-black text-emerald-500 font-mono">{repairedCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-2xl border border-amber-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider block">Total Tracked</span>
              <span className="text-2xl font-black text-amber-500 font-mono">{defects.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'OPEN'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Active Defects ({openDefectsCount})
          </button>
          <button
            onClick={() => setStatusFilter('REPAIRED')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'REPAIRED'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Repaired ({repairedCount})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Logs ({defects.length})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Machine Filter Dropdown */}
          <div className="relative flex-1 md:w-48">
            <select
              value={selectedMachineId}
              onChange={e => setSelectedMachineId(e.target.value)}
              className="w-full pl-3 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Machines</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>
                  {m.unitCode} - {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search defects, units..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Defects List */}
      {filteredDefects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto opacity-80" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Defects Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {statusFilter === 'OPEN'
              ? 'All machinery is clean and cleared for operation! No unresolved defects on file.'
              : 'No defect records match your current filter settings.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDefects.map(defect => {
            const isRepaired = defect.status === 'REPAIRED';
            return (
              <div
                key={defect.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition shadow-sm ${
                  isRepaired
                    ? 'border-slate-200 dark:border-slate-800 opacity-90'
                    : 'border-rose-500/30 dark:border-rose-500/20 bg-rose-500/[0.01]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-500 font-mono font-black text-xs border border-amber-500/20">
                      {defect.unitCode}
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {defect.checkItemLabel}
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          {defect.category}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">{defect.machineName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isRepaired ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-extrabold border border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5" /> REPAIRED & SIGNED OFF
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-extrabold border border-rose-500/20 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" /> UNRESOLVED DEFECT
                      </span>
                    )}

                    {!isRepaired && (
                      <button
                        onClick={() => openRepairModal(defect)}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-md transition cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Fitter Sign Off
                      </button>
                    )}
                  </div>
                </div>

                {/* Defect Description & Reporter Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                      Reported Issue Details
                    </span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                      "{defect.notes}"
                    </p>
                    <div className="flex items-center gap-2 mt-2.5 text-[11px] text-slate-500 font-medium">
                      <UserCheck className="w-3 h-3 text-amber-500" />
                      <span>Reported by: <strong>{defect.reportedByWorkerName}</strong></span>
                      <span>•</span>
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(defect.reportedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Fitter Repair Log (If repaired) */}
                  {isRepaired && (
                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20">
                      <span className="text-[10px] font-black uppercase text-emerald-500 block mb-1">
                        Fitter Maintenance & Sign-Off Record
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                        "{defect.repairNotes || 'Repaired and verified operational.'}"
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-emerald-500/10 text-[11px]">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          Fitter: {defect.repairedByWorkerName}
                        </span>
                        <span className="text-slate-400">
                          {defect.repairedAt ? new Date(defect.repairedAt).toLocaleString() : ''}
                        </span>
                      </div>
                      {defect.fitterSignature && (
                        <div className="mt-2 bg-white dark:bg-slate-900 p-1 rounded border border-emerald-500/20 max-w-[140px]">
                          <img src={defect.fitterSignature} alt="Fitter Signature" className="h-8 object-contain" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fitter Sign Off Modal */}
      {activeDefectForRepair && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Wrench className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Fitter Repair Sign-Off
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {activeDefectForRepair.unitCode} • {activeDefectForRepair.checkItemLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDefectForRepair(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Issue summary badge */}
            <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl text-xs space-y-1">
              <span className="font-bold text-rose-500 block">Reported Defect:</span>
              <p className="text-slate-800 dark:text-slate-200 font-medium">"{activeDefectForRepair.notes}"</p>
            </div>

            {/* Fitter Form */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  Fitter / Mechanic / Supervisor
                </label>
                <select
                  value={fitterWorkerId}
                  onChange={e => setFitterWorkerId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  Fitter Security PIN
                </label>
                <input
                  type="password"
                  placeholder="Enter worker PIN"
                  value={fitterPinInput}
                  onChange={e => {
                    setFitterPinInput(e.target.value);
                    setPinError(null);
                  }}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  Repair Action & Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe repair work undertaken (e.g., Replaced hydraulic hose, refilled oil, leak test OK)..."
                  value={repairNotes}
                  onChange={e => setRepairNotes(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>

              {/* Signature Canvas */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Fitter Digital Signature
                  </label>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-[11px] font-bold text-rose-500 hover:underline"
                    >
                      Clear Signature
                    </button>
                  )}
                </div>
                <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={440}
                    height={100}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-24 touch-none cursor-crosshair"
                  />
                </div>
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold">
                  {pinError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveDefectForRepair(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCompleteRepair}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                Sign Off & Clear Defect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
