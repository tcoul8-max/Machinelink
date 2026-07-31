import { Machine, Worker, CheckItemDefinition, PrestartType, DocketTemplateConfig } from '../types';

export const INITIAL_WORKERS: Worker[] = [
  { id: 'w1', name: 'Dave Miller', role: 'Senior Plant Operator', pin: '1234', phone: '0412 888 101', active: true },
  { id: 'w2', name: 'Sarah Jenkins', role: 'Excavator & Loader Operator', pin: '2345', phone: '0423 999 202', active: true },
  { id: 'w3', name: 'Jack Thompson', role: 'Heavy Diesel Fitter & Operator', pin: '3456', phone: '0434 111 303', active: true },
  { id: 'w4', name: 'Mick O\'Connor', role: 'Site Supervisor', pin: '4567', phone: '0445 222 404', active: true },
];

export const INITIAL_MACHINES: Machine[] = [
  {
    id: 'm1',
    unitCode: 'EX-201',
    name: 'CAT 320 Next Gen Excavator (Tracked)',
    regoOrSerial: 'CAT0320T-98812',
    prestartType: 2, // Tracked
    currentHours: 1420.5,
    status: 'Operational',
  },
  {
    id: 'm2',
    unitCode: 'LD-104',
    name: 'Komatsu WA380 Wheel Loader',
    regoOrSerial: 'KMT-WA380-4519',
    prestartType: 1, // Wheeled
    currentHours: 3890.0,
    status: 'Operational',
  },
  {
    id: 'm3',
    unitCode: 'DZ-05',
    name: 'CAT D6 Dozer (Tracked)',
    regoOrSerial: 'CAT-D6T-33201',
    prestartType: 2, // Tracked
    currentHours: 2150.2,
    status: 'Operational',
  },
  {
    id: 'm4',
    unitCode: 'BH-02',
    name: 'JCB 3CX Backhoe Loader (Wheeled)',
    regoOrSerial: 'JCB-3CX-78291',
    prestartType: 1, // Wheeled
    currentHours: 890.4,
    status: 'Requires Service',
  },
  {
    id: 'm5',
    unitCode: 'UTE-09',
    name: 'Toyota Hilux 4x4 Field Service Ute',
    regoOrSerial: '1GXX-882 (WA)',
    prestartType: 3, // Light/Aux
    currentHours: 124500, // km / hours
    status: 'Operational',
  },
  {
    id: 'm6',
    unitCode: 'TRL-03',
    name: 'Diesel Fuel Tanker Trailer & Pump',
    regoOrSerial: 'TRL-D9902',
    prestartType: 3, // Light/Aux
    currentHours: 340.0,
    status: 'Operational',
  }
];

