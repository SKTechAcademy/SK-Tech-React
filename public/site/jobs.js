/**
 * jobs.js
 * Dynamic Job Openings section for interviews.html.
 * Fetches job data from a published Google Sheet CSV and renders cards.
 * Includes WhatsApp share, Instagram caption generator, and apply logic.
 */

const JOBS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZ_q6CAt5GAQQ-Yr4dQVNGOT3R2UruLuxWYJn1TeBMnkWtQH9jiF4fbvqcxlHRZg_Zy0SHZd70Mp3n/pub?gid=800448316&single=true&output=csv";

let jobsData = [];
let jobsLoaded = false;
let jobsAgeFilter = "all"; // all, new, old
let jobsSearchQuery = "";
let jobsTypeFilter = "";
let jobsSort = "newest";
const JOBS_PAGE_SIZE = 10;
let jobsPage = 1;

/**
 * Simple CSV parser that handles quoted fields and commas inside quotes.
 */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(function(h) { return h.trim(); });
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 1 && values[0].trim() === "") continue;

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] || "").trim();
    }
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  values.push(current);
  return values;
}

function normalizeJob(job) {
  return {
    companyName: job["Company Name"] || "",
    jobId: job["Job ID"] || "",
    title: job["Job Title"] || "",
    experience: job["Experience"] || "",
    location: job["Location"] || "",
    skills: job["Skills"] || "",
    employmentType: job["Employment Type"] || "",
    salary: job["Salary"] || "",
    description: job["Description"] || "",
    applyLink: job["Apply Link (Optional)"] || "",
    hrEmail: job["HR Email (Optional)"] || "",
    whatsappGroup: job["WhatsApp Group (Optional)"] || "",
    status: job["Status"] || "",
    postedDate: job["Posted Date"] || ""
  };
}

