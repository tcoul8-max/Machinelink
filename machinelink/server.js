const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Paths to CSV and JSON storage files
const PRESTARTS_CSV_PATH = path.join(__dirname, 'prestarts.csv');
const DOCKETS_JSON_PATH = path.join(__dirname, 'dockets.json');
const MACHINES_CSV_PATH = path.join(__dirname, 'machines.csv');
const WORKERS_CSV_PATH = path.join(__dirname, 'workers.csv');

// Initialize files if missing
if (!fs.existsSync(PRESTARTS_CSV_PATH)) {
  const header = 'id,timestamp,date,workerName,machineCode,machineName,prestartType,engineHours,overallStatus,generalNotes,hasDefects\n';
  fs.writeFileSync(PRESTARTS_CSV_PATH, header, 'utf-8');
}

if (!fs.existsSync(DOCKETS_JSON_PATH)) {
  fs.writeFileSync(DOCKETS_JSON_PATH, JSON.stringify([]), 'utf-8');
}

// Helper to parse machines CSV
function getMachines() {
  if (!fs.existsSync(MACHINES_CSV_PATH)) return [];
  const content = fs.readFileSync(MACHINES_CSV_PATH, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length <= 1) return [];

  const machines = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 7) {
      machines.push({
        id: parts[0].trim(),
        unitCode: parts[1].trim(),
        name: parts[2].trim(),
        rego: parts[3].trim(),
        prestartType: parseInt(parts[4].trim(), 10) || 1,
        currentHours: parseFloat(parts[5].trim()) || 0,
        status: parts[6].trim()
      });
    }
  }
  return machines;
}

// Helper to save machines back to CSV
function saveMachines(machines) {
  let csv = 'id,unitCode,name,rego,prestartType,currentHours,status\n';
  machines.forEach(m => {
    csv += `${m.id},${m.unitCode},${m.name},${m.rego || ''},${m.prestartType},${m.currentHours},${m.status}\n`;
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
  const targetMac = machines.find(m => m.unitCode === p.machineCode || m.id === p.machineId);
  if (targetMac && p.engineHours > targetMac.currentHours) {
    targetMac.currentHours = p.engineHours;
    if (p.overallStatus === 'UNSAFE_OUT_OF_SERVICE') {
      targetMac.status = 'Out of Service';
    } else if (p.overallStatus === 'SAFE_WITH_DEFECTS') {
      targetMac.status = 'Defects Noted';
    }
    saveMachines(machines);
  }

  res.json({ success: true, id: p.id, syncedAt: new Date().toISOString() });
});

// 3b. Batch Sync Endpoint
app.post('/api/sync', (req, res) => {
  const { prestarts = [], dockets = [] } = req.body;
  let pSynced = 0;
  let dSynced = 0;

  for (const p of prestarts) {
    const hasDefects = p.overallStatus !== 'SAFE_TO_OPERATE';
    const cleanNotes = (p.generalNotes || '').replace(/[\r\n,]/g, ' ');
    const row = `${p.id},${new Date(p.timestamp || Date.now()).toISOString()},${p.date},${p.workerName},${p.machineCode},${p.machineName},${p.prestartType},${p.engineHours},${p.overallStatus},"${cleanNotes}",${hasDefects}\n`;
    fs.appendFileSync(PRESTARTS_CSV_PATH, row, 'utf-8');
    pSynced++;
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
  const machines = getMachines();
  const newMachine = req.body;
  machines.push(newMachine);
  saveMachines(machines);
  res.json({ success: true, machines });
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

// 8. Download Reports
app.get('/api/reports/prestarts.csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="prestarts_master.csv"');
  res.sendFile(PRESTARTS_CSV_PATH);
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
