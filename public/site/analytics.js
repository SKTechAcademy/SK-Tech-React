(function () {
  "use strict";

  const measurementId = "G-253JM77BS2";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", measurementId);

  window.skTrack = function (eventName, parameters) {
    if (!eventName || typeof window.gtag !== "function") return;
    window.gtag("event", eventName, parameters || {});
  };

  document.addEventListener("click", function (event) {
    const link = event.target.closest("a");
    if (!link) return;
    const href = (link.getAttribute("href") || "").trim();

    if (link.classList.contains("schedule-btn")) {
      window.skTrack("schedule_interview_click");
    } else if (/wa\.me|api\.whatsapp\.com/i.test(href)) {
      window.skTrack("whatsapp_click", { link_area: link.closest("footer") ? "footer" : "page" });
    } else if (/^tel:/i.test(href)) {
      window.skTrack("phone_click");
    } else if (/^mailto:/i.test(href)) {
      window.skTrack("email_click");
    } else if (/docs\.google\.com\/forms|forms\.gle/i.test(href)) {
      window.skTrack("registration_click");
    } else if (link.getAttribute("aria-label") && /facebook|instagram/i.test(link.getAttribute("aria-label"))) {
      window.skTrack("social_click", { network: link.getAttribute("aria-label").toLowerCase() });
    }
  });
})();
