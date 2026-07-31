# MachineLink Standalone Testing Server Node (Port 3004)

This folder (`machinelink`) contains the standalone Node.js server and CSV master files to run with PM2 on port `3004`.

## Included Files
- **`server.js`**: Express backend handling sequential dockets (`/api/dockets/next-number`), prestart CSV logs (`prestarts.csv`), machine master updates (`machines.csv`), and worker user management (`workers.csv`).
- **`machines.csv`**: Master list of plant equipment with prestart form types (Type 1 Wheeled, Type 2 Tracked, Type 3 Light Vehicle / Aux) and current engine hour meters.
- **`workers.csv`**: Test site operators, fitters, and supervisors with PIN access codes.
- **`package.json`**: NPM dependencies (`express`, `cors`).

---

## Quick Setup & PM2 Execution Guide

### 1. Navigate to the `machinelink` folder
```bash
cd machinelink
```

### 2. Install dependencies
```bash
npm install
```

### 3. Launch with PM2 on Port 3004
```bash
PORT=3004 pm2 start server.js --name "machinelink-server"
```

Or using npm script:
```bash
npm run pm2
```

### 4. Verify PM2 Status
```bash
pm2 status
pm2 logs machinelink-server
```

---

## API Endpoints Handled
- `GET  /api/dockets/next-number`: Generates unique sequential docket numbers starting from `8183`.
- `GET  /api/server-info`: Returns server status, CSV prestart records, and saved dockets.
- `GET  /api/master/machines`: Reads `machines.csv`.
- `POST /api/master/machines`: Appends new machinery to `machines.csv`.
- `GET  /api/master/workers`: Reads `workers.csv`.
- `POST /api/master/workers`: Appends new team members to `workers.csv`.
- `POST /api/prestart`: Logs prestart inspections into `prestarts.csv`.
- `POST /api/dockets`: Saves filled dockets (with signatures, drawing pads, line items) into `dockets.json`.
- `GET  /api/reports/prestarts.csv`: Direct download of master prestarts CSV file.
