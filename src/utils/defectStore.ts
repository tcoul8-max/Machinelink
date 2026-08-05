import { DefectRecord, PrestartSubmission, CheckItemDefinition } from '../types';
import { getTailscaleIp } from './offlineStore';
import { smartFetchApi } from './apiClient';

const DEFECTS_KEY = 'apex_defects_store';

export function getSavedDefects(): DefectRecord[] {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(DEFECTS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // fallback
      }
    }
  }
  return [];
}

export function saveSavedDefects(defects: DefectRecord[]): void {
  if (typeof window !== 'undefined' && Array.isArray(defects)) {
    localStorage.setItem(DEFECTS_KEY, JSON.stringify(defects));
  }
}

export function getOpenDefectsForMachine(machineId: string, defects?: DefectRecord[]): DefectRecord[] {
  const list = defects || getSavedDefects();
  return list.filter(d => d.machineId === machineId && d.status !== 'REPAIRED');
}

export async function createDefectsFromPrestart(
  submission: PrestartSubmission,
  questions: CheckItemDefinition[]
): Promise<DefectRecord[]> {
  const existingDefects = getSavedDefects();
  const newDefects: DefectRecord[] = [];

  const questionsMap = new Map<string, CheckItemDefinition>();
  questions.forEach(q => questionsMap.set(q.id, q));

  Object.entries(submission.checks).forEach(([checkItemId, checkResult]) => {
    // Register defect if status is FAIL or if notes contain defect description
    if (checkResult.status === 'FAIL' || (checkResult.notes && checkResult.notes.trim().length > 0)) {
      const qDef = questionsMap.get(checkItemId);
      const defectId = `DEF-${submission.id.replace(/[^a-zA-Z0-9]/g, '')}-${checkItemId}`;
      
      // Check if defect already created
      const existsIndex = existingDefects.findIndex(d => d.id === defectId);
      const defectObj: DefectRecord = {
        id: defectId,
        submissionId: submission.id,
        machineId: submission.machineId,
        unitCode: submission.machineCode,
        machineName: submission.machineName,
        checkItemId,
        checkItemLabel: qDef ? qDef.label : checkItemId,
        category: qDef ? qDef.category : 'General Checks',
        reportedByWorkerId: submission.workerId,
        reportedByWorkerName: submission.workerName,
        reportedAt: submission.timestamp || new Date().toISOString(),
        status: 'OPEN',
        notes: checkResult.notes || (checkResult.status === 'FAIL' ? 'Failed inspection item' : 'Note recorded during prestart'),
      };

      if (existsIndex >= 0) {
        existingDefects[existsIndex] = { ...existingDefects[existsIndex], ...defectObj };
      } else {
        existingDefects.push(defectObj);
        newDefects.push(defectObj);
      }
    }
  });

  saveSavedDefects(existingDefects);

  // Sync to server
  try {
    const targetIp = getTailscaleIp();
    await smartFetchApi('/api/defects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existingDefects),
    }, targetIp);
  } catch (e) {
    console.warn('Defects saved locally, offline sync pending:', e);
  }

  return newDefects;
}

export async function updateDefect(defectId: string, patch: Partial<DefectRecord>): Promise<DefectRecord[]> {
  const existingDefects = getSavedDefects();
  const index = existingDefects.findIndex(d => d.id === defectId);
  if (index >= 0) {
    existingDefects[index] = { ...existingDefects[index], ...patch };
    saveSavedDefects(existingDefects);

    try {
      const targetIp = getTailscaleIp();
      await smartFetchApi('/api/defects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([existingDefects[index]]),
      }, targetIp);
    } catch (e) {
      console.warn('Updated defect locally, server sync pending:', e);
    }
  }
  return existingDefects;
}

export async function syncDefectsFromServer(): Promise<DefectRecord[]> {
  try {
    const targetIp = getTailscaleIp();
    const local = getSavedDefects();

    // 1. Post local defects to server to ensure server has anything logged offline
    if (local.length > 0) {
      await smartFetchApi('/api/defects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(local),
      }, targetIp).catch(() => {});
    }

    // 2. Fetch master defects list from server
    const { data } = await smartFetchApi('/api/defects', {}, targetIp);
    if (Array.isArray(data)) {
      const map = new Map<string, DefectRecord>();
      local.forEach(d => map.set(d.id, d));
      data.forEach(d => {
        if (d && d.id) {
          map.set(d.id, { ...map.get(d.id), ...d });
        }
      });
      const merged = Array.from(map.values());
      saveSavedDefects(merged);
      window.dispatchEvent(new CustomEvent('defects-updated'));
      return merged;
    }
  } catch (e) {
    // ignore
  }
  return getSavedDefects();
}
