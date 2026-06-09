# Behind the Code: Engineering a Zero-Dependency, Secure, and Fully Accessible Carbon Dashboard

In this post, I will break down the engineering decisions, coding patterns, and security practices implemented to build **EcoTrace**—a zero-dependency, secure-by-default, and highly interactive carbon awareness dashboard.

Every line of code in the repository was built to demonstrate clean engineering, full accessibility (a11y), edge-level security, and high performance.

---

## 📂 Project Architecture

The repository is structured logically to separate user interface, business logic, testing, and deployment configurations:

- `index.html`: Holds the semantic layout, accessible WAI-ARIA tabs, calculator forms, and chat widgets.
- `styles.css`: Centralizes modern style tokens, layouts, transitions, and the Forest Dark & Fresh Light themes.
- `server.js`: A secure, zero-dependency local static server.
- `vercel.json`: Configuration for serverless static hosting and edge security rules.
- `src/calculator.js`: Contains calculation constants, input boundary validation, and recommendation models.
- `src/app.js`: Coordinates DOM state updates, SVG chart drawing, keyboard listeners, and the client-side EcoBot chatbot.
- `tests/calculator.test.js`: Contains comprehensive unit tests for calculations and validation rules.

---

## 🛠️ 1. Validation & Calculation Logic (`calculator.js`)

At the core of the app is the emission coefficient engine. We lock coefficients in a frozen dictionary `EMISSION_FACTORS` to prevent runtime mutation:

```javascript
export const EMISSION_FACTORS = Object.freeze({
  carKgPerKm: 0.21,
  publicKgPerKm: 0.08,
  electricityKgPerKwh: 0.417,
  wasteKgPerKg: 0.57,
  meatMealKgPerMeal: 2.5,
  weeksPerMonth: 4.345,
});
```

### Input Validation & Boundary Checks
The `validateInput` function screens raw inputs. Rather than general type coercion, it explicitly checks boundaries (catching negative numbers, empty inputs, and values exceeding `MAX_VALUE` of `1,000,000`):

```javascript
export function validateInput(input) {
  const errors = {};
  const value = {};

  for (const field of NUMERIC_FIELDS) {
    const raw = input[field];
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      errors[field] = "This field is required. Enter 0 if not applicable.";
      continue;
    }
    const numericValue = Number(raw);
    if (!Number.isFinite(numericValue)) {
      errors[field] = "A valid number is required.";
      ...
```

---

## 📊 2. Dynamic SVG Donut Chart & Rotated Labels (`app.js`)

Rather than pulling in massive charting packages, the dashboard draws segment arcs directly inside `drawDonutChart(components)` using the SVG stroke properties:

1. Circumference: $C = 2 \pi r \approx 219.91$ (where radius $r = 35$).
2. `stroke-dashoffset` controls the segment length:
   ```javascript
   const percent = value / total;
   const strokeLength = percent * circ;
   const strokeOffset = circ - strokeLength;
   ```
3. Because the container SVG `.donut-chart-svg` is rotated `-90deg` by CSS to align slices starting from 12 o'clock, text elements inside it would naturally render rotated. To keep the center label horizontal and readable, we offset the group by a positive `90deg` transform:
   ```javascript
   svgContent += `
     <g class="chart-center-text" transform="rotate(90 50 50)">
       <text x="50" y="52" text-anchor="middle" font-size="4.8" fill="var(--text-primary)" font-weight="800">
         ${total.toFixed(0)} kg CO₂e/mo
       </text>
     </g>
   `;
   ```

---

## ♿ 3. Full Accessibility Integration (`app.js` & `index.html`)

We strictly conform to WCAG 2.1 AA guidelines by managing user focus and ARIA attributes:

### Tab Switching & Keyboard Navigation
Inside `initTabs()`, key down listeners capture keyboard arrow keys to navigate dashboard tabs cleanly. If a user presses `ArrowRight`, the browser manages focus index and updates layout attributes:

```javascript
tabList.addEventListener("keydown", (e) => {
  const activeTab = document.activeElement;
  let index = tabsArr.indexOf(activeTab);
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    index = (index + 1) % tabsArr.length;
    tabsArr[index].focus();
    tabsArr[index].click();
    e.preventDefault();
  }
  ...
```

### Dynamic Error Announcements
When a validation fails, `renderErrors(errors)` links input elements to error text blocks dynamically, prompting immediate reading by screen readers:

```javascript
input.setAttribute("aria-invalid", "true");
input.setAttribute("aria-describedby", `${helpId} ${errorSpan.id}`.trim());
```

---

## 🔒 4. Server-Side Security Measures (`server.js`)

For production environments, the custom `server.js` protects the application from common hosting vulnerabilities without standard web framework bloat:

### Directory Traversal Block
URL normalizations make sure requested files sit strictly inside the working directory:
```javascript
const filePath = path.join(__dirname, safePath);
const relativePath = path.relative(__dirname, filePath);

if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
  res.statusCode = 403;
  res.setHeader("Content-Type", "text/plain");
  res.end("403 Forbidden: Access denied.");
  return;
}
```

### Hardened Header Declarations
Every response includes headers designed to block clickjacking, MIME sniffing, and cross-site scripting (XSS):
```javascript
res.setHeader("X-Content-Type-Options", "nosniff");
res.setHeader("X-Frame-Options", "DENY");
res.setHeader("X-XSS-Protection", "1; mode=block");
res.setHeader("Content-Security-Policy", "default-src 'self'; font-src 'self' ...;");
```

---

## 🤖 5. Context-Aware AI Chatbot (`app.js`)

We built a local climate assistant (**EcoBot**) that operates without network requests. The bot parses queries using extensive keywords (e.g. `isBiggest`, `isTransport`, `isEnergy`) and generates calculations based on the user's active context:

```javascript
const maxEntry = Object.entries(currentFootprintComponents).reduce(
  (max, entry) => entry[1] > max[1] ? entry : max, ["", -1]
);
const percentage = ((maxEntry[1] / currentFootprintValue) * 100).toFixed(0);

return `Based on your inputs, your biggest source of carbon emissions is **${sourceNames[maxEntry[0]]}** producing **${maxEntry[1]} kg CO₂e/month** (representing **${percentage}%** of your total footprint).`;
```

---

## 🧪 6. Testing Pipeline (`calculator.test.js`)

We run our tests using Node.js's native test runner (`node --test`), keeping verification fast and completely independent of third-party frameworks. Tests verify calculations, empty inputs, values exceeding boundaries, and recommendation sorting logic.

```bash
# Run the test suite
npm test
```

---

## 💡 Summary

By dropping massive frameworks in favor of native APIs, custom SVG mathematics, and clean, accessible code patterns, **EcoTrace** remains blazing fast, highly secure, and extremely maintainable.
