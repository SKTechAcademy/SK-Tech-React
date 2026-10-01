(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setupMenu() {
    const toggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".header nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      }
    });
  }

  function setupTilt() {
    if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    document.querySelectorAll(".card, .frame, .course, .testimonial, .tech-panel, .job-card").forEach(function (card) {
      if (card.dataset.tiltReady === "true") return;
      card.dataset.tiltReady = "true";
      card.classList.add("tilt-card");
      card.addEventListener("pointermove", function (event) {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        card.style.transform = "perspective(900px) rotateX(" + (-y * 7) + "deg) rotateY(" + (x * 9) + "deg) translateY(-3px)";
      });
      card.addEventListener("pointerleave", function () { card.style.transform = ""; });
    });
  }

  function setupReveal() {
    const elements = document.querySelectorAll("section, .cards, .tabs");
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
      });
    }, { threshold: .08 });
    elements.forEach(function (el) { el.classList.add("reveal-3d"); observer.observe(el); });
  }

  function setupAmbientLight() {
    if (reducedMotion) return;
    const orb = document.createElement("div");
    orb.className = "ambient-orb";
    document.body.appendChild(orb);
    document.addEventListener("pointermove", function (event) {
      orb.style.left = event.clientX + "px";
      orb.style.top = event.clientY + "px";
    }, { passive: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupMenu(); setupTilt(); setupReveal(); setupAmbientLight();
    document.querySelectorAll('[role="button"][tabindex="0"]').forEach(function(element) {
      element.addEventListener("keydown", function(event) {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); element.click(); }
      });
    });
  });
  window.refresh3DEffects = setupTilt;
})();
