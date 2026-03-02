# Homey RCS TBZ48 (Z-Wave) – Driver Investigation Repo

This repository documents issues encountered while developing a Homey Pro 2023 (SDK v3) Z-Wave driver for the RCS TBZ48 thermostat.

Repo: https://github.com/qiuzux/homey-rcs-tbz48

---

## Environment

- Homey Pro 2023
- Homey Apps SDK: v3
- Homey CLI: (please see `homey -V` output below)
- App ID: `com.qiuzu.tbz48`
- Device: RCS TBZ48 thermostat (battery / FLiRS)
- Z-Wave IDs:
  - Manufacturer ID: **16**
  - ProductType ID: **21570**
  - Product ID: **21554**
- Included with security: **S0**
- Example Node ID (from logs): **134**

---

## Current Status (What Works)

Even with the issues below:

- App can be installed (`homey app install`)
- App can run (`homey app run`)
- Device is recognized and initializes
- Battery capability works (battery value visible in Homey)
- Thermostat mode / fan mode capabilities appear in Homey UI
- Target temperature can be changed from Homey UI (command is sent), but device often does not reflect / sync correctly

---

## Issues

### Issue A — `homey app validate` fails with “images required”, but install/run works

Command:

```bash
homey app validate
