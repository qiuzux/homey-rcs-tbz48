'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

class TBZ48Device extends ZwaveDevice {

  async onNodeInit() {
    this.log('TBZ48 - INIT (manual CC + assoc brute-force + retry)');

    try {
      this.log('[TBZ48] capabilities =', this.getCapabilities());
    } catch (e) {
      this.log('[TBZ48] getCapabilities failed:', e);
    }

    this._safeSetCap = async (cap, value) => {
      try {
        if (!this.hasCapability(cap)) {
          this.log(`[TBZ48] skip set "${cap}"="${value}" (cap missing)`);
          return;
        }
        await this.setCapabilityValue(cap, value);
      } catch (err) {
        this.error(`[TBZ48] setCapabilityValue failed cap=${cap} value=${value}`, err);
      }
    };

    this._cc = (name) => {
      try {
        const cc = this.getCommandClass(name);
        if (!cc) this.log(`[TBZ48] getCommandClass("${name}") -> null`);
        return cc || null;
      } catch (e) {
        this.error(`[TBZ48] getCommandClass("${name}") threw`, e);
        return null;
      }
    };

    this._delay = (ms) => new Promise(r => this.homey.setTimeout(r, ms));

    this._sendWithRetry = async (fn, label, tries = 3, gapMs = 900) => {
      for (let i = 1; i <= tries; i++) {
        try {
          this.log(`[TBZ48] ${label} try ${i}/${tries}`);
          await fn();
          return true;
        } catch (e) {
          this.error(`[TBZ48] ${label} failed try ${i}/${tries}`, e);
          if (i < tries) await this._delay(gapMs);
        }
      }
      return false;
    };

    // 1) 关联：强制 group 1/2/3 都指向 Homey(=1)，并回读确认
    await this._ensureAssociationBruteforce();

    // 2) 抓 report
    this._registerReportListeners();

    // 3) UI 操作 -> SET/GET
    this._registerCapabilityListeners();

    // 4) 轻量轮询（不强求）
    await this._delay(1200);
    await this._pollBasics();
  }

  async _ensureAssociationBruteforce() {
    const cc = this._cc('ASSOCIATION');
    if (!cc) {
      this.log('[TBZ48] ASSOCIATION CC not available');
      return;
    }

    // 你已确认 Homey NodeID 始终是 1
    const controllerNodeId = 1;

    // 很多设备 lifeline 不止 group1；这里直接 brute-force group1/2/3
    for (const g of [1, 2, 3]) {
      await this._sendWithRetry(
        async () => cc.ASSOCIATION_SET({ GroupingIdentifier: g, NodeId: [controllerNodeId] }),
        `ASSOC_SET(group${g} -> ${controllerNodeId})`,
        3,
        900
      );
      await this._delay(400);
    }

    // 回读确认（关键：如果你一直看不到 ASSOCIATION_REPORT，就说明设备没醒/没回应）
    for (const g of [1, 2, 3]) {
      await this._sendWithRetry(
        async () => cc.ASSOCIATION_GET({ GroupingIdentifier: g }),
        `ASSOC_GET(group${g})`,
        2,
        900
      );
      await this._delay(400);
    }
  }

  _registerReportListeners() {
    this.registerReportListener('ASSOCIATION', 'ASSOCIATION_REPORT', async (report) => {
      this.log('[TBZ48] ASSOCIATION_REPORT raw=', report);
    });

    this.registerReportListener('BATTERY', 'BATTERY_REPORT', async (report) => {
      this.log('[TBZ48] BATTERY_REPORT raw=', report);
      const lvl = report?.['Battery Level'] ?? report?.BatteryLevel ?? report?.Level;
      if (typeof lvl === 'number') await this._safeSetCap('measure_battery', lvl);

      const low = report?.['Battery Low Warning'] ?? report?.BatteryLowWarning;
      if (low !== undefined) await this._safeSetCap('alarm_battery', Boolean(low));
    });

    this.registerReportListener('THERMOSTAT_MODE', 'THERMOSTAT_MODE_REPORT', async (report) => {
      this.log('[TBZ48] MODE_REPORT raw=', report);
      const modeStr = report?.Level?.Mode ?? report?.Mode ?? report?.level?.mode ?? null;

      let homeyMode = null;
      if (typeof modeStr === 'string') {
        const s = modeStr.toLowerCase();
        if (s.includes('off')) homeyMode = 'off';
        else if (s.includes('heat')) homeyMode = 'heat';
        else if (s.includes('cool')) homeyMode = 'cool';
        else if (s.includes('auto')) homeyMode = 'auto';
      } else if (typeof modeStr === 'number') {
        homeyMode = this._tbz48ModeToHomey(modeStr);
      }

      if (homeyMode) await this._safeSetCap('thermostat_mode', homeyMode);
    });

    this.registerReportListener('THERMOSTAT_FAN_MODE', 'THERMOSTAT_FAN_MODE_REPORT', async (report) => {
      this.log('[TBZ48] FAN_MODE_REPORT raw=', report);
      const fan = report?.['Fan Mode'] ?? report?.Level?.['Fan Mode'] ?? report?.FanMode ?? null;
      if (fan === null || fan === undefined) return;
      const homeyFan = (Number(fan) === 0) ? 'auto' : 'on';
      await this._safeSetCap('fan_mode', homeyFan);
    });

    this.registerReportListener('SENSOR_MULTILEVEL', 'SENSOR_MULTILEVEL_REPORT', async (report) => {
      this.log('[TBZ48] SENSOR_MULTILEVEL_REPORT raw=', report);
      const val = report?.SensorValue?.value ?? report?.['Sensor Value (Parsed)'] ?? report?.Value;
      if (typeof val === 'number') await this._safeSetCap('measure_temperature', val);
    });

    this.registerReportListener('THERMOSTAT_SETPOINT', 'THERMOSTAT_SETPOINT_REPORT', async (report) => {
      this.log('[TBZ48] SETPOINT_REPORT raw=', report);
      const v = report?.Level2?.['Setpoint Value'] ?? report?.Level2?.SetpointValue ?? report?.Value;
      if (typeof v === 'number') await this._safeSetCap('target_temperature', v);
    });
  }

