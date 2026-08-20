import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { INITIAL_WORKERS, INITIAL_MACHINES, DEFAULT_DOCKET_TEMPLATE, DEFAULT_PRESTART_TEMPLATE_STORE } from './src/data/defaultData.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3004;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable CORS for direct web clients (e.g. GitHub Pages static frontend)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Ensure server storage directories exist
const STORAGE_DIR = path.join(process.cwd(), 'server_storage');
const PDF_DIR = path.join(STORAGE_DIR, 'dockets_pdf');
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

const PRESTARTS_CSV_PATH = path.join(STORAGE_DIR, 'prestarts.csv');
const PRESTARTS_JSON_PATH = path.join(STORAGE_DIR, 'prestarts.json');
const WORKERS_JSON_PATH = path.join(STORAGE_DIR, 'workers.json');
const MACHINES_JSON_PATH = path.join(STORAGE_DIR, 'machines.json');
const DOCKETS_JSON_PATH = path.join(STORAGE_DIR, 'dockets.json');
const DEFECTS_JSON_PATH = path.join(STORAGE_DIR, 'defects.json');
const SERVICES_JSON_PATH = path.join(STORAGE_DIR, 'services.json');
const TEMPLATE_JSON_PATH = path.join(STORAGE_DIR, 'docket_template.json');

function parsePrestartsFromCSV(): any[] {
  if (!fs.existsSync(PRESTARTS_CSV_PATH)) return [];
  try {
    const content = fs.readFileSync(PRESTARTS_CSV_PATH, 'utf-8');
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
    if (lines.length <= 1) return [];

    const checkKeyMap: Record<number, { id: string; label: string; cat: string }> = {
      9: { id: 'engine_oil', label: 'Engine Oil Level & Leaks', cat: 'Engine & Fluids' },
      10: { id: 'hydraulic_oil', label: 'Hydraulic Oil Level & Hoses', cat: 'Engine & Fluids' },
      11: { id: 'coolant', label: 'Radiator Coolant Level', cat: 'Engine & Fluids' },
      12: { id: 'transmission_oil', label: 'Transmission / Drive Oil', cat: 'Engine & Fluids' },
      13: { id: 'fuel_level', label: 'Fuel Level & Water Trap', cat: 'Engine & Fluids' },
      14: { id: 'tracks', label: 'Tracks & Undercarriage Tension', cat: 'Ground & Undercarriage' },
      15: { id: 'tires', label: 'Tires & Wheel Nuts Condition', cat: 'Ground & Undercarriage' },
      16: { id: 'steering', label: 'Steering Linkages & Cylinder', cat: 'Ground & Undercarriage' },
      17: { id: 'brakes', label: 'Service & Park Brake Operation', cat: 'Ground & Undercarriage' },
      18: { id: 'air_cleaner', label: 'Air Cleaner & Intake System', cat: 'General & Safety' },
      19: { id: 'attachment_bucket', label: 'Bucket, Pins & Attachments', cat: 'General & Safety' },
      20: { id: 'lights_beacons', label: 'Work Lights, Indicators & Beacons', cat: 'Cabin & Controls' },
      21: { id: 'seatbelt', label: 'Seatbelt Condition & Mounting', cat: 'Cabin & Controls' },
      22: { id: 'mirrors_glass', label: 'Mirrors, Glass & Wipers', cat: 'Cabin & Controls' },
      23: { id: 'fire_extinguisher', label: 'Fire Extinguisher & First Aid', cat: 'Cabin & Controls' },
      24: { id: 'horn_beeper', label: 'Horn & Reverse Alarm Beeper', cat: 'Cabin & Controls' },
      25: { id: 'controls_estop', label: 'Controls Neutral Lock & E-Stop', cat: 'Cabin & Controls' }
    };

    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = parseCsvLine(lines[i]);
      if (parts.length < 9) continue;

      const subId = parts[0] || `PRE-${i}`;
      const timestamp = parts[1] || new Date().toISOString();
      const date = parts[2] || new Date().toLocaleDateString();
      const workerName = parts[3] || 'Operator';
      const machineCode = parts[4] || 'N/A';
      const machineName = parts[5] || 'N/A';
      const prestartTypeStr = parts[6] || 'Type 1';
      const prestartType = parseInt(prestartTypeStr.replace(/\D/g, ''), 10) || 1;
      const engineHours = parseFloat(parts[7]) || 0;
      const overallStatus = parts[8] || 'SAFE_TO_OPERATE';

      const checks: Record<string, { status: string; notes?: string }> = {};

      Object.entries(checkKeyMap).forEach(([colIdxStr, meta]) => {
        const colIdx = parseInt(colIdxStr, 10);
        const rawVal = parts[colIdx] || 'N/A';
        if (rawVal !== 'N/A') {
          let status = 'PASS';
          let notes = '';
          if (rawVal.startsWith('FAIL')) {
            status = 'FAIL';
            const m = rawVal.match(/\((.*)\)/);
            if (m) notes = m[1];
          } else if (rawVal.startsWith('PASS')) {
            status = 'PASS';
            const m = rawVal.match(/\((.*)\)/);
            if (m) notes = m[1];
          } else {
            status = 'PASS';
            notes = rawVal;
          }
          checks[meta.id] = { status, notes };
        }
      });

      const generalNotes = parts[26] || '';
      const signatureDataUrl = parts[27] === 'YES' ? 'DATA_EXISTS' : '';

      parsed.push({
        id: subId,
        timestamp,
        date,
        workerName,
        workerId: workerName,
        machineCode,
        machineName,
        machineId: machineCode,
        prestartType,
        engineHours,
        overallStatus,
        checks,
        generalNotes,
        signatureDataUrl,
        synced: true,
        syncedAt: timestamp
      });
    }
    return parsed;
  } catch (e) {
    console.error('Error parsing prestarts from CSV:', e);
    return [];
  }
}

