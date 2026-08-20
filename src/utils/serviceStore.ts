import { ServiceRecord, Machine } from '../types';
import { getTailscaleIp } from './offlineStore';
import { smartFetchApi } from './apiClient';
import { getSavedMachines, saveSavedMachines } from '../data/defaultData';

const SERVICES_KEY = 'apex_services_store';

export const INITIAL_SERVICES: ServiceRecord[] = [
  {
    id: 'SRV-101',
    machineId: 'm1',
    unitCode: 'EX-201',
    machineName: 'CAT 320 Next Gen Excavator (Tracked)',
    serviceDate: '2026-07-15',
    performedByWorkerId: 'w3',
    performedByWorkerName: 'Name 3 (Heavy Diesel Fitter)',
    completedAtHours: 1250.0,
    usageUnit: 'Hours',
    serviceType: '250h Standard PM Service',
    notes: 'Replaced engine oil & filter (Cat 15W-40). Inspected hydraulic return filter. Greased all slew and boom pins. Track tension verified.',
    nextServiceDueSetTo: 1500.0,
    synced: true,
    syncedAt: '2026-07-15T14:30:00Z',
    createdAt: '2026-07-15T14:30:00Z',
  },
  {
    id: 'SRV-102',
    machineId: 'm1',
    unitCode: 'EX-201',
    machineName: 'CAT 320 Next Gen Excavator (Tracked)',
    serviceDate: '2026-04-20',
    performedByWorkerId: 'w3',
    performedByWorkerName: 'Name 3 (Heavy Diesel Fitter)',
    completedAtHours: 1000.0,
    usageUnit: 'Hours',
    serviceType: '1,000h Major Overhaul Service',
    notes: 'Complete fluid change. Engine, hydraulic oil, final drive planetary oils renewed. Air cleaner primary and secondary elements replaced.',
    nextServiceDueSetTo: 1250.0,
    synced: true,
    syncedAt: '2026-04-20T16:00:00Z',
    createdAt: '2026-04-20T16:00:00Z',
  },
  {
    id: 'SRV-103',
    machineId: 'm2',
    unitCode: 'LD-104',
    machineName: 'Komatsu WA380 Wheel Loader',
    serviceDate: '2026-06-20',
    performedByWorkerId: 'w1',
    performedByWorkerName: 'Name 1 (Senior Plant Operator)',
    completedAtHours: 3750.0,
    usageUnit: 'Hours',
    serviceType: '250h Minor Service & Inspection',
    notes: 'Engine lube service, fuel water drain, lube all steering cylinder pins and bucket linkage joints.',
    nextServiceDueSetTo: 4000.0,
    synced: true,
    syncedAt: '2026-06-20T11:20:00Z',
    createdAt: '2026-06-20T11:20:00Z',
  },
  {
    id: 'SRV-104',
    machineId: 'm3',
    unitCode: 'DZ-05',
    machineName: 'CAT D6 Dozer (Tracked)',
    serviceDate: '2026-07-02',
    performedByWorkerId: 'w3',
    performedByWorkerName: 'Name 3 (Heavy Diesel Fitter)',
    completedAtHours: 2000.0,
    usageUnit: 'Hours',
    serviceType: '500h Mid-Life Service',
    notes: 'Transmission fluid drain & refill. Final drives serviced. Blade pins greased and tension verified.',
    nextServiceDueSetTo: 2250.0,
    synced: true,
    syncedAt: '2026-07-02T13:45:00Z',
    createdAt: '2026-07-02T13:45:00Z',
  },
  {
    id: 'SRV-105',
    machineId: 'm4',
    unitCode: 'BH-02',
    machineName: 'JCB 3CX Backhoe Loader (Wheeled)',
    serviceDate: '2026-05-10',
    performedByWorkerId: 'w4',
    performedByWorkerName: 'Name 4 (Site Supervisor)',
    completedAtHours: 600.0,
    usageUnit: 'Hours',
    serviceType: '250h Standard PM Service',
    notes: 'Engine oil changed, hydraulic lines flushed, boom safety check. Note: Front tire tread at 40%.',
    nextServiceDueSetTo: 850.0,
    synced: true,
    syncedAt: '2026-05-10T09:15:00Z',
    createdAt: '2026-05-10T09:15:00Z',
  },
  {
    id: 'SRV-106',
    machineId: 'm5',
    unitCode: 'UTE-09',
    machineName: 'Toyota Hilux 4x4 Field Service Ute',
    serviceDate: '2026-06-11',
    performedByWorkerId: 'w3',
    performedByWorkerName: 'Name 3 (Heavy Diesel Fitter)',
    completedAtHours: 120000,
    usageUnit: 'KM',
    serviceType: '10,000 KM Periodic Service',
    notes: 'Synthetic 5W-30 engine oil, OEM oil filter, fuel filter, tire rotation and pressure set to 38 PSI.',
    nextServiceDueSetTo: 130000,
    synced: true,
    syncedAt: '2026-06-11T15:10:00Z',
    createdAt: '2026-06-11T15:10:00Z',
  },
];

