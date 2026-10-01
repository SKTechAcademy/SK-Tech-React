// dashboard.js
// Public interview dashboard for SK Tech Academy.
let dashboardRequestController = null;
let dashboardRows = [];
let dashboardUpcoming = [];
let dashboardLoaded = false;
let dashboardLoadSequence = 0;
const DASHBOARD_CACHE_KEY = "sktechInterviewCacheV1";
const DASHBOARD_CACHE_MAX_AGE = 6 * 60 * 60 * 1000;

function updateTodayCalendarIcon() {
  const now = new Date();
  setText("calendarMonth", now.toLocaleDateString("en-IN", { month: "short" }).toUpperCase());
  setText("calendarDay", String(now.getDate()));
}

function renderActiveInterviewTab() {
  const activeBtn = document.querySelector(".tab-btn.active");
  const activeTab = activeBtn ? activeBtn.getAttribute("data-tab") : "all";
  // Seven days guarantees that Saturday and Sunday availability is always visible.
  renderTable(filterByTab(dashboardRows, activeTab, dashboardUpcoming, 7));
}

function renderTable(data) {
  const table = document.getElementById("tableBody");
  table.innerHTML = "";

  if (data.length === 0) {
    showEmpty("tableBody", "No interviews found for this tab.", 6);
    return;
  }

  for (let i = 0; i < data.length; i++) {
    const obj = data[i];
    const item = obj.item || obj;
    const rowClass = obj.rowClass || "";

    let row = "<tr";
    if (rowClass) {
      row += " class=\"" + rowClass + "\"";
    }
    row += ">";

    row += '<td data-label="ID">' + escapeHtml(item["Sk Tech Register ID"] || "") + "</td>";
    row += '<td data-label="Round">' + escapeHtml(item["Round"] || "") + "</td>";
    const dateLabel = obj.dateLabel || "Upcoming";
    row += '<td data-label="Date"><span class="date-badge">' + escapeHtml(dateLabel) + '</span><span class="date-value">' + escapeHtml(formatDate(item["Interview Date"])) + "</span></td>";
    row += '<td data-label="From">' + escapeHtml(formatTime(item["Interview Time (From)  or  If Time Not confirmed plz select 00:00 like Assessment"])) + "</td>";
    row += '<td data-label="To">' + escapeHtml(formatTime(item["Interview Time (To) or  If Time Not confirmed plz select 00:00 like Assessment"])) + "</td>";
    row += '<td data-label="Batch">' + escapeHtml(item["Batch"] || "") + "</td>";

    row += "</tr>";
    table.innerHTML += row;
  }
}

function isWeekend(dateOnly) {
  return !!dateOnly && (dateOnly.getDay() === 0 || dateOnly.getDay() === 6);
}

function getWeekdayLabel(dateOnly) {
  if (!dateOnly) return "Upcoming";
  return dateOnly.toLocaleDateString("en-IN", { weekday: "long" });
}

function isPanelUnavailable(item) {
  const searchable = [
    item["Round"], item["Status"], item["Remarks"], item[" Technologies Required"]
  ].join(" ").toLowerCase();
  const mentionsSupport = /panel|pannel|supporter|support/.test(searchable);
  const mentionsUnavailable = /not\s*(available|avaible)|unavailable|not\s*avail/.test(searchable);
  return mentionsSupport && mentionsUnavailable;
}

function classifyRows(upcoming) {
  const today = getToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);
  const conflictIndices = findConflicts(upcoming);

  const rows = [];
  for (let i = 0; i < upcoming.length; i++) {
    const itm = upcoming[i];
    const dateOnly = getDateOnly(itm["Interview Date"]);
    let rowClass = "";
    let dateLabel = "Later";
    if (isPanelUnavailable(itm) || isWeekend(dateOnly)) {
      rowClass = "unavailable-row";
      dateLabel = isWeekend(dateOnly) ? "Weekend Closed" : "Panel Unavailable";
    } else if (conflictIndices.has(i)) {
      rowClass = "conflict-row";
      dateLabel = "Conflict";
    } else if (dateOnly && dateOnly.getTime() === today.getTime()) {
      rowClass = "today-row";
      dateLabel = "Today";
    } else if (dateOnly && dateOnly.getTime() === tomorrow.getTime()) {
      rowClass = "tomorrow-row";
      dateLabel = "Tomorrow";
    } else if (dateOnly && dateOnly.getTime() === dayAfterTomorrow.getTime()) {
      rowClass = "day-after-row";
      dateLabel = getWeekdayLabel(dateOnly);
    } else {
      rowClass = "future-row";
      dateLabel = getWeekdayLabel(dateOnly);
    }
    rows.push({ item: itm, rowClass: rowClass, dateOnly: dateOnly, dateLabel: dateLabel });
  }
  return rows;
}

