import { Machine, Worker, CheckItemDefinition, PrestartTypeDefinition, PrestartTemplateStore, DocketTemplateConfig } from '../types';

export const INITIAL_WORKERS: Worker[] = [
  { id: 'w1', name: 'Demo Name 1', role: 'Plant Operator', pin: '1111', phone: '0400 000 001', active: true },
  { id: 'w2', name: 'Demo Name 2', role: 'Loader Operator', pin: '2222', phone: '0400 000 002', active: true },
  { id: 'w3', name: 'Demo Name 3', role: 'Heavy Diesel Fitter & Operator', pin: '3333', phone: '0400 000 003', active: true },
  { id: 'w4', name: 'Demo Name 4', role: 'Site Supervisor', pin: '4444', phone: '0400 000 004', active: true },
];

export const INITIAL_MACHINES: Machine[] = [
  {
    id: 'm1',
    unitCode: 'DEMO1',
    name: 'Excavator',
    regoOrSerial: '5739593667',
    prestartType: 2, // Tracked Heavy
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
    prestartType: 1, // Wheeled Heavy
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
    prestartType: 2, // Tracked Heavy
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
    prestartType: 1, // Wheeled Heavy
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
    prestartType: 3, // Light Vehicles
    currentHours: 124500, // km / hours
    status: 'Operational',
    usageUnit: 'KM',
    nextServiceDue: 130000,
    serviceInterval: 10000,
    lastServiceDate: '2026-06-11',
    lastServiceHours: 120000,
  }
];

export const DEFAULT_PRESTART_TYPES: PrestartTypeDefinition[] = [
  { id: 1, name: 'Wheeled Heavy Plant', description: 'Loaders, Backhoes, Graders, Dump Trucks', badgeColor: 'amber' },
  { id: 2, name: 'Tracked Heavy Plant', description: 'Excavators, Dozers, Track Loaders', badgeColor: 'orange' },
  { id: 3, name: 'Light Vehicles & Field Utes', description: '4x4 Service Utes, Light Trucks, Vans', badgeColor: 'emerald' },
  { id: 4, name: 'Stationary Plant & Power', description: 'Generators, Compressors, Pumps, Lighting Towers', badgeColor: 'blue' },
  { id: 5, name: 'Compaction & Rollers', description: 'Smooth Drum, Padfoot, Multi-Tyre Rollers', badgeColor: 'purple' },
  { id: 6, name: 'Cranes, Lifting & EWPs', description: 'Telehandlers, Franna Cranes, Boom & Scissor Lifts', badgeColor: 'rose' },
  { id: 7, name: 'Crushing & Screening Plant', description: 'Jaw Crushers, Cone Crushers, Screens, Conveyors', badgeColor: 'cyan' },
  { id: 8, name: 'Custom Site Machinery', description: 'Custom Site Specific Machinery Checklist', badgeColor: 'slate' },
];

