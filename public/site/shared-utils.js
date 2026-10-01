/**
 * shared-utils.js
 * Common helpers used by admin.js, candidate.js, and dashboard.js.
 */

const API_URL = "https://script.google.com/macros/s/AKfycbwxpMoYA7gmul9iMk9eA2Cae07sxynCp6Ff73BhXFAdJoOMBmNzZP2-5ck2qRyqjm7W/exec";

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString("en-IN");
}

function parseTimeString(str) {
  const lower = str.toLowerCase().trim();
  const match = lower.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3] || "";
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function formatTime(val) {
  if (!val) return "";
  const str = val.toString().trim();
  if (str === "00:00" || str === "0:00") return "";

  // Try full date/time first
  const d = new Date(str);
  if (!isNaN(d)) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  // Parse plain time string like "10:30 am" or "14:30"
  const parsed = parseTimeString(str);
  if (!parsed) return str;

  const date = new Date();
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatTimeRange(from, to) {
  const fromStr = formatTime(from);
  const toStr = formatTime(to);
  if (!fromStr && !toStr) return "Not confirmed";
  if (!fromStr) return toStr;
  if (!toStr) return fromStr;
  return fromStr + " - " + toStr;
}

function toMinutes(timeStr) {
  if (!timeStr) return 0;
  const str = timeStr.toString().trim().toLowerCase();
  if (str === "00:00" || str === "0:00") return 0;

  // Try full date/time first
  const d = new Date(str);
  if (!isNaN(d)) {
    return d.getHours() * 60 + d.getMinutes();
  }

  // Parse plain time string
  const parsed = parseTimeString(str);
  if (!parsed) return 0;
  return parsed.hour * 60 + parsed.minute;
}

function getDateOnly(val) {
  const d = new Date(val);
  if (isNaN(d)) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function filterUpcoming(data) {
  const today = getToday();
  const upcoming = [];
  let todayCount = 0;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const dateOnly = getDateOnly(item["Interview Date"]);
    if (!dateOnly) continue;
    if (dateOnly >= today) {
      upcoming.push(item);
      if (dateOnly.getTime() === today.getTime()) {
        todayCount++;
      }
    }
  }
  return { upcoming, todayCount };
}

function sortByDateTime(items) {
  return items.slice().sort(function(a, b) {
    const dateA = getDateOnly(a["Interview Date"]);
    const dateB = getDateOnly(b["Interview Date"]);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    const dateDiff = dateA.getTime() - dateB.getTime();
    if (dateDiff !== 0) return dateDiff;
    const timeA = toMinutes(a["Interview Time (From)  or  If Time Not confirmed plz select 00:00 like Assessment"]);
    const timeB = toMinutes(b["Interview Time (From)  or  If Time Not confirmed plz select 00:00 like Assessment"]);
    return timeA - timeB;
  });
}

function findConflicts(upcoming) {
  const conflictIndices = new Set();
  for (let i = 0; i < upcoming.length; i++) {
    const item1 = upcoming[i];
    const dateOnly1 = getDateOnly(item1["Interview Date"]);
    if (!dateOnly1) continue;
    const start1 = toMinutes(item1["Interview Time (From)  or  If Time Not confirmed plz select 00:00 like Assessment"]);
    const end1 = toMinutes(item1["Interview Time (To) or  If Time Not confirmed plz select 00:00 like Assessment"]);
    for (let j = i + 1; j < upcoming.length; j++) {
      const item2 = upcoming[j];
      const dateOnly2 = getDateOnly(item2["Interview Date"]);
      if (!dateOnly2 || dateOnly1.getTime() !== dateOnly2.getTime()) continue;
      const start2 = toMinutes(item2["Interview Time (From)  or  If Time Not confirmed plz select 00:00 like Assessment"]);
      const end2 = toMinutes(item2["Interview Time (To) or  If Time Not confirmed plz select 00:00 like Assessment"]);
      if (start1 < end2 && start2 < end1) {
        conflictIndices.add(i);
        conflictIndices.add(j);
      }
    }
  }
  return conflictIndices;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function showLoading(containerId, colspan) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<tr><td colspan="' + (colspan || 10) + '" class="loading-row">Loading data...</td></tr>';
}

function showError(containerId, message, colspan) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<tr><td colspan="' + (colspan || 10) + '" class="error-row">' + escapeHtml(message) + '</td></tr>';
}

function showEmpty(containerId, message, colspan) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<tr><td colspan="' + (colspan || 10) + '" class="empty-row">' + escapeHtml(message) + '</td></tr>';
}