const OPEN_MINUTES = 7 * 60; // 7:00 AM
const CLOSE_MINUTES = 24 * 60; // 12:00 AM (midnight)
const SLOT_MINUTES = 30;

function minutesToTimeStr(minutes) {
  if (minutes === 24 * 60) return "12:00 am";
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function createAvailableSlot(dateObj, startMinutes, endMinutes, isToday) {
  return {
    item: {
      "Sk Tech Register ID": "Available",
      "Round": "",
      "Interview Date": dateObj,
      "Interview Time (From)  or  If Time Not confirmed plz select 00:00 like Assessment": minutesToTimeStr(startMinutes),
      "Interview Time (To) or  If Time Not confirmed plz select 00:00 like Assessment": minutesToTimeStr(endMinutes),
      "Batch": ""
    },
    rowClass: isToday ? "today-available-row" : "future-available-row",
    dateOnly: dateObj
  };
}

function createBookedSlot(dateObj, startMinutes, endMinutes, item) {
  const unavailable = isPanelUnavailable(item);
  return {
    item: {
      "Sk Tech Register ID": item["Sk Tech Register ID"] || "Booked",
      "Round": item["Round"] || "",
      "Interview Date": dateObj,
      "Interview Time (From)  or  If Time Not confirmed plz select 00:00 like Assessment": minutesToTimeStr(startMinutes),
      "Interview Time (To) or  If Time Not confirmed plz select 00:00 like Assessment": minutesToTimeStr(endMinutes),
      "Batch": item["Batch"] || ""
    },
    rowClass: unavailable ? "unavailable-row" : "booked-row",
    dateOnly: dateObj,
    dateLabel: unavailable ? "Panel Unavailable" : "Booked"
  };
}

function createWeekendUnavailableSlot(dateObj) {
  return {
    item: {
      "Sk Tech Register ID": "Unavailable",
      "Round": "Panel support not available (Weekend)",
      "Interview Date": dateObj,
      "Interview Time (From)  or  If Time Not confirmed plz select 00:00 like Assessment": minutesToTimeStr(OPEN_MINUTES),
      "Interview Time (To) or  If Time Not confirmed plz select 00:00 like Assessment": minutesToTimeStr(CLOSE_MINUTES),
      "Batch": "-"
    },
    rowClass: "unavailable-row",
    dateOnly: dateObj,
    dateLabel: "Weekend Closed"
  };
}

function getAvailableSlots(upcoming, daysToShow) {
  const slots = [];
  const today = getToday();
  const bookedSlots = upcoming.filter(function(item) {
    return (item["Sk Tech Register ID"] || "").toString().trim();
  });
  const dates = [];

  // Build list of dates: today + next daysToShow-1 days, plus any dates from data
  const dateSet = new Set();
  for (let i = 0; i < (daysToShow || 5); i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dateSet.add(d.getTime());
  }
  upcoming.forEach(function(item) {
    const dateOnly = getDateOnly(item["Interview Date"]);
    if (dateOnly) dateSet.add(dateOnly.getTime());
  });
  dateSet.forEach(function(t) { dates.push(new Date(t)); });
  dates.sort(function(a, b) { return a.getTime() - b.getTime(); });

  dates.forEach(function(dateObj) {
    const dateTime = dateObj.getTime();
    const isToday = dateTime === today.getTime();

    // Get current time in minutes for filtering past slots
    const now = new Date();
    const currentMinutes = isToday ? (now.getHours() * 60 + now.getMinutes()) : 0;

    // Get booked slots for this date, sorted by start time
    const dayBooked = bookedSlots
      .map(function(item) {
        return {
          item: item,
          start: toMinutes(item["Interview Time (From)  or  If Time Not confirmed plz select 00:00 like Assessment"]),
          end: toMinutes(item["Interview Time (To) or  If Time Not confirmed plz select 00:00 like Assessment"])
        };
      })
      .filter(function(slot) {
        const itemDate = getDateOnly(slot.item["Interview Date"]);
        return itemDate && itemDate.getTime() === dateTime && slot.start > 0 && slot.end > 0;
      })
      .sort(function(a, b) { return a.start - b.start; });

    // Weekends remain closed, but real Sheet bookings must still be visible.
    if (isWeekend(dateObj)) {
      slots.push(createWeekendUnavailableSlot(dateObj));
      dayBooked.forEach(function(slot) {
        slots.push(createBookedSlot(dateObj, slot.start, slot.end, slot.item));
      });
      return;
    }

    // Merge overlapping/adjacent booked slots
    const merged = [];
    dayBooked.forEach(function(slot) {
      if (merged.length === 0) {
        merged.push(slot);
      } else {
        const last = merged[merged.length - 1];
        if (slot.start <= last.end) {
          last.end = Math.max(last.end, slot.end);
        } else {
          merged.push(slot);
        }
      }
    });

    // Generate free 1-hour slots and booked slot rows between operating hours
    // For today, start from next 30-minute interval; for future dates, start from opening time
    let current = OPEN_MINUTES;
    if (isToday) {
      // Round up to next 30-minute interval
      const nextSlot = Math.ceil(currentMinutes / SLOT_MINUTES) * SLOT_MINUTES;
      current = Math.max(OPEN_MINUTES, nextSlot);
    }
    merged.forEach(function(slot) {
      while (current + SLOT_MINUTES <= slot.start) {
        slots.push(createAvailableSlot(dateObj, current, current + SLOT_MINUTES, isToday));
        current += SLOT_MINUTES;
      }
      // Show the booked slot row itself in red
      const bookedStart = Math.max(slot.start, OPEN_MINUTES);
      const bookedEnd = Math.min(slot.end, CLOSE_MINUTES);
      if (bookedStart < bookedEnd) {
        slots.push(createBookedSlot(dateObj, bookedStart, bookedEnd, slot.item));
      }
      if (current < slot.end) {
        current = slot.end;
      }
    });
    while (current + SLOT_MINUTES <= CLOSE_MINUTES) {
      slots.push(createAvailableSlot(dateObj, current, current + SLOT_MINUTES, isToday));
      current += SLOT_MINUTES;
    }
  });

  return slots;
}

function filterByTab(rows, tab, upcoming, daysToShow) {
  const today = getToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (tab === "today") {
    return rows.filter(function(r) { return r.dateOnly && r.dateOnly.getTime() === today.getTime(); });
  }
  if (tab === "tomorrow") {
    return rows.filter(function(r) { return r.dateOnly && r.dateOnly.getTime() === tomorrow.getTime(); });
  }
  if (tab === "available") {
    return getAvailableSlots(upcoming, daysToShow || 2);
  }
  return rows;
}

function applyDashboardData(data, cached) {
  if (!Array.isArray(data)) throw new Error("Unexpected response from server");
  let result = filterUpcoming(data);
  let upcoming = sortByDateTime(result.upcoming);
  dashboardUpcoming = upcoming;
  dashboardRows = classifyRows(upcoming);
  dashboardLoaded = true;
  setText("totalCount", upcoming.length);
  setText("todayCount", result.todayCount);
  renderActiveInterviewTab();
  const updated = document.getElementById("lastUpdated");
  if (updated) updated.textContent = cached ? "Showing saved data • Refreshing…" : "Updated " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function restoreDashboardCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(DASHBOARD_CACHE_KEY) || "null");
    if (cached && Array.isArray(cached.data) && Date.now() - cached.savedAt < DASHBOARD_CACHE_MAX_AGE) {
      applyDashboardData(cached.data, true);
      return true;
    }
  } catch (error) {
    console.warn("Dashboard cache unavailable:", error);
  }
  return false;
}

