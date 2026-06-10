/**
 * EcoTrace Frontend Application Controller
 * Handles user interactions, form validation, theme switching, 
 * accessible tab navigation, chat assistant integration, 
 * and real-time chart & checklist updates.
 */

import {
  calculateFootprint,
  categorizeFootprint,
  getReductionTips,
  validateInput,
  getTipsDetails,
} from "./calculator.js";

// Global Application State
let currentFootprintValue = 0;
let currentFootprintComponents = null;
let currentValidatedInput = null;

const legendIds = {
  car: "#legend-car",
  publicTransport: "#legend-transit",
  electricity: "#legend-electricity",
  waste: "#legend-waste",
  food: "#legend-food",
};

/**
 * Initializes light/dark theme toggle based on system and saved preferences.
 */
function initTheme() {
  const themeToggle = document.querySelector("#theme-toggle");
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem("theme");
  const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  
  if (savedTheme === "light" || (!savedTheme && systemPrefersLight)) {
    document.documentElement.classList.add("theme-light");
  } else {
    document.documentElement.classList.remove("theme-light");
  }

  themeToggle.addEventListener("click", () => {
    const isLight = document.documentElement.classList.toggle("theme-light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });
}

/**
 * Switches between dashboard panels.
 * @param {string} tabId - ID of the clicked tab.
 */
function switchTab(tabId) {
  const targetTab = document.getElementById(tabId);
  if (!targetTab) return;
  
  const tabs = document.querySelectorAll('[role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');
  
  tabs.forEach((t) => {
    t.setAttribute("aria-selected", "false");
    t.setAttribute("tabindex", "-1");
    t.classList.remove("active");
  });
  
  panels.forEach((p) => {
    p.setAttribute("hidden", "true");
  });
  
  targetTab.setAttribute("aria-selected", "true");
  targetTab.setAttribute("tabindex", "0");
  targetTab.classList.add("active");
  
  const panelId = targetTab.getAttribute("aria-controls");
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.removeAttribute("hidden");
    panel.setAttribute("tabindex", "-1");
    panel.focus();
  }
}

/**
 * Attaches click and key events for accessible tab switching.
 */
function initTabs() {
  const tabs = document.querySelectorAll('[role="tab"]');
  
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchTab(tab.id);
    });
  });

  const tabList = document.querySelector('[role="tablist"]');
  if (tabList) {
    const tabsArr = Array.from(tabs);
    tabList.addEventListener("keydown", (e) => {
      const activeTab = document.activeElement;
      if (!tabsArr.includes(activeTab)) return;
      
      let index = tabsArr.indexOf(activeTab);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        index = (index + 1) % tabsArr.length;
        tabsArr[index].focus();
        tabsArr[index].click();
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        index = (index - 1 + tabsArr.length) % tabsArr.length;
        tabsArr[index].focus();
        tabsArr[index].click();
        e.preventDefault();
      }
    });
  }
}

/**
 * Clears previous form validation errors.
 */
function clearErrors() {
  const errorBanner = document.querySelector("#errors");
  if (errorBanner) {
    errorBanner.style.display = "none";
    errorBanner.textContent = "";
  }

  const groups = document.querySelectorAll(".form-group");
  groups.forEach((group) => {
    group.classList.remove("has-error");
    const existingError = group.querySelector(".field-error-msg");
    if (existingError) {
      existingError.remove();
    }
    const input = group.querySelector("input");
    if (input) {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      const helpText = group.querySelector(".field-help");
      if (helpText) {
        input.setAttribute("aria-describedby", helpText.id);
      }
    }
  });
}

/**
 * Renders validation error highlights and helper text links.
 * @param {Record<string, string>} errors
 */