function getPrestarts(): any[] {
  const map = new Map<string, any>();
  const csvPrestarts = parsePrestartsFromCSV();
  csvPrestarts.forEach(p => { if (p && p.id) map.set(p.id, p); });

  if (fs.existsSync(PRESTARTS_JSON_PATH)) {
    try {
      const jsonPrestarts = JSON.parse(fs.readFileSync(PRESTARTS_JSON_PATH, 'utf-8'));
      if (Array.isArray(jsonPrestarts)) {
        jsonPrestarts.forEach(p => {
          if (p && p.id) {
            map.set(p.id, { ...map.get(p.id), ...p });
          }
        });
      }
    } catch (e) {
      // fallback
    }
  }

  return Array.from(map.values());
}

function savePrestarts(prestarts: any[]) {
  fs.writeFileSync(PRESTARTS_JSON_PATH, JSON.stringify(prestarts, null, 2));
}

function getDefects(): any[] {
  const defectMap = new Map<string, any>();

  // 1. Read existing defects.json if present
  if (fs.existsSync(DEFECTS_JSON_PATH)) {
    try {
      const jsonDefects = JSON.parse(fs.readFileSync(DEFECTS_JSON_PATH, 'utf-8'));
      if (Array.isArray(jsonDefects)) {
        jsonDefects.forEach((d: any) => {
          if (d && d.id) defectMap.set(d.id, d);
        });
      }
    } catch (e) {
      // fallback
    }
  }

  // 2. Extract defects from all prestarts (from getPrestarts())
  const allPrestarts = getPrestarts();
  const checkKeyLabelMap: Record<string, { label: string; category: string }> = {
    engine_oil: { label: 'Engine Oil Level & Leaks', category: 'Engine & Fluids' },
    hydraulic_oil: { label: 'Hydraulic Oil Level & Hoses', category: 'Engine & Fluids' },
    coolant: { label: 'Radiator Coolant Level', category: 'Engine & Fluids' },
    transmission_oil: { label: 'Transmission / Drive Oil', category: 'Engine & Fluids' },
    fuel_level: { label: 'Fuel Level & Water Trap', category: 'Engine & Fluids' },
    tracks: { label: 'Tracks & Undercarriage Tension', category: 'Ground & Undercarriage' },
    tires: { label: 'Tires & Wheel Nuts Condition', category: 'Ground & Undercarriage' },
    steering: { label: 'Steering Linkages & Cylinder', category: 'Ground & Undercarriage' },
    brakes: { label: 'Service & Park Brake Operation', category: 'Ground & Undercarriage' },
    air_cleaner: { label: 'Air Cleaner & Intake System', category: 'General & Safety' },
    attachment_bucket: { label: 'Bucket, Pins & Attachments', category: 'General & Safety' },
    lights_beacons: { label: 'Work Lights, Indicators & Beacons', category: 'Cabin & Controls' },
    seatbelt: { label: 'Seatbelt Condition & Mounting', category: 'Cabin & Controls' },
    mirrors_glass: { label: 'Mirrors, Glass & Wipers', category: 'Cabin & Controls' },
    fire_extinguisher: { label: 'Fire Extinguisher & First Aid', category: 'Cabin & Controls' },
    horn_beeper: { label: 'Horn & Reverse Alarm Beeper', category: 'Cabin & Controls' },
    controls_estop: { label: 'Controls Neutral Lock & E-Stop', category: 'Cabin & Controls' }
  };

  allPrestarts.forEach((prestart: any) => {
    if (prestart.checks && typeof prestart.checks === 'object') {
      Object.entries(prestart.checks).forEach(([checkItemId, checkResult]: [string, any]) => {
        if (checkResult && (checkResult.status === 'FAIL' || (checkResult.notes && checkResult.notes.trim().length > 0))) {
          const defectId = `DEF-${prestart.id.replace(/[^a-zA-Z0-9]/g, '')}-${checkItemId}`;
          if (!defectMap.has(defectId)) {
            const meta = checkKeyLabelMap[checkItemId] || { label: checkItemId, category: 'Prestart Inspection' };
            defectMap.set(defectId, {
              id: defectId,
              submissionId: prestart.id,
              machineId: prestart.machineId || prestart.machineCode,
              unitCode: prestart.machineCode,
              machineName: prestart.machineName,
              checkItemId,
              checkItemLabel: meta.label,
              category: meta.category,
              reportedByWorkerId: prestart.workerId || prestart.workerName,
              reportedByWorkerName: prestart.workerName,
              reportedAt: prestart.timestamp || new Date().toISOString(),
              status: 'OPEN',
              notes: checkResult.notes || 'Reported during prestart inspection',
            });
          }
        }
      });
    }
  });

  return Array.from(defectMap.values());
}