export const MASTER_CHECK_ITEMS: CheckItemDefinition[] = [
  // Fluid Levels
  { id: 'engine_oil', category: 'Fluid Levels', label: 'Engine Oil Level', description: 'Check dipstick level between Min and Max' },
  { id: 'hydraulic_oil', category: 'Fluid Levels', label: 'Hydraulic Oil Level', description: 'Check sight glass with boom/bucket in park position' },
  { id: 'coolant', category: 'Fluid Levels', label: 'Radiator Coolant & Hoses', description: 'Check expansion tank level and hose condition' },
  { id: 'transmission_oil', category: 'Fluid Levels', label: 'Transmission / Drive Oil', description: 'Check transmission dipstick or sight gauge' },
  { id: 'final_drive_oil', category: 'Fluid Levels', label: 'Final Drive / Swing Motor Oil', description: 'Inspect final drive seals and oil sight plug for leaks' },
  { id: 'brake_fluid', category: 'Fluid Levels', label: 'Brake & Clutch Fluid', description: 'Check reservoir level in engine compartment' },
  { id: 'fuel_level', category: 'Fluid Levels', label: 'Fuel & DEF Level / Water Trap', description: 'Check fuel level and drain fuel filter water separator trap' },
  { id: 'def_adblue', category: 'Fluid Levels', label: 'DEF / AdBlue Fluid Level', description: 'Ensure adequate exhaust fluid for shift' },

  // Ground & Mechanical
  { id: 'tires', category: 'Ground & Mechanical', label: 'Tire Condition, Pressure & Wheel Nuts', description: 'Check inflation, tread cuts, and wheel nut indicator pointers' },
  { id: 'tracks', category: 'Ground & Mechanical', label: 'Track Tension, Shoes, Rollers & Sprockets', description: 'Check track sag, loose shoe bolts, damaged rollers, sprocket wear' },
  { id: 'steering', category: 'Ground & Mechanical', label: 'Steering Linkages & Rams', description: 'Check cylinder pins, play, and grease points' },
  { id: 'brakes', category: 'Ground & Mechanical', label: 'Service & Park Brakes', description: 'Test foot brake response and park brake hold on incline' },
  { id: 'air_cleaner', category: 'Ground & Mechanical', label: 'Air Cleaner & Dust Bowl', description: 'Check dust ejector valve and filter restriction gauge' },
  { id: 'attachment_bucket', category: 'Ground & Mechanical', label: 'Bucket, Pins, Teeth & Quick Hitch', description: 'Check safety lock pin engagement, teeth wear, and grease' },
  { id: 'hydraulic_hoses', category: 'Ground & Mechanical', label: 'Hydraulic Hoses & Cylinder Seals', description: 'Check for weeping seals, chafed hoses, hose clamps' },
  { id: 'undercarriage', category: 'Ground & Mechanical', label: 'Undercarriage & Guarding', description: 'Inspect frame for cracking, rock guard integrity, mud buildup' },
  { id: 'tow_hitch', category: 'Ground & Mechanical', label: 'Tow Hitch, Safety Chains & Plug', description: 'Inspect tow ball/pintle hook, D-shackles, trailer socket' },
  { id: 'belt_guards', category: 'Ground & Mechanical', label: 'Drive Belts, Pulleys & Safety Guarding', description: 'Inspect alternator/fan belt tension and pulley safety covers' },
  { id: 'outriggers', category: 'Ground & Mechanical', label: 'Outriggers, Stabilizer Legs & Locks', description: 'Inspect extension cylinders, locking pins, and pad feet' },
  { id: 'winch_cable', category: 'Ground & Mechanical', label: 'Winch Cable, Spooling & Hook', description: 'Inspect wire rope for fraying, crushing, and drum spooling' },

  // Cab & Safety
  { id: 'lights_beacons', category: 'Cab & Safety', label: 'Lights, Indicators & Strobe Beacon', description: 'Check high/low beam, work lights, brake lights, amber beacon' },
  { id: 'seatbelt', category: 'Cab & Safety', label: 'Seatbelt & Mounting', description: 'Check belt condition, latch engagement, and inertia lock' },
  { id: 'mirrors_glass', category: 'Cab & Safety', label: 'Mirrors, Windscreen & Wipers', description: 'Clean glass, inspect for cracks, check washer fluid' },
  { id: 'fire_extinguisher', category: 'Cab & Safety', label: 'Fire Extinguisher & First Aid Kit', description: 'Check pressure gauge in green zone and tag inspection date' },
  { id: 'fops_rops', category: 'Cab & Safety', label: 'FOPS / ROPS Cabin Protection Structure', description: 'Inspect cabin structural mounts and roll-over protection frame' },
  { id: 'spill_kit', category: 'Cab & Safety', label: 'Spill Kit & Hydrocarbon Absorbent Pads', description: 'Confirm spill kit bag is present and stocked' },
  { id: 'wheel_chocks', category: 'Cab & Safety', label: 'Wheel Chocks & Safety Cones', description: 'Ensure wheel chocks are available in vehicle/plant holder' },

  // Operational Checks
  { id: 'horn_beeper', category: 'Operational Checks', label: 'Horn & Reversing / Travel Alarm', description: 'Test horn sound and reverse / movement alarm' },
  { id: 'controls_estop', category: 'Operational Checks', label: 'Controls, Levers & E-Stop Button', description: 'Check smooth lever response and emergency engine cutoff switch' },
  { id: 'gauges_warning', category: 'Operational Checks', label: 'Gauges, Display Screen & Warning Lights', description: 'Confirm no fault codes or warning symbols on dashboard' },
  { id: 'auxiliary_hydraulics', category: 'Operational Checks', label: 'Auxiliary Hydraulic Flow Controls', description: 'Test hammer / attachment circuit pedal or switch' },

  // Special & Rigging
  { id: 'lifting_shackles', category: 'Special & Rigging', label: 'Lifting Shackles, Slings & Chains Tagging', description: 'Verify current color code tag, WLL rating, pin threads' },
  { id: 'safety_hook', category: 'Special & Rigging', label: 'Crane / Hoist Hook & Safety Latch', description: 'Check hook throat opening, latch spring action, swivel bearing' },
  { id: 'boom_loadchart', category: 'Special & Rigging', label: 'Boom Angle Indicator & Load Chart', description: 'Verify load chart readability and angle indicator bubble' },
  { id: 'ground_pads', category: 'Special & Rigging', label: 'Outrigger Ground Pads & Ground Stability', description: 'Check bog mats/outrigger pads available and ground firmness' },
];