function waitBeforeRetry(milliseconds) {
  return new Promise(function(resolve) { setTimeout(resolve, milliseconds); });
}

async function loadData() {
  const tableBody = document.getElementById("tableBody");
  if (!dashboardLoaded && tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="load-state"><div class="state-spinner" aria-hidden="true"></div><div>Loading latest interview schedule…</div><small>Connecting securely to the schedule…</small></td></tr>';
  const updated = document.getElementById("lastUpdated");
  if (dashboardLoaded && updated) updated.textContent = "Refreshing… current data remains visible";

  dashboardLoadSequence += 1;
  const sequence = dashboardLoadSequence;
  if (dashboardRequestController) dashboardRequestController.abort();
  let lastError = new Error("Unable to reach the schedule server");

  for (let attempt = 0; attempt < 3; attempt++) {
    if (sequence !== dashboardLoadSequence) return;
    dashboardRequestController = new AbortController();
    const currentController = dashboardRequestController;
    const timeoutId = setTimeout(function() { currentController.abort(); }, 20000 + attempt * 5000);
    try {
      const response = await fetch(API_URL, { signal: currentController.signal, cache: "default" });
      if (!response.ok) throw new Error("Server returned " + response.status);
      const responseData = await response.json();
      const data = Array.isArray(responseData) ? responseData.filter(function(item) {
        return String(item["Full Name"] || "").trim().toLowerCase() !== "system qa check";
      }) : responseData;
      if (sequence !== dashboardLoadSequence) return;
      applyDashboardData(data, false);
      try { localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: data })); } catch (cacheError) { console.warn("Could not save dashboard cache:", cacheError); }
      clearTimeout(timeoutId);
      return;
    } catch (error) {
      clearTimeout(timeoutId);
      if (sequence !== dashboardLoadSequence) return;
      lastError = error.name === "AbortError" ? new Error("The server took too long to respond") : error;
      if (attempt < 2) await waitBeforeRetry(1000 * (attempt + 1));
    }
  }

  console.error("Dashboard refresh failed:", lastError);
  if (dashboardLoaded) {
    renderActiveInterviewTab();
    if (updated) updated.textContent = "Connection slow • Showing last loaded data";
  } else if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="6" class="load-state">Unable to load interview data after automatic retries.<br><small>' + escapeHtml(lastError.message) + '</small><br><button class="retry-btn" type="button" onclick="loadData()">Try again</button></td></tr>';
  }
}