function saveDefects(defects: any[]) {
  fs.writeFileSync(DEFECTS_JSON_PATH, JSON.stringify(defects, null, 2));
}

const INITIAL_SERVICES_SERVER: any[] = [
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

function getServices(): any[] {
  if (fs.existsSync(SERVICES_JSON_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(SERVICES_JSON_PATH, 'utf-8'));
      if (Array.isArray(data)) return data;
    } catch (e) {
      // fallback
    }
  }
  return INITIAL_SERVICES_SERVER;
}

function saveServices(services: any[]) {
  fs.writeFileSync(SERVICES_JSON_PATH, JSON.stringify(services, null, 2));
}
const PRESTART_TEMPLATES_JSON_PATH = path.join(STORAGE_DIR, 'prestart_templates.json');

function getDocketTemplate() {
  if (fs.existsSync(TEMPLATE_JSON_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(TEMPLATE_JSON_PATH, 'utf-8'));
    } catch (e) {
      // fallback
    }
  }
  return DEFAULT_DOCKET_TEMPLATE;
}

function saveDocketTemplate(template: any) {
  fs.writeFileSync(TEMPLATE_JSON_PATH, JSON.stringify(template, null, 2));
}

function getPrestartTemplates() {
  if (fs.existsSync(PRESTART_TEMPLATES_JSON_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(PRESTART_TEMPLATES_JSON_PATH, 'utf-8'));
    } catch (e) {
      // fallback
    }
  }
  return DEFAULT_PRESTART_TEMPLATE_STORE;
}

function savePrestartTemplates(store: any) {
  fs.writeFileSync(PRESTART_TEMPLATES_JSON_PATH, JSON.stringify(store, null, 2));
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

// Initialize Master Lists if not created
if (!fs.existsSync(WORKERS_JSON_PATH)) {
  fs.writeFileSync(WORKERS_JSON_PATH, JSON.stringify(INITIAL_WORKERS, null, 2));
}
if (!fs.existsSync(MACHINES_JSON_PATH)) {
  fs.writeFileSync(MACHINES_JSON_PATH, JSON.stringify(INITIAL_MACHINES, null, 2));
}
if (!fs.existsSync(DOCKETS_JSON_PATH)) {
  fs.writeFileSync(DOCKETS_JSON_PATH, JSON.stringify([], null, 2));
}

// Initialize CSV file header if not exists
const CSV_HEADER = [
  'Submission_ID',
  'Timestamp',
  'Date',
  'Worker_Name',
  'Machine_Code',
  'Machine_Name',
  'Prestart_Type',
  'Engine_Hours',
  'Overall_Status',
  'Engine_Oil',
  'Hydraulic_Oil',
  'Coolant',
  'Transmission_Drive_Oil',
  'Fuel_Water_Trap',
  'Tracks_Undercarriage',
  'Tires_Wheel_Nuts',
  'Steering_Linkages',
  'Brakes_Park_Brake',
  'Air_Cleaner',
  'Bucket_Pins_Attachment',
  'Lights_Beacons',
  'Seatbelt',
  'Mirrors_Glass',
  'Fire_Extinguisher',
  'Horn_Reverse_Alarm',
  'Controls_EStop',
  'General_Notes',
  'Operator_Signature_Attached'
].join(',') + '\n';

const INITIAL_PRESTART_ROWS = [
  'PRE-2026-001,2026-07-30T06:15:00.000Z,30/07/2026,"John Miller",EX-01,"Caterpillar 320 Excavator (Tracked)",Type 2,1425.5,SAFE_TO_OPERATE,PASS,PASS,PASS,N/A,PASS,PASS,N/A,N/A,PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS,"Prestart inspection complete. Machine clean and operational.",YES',
  'PRE-2026-002,2026-07-30T06:30:00.000Z,30/07/2026,"Dave Wilson",DZ-04,"Komatsu D65EX Dozer (Tracked)",Type 2,3102.8,SAFE_TO_OPERATE,PASS,PASS,PASS,N/A,PASS,PASS,N/A,N/A,PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS,"Blade grease points serviced.",YES',
  'PRE-2026-003,2026-07-30T07:00:00.000Z,30/07/2026,"Sarah Jenkins",WL-08,"Volvo L150H Wheel Loader",Type 1,2150.2,DEFECT_REPORTED,PASS,PASS,PASS,PASS,PASS,N/A,PASS (Minor wear on LHS front),PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS,"Minor tire wear noticed on LHS front. Reported to supervisor.",YES'
].join('\n') + '\n';

if (!fs.existsSync(PRESTARTS_CSV_PATH) || fs.readFileSync(PRESTARTS_CSV_PATH, 'utf-8').trim().split('\n').length <= 1) {
  fs.writeFileSync(PRESTARTS_CSV_PATH, CSV_HEADER + INITIAL_PRESTART_ROWS);
}

// Helper functions to parse CSV files if present in machinelink or server_storage
function getWorkersFromCSV(): any[] | null {
  const possiblePaths = [
    '/home/tristan/machinelink/workers.csv',
    path.join(process.cwd(), 'machinelink', 'workers.csv'),
    path.join(process.cwd(), 'server_storage', 'workers.csv'),
    path.join(process.cwd(), 'workers.csv')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf-8');
        const lines = content.trim().split('\n');
        if (lines.length > 1) {
          const workers: any[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length >= 4) {
              workers.push({
                id: parts[0]?.trim(),
                name: parts[1]?.trim(),
                role: parts[2]?.trim(),
                pin: parts[3]?.trim(),
                active: parts[4] ? parts[4].trim() === 'true' : true
              });
            }
          }
          if (workers.length > 0) return workers;
        }
      } catch (e) {
        console.error('Error reading workers CSV:', e);
      }
    }
  }
  return null;
}

