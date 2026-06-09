# Engineering a Zero-Dependency, Secure, and Fully Accessible Carbon Dashboard

Building modern web applications often tempts developers to reach for heavy frameworks (like React or Next.js) and third-party libraries (like Chart.js or Tailwind). However, this introduces substantial page load overhead, potential supply-chain security vulnerabilities, and accessibility challenges.

For the **Carbon Footprint Awareness Platform** mini-challenge, I engineered **EcoTrace**—a zero-dependency, secure-by-default, and highly interactive eco-dashboard using pure HTML5, Vanilla CSS, and ES6+ JavaScript.

Here is a deep dive into the technical decisions, architecture, and security practices implemented to build a leaderboard-winning submission.

---

## 🏗️ 1. Architecture: Zero Dependencies, Maximum Efficiency

The runtime footprint of EcoTrace is close to **zero**. There are no build steps, no webpack configurations, and no `node_modules` required to serve the frontend. 

- **Frontend**: Single-page architecture managed via native ES modules.
- **Styling**: Structured Vanilla CSS utilizing custom properties (CSS variables) to handle theme tokens dynamically, supporting a default **Forest Dark** theme and a high-contrast **Fresh Light** theme.
- **Icons**: Crisp inline SVG elements. Avoiding external CDNs (like FontAwesome) protects the app against cross-site script injections (XSS) and network latency.

---

## 📊 2. Dynamic SVG Donut Chart Engine

Typically, developers rely on libraries like Chart.js or D3 to render breakdowns. In EcoTrace, the donut chart is drawn **dynamically from scratch** using native SVG `<circle>` elements and trigonometry.

### How it works:
1. The circumference ($C$) of the donut circle is calculated based on its radius ($r = 35$):
   $$C = 2 \pi r \approx 219.91$$
2. Using the `stroke-dasharray` attribute set to $C$, we control the visible segment length of the circle.
3. The `stroke-dashoffset` determines the hidden portion of the border, computed as:
   $$\text{offset} = C - (\text{percentage} \times C)$$
4. Slices are stacked and rotated sequentially based on the accumulated percentage to form a complete $360^\circ$ circle.

```javascript
// Truncated snippet from app.js
for (const [key, value] of Object.entries(components)) {
  const percent = value / total;
  const strokeOffset = circ - (percent * circ);
  const rotation = accumulatedPercent * 360 - 90; // Align top start (-90deg)
  
  svgContent += `
    <circle 
      cx="50" cy="50" r="${radius}" 
      fill="transparent" 
      stroke="${colors[key]}" stroke-width="10" 
      stroke-dasharray="${circ}" stroke-dashoffset="${strokeOffset}" 
      transform="rotate(${rotation} 50 50)"
      class="chart-slice"
      role="img" aria-label="${labels[key]}: ${value.toFixed(0)} kg CO₂e (${(percent * 100).toFixed(0)}%)"
    />`;
  accumulatedPercent += percent;
}
```

By offsetting the container rotation inside a `<g>` wrapper (`transform="rotate(90 50 50)"`), the center text aligns horizontally and reads cleanly, preventing rotated layouts.

---

## 🔒 3. Hardened Security & Custom Static Dev Server

Public repositories are highly scrutinized for security. To protect our users and demonstrate top-tier safety compliance, I built a custom Node.js development server (`server.js`) equipped with:

1. **Directory Traversal Mitigation**: Sanitizes and normalizes incoming file request URLs to block `../` path attacks, ensuring only files inside the project scope are accessible:
   ```javascript
   const filePath = path.join(__dirname, safePath);
   const relativePath = path.relative(__dirname, filePath);
   if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
     res.statusCode = 403;
     res.end("403 Forbidden");
   }
   ```
2. **Hardened Security Headers**:
   - **Content Security Policy (CSP)**: `default-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;` prevents arbitrary script execution.
   - **X-Frame-Options (DENY)**: Completely blocks clickjacking.
   - **X-Content-Type-Options (nosniff)**: Forces browsers to respect the sent MIME type.
   - **X-XSS-Protection**: Prevents loading of pages when cross-site scripting attacks are detected.

---

## ♿ 4. Accessibility (a11y) & Interactive UX

EcoTrace is designed to be fully usable by individuals navigating with screen readers or keyboards.

- **WAI-ARIA Tab Navigation**: The dashboard implements standard keyboard tab switching. Pressing `ArrowRight` or `ArrowDown` focuses and opens subsequent tabs, keeping focus trapped correctly inside standard panels.
- **Dynamic Field Associations**: When an input fails validation, we inject a detailed error label underneath, matching the parent container's `.has-error` style, and bind it using `aria-invalid="true"` and `aria-describedby="${field}-error"`. This triggers immediate screen reader announcements.
- **Aria-Live Updates**: The calculation triggers an `aria-live="polite"` status message updating screen readers on their score and active categories.

---

## 🤖 5. The EcoBot AI Assistant (Logical Decision Making)

To elevate usability, I implemented **EcoBot**—an interactive chatbot that analyzes user data. EcoBot runs entirely on client-side logic using key phrase matching, removing any API latency or cost overhead.

- If the user asks *"What is my biggest source?"*, the bot evaluates the maximum footprint component and replies: *"Electricity represents 61% of your total emissions..."*
- If the user asks *"Suggest a goal"*, it calculates a custom 20% reduction target (e.g. *"I recommend target 136 kg/month"*).
- Incorporates typing indicators to mimic realistic assistant interactions.

---

## 🧪 6. Testing Strategy
Using Node.js's built-in `node:test` framework, we have configured robust unit tests to verify:
- Non-numeric input rejections.
- Bound checking (inputs exceeding `1,000,000` or negative values).
- Default values (empty entries are caught cleanly).
- Precise carbon calculation coefficients.
- Action savings evaluations.

Run the test suite anytime:
```bash
npm test
```

---

## 💡 Summary

EcoTrace represents a modern, highly secure, fast, and accessible approach to web engineering. By dropping massive libraries in favor of native DOM operations and custom SVG math, the platform remains blazing fast, easily deployable as a static asset, and entirely secure against supply-chain attacks.
