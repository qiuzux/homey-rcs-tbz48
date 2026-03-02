'use strict';

const Homey = require('homey');

// 兼容不同版本 homey-zwavedriver 的导出名称，避免 “extends undefined”
let ZwaveDriverBase = null;
try {
  const zw = require('homey-zwavedriver');
  // 常见导出名（不同版本可能不同）
  ZwaveDriverBase =
    zw.ZwaveDriver ||
    zw.Driver ||
    zw.ZWaveDriver || // 保险
    null;
} catch (e) {
  ZwaveDriverBase = null;
}

// 如果找不到 ZwaveDriver，就退回到 Homey.Driver，至少保证驱动能初始化、App 不再感叹号
const Base = ZwaveDriverBase || Homey.Driver;

class TBZ48Driver extends Base {
  // 先不写任何逻辑：我们的设备逻辑在 device.js
}

module.exports = TBZ48Driver;