function getMachinesFromCSV(): any[] | null {
  const possiblePaths = [
    '/home/tristan/machinelink/machines.csv',
    path.join(process.cwd(), 'machinelink', 'machines.csv'),
    path.join(process.cwd(), 'server_storage', 'machines.csv'),
    path.join(process.cwd(), 'machines.csv')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf-8');
        const lines = content.trim().split('\n');
        if (lines.length > 1) {
          const machines: any[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());
            if (parts.length >= 6) {
              const currentH = parseFloat(parts[5]) || 0;
              const nextDueVal = parts[8] !== undefined && parts[8] !== '' ? parseFloat(parts[8]) : undefined;
              const intervalVal = parts[9] !== undefined && parts[9] !== '' ? parseFloat(parts[9]) : undefined;
              const lastHVal = parts[11] !== undefined && parts[11] !== '' ? parseFloat(parts[11]) : undefined;

              machines.push({
                id: parts[0] || `m_${i}`,
                unitCode: parts[1] || `UNIT-${i}`,
                name: parts[2] || 'Machine',
                regoOrSerial: parts[3] || '',
                prestartType: parseInt(parts[4], 10) || 1,
                currentHours: currentH,
                status: parts[6] ? parts[6] : 'Operational',
                usageUnit: parts[7] === 'KM' ? 'KM' : 'Hours',
                nextServiceDue: !isNaN(nextDueVal as number) ? nextDueVal : undefined,
                serviceInterval: !isNaN(intervalVal as number) ? intervalVal : undefined,
                lastServiceDate: parts[10] || undefined,
                lastServiceHours: !isNaN(lastHVal as number) ? lastHVal : undefined,
              });
            }
          }
          if (machines.length > 0) return machines;
        }
      } catch (e) {
        console.error('Error reading machines CSV:', e);
      }
    }
  }
  return null;
}

// Helper functions
function getWorkers() {
  const fromCsv = getWorkersFromCSV();
  if (fromCsv) return fromCsv;

  try {
    return JSON.parse(fs.readFileSync(WORKERS_JSON_PATH, 'utf-8'));
  } catch (e) {
    return INITIAL_WORKERS;
  }
}

function getMachines() {
  let jsonMachines: any[] = [];
  if (fs.existsSync(MACHINES_JSON_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(MACHINES_JSON_PATH, 'utf-8'));
      if (Array.isArray(parsed)) jsonMachines = parsed;
    } catch (e) {
      // fallback
    }
  }

  const fromCsv = getMachinesFromCSV();
  if (!fromCsv || fromCsv.length === 0) {
    return jsonMachines.length > 0 ? jsonMachines : INITIAL_MACHINES;
  }

  // Merge CSV with JSON machine properties so nextServiceDue & metadata are preserved
  const jsonMap = new Map<string, any>();
  jsonMachines.forEach(m => {
    if (m && m.id) jsonMap.set(m.id, m);
    if (m && m.unitCode) jsonMap.set(m.unitCode, m);
  });

  const merged = fromCsv.map(cm => {
    const jm = jsonMap.get(cm.id) || jsonMap.get(cm.unitCode) || {};
    return {
      ...jm,
      ...cm,
      usageUnit: cm.usageUnit || jm.usageUnit || 'Hours',
      nextServiceDue: cm.nextServiceDue !== undefined ? cm.nextServiceDue : jm.nextServiceDue,
      serviceInterval: cm.serviceInterval !== undefined ? cm.serviceInterval : jm.serviceInterval,
      lastServiceDate: cm.lastServiceDate || jm.lastServiceDate,
      lastServiceHours: cm.lastServiceHours !== undefined ? cm.lastServiceHours : jm.lastServiceHours,
      serviceNotes: cm.serviceNotes || jm.serviceNotes,
    };
  });

  return merged;
}