function renderErrors(errors) {
  clearErrors();

  const errorBanner = document.querySelector("#errors");
  const errorList = document.createElement("ul");

  for (const [field, message] of Object.entries(errors)) {
    const input = document.getElementById(field);
    if (input) {
      const group = input.closest(".form-group");
      if (group) {
        group.classList.add("has-error");
        
        const errorSpan = document.createElement("span");
        errorSpan.className = "field-error-msg";
        errorSpan.id = `${field}-error`;
        errorSpan.textContent = message;
        
        input.setAttribute("aria-invalid", "true");
        
        const helpText = group.querySelector(".field-help");
        const helpId = helpText ? helpText.id : "";
        input.setAttribute("aria-describedby", `${helpId} ${errorSpan.id}`.trim());
        
        group.appendChild(errorSpan);
      }
    }

    const item = document.createElement("li");
    item.textContent = `${message}`;
    errorList.appendChild(item);
  }

  if (errorBanner) {
    errorBanner.textContent = "Please fix the following validation errors:";
    errorBanner.appendChild(errorList);
    errorBanner.style.display = "block";
    errorBanner.focus();
  }
}

/**
 * Dynamic SVG donut-chart renderer.
 * Draws arc segments using stroke-dasharray and stroke-dashoffset.
 * @param {Record<string, number>} components
 */
function drawDonutChart(components) {
  const chartSvg = document.querySelector("#donut-chart");
  if (!chartSvg) return;
  
  chartSvg.innerHTML = "";
  
  const total = Object.values(components).reduce((sum, val) => sum + val, 0);
  if (total === 0) {
    chartSvg.innerHTML = `
      <circle cx="50" cy="50" r="35" fill="transparent" stroke="var(--border-color)" stroke-width="12"></circle>
      <g class="chart-center-text" transform="rotate(90 50 50)">
        <text x="50" y="52" text-anchor="middle" font-size="4.8" fill="var(--text-muted)" font-weight="bold">0 kg CO₂e/mo</text>
      </g>
    `;
    return;
  }

  const radius = 35;
  const circ = 2 * Math.PI * radius; // ~219.91
  let accumulatedPercent = 0;
  
  const colors = {
    car: "#f43f5e",
    publicTransport: "#3b82f6",
    electricity: "#eab308",
    waste: "#a855f7",
    food: "#10b981",
  };

  const labels = {
    car: "Car Travel",
    publicTransport: "Transit",
    electricity: "Electricity",
    waste: "Waste",
    food: "Food",
  };

  let svgContent = `<circle cx="50" cy="50" r="${radius}" fill="transparent" stroke="var(--bg-card)" stroke-width="12"></circle>`;

  for (const [key, value] of Object.entries(components)) {
    if (value <= 0) continue;
    const percent = value / total;
    const strokeLength = percent * circ;
    const strokeOffset = circ - strokeLength;
    const rotation = accumulatedPercent * 360 - 90; // Align top start (-90deg)
    
    svgContent += `
      <circle 
        cx="50" 
        cy="50" 
        r="${radius}" 
        fill="transparent" 
        stroke="${colors[key]}" 
        stroke-width="10" 
        stroke-dasharray="${circ}" 
        stroke-dashoffset="${strokeOffset}" 
        transform="rotate(${rotation} 50 50)"
        class="chart-slice"
        tabindex="0"
        role="img"
        aria-label="${labels[key]}: ${value.toFixed(0)} kg CO₂e (${(percent * 100).toFixed(0)}%)"
      >
        <title>${labels[key]}: ${value.toFixed(1)} kg (${(percent * 100).toFixed(1)}%)</title>
      </circle>
    `;
    accumulatedPercent += percent;
  }
  
  svgContent += `
    <g class="chart-center-text" transform="rotate(90 50 50)">
      <text x="50" y="52" text-anchor="middle" font-size="4.8" fill="var(--text-primary)" font-weight="800">${total.toFixed(0)} kg CO₂e/mo</text>
    </g>
  `;

  chartSvg.innerHTML = svgContent;
}

/**
 * Updates visual progress gauge pin location.
 * @param {number} total
 */
function updateGauge(total) {
  const pin = document.querySelector("#gauge-pin");
  if (!pin) return;
  
  let percent = 0;
  if (total <= 300) {
    percent = (total / 300) * 30;
  } else if (total <= 700) {
    percent = 30 + ((total - 300) / 400) * 40;
  } else {
    percent = 70 + Math.min(1, (total - 700) / 300) * 28;
  }
  
  pin.style.left = `${percent}%`;
}

/**
 * Updates global benchmark comparison bars.
 * @param {number} total
 */
