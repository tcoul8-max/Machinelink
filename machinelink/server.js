const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Paths to CSV and JSON storage files
const STORAGE_DIR = __dirname;
const PRESTARTS_CSV_PATH = path.join(__dirname, 'prestarts.csv');
const DOCKETS_JSON_PATH = path.join(__dirname, 'dockets.json');
const MACHINES_CSV_PATH = path.join(__dirname, 'machines.csv');
const WORKERS_CSV_PATH = path.join(__dirname, 'workers.csv');
const SERVICES_JSON_PATH = path.join(__dirname, 'services.json');

const DEFAULT_MACHINES = [
  {
    id: 'm1',
    unitCode: 'DEMO1',
    name: 'Excavator',
    regoOrSerial: '5739593667',
    prestartType: 2,
    currentHours: 1420.5,
    status: 'Operational',
    usageUnit: 'Hours',
    nextServiceDue: 1500,
    serviceInterval: 250,
    lastServiceDate: '2026-07-15',
    lastServiceHours: 1250.0,
  },
  {
    id: 'm2',
    unitCode: 'DEMO2',
    name: 'Wheel Loader',
    regoOrSerial: '14579076429',
    prestartType: 1,
    currentHours: 3890.0,
    status: 'Operational',
    usageUnit: 'Hours',
    nextServiceDue: 4000,
    serviceInterval: 250,
    lastServiceDate: '2026-06-20',
    lastServiceHours: 3750.0,
  },
  {
    id: 'm3',
    unitCode: 'DEMO3',
    name: 'Dozer',
    regoOrSerial: '67349294756',
    prestartType: 2,
    currentHours: 2150.2,
    status: 'Operational',
    usageUnit: 'Hours',
    nextServiceDue: 2250,
    serviceInterval: 250,
    lastServiceDate: '2026-07-02',
    lastServiceHours: 2000.0,
  },
  {
    id: 'm4',
    unitCode: 'DEMO4',
    name: 'Backhoe Loader',
    regoOrSerial: '124567890786',
    prestartType: 1,
    currentHours: 890.4,
    status: 'Requires Service',
    usageUnit: 'Hours',
    nextServiceDue: 1000,
    serviceInterval: 250,
    lastServiceDate: '2026-05-10',
    lastServiceHours: 600.0,
  },
  {
    id: 'm5',
    unitCode: 'DEMO5',
    name: 'Toyota Hilux',
    regoOrSerial: 'aaa111 (QLD)',
    prestartType: 3,
    currentHours: 124500,
    status: 'Operational',
    usageUnit: 'KM',
    nextServiceDue: 130000,
    serviceInterval: 10000,
    lastServiceDate: '2026-06-11',
    lastServiceHours: 120000,
  }
];

// Initialize files if missing
if (!fs.existsSync(PRESTARTS_CSV_PATH)) {
  const header = 'id,timestamp,date,workerName,machineCode,machineName,prestartType,engineHours,overallStatus,generalNotes,hasDefects\n';
  fs.writeFileSync(PRESTARTS_CSV_PATH, header, 'utf-8');
}

if (!fs.existsSync(DOCKETS_JSON_PATH)) {
  fs.writeFileSync(DOCKETS_JSON_PATH, JSON.stringify([]), 'utf-8');
}