function getDockets() {
  try {
    return JSON.parse(fs.readFileSync(DOCKETS_JSON_PATH, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveWorkers(workers: any) {
  fs.writeFileSync(WORKERS_JSON_PATH, JSON.stringify(workers, null, 2));
}

function saveMachines(machines: any) {
  fs.writeFileSync(MACHINES_JSON_PATH, JSON.stringify(machines, null, 2));

  // Also sync to machines.csv in server_storage or machinelink if present
  try {
    const targetDirs = [
      STORAGE_DIR,
      path.join(process.cwd(), 'machinelink'),
      path.join(process.cwd(), 'server_storage'),
      process.cwd(),
      '/home/tristan/machinelink'
    ];
    for (const dir of targetDirs) {
      if (fs.existsSync(dir)) {
        const csvPath = path.join(dir, 'machines.csv');
        const header = 'id,unitCode,name,regoOrSerial,prestartType,currentHours,status,usageUnit,nextServiceDue,serviceInterval,lastServiceDate,lastServiceHours\n';
        const rows = machines.map((m: any) =>
          `"${m.id || ''}","${m.unitCode || ''}","${(m.name || '').replace(/"/g, '""')}","${m.regoOrSerial || m.rego || ''}",${m.prestartType || 1},${m.currentHours !== undefined ? m.currentHours : 0},"${m.status || 'Operational'}","${m.usageUnit || 'Hours'}",${m.nextServiceDue !== undefined && !isNaN(m.nextServiceDue) ? m.nextServiceDue : ''},${m.serviceInterval || 250},"${m.lastServiceDate || ''}",${m.lastServiceHours !== undefined && !isNaN(m.lastServiceHours) ? m.lastServiceHours : ''}`
        ).join('\n');
        fs.writeFileSync(csvPath, header + rows + '\n');
      }
    }
  } catch (e) {
    console.error('Error syncing machines.csv:', e);
  }
}

function saveDockets(dockets: any) {
  fs.writeFileSync(DOCKETS_JSON_PATH, JSON.stringify(dockets, null, 2));
}

function appendPrestartToCSV(sub: any) {
  const getStatus = (itemId: string) => {
    if (!sub.checks || !sub.checks[itemId]) return 'N/A';
    const c = sub.checks[itemId];
    return c.notes ? `${c.status} (${c.notes.replace(/,/g, ';')})` : c.status;
  };

  const escapeCsv = (str: string) => {
    if (!str) return '';
    const clean = str.replace(/"/g, '""').replace(/\n/g, ' ');
    return `"${clean}"`;
  };

  const row = [
    sub.id,
    sub.timestamp || new Date().toISOString(),
    sub.date || new Date().toLocaleDateString(),
    escapeCsv(sub.workerName),
    sub.machineCode,
    escapeCsv(sub.machineName),
    `Type ${sub.prestartType}`,
    sub.engineHours,
    sub.overallStatus,
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
    escapeCsv(sub.generalNotes || ''),
    sub.signatureDataUrl ? 'YES' : 'NO'
  ].join(',') + '\n';

  fs.appendFileSync(PRESTARTS_CSV_PATH, row);
}

function getNextDocketNumber(): string {
  const dockets = getDockets();
  let maxNum = -1; // Default sequence starts at 0000
  for (const doc of dockets) {
    if (doc.docketNumber) {
      const match = doc.docketNumber.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }
  return String(maxNum + 1).padStart(4, '0');
}

function formatTargetUrl(ip: string): string {
  if (!ip) return '';
  let url = ip.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = !url.includes(':') ? `http://${url}:3004` : `http://${url}`;
  }
  return url;
}

// Dedicated Tailscale test connection endpoint for diagnostics
app.post('/api/tailscale/test', async (req, res) => {
  const { serverUrl, ip } = req.body;
  const target = serverUrl || ip;
  if (!target) return res.status(400).json({ success: false, message: 'Server URL or IP required' });

  try {
    const formattedUrl = formatTargetUrl(target);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${formattedUrl}/api/server-info`, { signal: controller.signal });
    clearTimeout(id);

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        success: false,
        message: `Server at ${formattedUrl} returned non-JSON data. Make sure 'node server.js' is running on port 3004.`
      });
    }

    if (response.ok) {
      return res.json({ success: true, serverInfo: data });
    } else {
      return res.status(502).json({
        success: false,
        message: `Remote server responded with HTTP status ${response.status}`
      });
    }
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError' || err.message?.includes('abort');
    return res.status(502).json({
      success: false,
      message: isTimeout
        ? 'Connection timed out. Verify server IP, port 3004, and Tailscale connectivity.'
        : `Could not reach ${target}: ${err.message || 'Network unreachable'}`
    });
  }
});

// API Routes
app.get('/api/dockets/next-number', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const r = await fetch(`${targetUrl}/api/dockets/next-number`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Fallback
    }
  }
  const nextNumber = getNextDocketNumber();
  res.json({ nextDocketNumber: nextNumber });
});

app.get('/api/server-info', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const r = await fetch(`${targetUrl}/api/server-info`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Fallback
    }
  }

  const prestartCsvContent = fs.readFileSync(PRESTARTS_CSV_PATH, 'utf-8');
  const csvLines = prestartCsvContent.trim().split('\n');
  const prestartsCount = Math.max(0, csvLines.length - 1, getPrestarts().length);
  const dockets = getDockets();
  const services = getServices();

  res.json({
    tailscaleIp: '100.112.45.19',
    serverConnected: true,
    tailscaleStatus: 'Connected',
    serverName: 'APEX-TOWER-01 (Tailscale Mesh Node)',
    serverPrestartsCount: prestartsCount,
    serverDocketsCount: dockets.length,
    serverServicesCount: services.length,
    lastSyncTimestamp: new Date().toISOString(),
    storagePath: STORAGE_DIR
  });
});

// Health check endpoint for real-world connectivity testing
app.get('/api/health-check', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();

  // If no target IP or pointed to local machine default port 3000
  if (!targetIp || targetIp === '3000' || targetIp === 'local') {
    return res.json({
      online: true,
      ip: targetIp || '127.0.0.1',
      status: 'Connected',
      serverName: 'Local Server Node',
      timestamp: new Date().toISOString()
    });
  }

  const targetUrl = formatTargetUrl(targetIp);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(`${targetUrl}/api/server-info`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return res.json({
        online: true,
        ip: targetIp,
        targetUrl,
        status: 'Connected',
        serverInfo: data
      });
    } else {
      return res.json({
        online: false,
        ip: targetIp,
        targetUrl,
        status: 'Unreachable',
        error: `HTTP ${response.status} from target server`
      });
    }
  } catch (err: any) {
    return res.json({
      online: false,
      ip: targetIp,
      targetUrl,
      status: 'Unreachable',
      error: err.name === 'AbortError' ? `Connection timed out to ${targetUrl}` : (err.message || 'Network unreachable')
    });
  }
});

app.get('/api/master/workers', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();

  // If remote target IP provided, attempt remote fetch with quick timeout
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const r = await fetch(`${targetUrl}/api/master/workers`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e: any) {
      // Silent fallback to local CSV/JSON if remote Tailscale server is unreachable
    }
  }

  res.json(getWorkers());
});

app.post('/api/master/workers', async (req, res) => {
  const targetIp = (req.query.ip as string || req.body?.ip || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const r = await fetch(`${targetUrl}/api/master/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Silent fallback
    }
  }

  const workers = getWorkers();
  const newWorker = req.body;
  
  const existingIdx = workers.findIndex((w: any) => w.id === newWorker.id);
  if (existingIdx >= 0) {
    workers[existingIdx] = newWorker;
  } else {
    workers.push(newWorker);
  }
  saveWorkers(workers);
  res.json({ success: true, workers });
});

app.get('/api/master/machines', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();

  // If remote target IP provided, attempt remote fetch with quick timeout
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const r = await fetch(`${targetUrl}/api/master/machines`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e: any) {
      // Silent fallback to local CSV/JSON if remote Tailscale server is unreachable
    }
  }

  res.json(getMachines());
});

app.post('/api/master/machines', async (req, res) => {
  const targetIp = (req.query.ip as string || req.body?.ip || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const r = await fetch(`${targetUrl}/api/master/machines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Silent fallback
    }
  }

  const machines = getMachines();
  const newMachine = req.body;

  const existingIdx = machines.findIndex((m: any) => m.id === newMachine.id);
  if (existingIdx >= 0) {
    machines[existingIdx] = newMachine;
  } else {
    machines.push(newMachine);
  }
  saveMachines(machines);
  res.json({ success: true, machines });
});

// Get prestarts list
app.get('/api/prestarts', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const r = await fetch(`${targetUrl}/api/prestarts`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Silent fallback
    }
  }
  res.json(getPrestarts());
});

// Submit a single prestart
app.post('/api/prestarts', (req, res) => {
  const submission = req.body;
  if (!submission.id) submission.id = 'pre_' + Date.now();
  submission.synced = true;
  submission.syncedAt = new Date().toISOString();

  appendPrestartToCSV(submission);

  const existingPrestarts = getPrestarts();
  const pIdx = existingPrestarts.findIndex((p: any) => p.id === submission.id);
  if (pIdx >= 0) {
    existingPrestarts[pIdx] = submission;
  } else {
    existingPrestarts.push(submission);
  }
  savePrestarts(existingPrestarts);

  // Update Machine hours & last prestart
  const machines = getMachines();
  const machine = machines.find((m: any) => m.id === submission.machineId || m.unitCode === submission.machineCode);
  if (machine) {
    const subHours = parseFloat(submission.engineHours);
    if (!isNaN(subHours) && subHours > 0) {
      if (subHours > (machine.currentHours || 0) || !machine.currentHours) {
        machine.currentHours = subHours;
      }
    }
    machine.lastPrestartDate = submission.date || new Date().toISOString();
    if (submission.overallStatus === 'UNSAFE_OUT_OF_SERVICE') {
      machine.status = 'Out of Service';
    } else if (submission.overallStatus === 'DEFECT_REPORTED') {
      machine.status = 'Requires Service';
    } else if (machine.status !== 'Out of Service') {
      machine.status = 'Operational';
    }
    saveMachines(machines);
  }

  res.json({ success: true, submissionId: submission.id, syncedAt: submission.syncedAt, machines: getMachines() });
});

// Download raw CSV file
app.get('/api/reports/prestarts.csv', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const r = await fetch(`${targetUrl}/api/reports/prestarts.csv`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const csvData = await r.text();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="machinery_prestarts_master.csv"');
        return res.send(csvData);
      }
    } catch (e) {
      // Fallback
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="machinery_prestarts_master.csv"');
  const csvData = fs.readFileSync(PRESTARTS_CSV_PATH, 'utf-8');
  res.send(csvData);
});

// View CSV content as JSON for the server tower dashboard
app.get('/api/prestarts/csv-data', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const r = await fetch(`${targetUrl}/api/prestarts/csv-data`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Fallback to local file below
    }
  }

  let content = '';
  if (fs.existsSync(PRESTARTS_CSV_PATH)) {
    try {
      content = fs.readFileSync(PRESTARTS_CSV_PATH, 'utf-8');
    } catch (e) {
      console.error('Error reading PRESTARTS_CSV_PATH:', e);
    }
  }

  if (!content || !content.trim()) {
    return res.json({ headers: [], rows: [], rawContent: '' });
  }

  const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (rawLines.length === 0) {
    return res.json({ headers: [], rows: [], rawContent: content });
  }

  const headers = parseCsvLine(rawLines[0]);
  const rows = rawLines.slice(1).map(l => parseCsvLine(l));
  res.json({ headers, rows, rawContent: content });
});

// Submit job docket
app.post('/api/dockets', async (req, res) => {
  const targetIp = (req.query.ip as string || req.body.ip || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const r = await fetch(`${targetUrl}/api/dockets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Fallback
    }
  }

  const docket = req.body;
  if (!docket.id) docket.id = 'doc_' + Date.now();
  docket.synced = true;
  docket.syncedAt = new Date().toISOString();

  const dockets = getDockets();
  const existingIdx = dockets.findIndex((d: any) => d.id === docket.id);
  if (existingIdx >= 0) {
    dockets[existingIdx] = docket;
  } else {
    dockets.push(docket);
  }
  saveDockets(dockets);

  res.json({ success: true, docketId: docket.id, syncedAt: docket.syncedAt });
});

app.get('/api/dockets', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const r = await fetch(`${targetUrl}/api/dockets`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Fallback
    }
  }

  res.json(getDockets());
});