function updateBenchmarks(total) {
  const userBar = document.querySelector("#bench-user-bar");
  const userVal = document.querySelector("#bench-user-val");
  
  if (userVal) userVal.textContent = `${total.toLocaleString()} kg CO₂e`;
  if (userBar) {
    const pct = Math.min(100, (total / 1300) * 100);
    userBar.style.width = `${pct}%`;
  }
}

/**
 * Renders output summaries in Insights tab.
 * @param {number} totalKgCo2ePerMonth
 * @param {string} category
 */
function renderInsightsOutput(totalKgCo2ePerMonth, category) {
  const valueEl = document.querySelector("#results-value");
  const badgeEl = document.querySelector("#results-category-badge");
  const summaryEl = document.querySelector("#summary");
  
  if (valueEl) valueEl.textContent = totalKgCo2ePerMonth.toLocaleString();
  if (badgeEl) {
    badgeEl.textContent = `${category} Footprint`;
    badgeEl.setAttribute("data-category", category);
  }
  
  if (summaryEl) {
    let text = "";
    if (category === "Low") {
      text = "Excellent! Your footprint is low and sustainable. You are hitting global targets.";
    } else if (category === "Moderate") {
      text = "Your carbon footprint is moderate. Adopting a few action items can drop you to a Low rating!";
    } else {
      text = "Your carbon footprint is high. Review your travel and electricity usage in the reduction plan.";
    }
    summaryEl.textContent = text;
  }
}

/**
 * Re-calculates projected footprint reductions when items are checked.
 */
function updateProjectedSavings() {
  const checkboxes = document.querySelectorAll("#planner-checklist input[type='checkbox']");
  let totalSavings = 0;
  
  checkboxes.forEach((chk) => {
    if (chk.checked) {
      const parent = chk.closest(".action-item");
      const savings = parseFloat(parent.getAttribute("data-savings")) || 0;
      totalSavings += savings;
    }
  });

  totalSavings = Math.min(totalSavings, currentFootprintValue);
  const projectedFootprint = Math.max(0, currentFootprintValue - totalSavings);
  
  const savingsFormatted = totalSavings.toFixed(1);
  const projectedFormatted = projectedFootprint.toFixed(1);
  const percentReduction = currentFootprintValue > 0 ? ((totalSavings / currentFootprintValue) * 100).toFixed(0) : 0;
  
  // Update UI Elements
  const savingsVal = document.querySelector("#planner-savings-val");
  const projectedVal = document.querySelector("#planner-projected-val");
  const reductionPct = document.querySelector("#planner-reduction-pct");
  const progressFill = document.querySelector("#planner-progress-fill");
  
  if (savingsVal) savingsVal.textContent = `${savingsFormatted} kg`;
  if (projectedVal) projectedVal.textContent = `${projectedFormatted} kg`;
  if (reductionPct) reductionPct.textContent = `${percentReduction}%`;
  if (progressFill) progressFill.style.width = `${percentReduction}%`;

  // Milestone Alert Card
  const milestoneText = document.querySelector("#reduction-milestone-text");
  if (milestoneText) {
    if (Number(percentReduction) === 0) {
      milestoneText.textContent = "Start checking actions to see your potential carbon savings grow!";
      milestoneText.className = "action-alert-box";
    } else if (Number(percentReduction) < 15) {
      milestoneText.textContent = "Good start! Every carbon saving counts towards a healthier planet.";
      milestoneText.className = "action-alert-box milestone-reached";
    } else if (Number(percentReduction) < 40) {
      milestoneText.textContent = "Fantastic progress! You are on track to make a significant ecological difference.";
      milestoneText.className = "action-alert-box milestone-reached";
    } else {
      milestoneText.textContent = "Climate Champion! You've offset a massive portion of your carbon footprint.";
      milestoneText.className = "action-alert-box milestone-reached";
    }
  }

  // Update Leaderboard ranking
  const rankEl = document.querySelector("#leaderboard-rank");
  const scoreEl = document.querySelector("#leaderboard-score");
  const sidebarFootprint = document.querySelector("#sidebar-footprint");

  if (scoreEl) scoreEl.textContent = `${projectedFootprint.toFixed(0)} kg`;
  if (sidebarFootprint) sidebarFootprint.textContent = `${projectedFootprint.toFixed(0)} kg`;

  if (currentFootprintValue === 0) {
    if (rankEl) rankEl.textContent = "#--";
    if (scoreEl) scoreEl.textContent = "0 kg";
    if (sidebarFootprint) sidebarFootprint.textContent = "0 kg";
    return;
  }

  let rank = 25;
  if (totalSavings > 0) rank = 18;
  if (totalSavings > 25) rank = 12;
  if (totalSavings > 60) rank = 5;
  if (totalSavings > 120) rank = 2;
  
  if (rankEl) rankEl.textContent = `#${rank}`;
}