function parseCSVLine(line) {
  const result = [];
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

function deduplicateMachinesList(list) {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  for (const m of list) {
    if (!m) continue;
    const key = (m.unitCode || m.id || '').trim().toUpperCase();
    if (!key) continue;
    if (map.has(key)) {
      const existing = map.get(key);
      const validNextDue = (m.nextServiceDue !== undefined && m.nextServiceDue !== null && !isNaN(m.nextServiceDue))
        ? m.nextServiceDue
        : (existing.nextServiceDue !== undefined && existing.nextServiceDue !== null && !isNaN(existing.nextServiceDue) ? existing.nextServiceDue : undefined);

      const validInterval = (m.serviceInterval !== undefined && m.serviceInterval !== null && !isNaN(m.serviceInterval))
        ? m.serviceInterval
        : (existing.serviceInterval !== undefined && existing.serviceInterval !== null && !isNaN(existing.serviceInterval) ? existing.serviceInterval : undefined);

      const validLastHours = (m.lastServiceHours !== undefined && m.lastServiceHours !== null && !isNaN(m.lastServiceHours))
        ? m.lastServiceHours
        : (existing.lastServiceHours !== undefined && existing.lastServiceHours !== null && !isNaN(existing.lastServiceHours) ? existing.lastServiceHours : undefined);

      map.set(key, {
        ...existing,
        ...m,
        id: existing.id || m.id,
        unitCode: existing.unitCode || m.unitCode,
        name: m.name || existing.name,
        regoOrSerial: m.regoOrSerial || m.rego || existing.regoOrSerial || existing.rego || '',
        prestartType: m.prestartType || existing.prestartType || 1,
        currentHours: m.currentHours !== undefined ? Math.max(existing.currentHours || 0, m.currentHours || 0) : (existing.currentHours || 0),
        status: m.status || existing.status || 'Operational',
        usageUnit: m.usageUnit || existing.usageUnit || 'Hours',
        nextServiceDue: validNextDue,
        serviceInterval: validInterval,
        lastServiceDate: m.lastServiceDate || existing.lastServiceDate,
        lastServiceHours: validLastHours,
        serviceNotes: m.serviceNotes || existing.serviceNotes,
      });
    } else {
      map.set(key, { ...m });
    }
  }
  return Array.from(map.values());
}

// Helper to parse machines CSV
function getMachines() {
  if (!fs.existsSync(MACHINES_CSV_PATH)) return [];
  const content = fs.readFileSync(MACHINES_CSV_PATH, 'utf-8');
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length <= 1) return [];

  const machines = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = parseCSVLine(line).map(s => s.replace(/^"|"$/g, '').trim());
    if (parts.length >= 5) {
      const currentH = parseFloat(parts[5]) || 0;
      const nextDueVal = parts[8] !== undefined && parts[8] !== '' ? parseFloat(parts[8]) : undefined;
      const intervalVal = parts[9] !== undefined && parts[9] !== '' ? parseFloat(parts[9]) : undefined;
      const lastHVal = parts[11] !== undefined && parts[11] !== '' ? parseFloat(parts[11]) : undefined;

      machines.push({
        id: parts[0] || `m_${i}`,
        unitCode: parts[1] || `UNIT-${i}`,
        name: parts[2] || 'Machine',
        rego: parts[3] || '',
        regoOrSerial: parts[3] || '',
        prestartType: parseInt(parts[4], 10) || 1,
        currentHours: currentH,
        status: parts[6] || 'Operational',
        usageUnit: parts[7] === 'KM' ? 'KM' : 'Hours',
        nextServiceDue: !isNaN(nextDueVal) ? nextDueVal : undefined,
        serviceInterval: !isNaN(intervalVal) ? intervalVal : undefined,
        lastServiceDate: parts[10] || undefined,
        lastServiceHours: !isNaN(lastHVal) ? lastHVal : undefined,
      });
    }
  }
  return deduplicateMachinesList(machines);
}

// Helper to save machines back to CSV
function saveMachines(machines) {
  const deduped = deduplicateMachinesList(machines);
  let csv = 'id,unitCode,name,regoOrSerial,prestartType,currentHours,status,usageUnit,nextServiceDue,serviceInterval,lastServiceDate,lastServiceHours\n';
  deduped.forEach(m => {
    csv += `"${m.id || ''}","${m.unitCode || ''}","${(m.name || '').replace(/"/g, '""')}","${m.regoOrSerial || m.rego || ''}",${m.prestartType || 1},${m.currentHours !== undefined ? m.currentHours : 0},"${m.status || 'Operational'}","${m.usageUnit || 'Hours'}",${m.nextServiceDue !== undefined && !isNaN(m.nextServiceDue) ? m.nextServiceDue : ''},${m.serviceInterval || 250},"${m.lastServiceDate || ''}",${m.lastServiceHours !== undefined && !isNaN(m.lastServiceHours) ? m.lastServiceHours : ''}\n`;
  });
  fs.writeFileSync(MACHINES_CSV_PATH, csv, 'utf-8');
}

// Helper to parse workers CSV
function getWorkers() {
  if (!fs.existsSync(WORKERS_CSV_PATH)) return [];
  const content = fs.readFileSync(WORKERS_CSV_PATH, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length <= 1) return [];

  const workers = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 5) {
      workers.push({
        id: parts[0].trim(),
        name: parts[1].trim(),
        role: parts[2].trim(),
        pin: parts[3].trim(),
        active: parts[4].trim() === 'true'
      });
    }
  }
  return workers;
}

