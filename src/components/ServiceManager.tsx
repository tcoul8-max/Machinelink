import React, { useState, useEffect } from 'react';
import {
  Wrench,
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  PlusCircle,
  Save,
  Search,
  ArrowUpDown,
  History,
  Gauge,
  User,
  Calendar,
  FileText,
  Truck,
  X,
  SlidersHorizontal,
  ChevronLeft
} from 'lucide-react';
import { Machine, Worker, ServiceRecord } from '../types';
import {
  getSavedServices,
  getServicesForMachine,
  calculateServiceStatus,
  recordCompletedService,
  updateMachineServiceSettings,
  syncServicesFromServer
} from '../utils/serviceStore';

interface ServiceManagerProps {
  machines: Machine[];
  workers: Worker[];
  onDataUpdated?: () => void;
}

export const ServiceManager: React.FC<ServiceManagerProps> = ({
  machines,
  workers,
  onDataUpdated
}) => {
  const [services, setServices] = useState<ServiceRecord[]>(() => getSavedServices());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'remaining' | 'name' | 'unitCode'>('remaining');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'GOOD'>('ALL');
  
  // Active machine selected for detail / settings view
  const [activeMachineModalId, setActiveMachineModalId] = useState<string | null>(null);

  // Edit next service due state for active modal machine
  const [editableNextDue, setEditableNextDue] = useState<string>('');
  const [editableUnit, setEditableUnit] = useState<'Hours' | 'KM'>('Hours');
  const [editableInterval, setEditableInterval] = useState<string>('250');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Completed Service Modal State (can be opened from within machine details)
  const [showServiceModal, setShowServiceModal] = useState<boolean>(false);
  const [modalWorkerId, setModalWorkerId] = useState<string>('');
  const [modalCustomWorker, setModalCustomWorker] = useState<string>('');
  const [modalServiceDate, setModalServiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modalCompletedHours, setModalCompletedHours] = useState<string>('');
  const [modalServiceType, setModalServiceType] = useState<string>('250h Minor Service');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [modalNextDue, setModalNextDue] = useState<string>('');
  const [modalSetOperational, setModalSetOperational] = useState<boolean>(true);
  const [isSubmittingService, setIsSubmittingService] = useState<boolean>(false);

  // Refresh local state & sync from Tailscale node
  const refreshServices = () => {
    setServices(getSavedServices());
  };

  useEffect(() => {
    refreshServices();
    syncServicesFromServer().then((srvs) => setServices(srvs)).catch(() => {});

    const handleUpdate = () => refreshServices();
    window.addEventListener('services-updated', handleUpdate);
    window.addEventListener('sync-completed', handleUpdate);

    return () => {
      window.removeEventListener('services-updated', handleUpdate);
      window.removeEventListener('sync-completed', handleUpdate);
    };
  }, []);

  const activeMachine = machines.find(m => m.id === activeMachineModalId || m.unitCode === activeMachineModalId) || null;

  // Sync active machine editable fields when a machine is tapped
  useEffect(() => {
    if (activeMachine) {
      setEditableNextDue(activeMachine.nextServiceDue !== undefined ? String(activeMachine.nextServiceDue) : '');
      setEditableUnit(activeMachine.usageUnit || 'Hours');
      setEditableInterval(activeMachine.serviceInterval ? String(activeMachine.serviceInterval) : (activeMachine.usageUnit === 'KM' ? '10000' : '250'));
    }
  }, [activeMachine?.id, activeMachine?.nextServiceDue, activeMachine?.usageUnit]);

  // Open Service Completed modal for active machine
  const handleOpenServiceModal = () => {
    if (!activeMachine) return;
    const unit = activeMachine.usageUnit || 'Hours';
    const currentMeter = activeMachine.currentHours || 0;
    const interval = activeMachine.serviceInterval || (unit === 'KM' ? 10000 : 250);
    const calculatedNextDue = currentMeter + interval;

    setModalWorkerId(workers[0]?.id || '');
    setModalCustomWorker('');
    setModalServiceDate(new Date().toISOString().split('T')[0]);
    setModalCompletedHours(String(currentMeter));
    setModalServiceType(unit === 'KM' ? '10,000 KM Periodic Service' : '250h Standard PM Service');
    setModalNotes('');
    setModalNextDue(String(calculatedNextDue));
    setModalSetOperational(true);
    setShowServiceModal(true);
  };

  // Save updated service configuration for machine
  const handleSaveSettings = async () => {
    if (!activeMachine) return;
    const nextDueNum = editableNextDue ? parseFloat(editableNextDue) : undefined;
    const intervalNum = editableInterval ? parseFloat(editableInterval) : undefined;

    await updateMachineServiceSettings(activeMachine.id, {
      usageUnit: editableUnit,
      nextServiceDue: nextDueNum,
      serviceInterval: intervalNum,
    });

    if (onDataUpdated) onDataUpdated();

    setSaveSuccessMsg('Service settings saved successfully!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Quick preset next due adjust
  const handleQuickNextDuePreset = (addAmount: number) => {
    const currentMeter = activeMachine?.currentHours || 0;
    const newTarget = Math.round((currentMeter + addAmount) * 10) / 10;
    setEditableNextDue(String(newTarget));
  };

  // Submit Completed Service
  const handleSubmitService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMachine) return;

    setIsSubmittingService(true);
    try {
      const selectedWorker = workers.find(w => w.id === modalWorkerId);
      const workerName = modalCustomWorker.trim()
        ? modalCustomWorker.trim()
        : (selectedWorker ? selectedWorker.name : 'Heavy Diesel Fitter');

      const completedHoursNum = parseFloat(modalCompletedHours) || activeMachine.currentHours || 0;
      const nextDueNum = parseFloat(modalNextDue) || (completedHoursNum + (activeMachine.serviceInterval || (editableUnit === 'KM' ? 10000 : 250)));

      await recordCompletedService({
        machine: activeMachine,
        workerId: modalWorkerId || 'custom',
        workerName,
        serviceDate: modalServiceDate,
        completedAtHours: completedHoursNum,
        serviceType: modalServiceType,
        notes: modalNotes || 'Service completed & verified.',
        nextServiceDue: nextDueNum,
        setOperational: modalSetOperational,
      });

      refreshServices();
      if (onDataUpdated) onDataUpdated();

      setShowServiceModal(false);
      setSaveSuccessMsg(`Service logged for ${activeMachine.unitCode}! Next service due set to ${nextDueNum} ${activeMachine.usageUnit || 'Hours'}.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Error recording service: ${err?.message || 'Failed to save'}`);
    } finally {
      setIsSubmittingService(false);
    }
  };

  // Filter machines
  const filteredMachines = machines.filter(m => {
    const unit = m.usageUnit || 'Hours';
    const matchesSearch =
      m.unitCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.regoOrSerial.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    const statusCalc = calculateServiceStatus(m.currentHours, m.nextServiceDue, unit, m.lastServiceHours);
    if (statusFilter === 'OVERDUE') return statusCalc.status === 'OVERDUE';
    if (statusFilter === 'DUE_SOON') return statusCalc.status === 'DUE_SOON';
    if (statusFilter === 'GOOD') return statusCalc.status === 'GOOD';

    return true;
  });

  // Sort machines
  const sortedMachines = [...filteredMachines].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'unitCode') {
      return a.unitCode.localeCompare(b.unitCode);
    }
    // Default: Sort by service time remaining (lowest/most overdue first)
    const getDiff = (m: Machine) => {
      if (m.nextServiceDue === undefined || m.nextServiceDue === null) return 9999999;
      return m.nextServiceDue - m.currentHours;
    };
    return getDiff(a) - getDiff(b);
  });

  // Calculate status counts for quick pills
  let overdueCount = 0;
  let dueSoonCount = 0;
  machines.forEach(m => {
    const calc = calculateServiceStatus(m.currentHours, m.nextServiceDue, m.usageUnit || 'Hours', m.lastServiceHours);
    if (calc.status === 'OVERDUE') overdueCount++;
    else if (calc.status === 'DUE_SOON') dueSoonCount++;
  });

  const activeMachineServices = activeMachine ? getServicesForMachine(activeMachine.id, services) : [];
  const activeStatusCalc = activeMachine
    ? calculateServiceStatus(
        activeMachine.currentHours,
        activeMachine.nextServiceDue,
        activeMachine.usageUnit || 'Hours',
        activeMachine.lastServiceHours
      )
    : null;

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {saveSuccessMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between animate-fadeIn shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Clean Top Bar: Search & Sort & Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search plant by name, unit code (e.g. DEMO1, EX-201)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="remaining">Service Time Remaining</option>
              <option value="name">Machine Name</option>
              <option value="unitCode">Unit Code</option>
            </select>
          </div>

          {/* Status Quick Filter Pills */}
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            All ({machines.length})
          </button>
          {overdueCount > 0 && (
            <button
              onClick={() => setStatusFilter(statusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'OVERDUE'
                  ? 'bg-rose-500 text-white font-black'
                  : 'bg-slate-950 text-rose-400 border border-rose-900/50 hover:bg-rose-950/40'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Overdue ({overdueCount})
            </button>
          )}
          {dueSoonCount > 0 && (
            <button
              onClick={() => setStatusFilter(statusFilter === 'DUE_SOON' ? 'ALL' : 'DUE_SOON')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'DUE_SOON'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-amber-400 border border-amber-900/50 hover:bg-amber-950/40'
              }`}
            >
              <Clock className="w-3 h-3" />
              Due Soon ({dueSoonCount})
            </button>
          )}
        </div>
      </div>

      {/* Main Machine List */}
      <div className="space-y-2.5">
        {sortedMachines.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <Truck className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-black text-white">No machines found</h3>
            <p className="text-xs text-slate-500 mt-1">
              No plant matched "{searchQuery}" or the active filters.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          sortedMachines.map(machine => {
            const unit = machine.usageUnit || 'Hours';
            const unitLabel = unit === 'KM' ? 'KM' : 'Hrs';
            const statusCalc = calculateServiceStatus(
              machine.currentHours,
              machine.nextServiceDue,
              unit,
              machine.lastServiceHours
            );

            // Compute remaining time text (larger text)
            let remainingBadgeText = '';
            let remainingBadgeColor = 'text-slate-400 bg-slate-950 border-slate-800';

            if (machine.nextServiceDue === undefined || machine.nextServiceDue === null) {
              remainingBadgeText = `${machine.unitCode} - Target Unset`;
            } else {
              const diff = machine.nextServiceDue - machine.currentHours;
              const roundedDiff = Math.round(diff * 10) / 10;
              if (diff <= 0) {
                remainingBadgeText = `${machine.unitCode} - ${Math.abs(roundedDiff).toLocaleString()} ${unitLabel} OVERDUE`;
                remainingBadgeColor = 'text-rose-400 bg-rose-950/40 border-rose-500/50 shadow-rose-950/30';
              } else if (diff <= (unit === 'KM' ? 1000 : 50)) {
                remainingBadgeText = `${machine.unitCode} - ${roundedDiff.toLocaleString()} ${unitLabel} Remaining`;
                remainingBadgeColor = 'text-amber-400 bg-amber-950/40 border-amber-500/50 shadow-amber-950/30';
              } else {
                remainingBadgeText = `${machine.unitCode} - ${roundedDiff.toLocaleString()} ${unitLabel} Remaining`;
                remainingBadgeColor = 'text-emerald-400 bg-emerald-950/30 border-emerald-500/40 shadow-emerald-950/20';
              }
            }

            return (
              <div
                key={machine.id}
                onClick={() => setActiveMachineModalId(machine.id)}
                className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-850 p-4 rounded-2xl transition cursor-pointer shadow-md hover:shadow-xl group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Titles & Subtitle with Current Hours */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-black text-white group-hover:text-amber-400 transition truncate">
                        {machine.name}
                      </h4>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-950 text-slate-300 border border-slate-800">
                        {unit}
                      </span>
                    </div>

                    {/* Smaller text under titles: Current Hours and Next Target */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                      <span>
                        Current: <strong className="text-slate-200 font-bold">{machine.currentHours.toLocaleString()} {unitLabel}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Next Due: <strong className="text-slate-300 font-semibold">{machine.nextServiceDue ? `${machine.nextServiceDue.toLocaleString()} ${unitLabel}` : 'Unset'}</strong>
                      </span>
                      {machine.lastServiceDate && (
                        <>
                          <span className="hidden md:inline">•</span>
                          <span className="hidden md:inline text-slate-500">
                            Last: {machine.lastServiceDate}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Larger text for Remaining Time & Chevron */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                    <div className={`px-3.5 py-1.5 rounded-xl border font-mono text-sm sm:text-base font-black tracking-tight ${remainingBadgeColor}`}>
                      {remainingBadgeText}
                    </div>

                    <div className="p-1.5 rounded-lg bg-slate-950 text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {machine.nextServiceDue && (
                  <div className="w-full bg-slate-950 rounded-full h-1.5 mt-3 overflow-hidden border border-slate-800/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        statusCalc.status === 'OVERDUE'
                          ? 'bg-rose-500'
                          : statusCalc.status === 'DUE_SOON'
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${statusCalc.percent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Machine Details & Settings Modal (Accessed by tapping on a list item) */}
      {activeMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 flex-shrink-0">
                  <Wrench className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 font-black text-xs rounded-lg">
                      {activeMachine.unitCode}
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-white truncate">
                      {activeMachine.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Rego / Serial: <span className="text-slate-300 font-semibold">{activeMachine.regoOrSerial}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveMachineModalId(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer flex-shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Body: Settings, History & Controls */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
              {/* Current Status Banner & Log Service Action */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Current Meter Reading
                  </span>
                  <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 mt-0.5">
                    {activeMachine.currentHours.toLocaleString()}{' '}
                    <span className="text-sm font-bold text-slate-400">{activeMachine.usageUnit === 'KM' ? 'KM' : 'Hrs'}</span>
                  </div>
                  {activeStatusCalc && (
                    <div className="mt-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border uppercase tracking-wider ${activeStatusCalc.badgeClass}`}>
                        {activeStatusCalc.label}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleOpenServiceModal}
                  className="w-full sm:w-auto px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 flex-shrink-0"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Record Service Completed</span>
                </button>
              </div>

              {/* Service Settings & Next Due Configuration */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <h4 className="font-black text-sm text-white">
                    Service Settings & Next Due Configuration
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Measurement Unit */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Measurement Unit
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditableUnit('Hours')}
                        className={`py-2 px-3 rounded-lg text-xs font-black transition cursor-pointer ${
                          editableUnit === 'Hours'
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⏱️ Hours
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditableUnit('KM')}
                        className={`py-2 px-3 rounded-lg text-xs font-black transition cursor-pointer ${
                          editableUnit === 'KM'
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🚗 KM
                      </button>
                    </div>
                  </div>

                  {/* Service Interval */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Standard Interval ({editableUnit})
                    </label>
                    <input
                      type="number"
                      value={editableInterval}
                      onChange={(e) => setEditableInterval(e.target.value)}
                      placeholder={editableUnit === 'KM' ? '10000' : '250'}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                {/* Next Service Due Input & Preset Buttons */}
                <div className="space-y-2.5 pt-2">
                  <label className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Next Service Due Target ({editableUnit})</span>
                    <span className="text-slate-400 font-normal">
                      Current: {activeMachine.currentHours} {editableUnit}
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="any"
                        value={editableNextDue}
                        onChange={(e) => setEditableNextDue(e.target.value)}
                        placeholder="e.g. 1500"
                        className="w-full pl-4 pr-14 py-2.5 bg-slate-900 border-2 border-amber-500/40 focus:border-amber-500 rounded-xl text-base font-mono font-black text-amber-300 focus:outline-none transition shadow-inner"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                        {editableUnit}
                      </span>
                    </div>

                    <button
                      onClick={handleSaveSettings}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Target</span>
                    </button>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 font-semibold">Quick Presets:</span>
                    {editableUnit === 'KM' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickNextDuePreset(5000)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          +5,000 KM
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickNextDuePreset(10000)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          +10,000 KM
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickNextDuePreset(15000)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          +15,000 KM
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickNextDuePreset(100)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          +100 Hrs
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickNextDuePreset(250)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          +250 Hrs
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickNextDuePreset(500)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          +500 Hrs
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickNextDuePreset(1000)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          +1,000 Hrs
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Previous Services History Log */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <h4 className="font-black text-sm text-white">
                      Previous Completed Services Log
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {activeMachineServices.length} Records
                  </span>
                </div>

                {activeMachineServices.length === 0 ? (
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 text-center text-slate-400">
                    <FileText className="w-7 h-7 mx-auto text-slate-600 mb-2" />
                    <p className="font-bold text-xs text-slate-300">No previous services logged for {activeMachine.unitCode}</p>
                    <button
                      onClick={handleOpenServiceModal}
                      className="mt-3 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Log Completed Service
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeMachineServices.map(record => (
                      <div
                        key={record.id}
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {record.serviceType}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                              {record.serviceDate}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300">
                            <Gauge className="w-3.5 h-3.5 text-amber-400" />
                            <span>At: <strong className="text-white">{record.completedAtHours.toLocaleString()} {record.usageUnit || 'Hours'}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>Performed By: <strong className="text-amber-400 font-bold">{record.performedByWorkerName}</strong></span>
                        </div>

                        {record.notes && (
                          <div className="bg-slate-900/80 rounded-xl p-2.5 text-xs text-slate-300 leading-relaxed border border-slate-800/80">
                            {record.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
              <button
                onClick={() => setActiveMachineModalId(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Service Modal Dialog */}
      {showServiceModal && activeMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Record Completed Service
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {activeMachine.unitCode} - {activeMachine.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowServiceModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitService} className="space-y-4">
              {/* Who Performed It */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Service Performed By *
                </label>
                <select
                  value={modalWorkerId}
                  onChange={(e) => setModalWorkerId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-amber-500 transition cursor-pointer"
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.role})
                    </option>
                  ))}
                  <option value="custom">Other / External Contractor</option>
                </select>

                {modalWorkerId === 'custom' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter technician / contractor name"
                    value={modalCustomWorker}
                    onChange={(e) => setModalCustomWorker(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 mt-2"
                  />
                )}
              </div>

              {/* Date & Meter Reading */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Service Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={modalServiceDate}
                    onChange={(e) => setModalServiceDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Meter Reading ({activeMachine.usageUnit || 'Hours'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={modalCompletedHours}
                    onChange={(e) => {
                      setModalCompletedHours(e.target.value);
                      const num = parseFloat(e.target.value);
                      if (!isNaN(num)) {
                        const interval = activeMachine.serviceInterval || (activeMachine.usageUnit === 'KM' ? 10000 : 250);
                        setModalNextDue(String(num + interval));
                      }
                    }}
                    placeholder={`e.g. ${activeMachine.currentHours}`}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              {/* Service Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Service Type / Package *
                </label>
                <select
                  value={modalServiceType}
                  onChange={(e) => setModalServiceType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-amber-500 transition cursor-pointer"
                >
                  <option value="250h Standard PM Service">250h Standard PM Service (Engine oil, filters, grease)</option>
                  <option value="500h Mid-Life Service">500h Mid-Life Service (Hydraulics & filters)</option>
                  <option value="1,000h Major Overhaul">1,000h Major Overhaul (All fluids & transmission)</option>
                  <option value="2,000h Complete Fleet Service">2,000h Complete Fleet Service</option>
                  <option value="10,000 KM Periodic Service">10,000 KM Periodic Logbook Service</option>
                  <option value="Greasing, Inspection & Fluids Top-up">Greasing, Inspection & Fluids Top-up</option>
                  <option value="Corrective Repair / Fitter Maintenance">Corrective Repair / Fitter Maintenance</option>
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Service Work Notes & Replaced Parts
                </label>
                <textarea
                  rows={3}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="e.g. Replaced engine oil & filter, checked coolant, greased pins."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              {/* Next Due Auto-Target */}
              <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <label className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Set Next Service Due Target ({activeMachine.usageUnit || 'Hours'})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={modalNextDue}
                  onChange={(e) => setModalNextDue(e.target.value)}
                  placeholder="Next target"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Operational Reset Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modalSetOperational"
                  checked={modalSetOperational}
                  onChange={(e) => setModalSetOperational(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-800"
                />
                <label htmlFor="modalSetOperational" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Mark machine status as <strong>"Operational"</strong>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingService}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmittingService ? 'Saving...' : 'Save Completed Service'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