/**
 * Dynamic Action Checklist Builder.
 * @param {Array<Object>} tipsDetails
 */
function renderActionChecklist(tipsDetails) {
  const checklistContainer = document.querySelector("#planner-checklist");
  const legacyTipsList = document.querySelector("#tips");
  
  if (!checklistContainer) return;

  checklistContainer.innerHTML = "";
  if (legacyTipsList) legacyTipsList.innerHTML = "";

  if (tipsDetails.length === 0) {
    checklistContainer.innerHTML = `
      <div class="empty-state">
        <p>No carbon reduction actions available based on your input. Try adding activities to see personalized tips!</p>
      </div>
    `;
    return;
  }

  const legacyTips = getReductionTips(currentFootprintComponents);
  legacyTips.forEach((tip) => {
    const li = document.createElement("li");
    li.textContent = tip;
    if (legacyTipsList) legacyTipsList.appendChild(li);
  });

  tipsDetails.forEach((tip) => {
    const item = document.createElement("div");
    item.className = "action-item";
    item.setAttribute("data-id", tip.id);
    item.setAttribute("data-savings", tip.savings);

    item.innerHTML = `
      <div class="action-checkbox-container">
        <input type="checkbox" id="chk-${tip.id}" />
      </div>
      <div class="action-details">
        <div class="action-header-line">
          <label for="chk-${tip.id}" class="action-title">${tip.title}</label>
          <span class="action-savings-tag">-${tip.savings} kg/mo</span>
        </div>
        <p class="action-desc">${tip.description}</p>
      </div>
    `;

    const checkbox = item.querySelector("input");

    checkbox.addEventListener("change", () => {
      item.classList.toggle("checked", checkbox.checked);
      updateProjectedSavings();
    });

    item.addEventListener("click", (e) => {
      // If the click is not directly on the input or label, toggle it via programmatically clicking the input
      if (e.target !== checkbox && e.target.tagName !== "LABEL") {
        checkbox.click();
      }
    });

    checklistContainer.appendChild(item);
  });
}

/**
 * Handles Calculator Form Submissions.
 * @param {Event} event
 */
function handleCalculatorSubmit(event) {
  event.preventDefault();
  clearErrors();

  const form = event.target;
  const formData = new FormData(form);
  const rawInput = Object.fromEntries(formData.entries());

  const validation = validateInput(rawInput);

  if (!validation.valid) {
    renderErrors(validation.errors);
    return;
  }

  const result = calculateFootprint(validation.value);
  const category = categorizeFootprint(result.totalKgCo2ePerMonth);
  const tipsDetails = getTipsDetails(result.components, validation.value);

  currentFootprintValue = result.totalKgCo2ePerMonth;
  currentFootprintComponents = result.components;
  currentValidatedInput = validation.value;

  renderInsightsOutput(result.totalKgCo2ePerMonth, category);
  drawDonutChart(result.components);
  updateGauge(result.totalKgCo2ePerMonth);
  updateBenchmarks(result.totalKgCo2ePerMonth);
  
  renderActionChecklist(tipsDetails);
  updateProjectedSavings();

  for (const [key, elementId] of Object.entries(legendIds)) {
    const el = document.querySelector(elementId);
    if (!el) continue;
    
    const val = result.components[key] || 0;
    const pct = result.totalKgCo2ePerMonth > 0 ? ((val / result.totalKgCo2ePerMonth) * 100).toFixed(0) : 0;
    el.textContent = `${pct}% (${val.toFixed(0)} kg)`;
  }

  switchTab("tab-insights");

  const announceMsg = `Footprint successfully calculated: ${result.totalKgCo2ePerMonth} kg CO2e per month, rating is ${category}. Tab switched to Impact Insights.`;
  const announceArea = document.querySelector("#results");
  if (announceArea) {
    announceArea.setAttribute("aria-label", announceMsg);
  }
}

