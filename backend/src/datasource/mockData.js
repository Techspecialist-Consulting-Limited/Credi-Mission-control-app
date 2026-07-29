/**
 * Deterministic in-memory stand-in for the Credicorp_lakehouse tables.
 *
 * This exists because Fabric access is an org grant, not a code change: until
 * the service principal is a member of the workspace, every query fails at
 * LOGIN7 and nothing downstream can be exercised. The mock keeps the API, the
 * agent and the frontend fully testable in the meantime, and is swapped out
 * with a single env var (FABRIC_MODE) once the grant lands.
 *
 * Shapes here mirror what the real tables are expected to look like - the same
 * column kinds in the same roles (one id, one temporal axis, a couple of
 * low-cardinality dimensions, at least one numeric measure). Values are
 * generated from a fixed seed, so counts and charts are identical on every
 * restart and a demo can be rehearsed.
 */

/** mulberry32 - small, fast, deterministic. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted pick, so status donuts have a realistic shape instead of a flat one. */
function weighted(random, pairs) {
  const total = pairs.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

const pick = (random, list) => list[Math.floor(random() * list.length)];
const int = (random, min, max) => min + Math.floor(random() * (max - min + 1));
const money = (random, min, max) => Math.round((min + random() * (max - min)) * 100) / 100;

const DAY_MS = 86_400_000;
// Anchored to midnight so bucketing is stable across a long-running process.
const TODAY = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

/**
 * A timestamp inside the trailing `windowDays`, biased toward recent dates so
 * trend lines slope the way real operational data does.
 */
function recentDate(random, windowDays, skew = 1.6) {
  const fraction = Math.pow(random(), skew);
  const offsetMs = fraction * windowDays * DAY_MS;
  return new Date(TODAY - offsetMs + int(random, 0, 86_399) * 1000);
}

function laterDate(random, start, minDays, maxDays) {
  if (!start) return null;
  return new Date(start.getTime() + int(random, minDays, maxDays) * DAY_MS);
}

const DEPARTMENTS = ['Finance', 'Operations', 'Legal', 'Risk & Compliance', 'Technology', 'Human Resources'];
const PEOPLE = [
  'A. Mensah', 'B. Okafor', 'C. Adeyemi', 'D. Nwosu', 'E. Boateng', 'F. Diallo',
  'G. Abubakar', 'H. Owusu', 'I. Chukwu', 'J. Sarpong', 'K. Bello', 'L. Asante',
];

/**
 * Column metadata per table, in the shape INFORMATION_SCHEMA would return it.
 * `dataType` is a real T-SQL type name so src/schema.js classify() behaves
 * identically against mock and Fabric.
 */
const COLUMNS = {
  credo_support_tickets: [
    ['ticket_id', 'int'], ['subject', 'nvarchar'], ['category', 'nvarchar'], ['priority', 'nvarchar'],
    ['status', 'nvarchar'], ['channel', 'nvarchar'], ['assigned_to', 'nvarchar'], ['department', 'nvarchar'],
    ['created_at', 'datetime2'], ['resolved_at', 'datetime2'], ['resolution_hours', 'decimal'],
    ['satisfaction_score', 'decimal'], ['reopened', 'bit'],
  ],
  vendor_registry: [
    ['vendor_id', 'int'], ['vendor_name', 'nvarchar'], ['category', 'nvarchar'], ['country', 'nvarchar'],
    ['status', 'nvarchar'], ['risk_rating', 'nvarchar'], ['contract_value', 'decimal'],
    ['annual_spend', 'decimal'], ['onboarded_at', 'datetime2'], ['contract_expires_at', 'date'],
    ['compliance_verified', 'bit'],
  ],
  credo_memos: [
    ['memo_id', 'int'], ['title', 'nvarchar'], ['memo_type', 'nvarchar'], ['department', 'nvarchar'],
    ['status', 'nvarchar'], ['submitted_by', 'nvarchar'], ['approver', 'nvarchar'],
    ['amount_requested', 'decimal'], ['amount_approved', 'decimal'], ['created_at', 'datetime2'],
    ['approved_at', 'datetime2'], ['priority', 'nvarchar'],
  ],
  credo_travel_details: [
    ['travel_id', 'int'], ['employee_name', 'nvarchar'], ['department', 'nvarchar'],
    ['destination_country', 'nvarchar'], ['destination_city', 'nvarchar'], ['purpose', 'nvarchar'],
    ['status', 'nvarchar'], ['estimated_cost', 'decimal'], ['actual_cost', 'decimal'],
    ['created_at', 'datetime2'], ['departure_date', 'date'], ['return_date', 'date'],
  ],
  craig_audit_logs: [
    ['log_id', 'bigint'], ['event_type', 'nvarchar'], ['actor', 'nvarchar'], ['entity', 'nvarchar'],
    ['severity', 'nvarchar'], ['outcome', 'nvarchar'], ['source_system', 'nvarchar'],
    ['ip_address', 'nvarchar'], ['risk_score', 'decimal'], ['flagged', 'bit'], ['occurred_at', 'datetime2'],
  ],
};

const GENERATORS = {
  credo_support_tickets(random, index) {
    const created = recentDate(random, 400);
    const status = weighted(random, [['Resolved', 52], ['Closed', 18], ['In Progress', 14], ['Open', 11], ['Escalated', 5]]);
    const settled = status === 'Resolved' || status === 'Closed';
    const resolved = settled ? laterDate(random, created, 0, 21) : null;
    return {
      ticket_id: 100_000 + index,
      subject: `${pick(random, ['Access request', 'Payment failure', 'Report discrepancy', 'Account lockout', 'Data correction', 'System outage', 'Onboarding issue'])} - ref ${int(random, 1000, 9999)}`,
      category: weighted(random, [['Account', 26], ['Payments', 24], ['Reporting', 18], ['Access', 16], ['Infrastructure', 10], ['Other', 6]]),
      priority: weighted(random, [['Low', 34], ['Medium', 40], ['High', 20], ['Critical', 6]]),
      status,
      channel: weighted(random, [['Email', 44], ['Portal', 33], ['Phone', 15], ['Walk-in', 8]]),
      assigned_to: pick(random, PEOPLE),
      department: pick(random, DEPARTMENTS),
      created_at: created,
      resolved_at: resolved,
      resolution_hours: resolved ? Math.round(((resolved - created) / 3_600_000) * 10) / 10 : null,
      satisfaction_score: settled && random() > 0.25 ? Math.round((2.4 + random() * 2.6) * 10) / 10 : null,
      reopened: random() < 0.07,
    };
  },

  vendor_registry(random, index) {
    const onboarded = recentDate(random, 1500, 1.1);
    const contractValue = money(random, 12_000, 4_800_000);
    return {
      vendor_id: 5000 + index,
      vendor_name: `${pick(random, ['Sahel', 'Atlantic', 'Meridian', 'Kestrel', 'Northgate', 'Pinnacle', 'Verdant', 'Harbour', 'Ironwood', 'Solstice'])} ${pick(random, ['Holdings', 'Logistics', 'Technologies', 'Partners', 'Group', 'Industries', 'Services'])}`,
      category: weighted(random, [['Professional Services', 22], ['Technology', 21], ['Logistics', 17], ['Facilities', 14], ['Security', 12], ['Marketing', 9], ['Other', 5]]),
      country: weighted(random, [['Nigeria', 34], ['Ghana', 18], ['Kenya', 13], ['South Africa', 12], ['United Kingdom', 11], ['United States', 7], ['UAE', 5]]),
      status: weighted(random, [['Active', 62], ['Under Review', 15], ['Pending Onboarding', 11], ['Suspended', 7], ['Terminated', 5]]),
      risk_rating: weighted(random, [['Low', 46], ['Medium', 34], ['High', 15], ['Critical', 5]]),
      contract_value: contractValue,
      annual_spend: Math.round(contractValue * (0.15 + random() * 0.6) * 100) / 100,
      onboarded_at: onboarded,
      contract_expires_at: laterDate(random, onboarded, 180, 1460),
      compliance_verified: random() > 0.18,
    };
  },

  credo_memos(random, index) {
    const created = recentDate(random, 365);
    const status = weighted(random, [['Approved', 44], ['Pending Approval', 24], ['Under Review', 14], ['Rejected', 10], ['Draft', 8]]);
    const requested = money(random, 500, 950_000);
    const approved = status === 'Approved';
    return {
      memo_id: 20_000 + index,
      title: `${pick(random, ['Budget variance', 'Procurement request', 'Policy exception', 'Headcount approval', 'Capex proposal', 'Vendor renewal', 'Training allocation'])} - ${pick(random, DEPARTMENTS)}`,
      memo_type: weighted(random, [['Expenditure', 32], ['Policy', 20], ['Procurement', 19], ['Personnel', 17], ['Compliance', 12]]),
      department: pick(random, DEPARTMENTS),
      status,
      submitted_by: pick(random, PEOPLE),
      approver: status === 'Draft' ? null : pick(random, PEOPLE),
      amount_requested: requested,
      amount_approved: approved ? Math.round(requested * (0.6 + random() * 0.4) * 100) / 100 : null,
      created_at: created,
      approved_at: approved ? laterDate(random, created, 1, 30) : null,
      priority: weighted(random, [['Routine', 55], ['Expedited', 31], ['Urgent', 14]]),
    };
  },

  credo_travel_details(random, index) {
    const created = recentDate(random, 420);
    const departure = laterDate(random, created, 7, 90);
    const status = weighted(random, [['Completed', 41], ['Approved', 24], ['Pending Approval', 17], ['Cancelled', 10], ['In Progress', 8]]);
    const estimated = money(random, 800, 22_000);
    const done = status === 'Completed';
    return {
      travel_id: 8000 + index,
      employee_name: pick(random, PEOPLE),
      department: pick(random, DEPARTMENTS),
      destination_country: weighted(random, [['United Kingdom', 19], ['United States', 17], ['Ghana', 14], ['Kenya', 12], ['South Africa', 11], ['UAE', 10], ['France', 9], ['Rwanda', 8]]),
      destination_city: pick(random, ['London', 'New York', 'Accra', 'Nairobi', 'Johannesburg', 'Dubai', 'Paris', 'Kigali']),
      purpose: weighted(random, [['Client Engagement', 28], ['Conference', 22], ['Audit', 18], ['Training', 17], ['Regulatory Meeting', 15]]),
      status,
      estimated_cost: estimated,
      actual_cost: done ? Math.round(estimated * (0.78 + random() * 0.5) * 100) / 100 : null,
      created_at: created,
      departure_date: departure,
      return_date: laterDate(random, departure, 2, 14),
    };
  },

  craig_audit_logs(random, index) {
    const severity = weighted(random, [['Info', 58], ['Low', 19], ['Medium', 13], ['High', 7], ['Critical', 3]]);
    const risky = severity === 'High' || severity === 'Critical';
    return {
      log_id: 900_000 + index,
      event_type: weighted(random, [['record.read', 30], ['record.update', 20], ['auth.login', 18], ['export.generated', 12], ['permission.changed', 8], ['aml.screening', 7], ['auth.failed', 5]]),
      actor: pick(random, PEOPLE),
      entity: pick(random, ['credo_memos', 'vendor_registry', 'credo_travel_details', 'credo_support_tickets', 'user_directory']),
      severity,
      outcome: weighted(random, [['Success', 84], ['Denied', 11], ['Error', 5]]),
      source_system: weighted(random, [['Portal', 38], ['Fabric', 24], ['Batch', 20], ['API', 18]]),
      ip_address: `10.${int(random, 0, 40)}.${int(random, 0, 255)}.${int(random, 1, 254)}`,
      risk_score: Math.round((risky ? 55 + random() * 45 : random() * 55) * 10) / 10,
      flagged: risky && random() > 0.35,
      occurred_at: recentDate(random, 180, 2.2),
    };
  },
};

// Row counts chosen so aggregates look plausible on an executive tile without
// making the mock slow to build or page through.
const ROW_COUNTS = {
  credo_support_tickets: 4820,
  vendor_registry: 640,
  credo_memos: 1970,
  credo_travel_details: 1145,
  craig_audit_logs: 9600,
};

// Distinct seed per table so no two datasets share a value sequence.
const SEEDS = {
  credo_support_tickets: 1_337,
  vendor_registry: 4_242,
  credo_memos: 7_919,
  credo_travel_details: 2_718,
  craig_audit_logs: 3_141,
};

function buildTable(name) {
  const random = rng(SEEDS[name]);
  const generate = GENERATORS[name];
  return Array.from({ length: ROW_COUNTS[name] }, (_, index) => generate(random, index + 1));
}

let dataset = null;

/**
 * The whole mock lakehouse, built once on first access.
 * Returns Map<lowercaseName, { schema, name, columns, rows }>.
 */
export function mockDataset() {
  if (dataset) return dataset;

  dataset = new Map();
  for (const name of Object.keys(COLUMNS)) {
    dataset.set(name, {
      schema: 'dbo',
      name,
      columns: COLUMNS[name].map(([columnName, dataType], ordinal) => ({
        name: columnName,
        dataType,
        // Ids and the primary temporal axis are the only non-nullable columns.
        nullable: ordinal !== 0,
      })),
      rows: buildTable(name),
    });
  }
  return dataset;
}