app.get('/api/dockets/template', (req, res) => {
  res.json(getDocketTemplate());
});

app.post('/api/dockets/template', (req, res) => {
  const current = getDocketTemplate();
  const updated = { ...current, ...req.body };
  saveDocketTemplate(updated);
  res.json(updated);
});

app.get('/api/prestart-templates', (req, res) => {
  res.json(getPrestartTemplates());
});

app.post('/api/prestart-templates', (req, res) => {
  const store = req.body;
  if (store && store.types && store.questions) {
    savePrestartTemplates(store);
    return res.json({ success: true, store });
  }
  res.status(400).json({ error: 'Invalid template payload' });
});

app.get('/api/defects', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const r = await fetch(`${targetUrl}/api/defects`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Silent fallback
    }
  }
  res.json(getDefects());
});

app.post('/api/defects', async (req, res) => {
  const targetIp = (req.query.ip as string || req.body?.ip || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const r = await fetch(`${targetUrl}/api/defects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Silent fallback
    }
  }

  const incoming = Array.isArray(req.body) ? req.body : [req.body];
  const existing = getDefects();
  const map = new Map<string, any>();
  existing.forEach(d => { if (d && d.id) map.set(d.id, d); });

  incoming.forEach(d => {
    if (d && d.id) {
      map.set(d.id, { ...map.get(d.id), ...d });
    }
  });

  const updated = Array.from(map.values());
  saveDefects(updated);
  res.json({ success: true, defects: updated });
});

app.get('/api/services', async (req, res) => {
  const targetIp = (req.query.ip as string || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const r = await fetch(`${targetUrl}/api/services`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Silent fallback
    }
  }
  res.json(getServices());
});

app.post('/api/services', async (req, res) => {
  const targetIp = (req.query.ip as string || req.body?.ip || '').trim();
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const r = await fetch(`${targetUrl}/api/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        return res.json(data);
      }
    } catch (e) {
      // Silent fallback
    }
  }

  const incoming = Array.isArray(req.body) ? req.body : [req.body];
  const existing = getServices();
  const map = new Map<string, any>();
  existing.forEach(s => { if (s && s.id) map.set(s.id, s); });

  incoming.forEach(s => {
    if (s && s.id) {
      map.set(s.id, { ...map.get(s.id), ...s });
    }
  });

  const updated = Array.from(map.values()).sort(
    (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
  );
  saveServices(updated);
  res.json({ success: true, services: updated });
});