export const DEFAULT_PRESTART_ASSIGNMENTS: Record<number, string[]> = {
  // 1: Wheeled Heavy
  1: [
    'engine_oil', 'hydraulic_oil', 'coolant', 'transmission_oil', 'fuel_level', 'def_adblue',
    'tires', 'steering', 'brakes', 'air_cleaner', 'attachment_bucket', 'hydraulic_hoses',
    'lights_beacons', 'seatbelt', 'mirrors_glass', 'fire_extinguisher', 'fops_rops',
    'horn_beeper', 'controls_estop', 'gauges_warning'
  ],
  // 2: Tracked Heavy
  2: [
    'engine_oil', 'hydraulic_oil', 'coolant', 'final_drive_oil', 'fuel_level',
    'tracks', 'undercarriage', 'air_cleaner', 'attachment_bucket', 'hydraulic_hoses',
    'lights_beacons', 'seatbelt', 'mirrors_glass', 'fire_extinguisher', 'spill_kit',
    'horn_beeper', 'controls_estop', 'gauges_warning'
  ],
  // 3: Light Vehicles
  3: [
    'engine_oil', 'coolant', 'brake_fluid', 'fuel_level',
    'tires', 'tow_hitch', 'brakes',
    'lights_beacons', 'seatbelt', 'mirrors_glass', 'fire_extinguisher', 'wheel_chocks',
    'horn_beeper', 'gauges_warning'
  ],
  // 4: Stationary Plant & Power
  4: [
    'engine_oil', 'coolant', 'fuel_level', 'def_adblue',
    'belt_guards', 'air_cleaner',
    'fire_extinguisher', 'spill_kit',
    'controls_estop', 'gauges_warning'
  ],
  // 5: Compaction & Rollers
  5: [
    'engine_oil', 'hydraulic_oil', 'coolant', 'fuel_level',
    'tires', 'brakes', 'hydraulic_hoses', 'air_cleaner',
    'lights_beacons', 'seatbelt', 'fire_extinguisher', 'fops_rops',
    'horn_beeper', 'controls_estop', 'gauges_warning'
  ],
  // 6: Cranes & EWPs
  6: [
    'engine_oil', 'hydraulic_oil', 'coolant', 'fuel_level',
    'tires', 'brakes', 'outriggers', 'hydraulic_hoses', 'winch_cable',
    'lights_beacons', 'seatbelt', 'fire_extinguisher', 'spill_kit',
    'horn_beeper', 'controls_estop', 'gauges_warning',
    'lifting_shackles', 'safety_hook', 'boom_loadchart', 'ground_pads'
  ],
  // 7: Crushing & Screening Plant
  7: [
    'engine_oil', 'hydraulic_oil', 'coolant', 'fuel_level',
    'tracks', 'belt_guards', 'hydraulic_hoses', 'undercarriage',
    'lights_beacons', 'fire_extinguisher', 'spill_kit',
    'controls_estop', 'gauges_warning'
  ],
  // 8: Custom Site Machinery
  8: [
    'engine_oil', 'hydraulic_oil', 'coolant', 'fuel_level',
    'tires', 'brakes', 'hydraulic_hoses',
    'lights_beacons', 'seatbelt', 'fire_extinguisher',
    'horn_beeper', 'controls_estop'
  ],
};