/**
 * Sets up demo data listener.
 */
function initDemoLoader() {
  const btnDemo = document.querySelector("#btn-demo");
  const form = document.querySelector("#footprint-form");
  
  if (!btnDemo || !form) return;

  btnDemo.addEventListener("click", () => {
    const demoData = {
      carKmPerWeek: "120",
      publicKmPerWeek: "40",
      electricityKwhPerMonth: "250",
      wasteKgPerWeek: "6",
      meatMealsPerWeek: "8",
    };

    for (const [key, value] of Object.entries(demoData)) {
      const input = document.getElementById(key);
      if (input) {
        input.value = value;
      }
    }

    clearErrors();
    form.dispatchEvent(new Event("submit", { cancelable: true }));
  });
}

/**
 * Smart context-aware response logic for EcoBot assistant.
 * Handles extensive natural synonyms and multi-word inputs.
 * @param {string} userQuery
 * @returns {string} Response message
 */
function generateAssistantResponse(userQuery) {
  const cleanQuery = userQuery.toLowerCase().trim();

  // Helper dictionary
  const sourceNames = {
    car: "Car Travel",
    publicTransport: "Public Transport",
    electricity: "Electricity Use",
    waste: "Waste Generation",
    food: "Diet/Food",
  };

  // Check if target matches transport synonyms
  const isTransport = cleanQuery.includes("transport") || 
                      cleanQuery.includes("transit") || 
                      cleanQuery.includes("car") || 
                      cleanQuery.includes("drive") || 
                      cleanQuery.includes("bus") || 
                      cleanQuery.includes("train") || 
                      cleanQuery.includes("commute") || 
                      cleanQuery.includes("travel") || 
                      cleanQuery.includes("vehicle") ||
                      cleanQuery.includes("driving") ||
                      cleanQuery.includes("km");

  // Check if target matches energy/electricity synonyms
  const isEnergy = cleanQuery.includes("electricity") || 
                   cleanQuery.includes("power") || 
                   cleanQuery.includes("kwh") || 
                   cleanQuery.includes("light") || 
                   cleanQuery.includes("heat") || 
                   cleanQuery.includes("energy") || 
                   cleanQuery.includes("appliances") ||
                   cleanQuery.includes("led");

  // Check if target matches food/meals synonyms
  const isFood = cleanQuery.includes("diet") || 
                 cleanQuery.includes("food") || 
                 cleanQuery.includes("meat") || 
                 cleanQuery.includes("eat") || 
                 cleanQuery.includes("meal") || 
                 cleanQuery.includes("vegan") || 
                 cleanQuery.includes("vegetarian") || 
                 cleanQuery.includes("beef") || 
                 cleanQuery.includes("chicken") ||
                 cleanQuery.includes("pork") ||
                 cleanQuery.includes("fish");

  // Check if target matches waste/compost synonyms
  const isWaste = cleanQuery.includes("waste") || 
                  cleanQuery.includes("trash") || 
                  cleanQuery.includes("recycle") || 
                  cleanQuery.includes("garbage") || 
                  cleanQuery.includes("compost") || 
                  cleanQuery.includes("plastic") || 
                  cleanQuery.includes("landfill") ||
                  cleanQuery.includes("packaging");

  // Check if target matches goal/target synonyms
  const isGoal = cleanQuery.includes("target") || 
                 cleanQuery.includes("goal") || 
                 cleanQuery.includes("suggest") || 
                 cleanQuery.includes("limit") || 
                 cleanQuery.includes("aim") || 
                 cleanQuery.includes("reduce") || 
                 cleanQuery.includes("decrease") || 
                 cleanQuery.includes("cut") ||
                 cleanQuery.includes("offset");

  // Check if target matches biggest source queries
  const isBiggest = cleanQuery.includes("biggest") || 
                    cleanQuery.includes("largest") || 
                    cleanQuery.includes("source") || 
                    cleanQuery.includes("most") || 
                    cleanQuery.includes("highest") || 
                    cleanQuery.includes("max") || 
                    cleanQuery.includes("worst") ||
                    cleanQuery.includes("high-emitting") ||
                    cleanQuery.includes("breakdown");

  // Check if target matches general greeting
  const isGreeting = cleanQuery.includes("hello") || 
                     cleanQuery.includes("hi") || 
                     cleanQuery.includes("hey") || 
                     cleanQuery.includes("greetings") || 
                     cleanQuery.includes("bot");

  // 1. Intercept queries requiring active calculation if not calculated yet
  if (currentFootprintValue === 0) {
    if (isBiggest || isTransport || isEnergy || isFood || isWaste || isGoal) {
      return "You haven't calculated your carbon footprint yet! Please head over to the **Calculator** tab, input your weekly/monthly habits (or click 'Fill Demo Data'), and I will analyze your habits.";
    }
  }

  // 2. Intent Routing

  // Intent A: Biggest emission source
  if (isBiggest) {
    const maxEntry = Object.entries(currentFootprintComponents).reduce((max, entry) => entry[1] > max[1] ? entry : max, ["", -1]);
    const percentage = currentFootprintValue > 0 ? ((maxEntry[1] / currentFootprintValue) * 100).toFixed(0) : 0;
    return `Based on your inputs, your biggest source of carbon emissions is **${sourceNames[maxEntry[0]]}** producing **${maxEntry[1]} kg CO₂e/month** (representing **${percentage}%** of your total footprint). Targeting this area in your daily habits will make the most impact!`;
  }

  // Intent B: Transport advice
  if (isTransport) {
    const carKm = currentValidatedInput?.carKmPerWeek || 0;
    const carComp = currentFootprintComponents?.car || 0;
    if (carKm > 0) {
      const carSavings = (carComp * 0.20).toFixed(1);
      return `You are driving **${carKm} km/week**, creating **${carComp.toFixed(0)} kg CO₂e/month**. Swapping just 20% of your drives with cycling, walking, or telecommuting once a week would save **${carSavings} kg CO₂e/month**. You can check this off in your **Reduction Plan** tab!`;
    }
    return "Your driving footprint is already 0! Excellent work. If you use public transit, you can save more by optimizing routes or combining trips. Walking and biking are the ultimate zero-emission alternatives.";
  }

  // Intent C: Electricity & home energy advice
  if (isEnergy) {
    const elecComp = currentFootprintComponents?.electricity || 0;
    if (elecComp > 0) {
      const savings = (elecComp * 0.15).toFixed(1);
      return `Your electricity use generates **${elecComp.toFixed(0)} kg CO₂e/month**. Unplugging standby electronics and choosing cold water washes can save 15% of your energy footprint (saving **${savings} kg CO₂e/month**).`;
    }
    return "To lower home energy emissions, consider switching to LED lighting, insulating your windows, using smart thermostats, and choosing clean renewable electricity packages where available.";
  }

  // Intent D: Food & diet advice
  if (isFood) {
    const meals = currentValidatedInput?.meatMealsPerWeek || 0;
    const foodComp = currentFootprintComponents?.food || 0;
    if (meals > 0) {
      const foodSavings = (Math.min(3, meals) * 2.5 * 4.345).toFixed(1);
      return `Your meat meal choices create **${foodComp.toFixed(0)} kg CO₂e/month**. Substituting just 3 meals a week with delicious plant-based alternatives will save **${foodSavings} kg CO₂e/month**!`;
    }
    return "Your meat meal emissions are already zero! A plant-based diet is one of the most powerful personal choices to help combat climate change, reducing water usage, soil degradation, and methane emissions.";
  }

  // Intent E: Waste & landfill advice
  if (isWaste) {
    const wasteComp = currentFootprintComponents?.waste || 0;
    if (wasteComp > 0) {
      const savings = (wasteComp * 0.30).toFixed(1);
      return `Your waste emissions total **${wasteComp.toFixed(0)} kg CO₂e/month**. Composting food scraps and buying in bulk to reduce single-use plastic packaging will save **${savings} kg CO₂e/month** (30% savings).`;
    }
    return "Methane generated from organic food materials rotting in landfills is a potent greenhouse gas. Composting, reusing items, and buying items with zero-packaging are fantastic waste-reduction habits.";
  }

  // Intent F: Goal & target suggesting
  if (isGoal) {
    const target = (currentFootprintValue * 0.80).toFixed(0);
    const savings = (currentFootprintValue * 0.20).toFixed(0);
    return `Your current footprint is **${currentFootprintValue.toFixed(0)} kg CO₂e/month**. I suggest setting a 20% reduction goal to reach **${target} kg/month**, which offsets **${savings} kg** of carbon. You can achieve this easily by adopting the composting and LED lighting recommendations in your **Reduction Plan**!`;
  }

  // Intent G: Greetings & General bot identification
  if (isGreeting) {
    return "Hello! I am EcoBot, your smart climate advisor. Ask me questions about your carbon footprint, suggestions for targets, biggest sources, or advice on energy, transport, and diet!";
  }

  // Intent H: Leaderboard preview query
  if (cleanQuery.includes("leaderboard") || cleanQuery.includes("rank") || cleanQuery.includes("score")) {
    return "Your leaderboard ranking is based on your projected footprint. By checking off target actions in your **Reduction Plan**, your score decreases and your rank climbs in real-time!";
  }

  // Intent I: Fallback general advice query
  if (cleanQuery.includes("tip") || cleanQuery.includes("advice") || cleanQuery.includes("general") || cleanQuery.includes("help") || cleanQuery.includes("guide") || cleanQuery.includes("info")) {
    return `Here are highly effective habits to cut down carbon:
    1. **Food**: Switch 3 meat meals a week to plant-based options (saves up to 32 kg CO₂e/month).
    2. **Energy**: Switch to LED bulbs, unplug standby appliances, and wash clothes in cold water.
    3. **Waste**: Compost organic wastes. Decomposition in landfills produces methane, which is 28x more damaging than CO₂.`;
  }

  // Fallback response for unmapped questions
  return "I'm not sure I understand that query. You can ask about 'biggest source', 'transport advice', 'suggest a goal', 'diet', 'waste', 'electricity', or select one of the quick suggestions below!";
}