  _registerCapabilityListeners() {
    this.registerCapabilityListener('thermostat_mode', async (value) => {
      this.log('[TBZ48] thermostat_mode user set =', value);
      const modeByte = this._homeyModeToTbz48(value);

      await this._sendWithRetry(() => this._thermostatModeSet(modeByte), `MODE_SET(${modeByte})`, 3, 900);
      await this._delay(500);
      await this._sendWithRetry(() => this._thermostatModeGet(), 'MODE_GET', 2, 900);
      return true;
    });

    this.registerCapabilityListener('fan_mode', async (value) => {
      this.log('[TBZ48] fan_mode user set =', value);
      const fanByte = (value === 'auto') ? 0 : 1;

      await this._sendWithRetry(() => this._fanModeSet(fanByte), `FAN_MODE_SET(${fanByte})`, 3, 900);
      await this._delay(500);
      await this._sendWithRetry(() => this._fanModeGet(), 'FAN_MODE_GET', 2, 900);
      return true;
    });

    this.registerCapabilityListener('target_temperature', async (value) => {
      this.log('[TBZ48] target_temperature user set =', value);

      await this._sendWithRetry(() => this._setpointSet(value), `SETPOINT_SET(${value})`, 3, 900);
      await this._delay(600);
      await this._sendWithRetry(() => this._setpointGet(), 'SETPOINT_GET', 2, 900);
      return true;
    });
  }

  async _pollBasics() {
    await this._sendWithRetry(() => this._batteryGet(), 'BATTERY_GET', 2, 900);
    await this._delay(300);
    await this._sendWithRetry(() => this._thermostatModeGet(), 'MODE_GET(start)', 2, 900);
    await this._delay(300);
    await this._sendWithRetry(() => this._fanModeGet(), 'FAN_MODE_GET(start)', 2, 900);
    await this._delay(300);
    await this._sendWithRetry(() => this._setpointGet(), 'SETPOINT_GET(start)', 2, 900);
  }

  _homeyModeToTbz48(mode) {
    switch (mode) {
      case 'off': return 0;
      case 'heat': return 1;
      case 'cool': return 2;
      case 'auto': return 3;
      default: return 3;
    }
  }

  _tbz48ModeToHomey(level) {
    switch (Number(level)) {
      case 0: return 'off';
      case 1: return 'heat';
      case 2: return 'cool';
      case 3: return 'auto';
      case 4: return 'heat';
      default: return 'auto';
    }
  }

  async _batteryGet() {
    const cc = this._cc('BATTERY');
    if (!cc) return;
    await cc.BATTERY_GET({});
  }

  async _thermostatModeGet() {
    const cc = this._cc('THERMOSTAT_MODE');
    if (!cc) return;
    await cc.THERMOSTAT_MODE_GET({});
  }

  async _thermostatModeSet(modeByte) {
    const cc = this._cc('THERMOSTAT_MODE');
    if (!cc) return;
    await cc.THERMOSTAT_MODE_SET({ Level: modeByte });
  }

  async _fanModeGet() {
    const cc = this._cc('THERMOSTAT_FAN_MODE');
    if (!cc) return;
    await cc.THERMOSTAT_FAN_MODE_GET({});
  }

  async _fanModeSet(fanByte) {
    const cc = this._cc('THERMOSTAT_FAN_MODE');
    if (!cc) return;
    await cc.THERMOSTAT_FAN_MODE_SET({ 'Fan Mode': fanByte });
  }

  async _setpointGet() {
    const cc = this._cc('THERMOSTAT_SETPOINT');
    if (!cc) return;
    await cc.THERMOSTAT_SETPOINT_GET({ 'Setpoint Type': 1 });
  }

  async _setpointSet(value) {
    const cc = this._cc('THERMOSTAT_SETPOINT');
    if (!cc) return;

    // 关键：Level2 必须是对象，否则你手机就会报 ["Level2"]
    await cc.THERMOSTAT_SETPOINT_SET({
      Level: { 'Setpoint Type': 1, Precision: 1, Scale: 0, Size: 2 },
      Level2: { 'Setpoint Value': value }
    });
  }
}

module.exports = TBZ48Device;