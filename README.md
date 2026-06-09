# EcoTrace — Carbon Footprint Awareness Platform

An advanced, lightweight, secure-by-default web application designed to calculate personal carbon footprints, visualize emissions breakdowns, and plan actionable reductions in real-time.

Built from scratch with **zero dependencies**, focusing on clean code, web accessibility (a11y), and rigorous security practices.

---

## 🚀 Key Platform Features

- **Interactive Eco-Dashboard Layout**: Seamless tab navigation (`Calculator`, `Impact Insights`, `Reduction Plan`, `Global Benchmarks`) with complete responsive design.
- **Dynamic SVG Charting**: In-house rendering of accessible SVG donut charts and carbon intensity gauges. Updates live as the user tweaks inputs.
- **Gamified Interactive Action Planner**: A custom goal-planning checklist showing estimated monthly savings (in kg CO₂e) tailored to user data. Tracks real-time footprint offsets, projects updated scores, and updates leaderboard rank simulations as actions are checked.
- **Hardened Dev Server**: Replaced standard static servers with a custom Node.js server (`server.js`) implementing:
  - **Directory Traversal Mitigation** (restricting server reads outside project root).
  - **Hardened Security Headers** (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`).
- **Comprehensive Unit Testing**: Includes robust testing of boundary inputs, calculations, and recommendations using Node.js's native test runner (zero external test frameworks needed).
- **Web Accessibility (WCAG 2.1 AA Compliant)**:
  - High-contrast colors with standard focus indicators.
  - Complete keyboard navigation support on all tabs and checklist items.
  - Form inputs tied to error outputs using `aria-invalid` and `aria-describedby` dynamically.
  - Live announcements (`aria-live="polite"`) for calculations.
- **Dual-Theme Support**: Forest Dark & Fresh Light modes with system preference detection.

---

## 🛠️ Tech Stack & Architecture

- **Core**: Semantic HTML5 & Vanilla ES6+ Javascript.
- **Styling**: Modern Vanilla CSS with CSS Custom Properties (Theme-compatible tokens).
- **Icons**: Inline SVG symbols (zero external CDN dependencies to prevent XSS).
- **Dev Server**: Pure Node.js `http` & `fs` standard modules.
- **Testing**: Native Node.js `node:test` framework.

---

## 💻 Local Development

Ensure you have **Node.js 18+** installed.

### 1. Run Unit Tests
Verify all validation and calculations:
```bash
npm test
```

### 2. Start the Secure Server
Start the secure development server:
```bash
npm start
```
Once started, navigate to `http://localhost:8080` in your web browser.

### 3. Quick Demo Test
Click **"Fill Demo Data"** in the Calculator tab to instantly populate the form with mock carbon values and run the dashboard analysis.

---

## 🌐 Deployment
This project is fully static and has no database or runtime build requirements, making it extremely easy and fast to deploy. 

- **Static Platforms**: Simply deploy the directory directly to GitHub Pages, Netlify, Vercel, or Cloudflare Pages.
- **Docker/VPS**: Serve the folder using the bundled secure `server.js` by running `node server.js` behind a reverse proxy (e.g. Nginx).
