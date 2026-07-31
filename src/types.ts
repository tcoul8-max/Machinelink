export type PrestartType = 1 | 2 | 3;

export interface Worker {
  id: string;
  name: string;
  role: string;
  pin: string;
  phone?: string;
  active: boolean;
}

export interface Machine {
  id: string;
  unitCode: string; // e.g. "EX-201"
  name: string; // e.g. "CAT 320 Tracked Excavator"
  regoOrSerial: string;
  prestartType: PrestartType; // 1 = Wheeled Heavy, 2 = Tracked Heavy, 3 = Light/Aux
  currentHours: number;
  status: 'Operational' | 'Requires Service' | 'Out of Service';
  lastPrestartDate?: string;
}

export interface CheckItemDefinition {
  id: string;
  category: 'Fluid Levels' | 'Ground & Mechanical' | 'Cab & Safety' | 'Operational Checks';
  label: string;
  description?: string;
}

export type CheckStatus = 'PASS' | 'FAIL' | 'NA';

export interface ItemCheckResult {
  status: CheckStatus;
  notes?: string;
}

export interface PrestartSubmission {
  id: string;
  timestamp: string;
  date: string;
  workerId: string;
  workerName: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  prestartType: PrestartType;
  engineHours: number;
  overallStatus: 'SAFE_TO_OPERATE' | 'DEFECT_REPORTED' | 'UNSAFE_OUT_OF_SERVICE';
  checks: Record<string, ItemCheckResult>;
  generalNotes?: string;
  signatureDataUrl?: string;
  synced: boolean;
  syncedAt?: string;
}

export interface DocketLineItem {
  id: string;
  description: string;
  itemType: 'Machine Hours' | 'Travel/Mob' | 'Attachment' | 'Materials' | 'Fuel/Consumables' | 'Standby';
  qtyOrHours: number;
  unitRate: number;
  totalAmount: number;
}

export interface JobDocket {
  id: string;
  docketNumber: string;
  date: string;
  workerId: string;
  workerName: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  clientName: string;
  jobSite: string;
  poNumber: string;
  startHours: number;
  endHours: number;
  totalMachineHours: number;
  startTime?: string;
  breakHours?: number;
  finishTime?: string;
  startHourMeter?: number;
  finishHourMeter?: number;
  loadCount?: number;
  drawingDataUrl?: string;
  lineItems: DocketLineItem[];
  subtotal: number;
  gstAmount: number;
  totalIncGst: number;
  operatorSignature?: string;
  clientSignature?: string;
  clientSignerName?: string;
  generalNotes?: string;
  synced: boolean;
  syncedAt?: string;
  pdfUrl?: string;
}

export interface ServerSyncStatus {
  tailscaleIp: string;
  serverConnected: boolean;
  tailscaleStatus: 'Connected' | 'Disconnected' | 'Connecting';
  pendingPrestartsCount: number;
  pendingDocketsCount: number;
  serverPrestartsCount: number;
  serverDocketsCount: number;
  lastSyncTimestamp?: string;
}

export interface DocketTemplateConfig {
  companyName: string;
  companyAbn: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  templateVersion: string;
  logoText: string;
}
