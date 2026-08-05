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
const WORKERS_JSON_PATH = path.join(STORAGE_DIR, 'workers.json');
const MACHINES_JSON_PATH = path.join(STORAGE_DIR, 'machines.json');
const DOCKETS_JSON_PATH = path.join(STORAGE_DIR, 'dockets.json');
const DEFECTS_JSON_PATH = path.join(STORAGE_DIR, 'defects.json');
const TEMPLATE_JSON_PATH = path.join(STORAGE_DIR, 'docket_template.json');

function getDefects(): any[] {
  if (fs.existsSync(DEFECTS_JSON_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(DEFECTS_JSON_PATH, 'utf-8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveDefects(defects: any[]) {
  fs.writeFileSync(DEFECTS_JSON_PATH, JSON.stringify(defects, null, 2));
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
            const parts = line.split(',');
            if (parts.length >= 6) {
              machines.push({
                id: parts[0]?.trim(),
                unitCode: parts[1]?.trim(),
                name: parts[2]?.trim(),
                regoOrSerial: parts[3]?.trim(),
                prestartType: parseInt(parts[4]?.trim(), 10) || 1,
                currentHours: parseFloat(parts[5]?.trim()) || 0,
                status: parts[6] ? parts[6].trim() : 'Operational'
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
  const fromCsv = getMachinesFromCSV();
  if (fromCsv) return fromCsv;

  try {
    return JSON.parse(fs.readFileSync(MACHINES_JSON_PATH, 'utf-8'));
  } catch (e) {
    return INITIAL_MACHINES;
  }
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
  const prestartsCount = Math.max(0, csvLines.length - 1);
  const dockets = getDockets();

  res.json({
    tailscaleIp: '100.112.45.19',
    serverConnected: true,
    tailscaleStatus: 'Connected',
    serverName: 'APEX-TOWER-01 (Tailscale Mesh Node)',
    serverPrestartsCount: prestartsCount,
    serverDocketsCount: dockets.length,
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

app.post('/api/master/workers', (req, res) => {
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

app.post('/api/master/machines', (req, res) => {
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

// Submit a single prestart
app.post('/api/prestarts', (req, res) => {
  const submission = req.body;
  if (!submission.id) submission.id = 'pre_' + Date.now();
  submission.synced = true;
  submission.syncedAt = new Date().toISOString();

  appendPrestartToCSV(submission);

  // Update Machine hours & last prestart
  const machines = getMachines();
  const machine = machines.find((m: any) => m.id === submission.machineId || m.unitCode === submission.machineCode);
  if (machine) {
    if (submission.engineHours && submission.engineHours > machine.currentHours) {
      machine.currentHours = submission.engineHours;
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

  res.json({ success: true, submissionId: submission.id, syncedAt: submission.syncedAt });
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
  let content = '';

  if (fs.existsSync(PRESTARTS_CSV_PATH)) {
    try {
      content = fs.readFileSync(PRESTARTS_CSV_PATH, 'utf-8');
    } catch (e) {
      console.error('Error reading PRESTARTS_CSV_PATH:', e);
    }
  }

  const targetIp = (req.query.ip as string || '').trim();
  if (!content && targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const r = await fetch(`${targetUrl}/api/reports/prestarts.csv`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        content = await r.text();
      }
    } catch (e) {
      // Fallback
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

app.get('/api/defects', (req, res) => {
  res.json(getDefects());
});

app.post('/api/defects', (req, res) => {
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

// Batch sync endpoint for offline queue
app.post('/api/sync', async (req, res) => {
  const targetIp = (req.query.ip as string || req.body.ip || '').trim();

  // If remote target specified, attempt proxying sync directly to remote PM2 server
  if (targetIp && targetIp !== '3000' && targetIp !== 'local') {
    const targetUrl = formatTargetUrl(targetIp);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
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
      return res.status(503).json({
        success: false,
        message: `Unable to reach Tailscale server node at ${targetIp} (${e.message || 'Connection timed out'})`
      });
    }
  }

  const { prestarts = [], dockets = [], defects = [] } = req.body;

  let prestartsProcessed = 0;
  let docketsProcessed = 0;

  // Sync Defects
  const existingDefects = getDefects();
  const defectMap = new Map<string, any>();
  existingDefects.forEach((d: any) => { if (d && d.id) defectMap.set(d.id, d); });

  for (const defect of defects) {
    if (defect && defect.id) {
      defectMap.set(defect.id, { ...defectMap.get(defect.id), ...defect });
    }
  }

  for (const prestart of prestarts) {
    appendPrestartToCSV(prestart);
    
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
      if (prestart.engineHours && prestart.engineHours > machine.currentHours) {
        machine.currentHours = prestart.engineHours;
      }
      machine.lastPrestartDate = prestart.date;
      saveMachines(machines);
    }
    prestartsProcessed++;
  }

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
    defects: updatedDefects,
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