export const PRESTART_CHECK_ITEMS: Record<PrestartType, CheckItemDefinition[]> = {
  // Prestart 1: Wheeled Machinery
  1: [
    { id: 'engine_oil', category: 'Fluid Levels', label: 'Engine Oil Level', description: 'Check dipstick level between Min and Max' },
    { id: 'hydraulic_oil', category: 'Fluid Levels', label: 'Hydraulic Oil Level', description: 'Check sight glass with boom/bucket in park position' },
    { id: 'coolant', category: 'Fluid Levels', label: 'Radiator Coolant & Hoses', description: 'Check expansion tank level and hose condition' },
    { id: 'transmission_oil', category: 'Fluid Levels', label: 'Transmission / Drive Oil', description: 'Check transmission dipstick or sight gauge' },
    { id: 'fuel_level', category: 'Fluid Levels', label: 'Fuel & DEF Level / Water Trap', description: 'Check fuel level and drain fuel filter water trap' },
    
    { id: 'tires', category: 'Ground & Mechanical', label: 'Tire Condition, Pressure & Wheel Nuts', description: 'Check inflation, cuts/bulges, and wheel nut indicator pointers' },
    { id: 'steering', category: 'Ground & Mechanical', label: 'Steering Linkages & Rams', description: 'Check cylinder pins, play, and grease points' },
    { id: 'brakes', category: 'Ground & Mechanical', label: 'Service & Park Brakes', description: 'Test foot brake response and park brake hold' },
    { id: 'air_cleaner', category: 'Ground & Mechanical', label: 'Air Cleaner & Dust Bowl', description: 'Check dust ejector valve and filter restriction gauge' },
    { id: 'attachment_bucket', category: 'Ground & Mechanical', label: 'Bucket, Pins & Quick Hitch', description: 'Check lock pin engagement, teeth wear, and grease' },
    
    { id: 'lights_beacons', category: 'Cab & Safety', label: 'Lights, Indicators & Strobe Beacon', description: 'Check high/low beam, work lights, brake lights, beacon' },
    { id: 'seatbelt', category: 'Cab & Safety', label: 'Seatbelt & Mounting', description: 'Check belt condition, latch engagement, and inertia lock' },
    { id: 'mirrors_glass', category: 'Cab & Safety', label: 'Mirrors, Windscreen & Wipers', description: 'Clean glass, inspect for cracks, check washer fluid' },
    { id: 'fire_extinguisher', category: 'Cab & Safety', label: 'Fire Extinguisher & First Aid Kit', description: 'Check pressure gauge in green zone and tag date' },
    
    { id: 'horn_beeper', category: 'Operational Checks', label: 'Horn & Reversing Alarm', description: 'Test horn sound and reverse alarm activation' },
    { id: 'controls_estop', category: 'Operational Checks', label: 'Controls, Levers & E-Stop', description: 'Check smooth lever movement and emergency shutdown button' },
  ],

  // Prestart 2: Tracked Machinery (Tires & Steering Linkages omitted!)
  2: [
    { id: 'engine_oil', category: 'Fluid Levels', label: 'Engine Oil Level', description: 'Check dipstick level between Min and Max' },
    { id: 'hydraulic_oil', category: 'Fluid Levels', label: 'Hydraulic Oil Level', description: 'Check sight glass in cold/parked stance' },
    { id: 'coolant', category: 'Fluid Levels', label: 'Radiator Coolant & Hoses', description: 'Check expansion tank level and hose condition' },
    { id: 'final_drive_oil', category: 'Fluid Levels', label: 'Final Drive / Swing Motor Oil', description: 'Inspect final drive seals for leaks' },
    { id: 'fuel_level', category: 'Fluid Levels', label: 'Fuel Level & Water Separator', description: 'Check fuel level and drain water trap valve' },
    
    { id: 'tracks', category: 'Ground & Mechanical', label: 'Track Tension, Shoes, Rollers & Sprockets', description: 'Check track sag, loose shoe bolts, damaged rollers, sprocket teeth wear' },
    { id: 'undercarriage', category: 'Ground & Mechanical', label: 'Undercarriage & Guarding', description: 'Inspect frame for cracking, rock guard integrity, mud buildup' },
    { id: 'air_cleaner', category: 'Ground & Mechanical', label: 'Air Cleaner & Filter Restriction Gauge', description: 'Check dust ejector valve and air intake ducting' },
    { id: 'attachment_bucket', category: 'Ground & Mechanical', label: 'Boom, Dipper, Bucket & Quick Hitch', description: 'Inspect weld seams, pins, safety hitch lock, grease points' },
    { id: 'hydraulic_hoses', category: 'Ground & Mechanical', label: 'Hydraulic Hoses & Cylinder Seals', description: 'Check for weeping seals, chafed hoses, hose clamps' },

    { id: 'lights_beacons', category: 'Cab & Safety', label: 'Work Lights, Cabin Lights & Flashing Beacon', description: 'Test LED work lights and amber flashing strobe' },
    { id: 'seatbelt', category: 'Cab & Safety', label: 'Seatbelt & Safety Lock Lever', description: 'Check seatbelt retraction and hydraulic lock arm switch' },
    { id: 'mirrors_glass', category: 'Cab & Safety', label: 'Mirrors, Windscreen & FOPS/ROPS Guarding', description: 'Clean cabin glass, check mirrors and overhead guard' },
    { id: 'fire_extinguisher', category: 'Cab & Safety', label: 'Fire Extinguisher & Spill Kit', description: 'Inspect fire extinguisher pressure gauge and oil spill kit' },
    
    { id: 'horn_beeper', category: 'Operational Checks', label: 'Horn & Travel Alarm', description: 'Test horn and travel movement alarm' },
    { id: 'controls_estop', category: 'Operational Checks', label: 'Pilot Controls & Engine E-Stop', description: 'Check joystick response and emergency engine cutoff' },
  ],

  // Prestart 3: Auxiliary Equipment / Light Vehicles
  3: [
    { id: 'engine_oil', category: 'Fluid Levels', label: 'Engine Oil Level', description: 'Inspect dipstick level' },
    { id: 'coolant', category: 'Fluid Levels', label: 'Coolant Level & Hoses', description: 'Check coolant overflow bottle' },
    { id: 'brake_fluid', category: 'Fluid Levels', label: 'Brake & Clutch Fluid', description: 'Check reservoir fluid level' },
    { id: 'fuel_level', category: 'Fluid Levels', label: 'Fuel Level / Auxiliary Fuel', description: 'Ensure adequate fuel for shift' },

    { id: 'tires', category: 'Ground & Mechanical', label: 'Tires, Pressure & Spare Tire', description: 'Inspect tread depth, wall damage, wheel nuts, spare tire' },
    { id: 'tow_hitch', category: 'Ground & Mechanical', label: 'Tow Hitch, Safety Chains & Electrical Socket', description: 'Inspect tow ball/pintle hook, D-shackles, trailer socket' },
    { id: 'brakes', category: 'Ground & Mechanical', label: 'Brakes & Park Brake', description: 'Check pedal feel and handbrake hold on incline' },
    
    { id: 'lights_beacons', category: 'Cab & Safety', label: 'Headlights, Tail Lights & Indicators', description: 'Check all turn signals and brake lights' },
    { id: 'first_aid_extinguisher', category: 'Cab & Safety', label: 'First Aid Kit & Fire Extinguisher', description: 'Confirm kit is stocked and extinguisher charged' },
    { id: 'seatbelt', category: 'Cab & Safety', label: 'Seatbelts & Cabin Mirrors', description: 'Inspect driver and passenger seatbelts' },
  ]
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