export function getSavedServices(): ServiceRecord[] {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(SERVICES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // fallback
      }
    }
  }
  return INITIAL_SERVICES;
}

export function saveSavedServices(services: ServiceRecord[]): void {
  if (typeof window !== 'undefined' && Array.isArray(services)) {
    localStorage.setItem(SERVICES_KEY, JSON.stringify(services));
  }
}

export function getServicesForMachine(machineId: string, services?: ServiceRecord[]): ServiceRecord[] {
  const list = services || getSavedServices();
  return list
    .filter(s => s.machineId === machineId || s.unitCode === machineId)
    .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
}

export interface ServiceStatusCalculation {
  status: 'OVERDUE' | 'DUE_SOON' | 'GOOD' | 'UNSET';
  diff: number; // remaining till due (negative if overdue)
  percent: number; // 0 to 100 towards next service
  label: string;
  badgeClass: string;
  textClass: string;
  borderClass: string;
}

export function calculateServiceStatus(
  currentMeter: number,
  nextDue?: number,
  unit: 'Hours' | 'KM' = 'Hours',
  lastServiceMeter?: number
): ServiceStatusCalculation {
  if (nextDue === undefined || nextDue === null || isNaN(nextDue) || nextDue <= 0) {
    return {
      status: 'UNSET',
      diff: 0,
      percent: 0,
      label: 'Service Due Unset',
      badgeClass: 'bg-slate-700/60 text-slate-300 border-slate-600',
      textClass: 'text-slate-400',
      borderClass: 'border-slate-700',
    };
  }

  const diff = nextDue - currentMeter;
  const unitLabel = unit === 'KM' ? 'KM' : 'Hrs';
  const dueSoonThreshold = unit === 'KM' ? 1000 : 50;

  // Calculate progress percentage
  const lastBase = lastServiceMeter !== undefined && lastServiceMeter < nextDue ? lastServiceMeter : Math.max(0, nextDue - (unit === 'KM' ? 10000 : 250));
  const span = Math.max(1, nextDue - lastBase);
  const done = currentMeter - lastBase;
  const rawPercent = Math.min(100, Math.max(0, Math.round((done / span) * 100)));

  if (diff <= 0) {
    const overdueAmount = Math.abs(diff);
    return {
      status: 'OVERDUE',
      diff,
      percent: 100,
      label: `OVERDUE by ${overdueAmount.toLocaleString()} ${unitLabel}`,
      badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      textClass: 'text-rose-400',
      borderClass: 'border-rose-500/50 shadow-rose-950/20',
    };
  }

  if (diff <= dueSoonThreshold) {
    return {
      status: 'DUE_SOON',
      diff,
      percent: rawPercent,
      label: `Due soon in ${diff.toLocaleString()} ${unitLabel}`,
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      textClass: 'text-amber-400',
      borderClass: 'border-amber-500/50 shadow-amber-950/20',
    };
  }

  return {
    status: 'GOOD',
    diff,
    percent: rawPercent,
    label: `${diff.toLocaleString()} ${unitLabel} remaining`,
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
  };
}

