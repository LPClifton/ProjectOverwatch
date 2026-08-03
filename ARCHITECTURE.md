# Project Overwatch
## Architecture

Version: 0.5.2

---

# Mission

Project Overwatch exists to maintain continuous situational awareness by gathering, evaluating, prioritizing, and presenting information that is relevant to the user's current context.

Project Overwatch is not a weather application.

Weather is one of many information sources monitored by Sentinel.

Sentinel does not exist to report everything it detects. Sentinel exists to identify what matters, determine when it matters, and communicate it with the least necessary interruption.

---

# Core Principles

- Modular by design
- Context aware
- Safety first
- User configurable
- Hardware independent whenever possible
- Graceful degradation when services are unavailable

---

# User Interface

The interface is divided into three major regions.

## Top Status Bar

Displays system state.

Examples:

- Active Profile
- GPS Status
- Time
- Radar Freshness
- Vehicle Mode
- Connectivity

---

## Adaptive Workspace

The workspace contains user-selected modules.

Examples:

- Map
- Weather
- Alerts
- Aircraft
- Radio
- Diagnostics
- Garage
- Inventory
- QRH

Users may create and save multiple layouts.

---

## Bottom Context Bar

Displays the most relevant information.

Normal operation rotates informational messages.

Critical events interrupt rotation until acknowledged or expired.

Examples:

- Lightning Distance
- Aircraft Activity
- Weather Trends
- Maintenance Reminders
- Route Hazards

---

# Profiles

Examples include:

- Driving
- Storm
- Aviation
- Garage
- Home
- Off-Road

Profiles define:

- Visible modules
- Layout
- Context priorities
- User preferences

---

# Managers

Core managers include:

- Notification Manager
- Navigation Intelligence Manager
- Display Protection Manager
- Weather Manager

Additional managers may be added as the platform evolves.

---

# Sentinel

Sentinel is the Situational Awareness Engine for Project Overwatch.

Sentinel receives analyzed information from all subsystem managers.

Sentinel determines:

- Relevance
- Priority
- Timing
- Destination
- Persistence
- User impact

Sentinel does not collect raw data.

Sentinel does not display information.

Sentinel coordinates all situational awareness across the platform.

# Modules

Modules are independent functional components.

Examples include:

- Weather
- Map
- Alerts
- Aircraft
- Radio
- Diagnostics
- Garage
- Inventory
- QRH

Modules may operate in the background even when not visible.

---

# Display Protection

Long-term display health is a design requirement.

Features include:

- Pixel shifting
- Idle dimming
- Static element drift
- Screensaver mode
- Alert wake-up

---

# Design Philosophy

Every feature should answer:

1. Is it a module?
2. Does it contribute to the Context Bar?
3. Does it require a Status indicator?
4. Is it user configurable?
5. Does it fit the mission of Overwatch?