// Helper to save workers CSV
function saveWorkers(workers) {
  let csv = 'id,name,role,pin,active\n';
  workers.forEach(w => {
    csv += `${w.id},${w.name},${w.role},${w.pin},${w.active}\n`;
  });
  fs.writeFileSync(WORKERS_CSV_PATH, csv, 'utf-8');
}

// Helper to get dockets
function getDockets() {
  try {
    const data = fs.readFileSync(DOCKETS_JSON_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Helper to generate next sequential docket number starting at 8183
function getNextDocketNumber(customDocketsList = null) {
  const dockets = customDocketsList || getDockets();
  let maxNum = 8182;
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
  return String(maxNum + 1);
}

// API ENDPOINTS

// 1. Get next sequential docket number
app.get('/api/dockets/next-number', (req, res) => {
  const nextNum = getNextDocketNumber();
  res.json({ nextDocketNumber: nextNum });
});

// 2. Server info and logs
app.get('/api/server-info', (req, res) => {
  const csvContent = fs.readFileSync(PRESTARTS_CSV_PATH, 'utf-8');
  const dockets = getDockets();
  res.json({
    node: 'MachineLink Server Node (Port ' + PORT + ')',
    status: 'ONLINE',
    port: PORT,
    prestartCsvContent: csvContent,
    dockets: dockets
  });
});

// 3. Sync Prestart Inspections
app.post(['/api/prestart', '/api/prestarts'], (req, res) => {
  const p = req.body;
  const hasDefects = p.overallStatus !== 'SAFE_TO_OPERATE';
  const cleanNotes = (p.generalNotes || '').replace(/[\r\n,]/g, ' ');

  const row = `${p.id},${new Date(p.timestamp || Date.now()).toISOString()},${p.date},${p.workerName},${p.machineCode},${p.machineName},${p.prestartType},${p.engineHours},${p.overallStatus},"${cleanNotes}",${hasDefects}\n`;
  fs.appendFileSync(PRESTARTS_CSV_PATH, row, 'utf-8');

  // Update current machine engine hours if higher
  const machines = getMachines();
  const targetHours = parseFloat(p.engineHours);
  const targetMac = machines.find(m => m.unitCode === p.machineCode || m.id === p.machineId);
  if (targetMac && !isNaN(targetHours) && targetHours > 0) {
    if (targetHours > (targetMac.currentHours || 0) || !targetMac.currentHours) {
      targetMac.currentHours = targetHours;
    }
    targetMac.lastPrestartDate = p.date;
    if (p.overallStatus === 'UNSAFE_OUT_OF_SERVICE') {
      targetMac.status = 'Out of Service';
    } else if (p.overallStatus === 'DEFECT_REPORTED' || p.overallStatus === 'SAFE_WITH_DEFECTS') {
      targetMac.status = 'Requires Service';
    } else if (targetMac.status !== 'Out of Service') {
      targetMac.status = 'Operational';
    }
    saveMachines(machines);
  }

  res.json({ success: true, id: p.id, syncedAt: new Date().toISOString(), machines: getMachines() });
});

// 3b. Batch Sync Endpoint
app.post('/api/sync', (req, res) => {
  const { prestarts = [], dockets = [] } = req.body;
  let pSynced = 0;
  let dSynced = 0;

  const machines = getMachines();
  let machinesUpdated = false;

  for (const p of prestarts) {
    const hasDefects = p.overallStatus !== 'SAFE_TO_OPERATE';
    const cleanNotes = (p.generalNotes || '').replace(/[\r\n,]/g, ' ');
    const row = `${p.id},${new Date(p.timestamp || Date.now()).toISOString()},${p.date},${p.workerName},${p.machineCode},${p.machineName},${p.prestartType},${p.engineHours},${p.overallStatus},"${cleanNotes}",${hasDefects}\n`;
    fs.appendFileSync(PRESTARTS_CSV_PATH, row, 'utf-8');
    pSynced++;

    // Update machine current hours & status from prestart
    const targetHours = parseFloat(p.engineHours);
    const targetMac = machines.find(m => m.unitCode === p.machineCode || m.id === p.machineId);
    if (targetMac && !isNaN(targetHours) && targetHours > 0) {
      if (targetHours > (targetMac.currentHours || 0) || !targetMac.currentHours) {
        targetMac.currentHours = targetHours;
        machinesUpdated = true;
      }
      targetMac.lastPrestartDate = p.date;
      if (p.overallStatus === 'UNSAFE_OUT_OF_SERVICE') {
        targetMac.status = 'Out of Service';
        machinesUpdated = true;
      } else if (p.overallStatus === 'DEFECT_REPORTED' || p.overallStatus === 'SAFE_WITH_DEFECTS') {
        targetMac.status = 'Requires Service';
        machinesUpdated = true;
      }
    }
  }

  if (machinesUpdated) {
    saveMachines(machines);
  }

  const existingDockets = getDockets();
  for (const d of dockets) {
    if (!d.docketNumber || d.docketNumber === '8183') {
      d.docketNumber = getNextDocketNumber();
    }
    const idx = existingDockets.findIndex(x => x.id === d.id);
    if (idx >= 0) {
      existingDockets[idx] = { ...d, synced: true, serverReceivedAt: new Date().toISOString() };
    } else {
      existingDockets.unshift({ ...d, synced: true, serverReceivedAt: new Date().toISOString() });
    }
    dSynced++;
  }
  fs.writeFileSync(DOCKETS_JSON_PATH, JSON.stringify(existingDockets, null, 2), 'utf-8');

  res.json({
    success: true,
    syncedAt: new Date().toISOString(),
    prestartsSyncedCount: pSynced,
    docketsSyncedCount: dSynced,
    machines: getMachines(),
    serverMessage: 'MachineLink PM2 Server synchronized successfully.'
  });
});

// 4. Sync Job Dockets
app.post('/api/dockets', (req, res) => {
  const d = req.body;
  const dockets = getDockets();
  
  if (!d.docketNumber || d.docketNumber === '8183') {
    d.docketNumber = getNextDocketNumber();
  }

  dockets.unshift({ ...d, synced: true, serverReceivedAt: new Date().toISOString() });
  fs.writeFileSync(DOCKETS_JSON_PATH, JSON.stringify(dockets, null, 2), 'utf-8');

  res.json({ success: true, docketNumber: d.docketNumber, id: d.id });
});

// 5. Get Dockets List
app.get('/api/dockets', (req, res) => {
  res.json(getDockets());
});

// 6. Master Data - Machines
app.get('/api/master/machines', (req, res) => {
  res.json(getMachines());
});

app.post('/api/master/machines', (req, res) => {
  let machines = getMachines();
  const payload = req.body;
  const itemsToUpsert = Array.isArray(payload) ? payload : (payload.machines && Array.isArray(payload.machines) ? payload.machines : [payload]);

  for (const newMachine of itemsToUpsert) {
    if (!newMachine) continue;
    const existingIdx = machines.findIndex(m => 
      (m.id && newMachine.id && m.id === newMachine.id) ||
      (m.unitCode && newMachine.unitCode && m.unitCode.trim().toUpperCase() === newMachine.unitCode.trim().toUpperCase())
    );
    if (existingIdx >= 0) {
      machines[existingIdx] = { ...machines[existingIdx], ...newMachine };
    } else {
      machines.push(newMachine);
    }
  }

  machines = deduplicateMachinesList(machines);
  saveMachines(machines);
  res.json({ success: true, machines: getMachines() });
});

// 7. Master Data - Workers
app.get('/api/master/workers', (req, res) => {
  res.json(getWorkers());
});

app.post('/api/master/workers', (req, res) => {
  const workers = getWorkers();
  const newWorker = req.body;
  workers.push(newWorker);
  saveWorkers(workers);
  res.json({ success: true, workers });
});

// 7b. Maintenance Services
app.get('/api/services', (req, res) => {
  if (fs.existsSync(SERVICES_JSON_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(SERVICES_JSON_PATH, 'utf-8'));
      if (Array.isArray(data)) return res.json(data);
    } catch (e) {}
  }
  res.json([]);
});

app.post('/api/services', (req, res) => {
  const payload = req.body;
  const newServices = Array.isArray(payload) ? payload : [payload];
  let existingServices = [];
  if (fs.existsSync(SERVICES_JSON_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(SERVICES_JSON_PATH, 'utf-8'));
      if (Array.isArray(data)) existingServices = data;
    } catch (e) {}
  }

  const map = new Map();
  existingServices.forEach(s => { if (s && s.id) map.set(s.id, s); });
  newServices.forEach(s => {
    if (s && s.id) {
      map.set(s.id, { ...s, synced: true, serverReceivedAt: new Date().toISOString() });
    }
  });

  const updatedList = Array.from(map.values()).sort((a, b) => new Date(b.serviceDate || 0).getTime() - new Date(a.serviceDate || 0).getTime());
  fs.writeFileSync(SERVICES_JSON_PATH, JSON.stringify(updatedList, null, 2), 'utf-8');
  res.json({ success: true, services: updatedList });
});

// 8. Download Reports
app.get('/api/reports/prestarts.csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="prestarts_master.csv"');
  if (fs.existsSync(PRESTARTS_CSV_PATH)) {
    res.sendFile(PRESTARTS_CSV_PATH);
  } else {
    res.send('Submission_ID,Timestamp,Date,Worker_Name,Machine_Code,Machine_Name,Prestart_Type,Engine_Hours,Overall_Status,Notes,Has_Defects\n');
  }
});