export const DEFAULT_PRESTART_TEMPLATE_STORE: PrestartTemplateStore = {
  types: DEFAULT_PRESTART_TYPES,
  questions: MASTER_CHECK_ITEMS,
  assignments: DEFAULT_PRESTART_ASSIGNMENTS,
  machineOverrides: {},
};

const PRESTART_TEMPLATES_KEY = 'apex_prestart_templates_store';

export function getSavedPrestartTemplates(): PrestartTemplateStore {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(PRESTART_TEMPLATES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          types: parsed.types && parsed.types.length ? parsed.types : DEFAULT_PRESTART_TYPES,
          questions: parsed.questions && parsed.questions.length ? parsed.questions : MASTER_CHECK_ITEMS,
          assignments: parsed.assignments || DEFAULT_PRESTART_ASSIGNMENTS,
          machineOverrides: parsed.machineOverrides || {},
        };
      } catch (e) {
        // fallback
      }
    }
  }
  return DEFAULT_PRESTART_TEMPLATE_STORE;
}

export function saveSavedPrestartTemplates(store: PrestartTemplateStore): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PRESTART_TEMPLATES_KEY, JSON.stringify(store));
  }
}

export function getCheckItemsForType(
  typeId: number,
  store?: PrestartTemplateStore,
  machineId?: string
): CheckItemDefinition[] {
  const activeStore = store || getSavedPrestartTemplates();

  // Check machine override first
  if (machineId && activeStore.machineOverrides && activeStore.machineOverrides[machineId]) {
    const questionIds = activeStore.machineOverrides[machineId];
    return activeStore.questions.filter(q => questionIds.includes(q.id));
  }

  // Fallback to type assignment
  const questionIds = activeStore.assignments[typeId] || activeStore.assignments[1] || [];
  const assignedItems = activeStore.questions.filter(q => questionIds.includes(q.id));

  // If assignedItems is empty for any reason, return defaults for type 1
  if (assignedItems.length === 0) {
    const fallbackIds = DEFAULT_PRESTART_ASSIGNMENTS[1];
    return activeStore.questions.filter(q => fallbackIds.includes(q.id));
  }

  return assignedItems;
}

// Keep PRESTART_CHECK_ITEMS for backwards compatibility
export const PRESTART_CHECK_ITEMS: Record<number, CheckItemDefinition[]> = {
  1: getCheckItemsForType(1, DEFAULT_PRESTART_TEMPLATE_STORE),
  2: getCheckItemsForType(2, DEFAULT_PRESTART_TEMPLATE_STORE),
  3: getCheckItemsForType(3, DEFAULT_PRESTART_TEMPLATE_STORE),
};

export const DEFAULT_DOCKET_TEMPLATE: DocketTemplateConfig = {
  companyName: 'APEX EARTHMOVING & CIVIL SERVICES PTY LTD',
  companyAbn: 'ABN: 48 902 314 881',
  companyAddress: 'Industrial Depot 14, Tailscale Tower Link, Perth WA',
  companyPhone: '(08) 9400 3320',
  companyEmail: 'dockets@apexearthmoving.com.au',
  templateVersion: 'V2026.4 - Sever Tower Master Template',
  logoText: 'APEX CIVIL',
};

const DOCKET_TEMPLATE_KEY = 'apex_docket_template';

export function getSavedDocketTemplate(): DocketTemplateConfig {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(DOCKET_TEMPLATE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_DOCKET_TEMPLATE, ...JSON.parse(saved) };
      } catch (e) {
        // fallback
      }
    }
  }
  return DEFAULT_DOCKET_TEMPLATE;
}

export function saveSavedDocketTemplate(config: DocketTemplateConfig): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DOCKET_TEMPLATE_KEY, JSON.stringify(config));
  }
}

