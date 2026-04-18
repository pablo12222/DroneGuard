const { v4: uuidv4 } = require('uuid');

class SimulationService {
  constructor() {
    this.missions = new Map();
    this.clients = new Map(); // missionId -> Set<res>
  }

  createMission(config) {
    const missionId = config.missionId || uuidv4();
    const state = {
      id: missionId,
      name: config.name || 'Inspection Mission',
      droneId: config.droneId || 'DRONE-01',
      status: 'idle',
      startTime: null,
      simulationTime: 0,
      route: config.route,
      detections: config.detections || [],
      dronePosition: { ...config.route.waypoints[0] },
      waypointIndex: 0,
      progress: 0,
      anomalyCount: 0,
      firedDetections: new Set(),
      interval: null,
      videoPath: config.videoPath || null,
    };
    this.missions.set(missionId, state);
    return state;
  }

  startMission(missionId) {
    const state = this.missions.get(missionId);
    if (!state) throw new Error('Mission not found');
    if (state.status === 'running') return state;

    state.status = 'running';
    state.startTime = Date.now();

    this._emitLog(missionId, 'success', `Mission ${missionId} started. Drone ${state.droneId} is airborne.`);
    this._emitLog(missionId, 'info', `Route: ${state.route.name} — ${state.route.waypoints.length} towers, ${state.route.totalDistance}km`);

    state.interval = setInterval(() => this._tick(missionId), 100);
    return state;
  }

  pauseMission(missionId) {
    const state = this.missions.get(missionId);
    if (!state) throw new Error('Mission not found');
    if (state.status === 'running') {
      state.status = 'paused';
      clearInterval(state.interval);
      this._emitLog(missionId, 'warning', 'Inspection paused by operator.');
      this._emit(missionId, { type: 'inspection_status', status: 'paused', progress: state.progress });
    } else if (state.status === 'paused') {
      state.status = 'running';
      state.interval = setInterval(() => this._tick(missionId), 100);
      this._emitLog(missionId, 'success', 'Inspection resumed.');
    }
    return state;
  }

  resetMission(missionId) {
    const state = this.missions.get(missionId);
    if (!state) throw new Error('Mission not found');
    clearInterval(state.interval);
    state.status = 'idle';
    state.simulationTime = 0;
    state.dronePosition = { ...state.route.waypoints[0] };
    state.waypointIndex = 0;
    state.progress = 0;
    state.anomalyCount = 0;
    state.firedDetections = new Set();
    this._emit(missionId, { type: 'inspection_reset' });
    this._emitLog(missionId, 'info', 'Mission reset. Ready for new inspection.');
    return state;
  }

  getMissionState(missionId) {
    return this.missions.get(missionId) || null;
  }

  addClient(missionId, res) {
    if (!this.clients.has(missionId)) this.clients.set(missionId, new Set());
    this.clients.get(missionId).add(res);
  }

  removeClient(missionId, res) {
    const set = this.clients.get(missionId);
    if (set) set.delete(res);
  }

  _tick(missionId) {
    const state = this.missions.get(missionId);
    if (!state || state.status !== 'running') return;

    state.simulationTime += 0.1;

    const waypoints = state.route.waypoints;
    const totalDuration = state.route.estimatedDuration;

    // Find current segment
    let wpIdx = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (state.simulationTime >= waypoints[i].timestamp) wpIdx = i;
    }
    state.waypointIndex = wpIdx;

    const wp1 = waypoints[wpIdx];
    const wp2 = waypoints[Math.min(wpIdx + 1, waypoints.length - 1)];
    const segDuration = wp2.timestamp - wp1.timestamp;
    const segProgress = segDuration > 0
      ? Math.min((state.simulationTime - wp1.timestamp) / segDuration, 1)
      : 1;

    const lat = wp1.lat + (wp2.lat - wp1.lat) * segProgress;
    const lng = wp1.lng + (wp2.lng - wp1.lng) * segProgress;
    const altitude = wp1.altitude + (wp2.altitude - wp1.altitude) * segProgress;

    const heading = Math.atan2(wp2.lng - wp1.lng, wp2.lat - wp1.lat) * (180 / Math.PI);

    state.dronePosition = { lat, lng, altitude, heading };
    state.progress = Math.min((state.simulationTime / totalDuration) * 100, 100);

    // Emit position every tick
    this._emit(missionId, {
      type: 'drone_position',
      lat, lng, altitude, heading,
      waypointIndex: wpIdx,
      waypointName: wp1.name,
      progress: state.progress,
      simulationTime: state.simulationTime,
      anomalyCount: state.anomalyCount,
    });

    // Check for new detections
    for (const det of state.detections) {
      if (!state.firedDetections.has(det.id) && state.simulationTime >= det.timestamp) {
        state.firedDetections.add(det.id);
        if (det.isAnomaly) state.anomalyCount++;

        this._emit(missionId, { type: 'detection', detection: det });

        const level = det.severity === 'high' ? 'error' : det.severity === 'medium' ? 'warning' : 'info';
        const flag = det.isAnomaly ? '⚠ ANOMALY' : 'DETECTION';
        this._emitLog(missionId, level,
          `${flag} [${det.className.toUpperCase()}] — Tower ${det.waypointId + 1} | Confidence: ${(det.confidence * 100).toFixed(1)}% | ${det.description}`
        );
      }
    }

    // Periodic system logs every 5 real seconds (50 ticks)
    const tick = Math.round(state.simulationTime * 10);
    if (tick % 50 === 0 && tick > 0) {
      this._emitLog(missionId, 'info',
        `Telemetry — Pos: [${lat.toFixed(5)}, ${lng.toFixed(5)}] | Alt: ${altitude.toFixed(0)}m | Tower: ${wp1.name} | Progress: ${state.progress.toFixed(1)}%`
      );
    }

    // Tower arrival logs
    if (segProgress < 0.05 && wpIdx > 0 && !state[`logged_wp_${wpIdx}`]) {
      state[`logged_wp_${wpIdx}`] = true;
      this._emitLog(missionId, 'info', `Arrived at ${wp1.name} — scanning components...`);
    }

    // Check completion
    if (state.simulationTime >= totalDuration) {
      state.status = 'complete';
      clearInterval(state.interval);
      state.progress = 100;

      const firedDets = state.detections.filter(d => state.firedDetections.has(d.id));
      this._emit(missionId, {
        type: 'inspection_complete',
        missionId,
        duration: state.simulationTime.toFixed(1),
        anomalyCount: state.anomalyCount,
        detectionsCount: firedDets.length,
      });
      this._emitLog(missionId, 'success',
        `✓ Inspection complete — Duration: ${state.simulationTime.toFixed(0)}s | Total detections: ${firedDets.length} | Anomalies: ${state.anomalyCount}`
      );
    }
  }

  _emit(missionId, data) {
    const clientSet = this.clients.get(missionId);
    if (!clientSet || clientSet.size === 0) return;
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    clientSet.forEach(res => { try { res.write(msg); } catch (_) {} });
  }

  _emitLog(missionId, level, message) {
    this._emit(missionId, {
      type: 'log',
      level,
      message,
      timestamp: this.missions.get(missionId)?.simulationTime || 0,
      wallTime: new Date().toISOString(),
    });
  }
}

module.exports = new SimulationService();