app.get('/api/reports/machines.csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="machinery_fleet_master.csv"');
  if (fs.existsSync(MACHINES_CSV_PATH)) {
    res.sendFile(MACHINES_CSV_PATH);
  } else {
    saveMachines(DEFAULT_MACHINES);
    res.sendFile(MACHINES_CSV_PATH);
  }
});

// 9. Full System Diagnostics
app.get('/api/admin/diagnostics', (req, res) => {
  const machines = getMachines();
  const dockets = getDockets();
  
  let prestartsCount = 0;
  if (fs.existsSync(PRESTARTS_CSV_PATH)) {
    try {
      const content = fs.readFileSync(PRESTARTS_CSV_PATH, 'utf-8');
      prestartsCount = Math.max(0, content.split('\n').filter(l => l.trim()).length - 1);
    } catch (e) {}
  }

  const machineCodes = machines.map(m => (m.unitCode || m.id || '').toUpperCase());
  const uniqueMachineCodes = new Set(machineCodes);
  const duplicateMachinesCount = machineCodes.length - uniqueMachineCodes.size;

  res.json({
    timestamp: new Date().toISOString(),
    status: duplicateMachinesCount === 0 ? 'HEALTHY' : 'REPAIR_RECOMMENDED',
    machines: {
      totalCount: machines.length,
      uniqueCount: uniqueMachineCodes.size,
      duplicateCount: duplicateMachinesCount,
      csvPath: MACHINES_CSV_PATH,
      exists: fs.existsSync(MACHINES_CSV_PATH)
    },
    prestarts: {
      totalCount: prestartsCount,
      csvPath: PRESTARTS_CSV_PATH,
      exists: fs.existsSync(PRESTARTS_CSV_PATH)
    },
    dockets: {
      totalCount: dockets.length,
      jsonPath: DOCKETS_JSON_PATH,
      exists: fs.existsSync(DOCKETS_JSON_PATH)
    }
  });
});