function showInterviewTable() {
  const table = document.querySelector("table");
  const tableShell = document.querySelector(".table-shell");
  const jobsContainer = document.getElementById("jobsContainer");
  if (tableShell) tableShell.style.display = "block";
  if (table) table.style.display = "table";
  if (jobsContainer) jobsContainer.style.display = "none";
}

function showJobsContainer() {
  const table = document.querySelector("table");
  const tableShell = document.querySelector(".table-shell");
  const jobsContainer = document.getElementById("jobsContainer");
  if (tableShell) tableShell.style.display = "none";
  if (table) table.style.display = "table";
  if (jobsContainer) jobsContainer.style.display = "block";
  if (typeof loadJobs === "function") {
    loadJobs();
  }
}

function switchInterviewTab(tabName) {
  activateDashboardTab(tabName, true);
}

function activateDashboardTab(tabName, updateUrl) {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(function(btn) { btn.classList.remove("active"); });
  const target = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
  if (target) target.classList.add("active");
  // HTMLPreview embeds the GitHub file URL inside its query string and rejects
  // history mutations. Never let an optional URL update stop tab switching.
  if (updateUrl && history.replaceState && location.hostname !== "htmlpreview.github.io") {
    try {
      history.replaceState(null, "", tabName === "all" ? location.pathname + location.search : "#" + tabName);
    } catch (historyError) {
      console.warn("Could not update the dashboard URL:", historyError);
    }
  }
  if (tabName === "jobs") {
    if (typeof window.skTrack === "function") window.skTrack("job_openings_view");
    if (typeof jobsAgeFilter !== "undefined") jobsAgeFilter = "all";
    showJobsContainer();
  } else {
    showInterviewTable();
    if (dashboardLoaded) renderActiveInterviewTab(); else loadData();
  }
}

function initTabs() {
  const tabBar = document.querySelector(".tabs");
  if (!tabBar) return;
  tabBar.addEventListener("click", function(event) {
    const btn = event.target.closest(".tab-btn");
    if (!btn || !tabBar.contains(btn)) return;
    event.preventDefault();
    activateDashboardTab(btn.getAttribute("data-tab"), true);
  });
}

function openTabFromLocation() {
  const requested = location.hash.replace("#", "").toLowerCase();
  if (requested !== "jobs" && requested !== "jobopenings") return;
  activateDashboardTab("jobs", false);
  requestAnimationFrame(function() {
    const jobs = document.getElementById("jobsContainer");
    if (jobs) jobs.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

window.switchInterviewTab = switchInterviewTab;

restoreDashboardCache();
loadData();
updateTodayCalendarIcon();
initTabs();
if (location.hash === "#jobs" || location.hash.toLowerCase() === "#jobopenings") openTabFromLocation(); else showInterviewTable();
window.addEventListener("hashchange", openTabFromLocation);
setInterval(function() {
  const activeBtn = document.querySelector(".tab-btn.active");
  if (activeBtn && activeBtn.getAttribute("data-tab") !== "jobs") {
    loadData();
  }
}, 60000);