export function deduplicateMachines(list: Machine[]): Machine[] {
  if (!Array.isArray(list)) return [];
  const map = new Map<string, Machine>();
  for (const m of list) {
    if (!m) continue;
    const key = (m.unitCode || m.id || '').trim().toUpperCase();
    if (!key) continue;
    if (map.has(key)) {
      const existing = map.get(key)!;
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
        regoOrSerial: m.regoOrSerial || existing.regoOrSerial || '',
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

export function deduplicateWorkers(list: Worker[]): Worker[] {
  if (!Array.isArray(list)) return [];
  const map = new Map<string, Worker>();
  for (const w of list) {
    if (!w) continue;
    const key = (w.name || w.id || '').trim().toUpperCase();
    if (!key) continue;
    if (map.has(key)) {
      const existing = map.get(key)!;
      map.set(key, { ...existing, ...w });
    } else {
      map.set(key, { ...w });
    }
  }
  return Array.from(map.values());
}

const WORKERS_CACHE_KEY = 'apex_cached_workers';
const MACHINES_CACHE_KEY = 'apex_cached_machines';
const MACHINES_LEGACY_KEY = 'apex_machines_store';

export function getSavedWorkers(): Worker[] {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(WORKERS_CACHE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deduped = deduplicateWorkers(parsed);
          if (deduped.length >= INITIAL_WORKERS.length) return deduped;
          // Merge with initial workers if any were missing
          const map = new Map<string, Worker>();
          INITIAL_WORKERS.forEach(w => map.set((w.name || w.id).toUpperCase(), w));
          deduped.forEach(w => map.set((w.name || w.id).toUpperCase(), w));
          return Array.from(map.values());
        }
      } catch (e) {
        // fallback
      }
    }
  }
  return INITIAL_WORKERS;
}

export function saveSavedWorkers(workers: Worker[]): void {
  if (typeof window !== 'undefined' && Array.isArray(workers)) {
    const deduped = deduplicateWorkers(workers);
    localStorage.setItem(WORKERS_CACHE_KEY, JSON.stringify(deduped));
  }
}

export function getSavedMachines(): Machine[] {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(MACHINES_CACHE_KEY) || localStorage.getItem(MACHINES_LEGACY_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return deduplicateMachines([...INITIAL_MACHINES, ...parsed]);
        }
      } catch (e) {
        // fallback
      }
    }
  }
  return INITIAL_MACHINES;
}

export function saveSavedMachines(machines: Machine[]): void {
  if (typeof window !== 'undefined' && Array.isArray(machines)) {
    const deduped = deduplicateMachines(machines);
    localStorage.setItem(MACHINES_CACHE_KEY, JSON.stringify(deduped));
    localStorage.setItem(MACHINES_LEGACY_KEY, JSON.stringify(deduped));
    window.dispatchEvent(new CustomEvent('machines-updated'));
  }
}

/**
 * Completely flushes local device cache for machines and resets to factory master list
 * without deleting user settings or company branding.
 */
export function forceResetLocalFleetToFactory(): Machine[] {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MACHINES_CACHE_KEY);
    localStorage.removeItem(MACHINES_LEGACY_KEY);
    localStorage.setItem(MACHINES_CACHE_KEY, JSON.stringify(INITIAL_MACHINES));
    localStorage.setItem(MACHINES_LEGACY_KEY, JSON.stringify(INITIAL_MACHINES));
    window.dispatchEvent(new CustomEvent('machines-updated'));
  }
  return INITIAL_MACHINES;
}

/**
 * Flushes all offline queues and caches from the local device to prevent
 * stale or duplicate data from being pushed back to the server on next sync.
 */
export function flushAllLocalDeviceCaches(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MACHINES_CACHE_KEY);
    localStorage.removeItem(MACHINES_LEGACY_KEY);
    localStorage.removeItem(WORKERS_CACHE_KEY);
    localStorage.removeItem('apex_offline_prestarts_queue');
    localStorage.removeItem('apex_offline_dockets_queue');
    localStorage.removeItem('apex_defects_store');
    localStorage.removeItem('apex_services_store');
    
    // Re-seed clean defaults
    localStorage.setItem(MACHINES_CACHE_KEY, JSON.stringify(INITIAL_MACHINES));
    localStorage.setItem(MACHINES_LEGACY_KEY, JSON.stringify(INITIAL_MACHINES));
    localStorage.setItem(WORKERS_CACHE_KEY, JSON.stringify(INITIAL_WORKERS));
    
    window.dispatchEvent(new CustomEvent('machines-updated'));
    window.dispatchEvent(new CustomEvent('defects-updated'));
    window.dispatchEvent(new CustomEvent('services-updated'));
    window.dispatchEvent(new CustomEvent('sync-completed'));
  }
}