// 10. Admin Repair: Machines
app.post('/api/admin/repair/machines', (req, res) => {
  const { resetToFactory = false } = req.body || {};

  // Backup current CSV before modifying
  try {
    if (fs.existsSync(MACHINES_CSV_PATH)) {
      const bkpPath = path.join(STORAGE_DIR, `machines_backup_${Date.now()}.csv`);
      fs.copyFileSync(MACHINES_CSV_PATH, bkpPath);
    }
  } catch (e) {}

  let finalMachines;
  if (resetToFactory) {
    finalMachines = [...DEFAULT_MACHINES];
  } else {
    const existing = getMachines();
    finalMachines = deduplicateMachinesList([...DEFAULT_MACHINES, ...existing]);
  }

  saveMachines(finalMachines);

  res.json({
    success: true,
    message: resetToFactory
      ? 'Fleet successfully reset to clean factory defaults on PM2 server.'
      : 'Fleet successfully verified and deduplicated on PM2 server.',
    resetToFactory,
    machines: getMachines()
  });
});

// 11. Admin Repair: Full
app.post('/api/admin/repair/full', (req, res) => {
  const existingMachines = getMachines();
  const cleanMachines = deduplicateMachinesList([...DEFAULT_MACHINES, ...existingMachines]);
  saveMachines(cleanMachines);

  res.json({
    success: true,
    message: 'All files repaired and deduplicated successfully on PM2 server.',
    machinesCount: cleanMachines.length
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(`MachineLink Server Node active on http://0.0.0.0:${PORT}`);
  console.log(`PM2 Process Target Port: ${PORT}`);
  console.log(`Prestart CSV File: ${PRESTARTS_CSV_PATH}`);
  console.log(`Machines CSV File: ${MACHINES_CSV_PATH}`);
  console.log(`Workers CSV File: ${WORKERS_CSV_PATH}`);
  console.log(`Dockets File: ${DOCKETS_JSON_PATH}`);
  console.log(`===================================================`);
});
