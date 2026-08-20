import { PrestartSubmission, JobDocket } from '../types';
import { smartFetchApi } from './apiClient';

const OFFLINE_PRESTARTS_KEY = 'apex_offline_prestarts_queue';
const OFFLINE_DOCKETS_KEY = 'apex_offline_dockets_queue';
const SIMULATE_OFFLINE_KEY = 'apex_simulate_offline_mode';
const SERVER_URL_KEY = 'apex_tailscale_server_url';
const TAILSCALE_IP_KEY = 'apex_tailscale_ip_address';

export function getTailscaleIp(): string {
  return localStorage.getItem(TAILSCALE_IP_KEY) || '100.112.45.19';
}

export function setTailscaleIp(ip: string): void {
  const cleanIp = ip.trim();
  localStorage.setItem(TAILSCALE_IP_KEY, cleanIp);
  window.dispatchEvent(new Event('tailscale-ip-changed'));
}

export function getSimulatedOffline(): boolean {
  return localStorage.getItem(SIMULATE_OFFLINE_KEY) === 'true';
}

export function setSimulatedOffline(value: boolean): void {
  localStorage.setItem(SIMULATE_OFFLINE_KEY, value ? 'true' : 'false');
  window.dispatchEvent(new Event('offline-mode-changed'));
}

export function getSavedServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || 'http://100.112.45.19:3000';
}

export function setSavedServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url);
}

export function getOfflinePrestarts(): PrestartSubmission[] {
  try {
    const raw = localStorage.getItem(OFFLINE_PRESTARTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveOfflinePrestart(submission: PrestartSubmission): void {
  const current = getOfflinePrestarts();
  const idx = current.findIndex(p => p.id === submission.id);
  if (idx >= 0) {
    current[idx] = submission;
  } else {
    current.push(submission);
  }
  localStorage.setItem(OFFLINE_PRESTARTS_KEY, JSON.stringify(current));
}

export function removeOfflinePrestart(id: string): void {
  const current = getOfflinePrestarts().filter(p => p.id !== id);
  localStorage.setItem(OFFLINE_PRESTARTS_KEY, JSON.stringify(current));
}

export function getOfflineDockets(): JobDocket[] {
  try {
    const raw = localStorage.getItem(OFFLINE_DOCKETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveOfflineDocket(docket: JobDocket): void {
  const current = getOfflineDockets();
  const idx = current.findIndex(d => d.id === docket.id);
  if (idx >= 0) {
    current[idx] = docket;
  } else {
    current.push(docket);
  }
  localStorage.setItem(OFFLINE_DOCKETS_KEY, JSON.stringify(current));
}

export function removeOfflineDocket(id: string): void {
  const current = getOfflineDockets().filter(d => d.id !== id);
  localStorage.setItem(OFFLINE_DOCKETS_KEY, JSON.stringify(current));
}

export async function attemptServerSync(): Promise<{
  success: boolean;
  prestartsSyncedCount: number;
  docketsSyncedCount: number;
  message: string;
}> {
  if (getSimulatedOffline()) {
    return {
      success: false,
      prestartsSyncedCount: 0,
      docketsSyncedCount: 0,
      message: 'App is currently in Simulated Offline Mode. Toggle signal in header to test server sync.',
    };
  }

  const prestarts = getOfflinePrestarts().filter(p => !p.synced);
  const dockets = getOfflineDockets().filter(d => !d.synced);

  try {
    const targetIp = getTailscaleIp();
    // Get local defects to sync
    const rawDefects = localStorage.getItem('apex_defects_store');
    const localDefects = rawDefects ? JSON.parse(rawDefects) : [];

    // Get local services to sync
    const rawServices = localStorage.getItem('apex_services_store');
    const localServices = rawServices ? JSON.parse(rawServices) : [];

    const { res, data } = await smartFetchApi('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prestarts, dockets, defects: localDefects, services: localServices, ip: targetIp }),
    }, targetIp);

    if (!res.ok) {
      throw new Error(data?.message || `Server returned HTTP ${res.status}`);
    }

    // Mark items synced locally
    const allPrestarts = getOfflinePrestarts().map(p => ({ ...p, synced: true, syncedAt: data.syncedAt }));
    const allDockets = getOfflineDockets().map(d => ({ ...d, synced: true, syncedAt: data.syncedAt }));

    localStorage.setItem(OFFLINE_PRESTARTS_KEY, JSON.stringify(allPrestarts));
    localStorage.setItem(OFFLINE_DOCKETS_KEY, JSON.stringify(allDockets));

    // Handle returned defects from server
    if (data && Array.isArray(data.defects)) {
      const map = new Map<string, any>();
      localDefects.forEach((d: any) => { if (d && d.id) map.set(d.id, d); });
      data.defects.forEach((d: any) => { if (d && d.id) map.set(d.id, { ...map.get(d.id), ...d }); });
      const merged = Array.from(map.values());
      localStorage.setItem('apex_defects_store', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('defects-updated'));
    }

    // Handle returned services from server
    if (data && Array.isArray(data.services)) {
      const map = new Map<string, any>();
      localServices.forEach((s: any) => { if (s && s.id) map.set(s.id, s); });
      data.services.forEach((s: any) => { if (s && s.id) map.set(s.id, { ...map.get(s.id), ...s }); });
      const mergedServices = Array.from(map.values()).sort(
        (a: any, b: any) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
      );
      localStorage.setItem('apex_services_store', JSON.stringify(mergedServices));
      window.dispatchEvent(new CustomEvent('services-updated'));
    }

    window.dispatchEvent(new Event('sync-completed'));

    if (prestarts.length === 0 && dockets.length === 0) {
      return {
        success: true,
        prestartsSyncedCount: 0,
        docketsSyncedCount: 0,
        message: 'Defects and system logs synchronized with Tailscale Server Tower.',
      };
    }

    return {
      success: true,
      prestartsSyncedCount: data.prestartsSyncedCount || prestarts.length,
      docketsSyncedCount: data.docketsSyncedCount || dockets.length,
      message: `Successfully synchronized ${prestarts.length} prestarts and ${dockets.length} dockets to Tailscale Server Tower!`,
    };
  } catch (error: any) {
    return {
      success: false,
      prestartsSyncedCount: 0,
      docketsSyncedCount: 0,
      message: `Sync failed: ${error?.message || 'Server connection unreachable'}. Queue retained locally.`,
    };
  }
}