// Batch sync endpoint for offline queue
app.post('/api/sync', async (req, res) => {
  const targetIp = (req.query.ip as string || req.body.ip || '').trim();

  // If remote target specified, attempt proxying sync directly to remote PM2 server
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const remoteRes = await fetch(`${targetUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (remoteRes.ok) {
        const remoteData = await remoteRes.json();
        return res.json(remoteData);
      }
    } catch (e: any) {
      console.warn(`Remote proxy sync to ${targetIp} unreachable. Falling back to local server processing.`);
    }
  }

  const { prestarts = [], dockets = [], defects = [], services = [] } = req.body;

  let prestartsProcessed = 0;
  let docketsProcessed = 0;
  let servicesProcessed = 0;

  // Sync Services
  const existingServices = getServices();
  const serviceMap = new Map<string, any>();
  existingServices.forEach((s: any) => { if (s && s.id) serviceMap.set(s.id, s); });

  for (const s of services) {
    if (s && s.id) {
      serviceMap.set(s.id, { ...serviceMap.get(s.id), ...s, synced: true, syncedAt: new Date().toISOString() });
      servicesProcessed++;
    }
  }
  const updatedServices = Array.from(serviceMap.values()).sort(
    (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
  );
  saveServices(updatedServices);

  // Sync Defects
  const existingDefects = getDefects();
  const defectMap = new Map<string, any>();
  existingDefects.forEach((d: any) => { if (d && d.id) defectMap.set(d.id, d); });

  for (const defect of defects) {
    if (defect && defect.id) {
      defectMap.set(defect.id, { ...defectMap.get(defect.id), ...defect });
    }
  }

  const existingPrestarts = getPrestarts();
  const prestartMap = new Map<string, any>();
  existingPrestarts.forEach((p: any) => { if (p && p.id) prestartMap.set(p.id, p); });

  for (const prestart of prestarts) {
    if (!prestartMap.has(prestart.id)) {
      appendPrestartToCSV(prestart);
    }
    prestartMap.set(prestart.id, prestart);
    
    // Auto extract defects from prestart checks if any failed/noted
    if (prestart.checks && typeof prestart.checks === 'object') {
      Object.entries(prestart.checks).forEach(([checkItemId, checkResult]: [string, any]) => {
        if (checkResult && (checkResult.status === 'FAIL' || (checkResult.notes && checkResult.notes.trim().length > 0))) {
          const defectId = `DEF-${prestart.id.replace(/[^a-zA-Z0-9]/g, '')}-${checkItemId}`;
          if (!defectMap.has(defectId)) {
            defectMap.set(defectId, {
              id: defectId,
              submissionId: prestart.id,
              machineId: prestart.machineId,
              unitCode: prestart.machineCode,
              machineName: prestart.machineName,
              checkItemId,
              checkItemLabel: checkItemId,
              category: 'Prestart Check',
              reportedByWorkerId: prestart.workerId,
              reportedByWorkerName: prestart.workerName,
              reportedAt: prestart.timestamp || new Date().toISOString(),
              status: 'OPEN',
              notes: checkResult.notes || 'Reported during prestart inspection',
            });
          }
        }
      });
    }

    // Update machine state
    const machines = getMachines();
    const machine = machines.find((m: any) => m.id === prestart.machineId || m.unitCode === prestart.machineCode);
    if (machine) {
      const pHours = parseFloat(prestart.engineHours);
      if (!isNaN(pHours) && pHours > 0) {
        if (pHours > (machine.currentHours || 0) || !machine.currentHours) {
          machine.currentHours = pHours;
        }
      }
      machine.lastPrestartDate = prestart.date || new Date().toISOString();
      if (prestart.overallStatus === 'UNSAFE_OUT_OF_SERVICE') {
        machine.status = 'Out of Service';
      } else if (prestart.overallStatus === 'DEFECT_REPORTED') {
        machine.status = 'Requires Service';
      } else if (machine.status !== 'Out of Service') {
        machine.status = 'Operational';
      }
      saveMachines(machines);
    }
    prestartsProcessed++;
  }

  savePrestarts(Array.from(prestartMap.values()));

  const updatedDefects = Array.from(defectMap.values());
  saveDefects(updatedDefects);

  const existingDockets = getDockets();
  for (const docket of dockets) {
    docket.synced = true;
    docket.syncedAt = new Date().toISOString();
    const idx = existingDockets.findIndex((d: any) => d.id === docket.id);
    if (idx >= 0) {
      existingDockets[idx] = docket;
    } else {
      existingDockets.push(docket);
    }
    docketsProcessed++;
  }
  saveDockets(existingDockets);

  res.json({
    success: true,
    syncedAt: new Date().toISOString(),
    prestartsSyncedCount: prestartsProcessed,
    docketsSyncedCount: docketsProcessed,
    servicesSyncedCount: servicesProcessed,
    machines: getMachines(),
    defects: updatedDefects,
    services: updatedServices,
    serverMessage: 'Tailscale Server Tower synchronized successfully.'
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server tower running on http://0.0.0.0:${PORT} (Tailscale Node 100.112.45.19)`);
  });
}

startServer();