export async function recordCompletedService(params: {
  machine: Machine;
  workerId: string;
  workerName: string;
  serviceDate: string;
  completedAtHours: number;
  serviceType: string;
  notes: string;
  nextServiceDue: number;
  partsReplaced?: string[];
  setOperational?: boolean;
}): Promise<ServiceRecord> {
  const { machine, workerId, workerName, serviceDate, completedAtHours, serviceType, notes, nextServiceDue, partsReplaced, setOperational } = params;

  const newRecord: ServiceRecord = {
    id: `SRV-${Date.now()}`,
    machineId: machine.id,
    unitCode: machine.unitCode,
    machineName: machine.name,
    serviceDate,
    performedByWorkerId: workerId,
    performedByWorkerName: workerName,
    completedAtHours,
    usageUnit: machine.usageUnit || 'Hours',
    serviceType,
    notes,
    partsReplaced: partsReplaced || [],
    nextServiceDueSetTo: nextServiceDue,
    synced: false,
    createdAt: new Date().toISOString(),
  };

  // 1. Update local service list
  const existingServices = getSavedServices();
  const updatedServices = [newRecord, ...existingServices];
  saveSavedServices(updatedServices);

  // 2. Update machine in cached master list
  const machines = getSavedMachines();
  const mIdx = machines.findIndex(m => m.id === machine.id || m.unitCode === machine.unitCode);
  if (mIdx >= 0) {
    machines[mIdx] = {
      ...machines[mIdx],
      currentHours: Math.max(machines[mIdx].currentHours, completedAtHours),
      nextServiceDue: nextServiceDue,
      lastServiceDate: serviceDate,
      lastServiceHours: completedAtHours,
      lastServiceByWorkerId: workerId,
      lastServiceByWorkerName: workerName,
      serviceNotes: notes,
      status: setOperational ? 'Operational' : machines[mIdx].status,
    };
    saveSavedMachines(machines);
  }

  // 3. Dispatch events
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('services-updated', { detail: newRecord }));
  }

  // 4. Async Sync to Server
  try {
    const targetIp = getTailscaleIp();
    await smartFetchApi('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([newRecord]),
    }, targetIp);

    // Also update machine master on server
    if (mIdx >= 0) {
      await smartFetchApi('/api/master/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machines[mIdx]),
      }, targetIp);
    }
  } catch (e) {
    console.log('Saved service record offline. Will synchronize when online.');
  }

  return newRecord;
}

export async function updateMachineServiceSettings(
  machineId: string,
  settings: {
    usageUnit?: 'Hours' | 'KM';
    nextServiceDue?: number;
    serviceInterval?: number;
    currentHours?: number;
    status?: 'Operational' | 'Requires Service' | 'Out of Service';
  }
): Promise<Machine | null> {
  const machines = getSavedMachines();
  const mIdx = machines.findIndex(m => m.id === machineId || m.unitCode === machineId);
  if (mIdx < 0) return null;

  machines[mIdx] = {
    ...machines[mIdx],
    ...settings,
  };
  saveSavedMachines(machines);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('services-updated'));
  }

  try {
    const targetIp = getTailscaleIp();
    await smartFetchApi('/api/master/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(machines[mIdx]),
    }, targetIp);
  } catch (e) {
    console.log('Saved machine service settings offline.');
  }

  return machines[mIdx];
}

export async function syncServicesFromServer(): Promise<ServiceRecord[]> {
  const targetIp = getTailscaleIp();
  try {
    const { data: serverServices } = await smartFetchApi('/api/services', {}, targetIp);
    if (Array.isArray(serverServices) && serverServices.length > 0) {
      const localServices = getSavedServices();
      const map = new Map<string, ServiceRecord>();
      serverServices.forEach(s => { if (s && s.id) map.set(s.id, s); });
      localServices.forEach(s => { if (s && s.id && !map.has(s.id)) map.set(s.id, s); });

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
      );
      saveSavedServices(merged);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('services-updated'));
      }
      return merged;
    }
  } catch (e) {
    console.warn('Unable to sync services from server:', e);
  }
  return getSavedServices();
}
