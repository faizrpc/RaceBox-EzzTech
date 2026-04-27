/**
 * RaceBox EzzTech CSV Parser
 * Parses CSV exports from the RaceBox EzzTech app into structured run data.
 */

const CSVParser = (() => {
  /**
   * Known column name mappings (Indonesian -> internal keys).
   * The parser tries exact matches first, then falls back to fuzzy matching.
   */
  const COLUMN_MAP = {
    // Date/time
    'date': 'date',
    'tanggal': 'date',
    'waktu': 'date',
    'timestamp': 'date',
    'time': 'time_raw',

    // Speed data points (for trace)
    'speed': 'speed',
    'kecepatan': 'speed',
    'speed (km/h)': 'speed',
    'kecepatan (km/h)': 'speed',
    'speed_kmh': 'speed',

    // Elapsed time for trace
    'elapsed': 'elapsed',
    'elapsed_time': 'elapsed',
    'waktu_berjalan': 'elapsed',
    'elapsed (s)': 'elapsed',
    'time (s)': 'elapsed',

    // Distance for trace
    'distance': 'distance',
    'jarak': 'distance',
    'distance (m)': 'distance',
    'jarak (m)': 'distance',

    // Acceleration test results
    '0-30': 'time_0_30',
    '0-30 km/h': 'time_0_30',
    '0_30': 'time_0_30',
    'time_0_30': 'time_0_30',

    '0-60': 'time_0_60',
    '0-60 km/h': 'time_0_60',
    '0_60': 'time_0_60',
    'time_0_60': 'time_0_60',

    '0-100': 'time_0_100',
    '0-100 km/h': 'time_0_100',
    '0_100': 'time_0_100',
    'time_0_100': 'time_0_100',

    // Distance test results
    '201m': 'time_201m',
    '201 m': 'time_201m',
    'time_201m': 'time_201m',
    '201m time': 'time_201m',

    '402m': 'time_402m',
    '402 m': 'time_402m',
    'time_402m': 'time_402m',
    '402m time': 'time_402m',

    // Top speed
    'top speed': 'top_speed',
    'top_speed': 'top_speed',
    'kecepatan_tertinggi': 'top_speed',
    'max speed': 'top_speed',
    'top speed (km/h)': 'top_speed',

    // Reaction time
    'reaction': 'reaction_time',
    'reaction time': 'reaction_time',
    'reaction_time': 'reaction_time',
    'waktu reaksi': 'reaction_time',

    // GPS accuracy
    'accuracy': 'gps_accuracy',
    'gps accuracy': 'gps_accuracy',
    'gps_accuracy': 'gps_accuracy',
    'akurasi': 'gps_accuracy',
    'akurasi gps': 'gps_accuracy',

    // Latitude / Longitude
    'latitude': 'latitude',
    'lat': 'latitude',
    'longitude': 'longitude',
    'lng': 'longitude',
    'lon': 'longitude',
  };

  function normalizeHeader(header) {
    return header.trim().toLowerCase().replace(/[_\s]+/g, ' ').replace(/[()]/g, '').trim();
  }

  function mapColumn(header) {
    const normalized = normalizeHeader(header);
    if (COLUMN_MAP[normalized]) return COLUMN_MAP[normalized];

    // Fuzzy match
    for (const [key, value] of Object.entries(COLUMN_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
    return null;
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  function parseNumeric(value) {
    if (!value || value === '' || value === '-' || value === 'N/A') return null;
    const cleaned = value.replace(/[^\d.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;

    // Try DD/MM/YYYY or DD-MM-YYYY
    const parts = value.split(/[\/\-]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const d2 = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  }

  /**
   * Detect if CSV contains GPS trace data (many rows per run)
   * vs. summary data (one row per run).
   */
  function detectFormat(columns) {
    const hasSpeed = columns.includes('speed');
    const hasElapsed = columns.includes('elapsed');
    const hasAccelTimes = columns.includes('time_0_60') || columns.includes('time_0_100');

    if (hasSpeed && hasElapsed) return 'trace';
    if (hasAccelTimes) return 'summary';
    return 'unknown';
  }

  /**
   * Parse a CSV string into an array of run objects.
   */
  function parse(csvText, fileName) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const columnMapping = headers.map(h => ({ original: h, mapped: mapColumn(h) }));
    const mappedColumns = columnMapping.map(c => c.mapped).filter(Boolean);
    const format = detectFormat(mappedColumns);

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row = {};
      columnMapping.forEach((col, idx) => {
        if (col.mapped && idx < values.length) {
          row[col.mapped] = values[idx];
        }
      });
      rows.push(row);
    }

    if (format === 'trace') {
      return parseTraceData(rows, fileName);
    } else {
      return parseSummaryData(rows, fileName);
    }
  }

  /**
   * Parse trace data: group continuous GPS data into a single run.
   */
  function parseTraceData(rows, fileName) {
    const tracePoints = rows.map(r => ({
      elapsed: parseNumeric(r.elapsed),
      speed: parseNumeric(r.speed),
      distance: parseNumeric(r.distance),
      latitude: parseNumeric(r.latitude),
      longitude: parseNumeric(r.longitude),
    })).filter(p => p.elapsed !== null && p.speed !== null);

    if (tracePoints.length === 0) return [];

    // Compute acceleration milestones from trace
    const topSpeed = Math.max(...tracePoints.map(p => p.speed));
    const time030 = findSpeedTime(tracePoints, 30);
    const time060 = findSpeedTime(tracePoints, 60);
    const time0100 = findSpeedTime(tracePoints, 100);
    const time201 = findDistanceTime(tracePoints, 201);
    const time402 = findDistanceTime(tracePoints, 402);

    const run = {
      id: generateId(),
      date: rows[0].date ? parseDate(rows[0].date) : new Date(),
      source: fileName || 'GPS Trace',
      top_speed: topSpeed,
      time_0_30: time030,
      time_0_60: time060,
      time_0_100: time0100,
      time_201m: time201,
      time_402m: time402,
      reaction_time: parseNumeric(rows[0].reaction_time),
      gps_accuracy: parseNumeric(rows[0].gps_accuracy),
      trace: tracePoints,
      tags: [],
    };

    return [run];
  }

  /**
   * Parse summary data: each row is one run.
   */
  function parseSummaryData(rows, fileName) {
    return rows.map(r => ({
      id: generateId(),
      date: r.date ? parseDate(r.date) : new Date(),
      source: fileName || 'CSV Import',
      top_speed: parseNumeric(r.top_speed),
      time_0_30: parseNumeric(r.time_0_30),
      time_0_60: parseNumeric(r.time_0_60),
      time_0_100: parseNumeric(r.time_0_100),
      time_201m: parseNumeric(r.time_201m),
      time_402m: parseNumeric(r.time_402m),
      reaction_time: parseNumeric(r.reaction_time),
      gps_accuracy: parseNumeric(r.gps_accuracy),
      trace: null,
      tags: [],
    })).filter(r =>
      r.top_speed !== null ||
      r.time_0_60 !== null ||
      r.time_0_100 !== null ||
      r.time_201m !== null ||
      r.time_402m !== null
    );
  }

  function findSpeedTime(trace, targetSpeed) {
    for (let i = 0; i < trace.length; i++) {
      if (trace[i].speed >= targetSpeed) {
        if (i === 0) return trace[i].elapsed;
        // Linear interpolation
        const prev = trace[i - 1];
        const curr = trace[i];
        const ratio = (targetSpeed - prev.speed) / (curr.speed - prev.speed);
        return prev.elapsed + ratio * (curr.elapsed - prev.elapsed);
      }
    }
    return null;
  }

  function findDistanceTime(trace, targetDist) {
    for (let i = 0; i < trace.length; i++) {
      if (trace[i].distance !== null && trace[i].distance >= targetDist) {
        if (i === 0) return trace[i].elapsed;
        const prev = trace[i - 1];
        const curr = trace[i];
        if (prev.distance === null) return curr.elapsed;
        const ratio = (targetDist - prev.distance) / (curr.distance - prev.distance);
        return prev.elapsed + ratio * (curr.elapsed - prev.elapsed);
      }
    }
    return null;
  }

  let idCounter = 0;
  function generateId() {
    return 'run_' + Date.now() + '_' + (idCounter++);
  }

  /**
   * Generate demo data for testing the dashboard.
   */
  function generateDemoData(numRuns) {
    numRuns = numRuns || 12;
    const runs = [];
    const baseDate = new Date('2026-03-01');
    const tagSets = [
      ['Stock', 'Sunny'],
      ['Modified', 'Sunny'],
      ['Stock', 'Rain'],
      ['Modified', 'Premium fuel'],
      ['Stock'],
      ['Modified', 'Rain'],
    ];

    for (let i = 0; i < numRuns; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i * 3 + Math.floor(Math.random() * 2));

      // Simulate gradual improvement with some variance
      const improvement = i * 0.08;
      const variance = () => (Math.random() - 0.5) * 0.4;

      const time030 = Math.max(1.5, 3.2 - improvement * 0.3 + variance());
      const time060 = Math.max(3.0, 6.8 - improvement * 0.5 + variance());
      const time0100 = Math.max(6.0, 12.5 - improvement + variance());
      const topSpeed = Math.min(220, 145 + improvement * 3 + variance() * 5);

      // Generate trace data
      const tracePoints = [];
      const totalTime = time0100 + 5 + Math.random() * 3;
      const dt = 0.1;
      let speed = 0;
      let dist = 0;

      for (let t = 0; t <= totalTime; t += dt) {
        // Logistic-ish acceleration curve
        const maxAccel = 35 - improvement * 0.5;
        const accel = maxAccel * Math.exp(-t / 4) * (1 - speed / (topSpeed + 10));
        speed = Math.max(0, speed + accel * dt + (Math.random() - 0.5) * 0.3);
        speed = Math.min(topSpeed + 2, speed);
        dist += (speed / 3.6) * dt;

        tracePoints.push({
          elapsed: Math.round(t * 100) / 100,
          speed: Math.round(speed * 10) / 10,
          distance: Math.round(dist * 10) / 10,
          latitude: null,
          longitude: null,
        });
      }

      const time201 = findDistanceTime(tracePoints, 201);
      const time402 = findDistanceTime(tracePoints, 402);

      runs.push({
        id: generateId(),
        date: date,
        source: 'Demo Data',
        top_speed: Math.round(topSpeed * 10) / 10,
        time_0_30: Math.round(time030 * 1000) / 1000,
        time_0_60: Math.round(time060 * 1000) / 1000,
        time_0_100: Math.round(time0100 * 1000) / 1000,
        time_201m: time201 ? Math.round(time201 * 1000) / 1000 : null,
        time_402m: time402 ? Math.round(time402 * 1000) / 1000 : null,
        reaction_time: Math.round((0.2 + Math.random() * 0.3) * 1000) / 1000,
        gps_accuracy: Math.round((2 + Math.random() * 5) * 10) / 10,
        trace: tracePoints,
        tags: tagSets[i % tagSets.length] || [],
      });
    }

    return runs;
  }

  return { parse, generateDemoData };
})();