function parseDateInput(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // ISO format: 2026-07-04
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str + "T00:00:00");
  }

  // Slash format: 2026/07/04
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) {
    return new Date(str.replace(/\//g, "-") + "T00:00:00");
  }

  // DD/MM/YYYY or MM/DD/YYYY: 04/07/2026 or 04-07-2026
  const euroMatch = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (euroMatch) {
    const first = parseInt(euroMatch[1], 10);
    const second = parseInt(euroMatch[2], 10);
    // If second number > 12, it must be a DD/MM/YYYY-style month
    if (second > 12) {
      return new Date(euroMatch[3], second - 1, first);
    }
    // Default to DD/MM/YYYY (Indian format) when ambiguous
    return new Date(euroMatch[3], second - 1, first);
  }

  // Month name formats: 4 Jul 2026, July 4 2026, Jul 4, 2026
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

function isNewJob(postedDate) {
  const posted = parseDateInput(postedDate);
  if (!posted || isNaN(posted.getTime())) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfPosted = new Date(posted.getFullYear(), posted.getMonth(), posted.getDate());
  const diffDays = Math.abs((startOfToday - startOfPosted) / (1000 * 60 * 60 * 24));

  // New if posted within 7 days before or after today
  return diffDays <= 7;
}

function getJobIcon(title) {
  const lower = (title || "").toLowerCase();
  if (lower.indexOf(".net") !== -1) return { emoji: "🖥️", class: "dev" };
  if (lower.indexOf("front end") !== -1 || lower.indexOf("frontend") !== -1 || lower.indexOf("angular") !== -1 || lower.indexOf("react") !== -1) return { emoji: "🌐", class: "web" };
  if (lower.indexOf("mobile") !== -1 || lower.indexOf("flutter") !== -1 || lower.indexOf("android") !== -1 || lower.indexOf("ios") !== -1) return { emoji: "📱", class: "mobile" };
  if (lower.indexOf("cloud") !== -1 || lower.indexOf("aws") !== -1 || lower.indexOf("azure") !== -1 || lower.indexOf("devops") !== -1) return { emoji: "☁️", class: "cloud" };
  if (lower.indexOf("qa") !== -1 || lower.indexOf("test") !== -1 || lower.indexOf("selenium") !== -1) return { emoji: "🐞", class: "qa" };
  if (lower.indexOf("data") !== -1 || lower.indexOf("analyst") !== -1 || lower.indexOf("engineer") !== -1 && lower.indexOf("cloud") === -1) return { emoji: "📊", class: "data" };
  return { emoji: "💼", class: "default" };
}

function escapeHtmlText(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildJobCard(job) {
  const icon = getJobIcon(job.title);
  const safeTitle = escapeHtmlText(job.title);
  const safeCompany = escapeHtmlText(job.companyName);
  const safeExperience = escapeHtmlText(job.experience);
  const safeLocation = escapeHtmlText(job.location);
  const safeType = escapeHtmlText(job.employmentType);
  const safeSalary = escapeHtmlText(job.salary);
  const safeDescription = escapeHtmlText(job.description);
  const safeSkills = escapeHtmlText(job.skills);

  const isNew = isNewJob(job.postedDate);
  const ageClass = isNew ? "job-card-new" : "job-card-old";
  const ageBadge = isNew ? '<span class="job-age-badge new">New</span>' : '<span class="job-age-badge old">Old</span>';

  const card = document.createElement("div");
  card.className = "job-card " + ageClass;
  card.innerHTML =
    ageBadge +
    '<div class="job-card-header">' +
      '<div class="job-icon ' + icon.class + '">' + icon.emoji + '</div>' +
      '<div class="job-title-wrap">' +
        '<div class="job-title">' + safeTitle + '</div>' +
        '<div class="job-company">' + safeCompany + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="job-meta">' +
      '<div class="job-meta-item"><span>📅</span> ' + safeExperience + '</div>' +
      '<div class="job-meta-item"><span>📍</span> ' + safeLocation + '</div>' +
      (safeSalary ? '<div class="job-meta-item"><span>💰</span> ' + safeSalary + '</div>' : '') +
    '</div>' +
    '<div class="job-type-badge">' + (safeType || "Full Time") + '</div>' +
    '<div class="job-description">' + safeDescription + '</div>' +
    '<div class="job-skills"><strong>Skills:</strong> ' + safeSkills + '</div>' +
    '<div class="job-actions">' +
      '<button class="job-btn job-btn-primary" onclick="viewJobDetails(\'' + job.jobId + '\')">View Details</button>' +
      '<button class="job-btn job-btn-secondary" onclick="applyForJob(\'' + job.jobId + '\')">Apply Now</button>' +
    '</div>' +
    '<div class="job-share-actions">' +
      '<button class="job-share-btn whatsapp" onclick="shareJobWhatsApp(\'' + job.jobId + '\')">WhatsApp</button>' +
      '<button class="job-share-btn instagram" onclick="generateInstagramPost(\'' + job.jobId + '\')">Instagram</button>' +
    '</div>';

  return card;
}

function findJobById(jobId) {
  for (let i = 0; i < jobsData.length; i++) {
    if (jobsData[i].jobId === jobId) return jobsData[i];
  }
  return null;
}

function setJobsLoading() {
  const grid = document.getElementById("jobsGrid");
  if (grid) {
    grid.innerHTML = '<div class="jobs-loading">Loading job openings...</div>';
  }
}

function setJobsError(message) {
  const grid = document.getElementById("jobsGrid");
  if (grid) {
    grid.innerHTML = '<div class="jobs-error">' + escapeHtmlText(message) + '</div>';
  }
}

function setJobsEmpty(message) {
  const grid = document.getElementById("jobsGrid");
  if (grid) {
    grid.innerHTML = '<div class="jobs-empty">' + escapeHtmlText(message) + '</div>';
  }
}

let jobsRequest = null;
let requestedJobOpened = false;

function openRequestedJob() {
  if (requestedJobOpened || !document.getElementById("jobModal")) return;
  const id = new URLSearchParams(location.search).get("job");
  if (id && findJobById(id)) {
    requestedJobOpened = true;
    viewJobDetails(id);
  }
}

function jobsNotice(message, retry) {
  let notice = document.getElementById("jobsNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "jobsNotice";
    notice.setAttribute("role", "status");
    document.getElementById("jobsGrid").before(notice);
  }
  notice.replaceChildren();
  notice.textContent = message;
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "refresh-btn";
    button.textContent = "Retry loading jobs";
    button.addEventListener("click", function() { loadJobs(true); });
    notice.appendChild(button);
  }
}

function acceptJobRows(rows) {
  jobsData = rows.map(normalizeJob).filter(function(job) {
    return job.status.toLowerCase() === "active";
  });
  jobsLoaded = true;
  populateJobTypes();
  renderJobs();
  openRequestedJob();
}

function loadJobs(force) {
  if (jobsRequest) return jobsRequest;
  if (jobsLoaded && !force) {
    renderJobs();
    openRequestedJob();
    return Promise.resolve();
  }
  if (!jobsLoaded) {
    try {
      const cached = JSON.parse(localStorage.getItem("skHomeJobs") || "null");
      if (cached && Array.isArray(cached.rows) && Date.now() - cached.time < 21600000) {
        acceptJobRows(cached.rows);
        jobsNotice("Showing saved jobs while checking for updates.", false);
      }
    } catch (error) { /* Storage may be disabled; live loading still works. */ }
  }
  if (!jobsLoaded) setJobsLoading();
  jobsRequest = (async function() {
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(function() { controller.abort(); }, 15000);
      try {
        const url = new URL(JOBS_CSV_URL);
        url.searchParams.set("t", String(Date.now()));
        const response = await fetch(url.href, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const csvText = await response.text();
        const headers = parseCsvLine(csvText.split(/\r?\n/)[0]).map(function(h) { return h.trim(); });
        if (!headers.includes("Job ID") || !headers.includes("Status")) throw new Error("Invalid jobs response");
        const rows = parseCsv(csvText);
        acceptJobRows(rows);
        try { localStorage.setItem("skHomeJobs", JSON.stringify({ time: Date.now(), rows: rows })); } catch (error) {}
        jobsNotice("", false);
        const id = new URLSearchParams(location.search).get("job");
        if (id && !findJobById(id)) jobsNotice("This opening is no longer available. Browse the current jobs below.", false);
        return;
      } catch (error) {
        if (attempt === 2) {
          if (!jobsLoaded) setJobsError("Unable to load jobs right now. Please retry.");
          jobsNotice(jobsLoaded ? "Live updates are unavailable. Showing saved jobs; availability may have changed. " : "", true);
        }
      } finally { clearTimeout(timeout); }
      await new Promise(function(resolve) { setTimeout(resolve, 1000 * (attempt + 1)); });
    }
  })().finally(function() { jobsRequest = null; });
  return jobsRequest;
}
document.addEventListener("DOMContentLoaded", openRequestedJob);

function updateJobCounts() {
  let newCount = 0;
  let oldCount = 0;
  for (let i = 0; i < jobsData.length; i++) {
    if (isNewJob(jobsData[i].postedDate)) {
      newCount++;
    } else {
      oldCount++;
    }
  }
  const newEl = document.getElementById("newJobsCount");
  const oldEl = document.getElementById("oldJobsCount");
  if (newEl) newEl.textContent = newCount;
  if (oldEl) oldEl.textContent = oldCount;
}

function filterJobsByAge(age) {
  jobsAgeFilter = age;
  jobsPage = 1;
  if (typeof window.skTrack === "function") window.skTrack("job_age_filter", { age_group: age });

  // Switch to Job Openings tab visually
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(function(btn) { btn.classList.remove("active"); });
  const jobsTab = document.querySelector('.tab-btn[data-tab="jobs"]');
  if (jobsTab) jobsTab.classList.add("active");

  if (typeof showJobsContainer === "function") {
    showJobsContainer();
  }

  renderJobs();
}

function renderJobs() {
  const grid = document.getElementById("jobsGrid");
  if (!grid) return;

  grid.innerHTML = "";
  updateJobCounts();

  let filtered = jobsData;
  if (jobsAgeFilter === "new") {
    filtered = jobsData.filter(function(job) { return isNewJob(job.postedDate); });
  } else if (jobsAgeFilter === "old") {
    filtered = jobsData.filter(function(job) { return !isNewJob(job.postedDate); });
  }

  if (jobsSearchQuery) {
    filtered = filtered.filter(function(job) {
      const haystack = [job.title, job.companyName, job.location, job.skills, job.experience].join(" ").toLowerCase();
      return haystack.indexOf(jobsSearchQuery) !== -1;
    });
  }
  if (jobsTypeFilter) {
    filtered = filtered.filter(function(job) { return job.employmentType.toLowerCase() === jobsTypeFilter; });
  }
  filtered = filtered.slice().sort(function(a, b) {
    if (jobsSort === "title") return a.title.localeCompare(b.title);
    const dateA = parseDateInput(a.postedDate);
    const dateB = parseDateInput(b.postedDate);
    return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / JOBS_PAGE_SIZE));
  jobsPage = Math.max(1, Math.min(jobsPage, totalPages));
  renderJobsPagination(filtered.length, totalPages);

  if (filtered.length === 0) {
    setJobsEmpty("No " + (jobsAgeFilter === "new" ? "new" : jobsAgeFilter === "old" ? "old" : "active") + " job openings at the moment.");
    return;
  }

  const start = (jobsPage - 1) * JOBS_PAGE_SIZE;
  for (let i = start; i < Math.min(start + JOBS_PAGE_SIZE, filtered.length); i++) {
    grid.appendChild(buildJobCard(filtered[i]));
  }
  if (typeof window.refresh3DEffects === "function") window.refresh3DEffects();
}

function renderJobsPagination(total, totalPages) {
  let pager = document.getElementById("jobsPagination");
  if (!pager) {
    pager = document.createElement("nav");
    pager.id = "jobsPagination";
    pager.className = "jobs-pagination";
    pager.setAttribute("aria-label", "Job pages");
    document.getElementById("jobsGrid").after(pager);
  }
  pager.replaceChildren();
  pager.hidden = total === 0;
  if (!total) return;
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "Previous";
  previous.disabled = jobsPage === 1;
  previous.addEventListener("click", function() { changeJobsPage(-1); });
  const status = document.createElement("span");
  status.setAttribute("role", "status");
  const start = (jobsPage - 1) * JOBS_PAGE_SIZE + 1;
  status.textContent = "Showing " + start + "–" + Math.min(start + JOBS_PAGE_SIZE - 1, total) +
    " of " + total + " jobs · Page " + jobsPage + " of " + totalPages;
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next";
  next.disabled = jobsPage === totalPages;
  next.addEventListener("click", function() { changeJobsPage(1); });
  pager.append(previous, status, next);
}

function changeJobsPage(direction) {
  jobsPage += direction;
  renderJobs();
  const heading = document.querySelector(".jobs-header h2");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start" });
  }
}

function populateJobTypes() {
  const select = document.getElementById("jobTypeFilter");
  if (!select || select.options.length > 1) return;
  const types = Array.from(new Set(jobsData.map(function(job) { return job.employmentType; }).filter(Boolean))).sort();
  types.forEach(function(type) {
    const option = document.createElement("option"); option.value = type.toLowerCase(); option.textContent = type; select.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", function() {
  const search = document.getElementById("jobSearch");
  const type = document.getElementById("jobTypeFilter");
  const sort = document.getElementById("jobSort");
  let searchTrackTimer = null;
  if (search) search.addEventListener("input", function() {
    jobsSearchQuery = search.value.trim().toLowerCase(); jobsPage = 1; renderJobs();
    clearTimeout(searchTrackTimer);
    searchTrackTimer = setTimeout(function() {
      if (jobsSearchQuery && typeof window.skTrack === "function") {
        window.skTrack("job_search", { query_length: jobsSearchQuery.length });
      }
    }, 800);
  });
  if (type) type.addEventListener("change", function() {
    jobsTypeFilter = type.value; jobsPage = 1; renderJobs();
    if (typeof window.skTrack === "function") window.skTrack("job_filter", { employment_type: type.value || "all" });
  });
  if (sort) sort.addEventListener("change", function() {
    jobsSort = sort.value; jobsPage = 1; renderJobs();
    if (typeof window.skTrack === "function") window.skTrack("job_sort", { sort_order: sort.value });
  });
});

function viewJobDetails(jobId) {
  const job = findJobById(jobId);
  if (!job) return;

  if (typeof window.skTrack === "function") {
    window.skTrack("job_view", { job_id: job.jobId, job_title: job.title, company: job.companyName });
  }

  const icon = getJobIcon(job.title);
  const modal = document.getElementById("jobModal");
  const body = document.getElementById("jobModalBody");

  const applyButtonHtml = '<button class="job-btn job-btn-primary" onclick="applyForJob(\'' + escapeHtmlText(job.jobId) + '\')">Apply Now</button>';

  body.innerHTML =
    '<div class="job-modal-body">' +
      '<div class="job-card-header" style="margin-bottom: 10px;">' +
        '<div class="job-icon ' + icon.class + '" style="font-size: 32px;">' + icon.emoji + '</div>' +
        '<div class="job-title-wrap">' +
          '<h2>' + escapeHtmlText(job.title) + '</h2>' +
          '<div class="job-company">' + escapeHtmlText(job.companyName) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="job-type-badge">' + escapeHtmlText(job.employmentType || "Full Time") + '</div>' +
      '<div class="job-detail-row"><span class="job-detail-icon">E</span><span><strong>Experience</strong>' + escapeHtmlText(job.experience) + '</span></div>' +
      '<div class="job-detail-row"><span class="job-detail-icon">L</span><span><strong>Location</strong>' + escapeHtmlText(job.location) + '</span></div>' +
      '<div class="job-detail-row"><span class="job-detail-icon">$</span><span><strong>Salary</strong>' + escapeHtmlText(job.salary || "Not disclosed") + '</span></div>' +
      '<div class="job-detail-row"><span class="job-detail-icon">#</span><span><strong>Job ID</strong>' + escapeHtmlText(job.jobId) + '</span></div>' +
      '<div class="job-detail-row"><span class="job-detail-icon">D</span><span><strong>Description</strong>' + escapeHtmlText(job.description) + '</span></div>' +
      '<div class="job-detail-row"><span class="job-detail-icon">K</span><span><strong>Skills</strong>' + escapeHtmlText(job.skills) + '</span></div>' +
      '<div class="job-modal-actions">' + applyButtonHtml + '<button class="job-btn job-btn-secondary" onclick="closeJobModal()">Close</button></div>' +
    '</div>';

  modal.style.display = "flex";
}

function closeJobModal() {
  const modal = document.getElementById("jobModal");
  if (modal) modal.style.display = "none";
}

function applyForJob(jobId) {
  const job = findJobById(jobId);
  if (!job) return;

  if (typeof window.skTrack === "function") {
    window.skTrack("apply_click", { job_id: job.jobId, job_title: job.title, company: job.companyName });
  }

  const link = (job.applyLink || "").trim();
  const email = (job.hrEmail || "").trim();
  let url = "";

  if (link) {
    // Make sure external links have a protocol so they are not treated as relative
    url = link;
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
  } else if (email) {
    url = "mailto:" + email;
  } else {
    alert("Contact HR for this opening.");
    return;
  }

  if (url.indexOf("mailto:") === 0) {
    window.location.href = url;
  } else {
    const win = window.open(url, "_blank");
    if (win) {
      win.opener = null;
    } else {
      // Fallback if popup was blocked
      window.location.href = url;
    }
  }
}

function shareJobWhatsApp(jobId) {
  const job = findJobById(jobId);
  if (!job) return;

  if (typeof window.skTrack === "function") {
    window.skTrack("job_share", { method: "whatsapp", job_id: job.jobId, job_title: job.title, company: job.companyName });
  }

  const icon = getJobIcon(job.title);
  let text = "🚀 New Job Opening!\n\n";
  text += icon.emoji + " " + job.title + "\n";
  text += "🏢 " + job.companyName + "\n";
  text += "📍 " + job.location + "\n";
  text += "📅 " + job.experience + "\n";
  if (job.salary) text += "💰 " + job.salary + "\n";
  text += "💼 " + (job.employmentType || "Full Time") + "\n\n";
  text += "🛠️ Skills: " + job.skills + "\n\n";

  const shareLink = (job.applyLink || "").trim();
  const shareEmail = (job.hrEmail || "").trim();
  if (shareLink) {
    let url = shareLink;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    text += "Apply here: " + url;
  } else if (shareEmail) {
    text += "Apply via email: " + shareEmail;
  } else {
    text += "Contact HR for details.";
  }

  if (job.whatsappGroup) {
    text += "\n\nJoin our WhatsApp group: " + job.whatsappGroup;
  }

  const url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

function generateInstagramPost(jobId) {
  const job = findJobById(jobId);
  if (!job) return;

  if (typeof window.skTrack === "function") {
    window.skTrack("job_share", { method: "instagram", job_id: job.jobId, job_title: job.title, company: job.companyName });
  }

  const icon = getJobIcon(job.title);
  const modal = document.getElementById("instaModal");
  const preview = document.getElementById("instaPreview");
  const caption = document.getElementById("instaCaption");

  const instaLink = (job.applyLink || "").trim();
  const instaEmail = (job.hrEmail || "").trim();
  let applyText = "";
  if (instaLink) {
    let url = instaLink;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    applyText = "Apply: " + url;
  } else if (instaEmail) {
    applyText = "Apply: " + instaEmail;
  } else {
    applyText = "Contact HR for details";
  }

  preview.innerHTML =
    '<div class="insta-icon">' + icon.emoji + '</div>' +
    '<div class="insta-title">' + escapeHtmlText(job.title) + '</div>' +
    '<div class="insta-company">' + escapeHtmlText(job.companyName) + '</div>' +
    '<div class="insta-meta">' +
      escapeHtmlText(job.location) + '<br>' +
      escapeHtmlText(job.experience) + '<br>' +
      escapeHtmlText(job.salary || "") +
    '</div>';

  const captionText = "🚀 We're hiring!\n\n" +
    "💼 " + job.title + "\n" +
    "🏢 " + job.companyName + "\n" +
    "📍 " + job.location + "\n" +
    "📅 " + job.experience + "\n" +
    (job.salary ? "💰 " + job.salary + "\n" : "") +
    "💼 " + (job.employmentType || "Full Time") + "\n\n" +
    "🛠️ Skills: " + job.skills + "\n\n" +
    applyText + "\n\n" +
    "#SKTech #Hiring #JobOpening #" + job.title.replace(/\s+/g, "") + " #" + job.location.replace(/,\s*/g, "").replace(/\s+/g, "");

  caption.value = captionText;
  modal.style.display = "flex";
}

function closeInstaModal() {
  const modal = document.getElementById("instaModal");
  if (modal) modal.style.display = "none";
}

function copyInstaCaption() {
  const caption = document.getElementById("instaCaption");
  if (!caption) return;
  caption.select();
  document.execCommand("copy");
  alert("Caption copied! You can paste it into Instagram.");
}

// Close modals when clicking outside content or on close button
document.addEventListener("click", function(e) {
  const jobModal = document.getElementById("jobModal");
  const instaModal = document.getElementById("instaModal");

  if (e.target === jobModal) closeJobModal();
  if (e.target === instaModal) closeInstaModal();

  if (e.target.classList && e.target.classList.contains("job-modal-close") && !e.target.onclick) {
    closeJobModal();
  }
});

// Escape key closes modals
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    closeJobModal();
    closeInstaModal();
  }
});

// Global functions exposed for inline onclick handlers
window.loadJobs = loadJobs;
window.viewJobDetails = viewJobDetails;
window.closeJobModal = closeJobModal;
window.applyForJob = applyForJob;
window.shareJobWhatsApp = shareJobWhatsApp;
window.generateInstagramPost = generateInstagramPost;
window.filterJobsByAge = filterJobsByAge;
window.closeInstaModal = closeInstaModal;
window.copyInstaCaption = copyInstaCaption;

// Load jobs on page start so dashboard counts are available immediately
loadJobs();
