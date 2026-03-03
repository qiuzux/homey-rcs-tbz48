# RCS TBZ48 / TBZ48A Thermostat Driver for Homey Pro 2023

## Overview

This project provides a custom Homey Pro 2023 (SDK v3) Z-Wave driver for the RCS TBZ48 / TBZ48A battery-powered thermostat (4 × AA).

The goal is to enable full thermostat functionality on Homey Pro 2023, including:

- Temperature measurement
- Target temperature control
- Thermostat mode selection
- Fan mode control
- Battery level reporting

---

## Device Information

Tested device:
- Model: RCS TBZ48 / TBZ48A
- Power: 4 × AA batteries
- Z-Wave

Current Z-Wave identifiers used:

- Manufacturer ID: `16`
- Product Type ID: `21570`
- Product ID: `21554`

These values are based on available documentation and existing controller behavior.  
Official confirmation from the manufacturer is pending.

---

## Project Status

### ✅ Completed

- Homey SDK v3 structure
- Valid publish-level validation (`homey app validate`)
- Driver class: `thermostat`
- Capabilities mapped:
  - `measure_temperature`
  - `target_temperature`
  - `thermostat_mode`
  - `fan_mode`
  - `measure_battery`
  - `alarm_battery`
- Z-Wave inclusion works
- Device installs successfully
- UI elements appear correctly in Homey

### ⚠️ Known Issues

- Thermostat does not always respond to control changes
- No consistent unsolicited reports observed
- Inclusion does not display a security prompt
- Device state may not remain synchronized with UI

The device is located ~1.3 meters from Homey Pro with no obstructions.

---

## Environment

Development environment:

- Windows 11
- Node.js v18 (managed via nvm)
- Homey CLI 3.12.x
- Homey Pro 2023
- SDK v3

---

## Installation (Development Mode)

```bash
npm install
homey login
homey app install
### Issue A — `homey app validate` fails with “images required”, but install/run works

Command:

```bash
homey app validate