/**
 * Initializes and wires up the chatbot EcoBot.
 */
function initAssistant() {
  const chatForm = document.querySelector("#chat-form");
  const chatInput = document.querySelector("#chat-input");
  const chatMessages = document.querySelector("#chat-messages");
  const suggestionContainer = document.querySelector("#chat-suggestions");

  if (!chatForm || !chatInput || !chatMessages) return;

  // Append message to bubble area
  const appendMessage = (sender, text) => {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = `<div class="message-bubble">${text}</div>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
  };

  // Handle bot reply with simulated typing delay
  const handleQuery = (queryText) => {
    // 1. Append User message
    appendMessage("user", queryText);

    // 2. Append Typing Indicator
    const typingIndicator = document.createElement("div");
    typingIndicator.className = "message assistant typing-indicator-item";
    typingIndicator.innerHTML = `
      <div class="message-bubble">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 3. Delay and trigger response
    setTimeout(() => {
      typingIndicator.remove();
      const botResponse = generateAssistantResponse(queryText);
      appendMessage("assistant", botResponse);
    }, 600);
  };

  // Form submission
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = chatInput.value.trim();
    if (!query) return;

    chatInput.value = "";
    handleQuery(query);
  });

  // Suggestion chips click events
  if (suggestionContainer) {
    suggestionContainer.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      
      // Send the exact readable suggestion text in the chat bubble
      const queryText = chip.textContent;
      handleQuery(queryText);
    });
  }
}

// Wire up events once DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  initDemoLoader();
  initAssistant();

  const form = document.querySelector("#footprint-form");
  if (form) {
    form.addEventListener("submit", handleCalculatorSubmit);
  }

  const gotoCalcBtn = document.querySelector("#btn-goto-calculator");
  if (gotoCalcBtn) {
    gotoCalcBtn.addEventListener("click", () => {
      switchTab("tab-calculator");
    });
  }
});
