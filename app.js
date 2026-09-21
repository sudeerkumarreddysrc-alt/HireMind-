/**
 * HireMind — Dashboard Interactions & Animations
 * app.js
 */

'use strict';

const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ============================================================
   STARTUP GUARD — Runs immediately on script load
   Ensures #interview-session and #session-complete are NEVER
   visible on first paint, regardless of CSS or cached state.
   ============================================================ */
(function enforceStartupState() {
  ['#interview-session', '#session-complete'].forEach(function(id) {
    var el = document.querySelector(id);
    if (el) {
      el.setAttribute('hidden', '');
      el.style.display = 'none';
    }
  });
})();


/* ============================================================
   0.5  HIREMIND STORAGE — localStorage Persistence Layer
   ============================================================ */
const HireMindStore = (function () {
  const KEY = 'hiremind_data';

  function _empty() {
    return {
      stats: {
        totalInterviews: 0,
        bestScore: 0,
        sumScores: 0,   // running sum of all scorePct values (for avg)
        totalSeconds: 0    // total practice seconds (for hours display)
      },
      sessions: []            // session records, newest first, capped at 100
    };
  }

  function _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return _empty();
      const parsed = JSON.parse(raw);
      // Merge-in defaults so older saved data with missing keys still works
      const base = _empty();
      return {
        stats: Object.assign(base.stats, parsed.stats || {}),
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
      };
    } catch (_) {
      return _empty();
    }
  }

  function _persist(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (_) { /* quota exceeded — silently ignore */ }
  }

  /** Return raw aggregate stats object from storage. */
  function getStats() {
    return _load().stats;
  }

  /** Return array of session records from storage (newest first). */
  function getSessions() {
    return _load().sessions;
  }

  /**
   * Derive human-readable display values from raw stats.
   * @returns {{ totalInterviews, bestScore, avgScore, practiceHours }}
   */
  function computeDisplayStats(stats) {
    const total = stats.totalInterviews;
    const best = stats.bestScore;
    const avg = total > 0 ? Math.round(stats.sumScores / total) : 0;
    // Hours: 1 decimal place, minimum 0.1 when any time was spent
    const rawHours = stats.totalSeconds / 3600;
    const hours = stats.totalSeconds > 0
      ? Math.max(0.1, Math.round(rawHours * 10) / 10)
      : 0;
    return { totalInterviews: total, bestScore: best, avgScore: avg, practiceHours: hours };
  }

  /**
   * Persist a completed session record and recompute aggregate stats.
   * @param {object} record  Session data object.
   * @returns {object}       Updated raw stats.
   */
  function saveSession(record) {
    const data = _load();

    // Prepend newest session and cap history
    data.sessions.unshift(record);
    if (data.sessions.length > 100) data.sessions = data.sessions.slice(0, 100);

    // Recompute all aggregate stats from the full session list (avoids drift)
    data.stats.totalInterviews = data.sessions.length;
    data.stats.sumScores = data.sessions.reduce((s, r) => s + (r.scorePct || 0), 0);
    data.stats.totalSeconds = data.sessions.reduce((s, r) => s + (r.totalSeconds || 0), 0);
    data.stats.bestScore = data.sessions.reduce((b, r) => Math.max(b, r.scorePct || 0), 0);

    _persist(data);
    return data.stats;
  }

  /** Update a session's report in local storage by session ID. */
  function updateSessionReport(sessionId, reportData) {
    const data = _load();
    const session = data.sessions.find(s => s.id == sessionId);
    if (session) {
      session.report = reportData;
      _persist(data);
    }
  }

  /** Persist settings to localStorage. */
  function saveSetting(key, value) {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : _empty();
      if (!data.settings) data.settings = {};
      data.settings[key] = value;
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (_) { }
  }

  /** Read a single setting from localStorage. */
  function getSetting(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultValue;
      const data = JSON.parse(raw);
      if (!data.settings) return defaultValue;
      return (key in data.settings) ? data.settings[key] : defaultValue;
    } catch (_) { return defaultValue; }
  }

  /** Wipe all stored data. */
  function clearAll() {
    try { localStorage.removeItem(KEY); } catch (_) { }
  }

  return { getStats, getSessions, saveSession, updateSessionReport, computeDisplayStats, clearAll, saveSetting, getSetting };
})();

/* ============================================================
   1. MOBILE HAMBURGER MENU
   ============================================================ */
(function initMobileMenu() {
  const btn = qs('#hamburger-btn');
  const mobileNav = qs('#mobile-nav');
  if (!btn || !mobileNav) return;

  btn.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    const spans = qsa('span', btn);
    if (isOpen) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !mobileNav.contains(e.target)) {
      mobileNav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      qsa('span', btn).forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });
})();

/* ============================================================
/* ============================================================
   1.5  TIME-AWARE DASHBOARD GREETING
   ============================================================ */
window.updateProfileUI = function() {
  const name = HireMindStore.getSetting('username', 'HireMind User') || 'HireMind User';
  
  // Update display name inputs / labels
  const pfUserEl = qs('#pf-username');
  if (pfUserEl) pfUserEl.textContent = name;
  
  const setUsernameInput = qs('#set-username');
  if (setUsernameInput) setUsernameInput.value = name;
  
  // Update avatar initials
  const initials = (function(str) {
    if (!str) return 'HM';
    const parts = str.trim().split(/\s+/);
    if (parts.length === 0) return 'HM';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
  })(name);
  
  const navAvatar = qs('#nav-avatar');
  if (navAvatar) navAvatar.textContent = initials;
  
  const userInitials = qs('#isess-user-initials');
  if (userInitials) userInitials.textContent = initials;
  
  const pfBadgeAvatar = qs('#pf-badge-avatar');
  if (pfBadgeAvatar) pfBadgeAvatar.textContent = initials;
  
  const userLabel = qs('#isess-user-label');
  if (userLabel) userLabel.textContent = name;
  
  // Update dashboard greeting
  const h1 = qs('.dashboard-greeting h1');
  if (h1) {
    const hour = new Date().getHours();
    const greeting = (hour >= 5 && hour < 12) ? 'Good morning' : (hour >= 12 && hour < 17) ? 'Good afternoon' : 'Good evening';
    h1.innerHTML = `${greeting}, <span class="gradient-text">${(function(str) {
      const p = document.createElement('p');
      p.textContent = str;
      return p.innerHTML;
    })(name)}</span>`;
  }
};

(function initGreeting() {
  window.updateProfileUI();

  // Set real timestamps for static activity feed items
  const now = Date.now();
  qsa('[data-ts-now]').forEach(el => {
    el.textContent = 'Just now';
    el.dataset.ts = String(now);
  });
  qsa('[data-ts-offset]').forEach(el => {
    const offset = parseInt(el.dataset.tsOffset || '0', 10);
    el.dataset.ts = String(now - offset);
    el.textContent = 'Just now';
  });
})();
(function initNavActive() {
  const navItems    = qsa('.nav-links li a');
  const mobileItems = qsa('.mobile-nav a');

  /** Map each nav link id → section name */
  const sectionMap = {
    'nav-dashboard':  'dashboard',
    'nav-interviews': 'interviews',
    'nav-history':    'history',
    'nav-profile':    'profile',
    'nav-settings':   'settings',
    'mob-dashboard':  'dashboard',
    'mob-interviews': 'interviews',
    'mob-history':    'history',
    'mob-profile':    'profile',
    'mob-settings':   'settings',
  };

  function showSection(name) {
    qsa('.nav-section').forEach(s => s.classList.remove('active'));
    const sec = qs(`#section-${name}`);
    if (sec) {
      sec.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Populate dynamic sections on demand
    if (name === 'history')    renderHistorySection?.();
    if (name === 'profile')    renderProfileSection?.();
    if (name === 'interviews') renderInterviewsSection?.();
  }

  // Expose globally so Quick-Access buttons and other code can call it
  window._showSection = showSection;

  /**
   * Toggle the "Need a Hint?" panel during an interview session.
   * Shows only evaluation keyword clues — never the full ideal answer.
   */
  window._toggleInterviewHint = function () {
    const bar    = document.querySelector('#isess-hint-bar');
    const toggle = document.querySelector('#isess-hint-toggle');
    if (!bar || !toggle) return;
    const isHidden = bar.hidden;
    bar.hidden = !isHidden;
    toggle.setAttribute('aria-expanded', String(isHidden));
    toggle.classList.toggle('active', isHidden);
  };

  function activate(clicked) {
    const section = sectionMap[clicked.id] || 'dashboard';
    const label   = clicked.textContent.trim().toLowerCase();
    navItems.forEach(a =>
      a.classList.toggle('active', a.textContent.trim().toLowerCase() === label));
    mobileItems.forEach(m =>
      m.classList.toggle('active', m.textContent.trim().toLowerCase() === label));
    showSection(section);
  }

  navItems.forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); activate(a); });
  });

  mobileItems.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      activate(a);
      const mNav = qs('#mobile-nav');
      const hBtn = qs('#hamburger-btn');
      mNav?.classList.remove('open');
      hBtn?.setAttribute('aria-expanded', 'false');
      if (hBtn) qsa('span', hBtn).forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    });
  });
})();

/* ============================================================
   3. NAVBAR SCROLL ELEVATION
   ============================================================ */
(function initNavScroll() {
  const navbar = qs('.navbar');
  if (!navbar) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (window.scrollY > 10) {
          navbar.style.boxShadow = '0 4px 48px rgba(0,0,0,.5), 0 1px 0 rgba(0,212,255,.1)';
          navbar.style.background = 'rgba(6,11,20,.92)';
        } else {
          navbar.style.boxShadow = '';
          navbar.style.background = '';
        }
        ticking = false;
      });
      ticking = true;
    }
  });
})();

/* ============================================================
   4. STAGGERED ENTRANCE ANIMATIONS
   ============================================================ */
(function initEntranceAnimations() {
  const targets = qsa([
    '.status-pill', '.glass-panel', '.dashboard-greeting', '.header-badge'
  ].join(','));

  targets.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity .55s ease ${i * 60}ms, transform .55s cubic-bezier(.34,1.56,.64,1) ${i * 60}ms`;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  targets.forEach(el => observer.observe(el));
})();

/* ============================================================
   5. ANIMATED STAT COUNTERS — driven by localStorage
   ============================================================ */
(function initStatCounters() {
  const rawStats = HireMindStore.getStats();
  const { totalInterviews, bestScore, avgScore, practiceHours } =
    HireMindStore.computeDisplayStats(rawStats);

  const statConfig = {
    'val-total': { end: totalInterviews, suffix: '', duration: 1200, decimals: 0 },
    'val-best': { end: bestScore, suffix: '%', duration: 1400, decimals: 0 },
    'val-avg': { end: avgScore, suffix: '%', duration: 1300, decimals: 0 },
    'val-hours': { end: practiceHours, suffix: 'h', duration: 1100, decimals: 1 },
  };

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCounter(el, end, suffix, duration, decimals) {
    if (end === 0) { el.textContent = '0' + suffix; return; }
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const raw = easeOut(progress) * end;
      const current = decimals > 0
        ? parseFloat(raw.toFixed(decimals))
        : Math.round(raw);
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  setTimeout(() => {
    Object.entries(statConfig).forEach(([id, cfg]) => {
      const el = qs(`#${id}`);
      if (el) animateCounter(el, cfg.end, cfg.suffix, cfg.duration, cfg.decimals);
    });
  }, 600);
})();

/* ============================================================
   5.5  HISTORY FEED — Restore last 3 sessions on page load
   ============================================================ */
(function initHistoryFeed() {
  const sessions = HireMindStore.getSessions();
  if (!sessions || sessions.length === 0) return;

  const recent = sessions.slice(0, 3);
  const colorMap = {
    hr: 'cyan', sde: 'violet', web: 'blue', data: 'green', custom: 'violet', company: 'orange'
  };

  // Insert entries after the dashboard has settled
  setTimeout(() => {
    // Reverse so the newest lands at the top of the feed
    [...recent].reverse().forEach(rec => {
      const color = colorMap[rec.category] || 'cyan';
      const d = new Date(rec.date);
      const when = isNaN(d) ? 'Earlier' :
        d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const text = `<strong>${rec.categoryLabel}</strong> completed — ` +
        `${rec.answered}/${rec.total} answered Â· Score: ` +
        `<strong>${rec.scorePct}%</strong> Â· ${rec.timeTaken} Â· ${when}`;
      addActivityEntry(color, text);
    });
  }, 900);
})();

/* ============================================================
   6. INTERVIEW SETUP MODAL & INTERACTIONS
   ============================================================ */
(function initSetupModal() {
  const cards = qsa('.category-card');
  const overlay = qs('#setup-overlay');
  const backdrop = qs('#setup-backdrop');
  const closeBtn = qs('#setup-close-btn');
  const btnBack = qs('#setup-btn-back');
  const btnNext = qs('#setup-btn-next');
  const btnStart = qs('#setup-btn-start');
  const subjectSearch = qs('#subject-search');
  const clearSubjectsBtn = qs('#subjects-clear-btn');

  if (!overlay) return;

  const categoryLabels = {
    hr: 'HR Interview',
    sde: 'Software Developer Interview',
    web: 'Web Developer Interview',
    data: 'Data Analyst Interview',
    custom: 'Custom Interview',
    company: 'Company-Specific Interview',
  };

  const categoryColors = {
    hr: 'rgba(0, 212, 255, 1)',
    sde: 'rgba(124, 58, 237, 1)',
    web: 'rgba(59, 130, 246, 1)',
    data: 'rgba(34, 197, 94, 1)',
    custom: 'rgba(168, 85, 247, 1)',
    company: 'rgba(251, 146, 60, 1)',
  };

  const branchDomainSubjects = {
    default: [
      "Problem Solving",
      "Data Structures",
      "Algorithms",
      "System Design",
      "Object Oriented Programming",
      "Database Systems",
      "Software Engineering Principles"
    ],
    domains: {
      "web-dev": [
        "HTML5 & CSS3",
        "JavaScript (ES6+)",
        "React & Vue",
        "Node.js & Express",
        "Web Security (OWASP)",
        "REST APIs",
        "SQL & NoSQL Databases",
        "TypeScript",
        "CSS Grid & Flexbox",
        "Performance Optimization"
      ],
      "mobile-dev": [
        "Swift & iOS Development",
        "Kotlin & Android SDK",
        "React Native & Flutter",
        "Mobile UI Design Patterns",
        "State Management",
        "App Store Guidelines",
        "Local Storage (CoreData/Room)",
        "Push Notifications & API Integration"
      ],
      "backend": [
        "API Design & Documentation",
        "Database Optimization & SQL",
        "Microservices Architecture",
        "Caching (Redis/Memcached)",
        "Message Brokers (RabbitMQ/Kafka)",
        "Authentication & JWT",
        "Docker Containers",
        "Server-side Programming"
      ],
      "fullstack": [
        "HTML5/CSS3/JavaScript",
        "Frontend Frameworks (React/Angular)",
        "Backend APIs (Node/Python/Java)",
        "Databases (SQL/MongoDB)",
        "State Management",
        "Deployment & Hosting",
        "Git Version Control",
        "System Architecture"
      ],
      "devops": [
        "Docker & Kubernetes",
        "CI/CD Pipelines (Jenkins/GitHub Actions)",
        "AWS / Azure / GCP Cloud Tools",
        "Terraform (Infrastructure as Code)",
        "Linux System Administration",
        "Nginx & Web Servers",
        "Prometheus & Grafana Monitoring",
        "Shell Scripting & Bash"
      ],
      "data-science": [
        "Python & R Programming",
        "Pandas & NumPy",
        "Exploratory Data Analysis",
        "Probability & Statistics",
        "Supervised Machine Learning",
        "Unsupervised Machine Learning",
        "Data Cleaning & Feature Engineering",
        "Jupyter Notebooks"
      ],
      "ai-ml": [
        "Supervised & Unsupervised Learning",
        "Neural Networks & Deep Learning",
        "PyTorch & TensorFlow",
        "Natural Language Processing (NLP)",
        "Computer Vision & OpenCV",
        "Reinforcement Learning",
        "Model Evaluation Metrics",
        "Linear Algebra & Calculus"
      ],
      "data-analyst": [
        "SQL (Joins, Aggregations, CTEs)",
        "Data Visualization (Tableau/Power BI)",
        "Excel Advanced (Pivot Tables, VLOOKUP)",
        "Python for Data Analysis",
        "Key Performance Indicators (KPIs)",
        "Statistical Analysis",
        "Business Intelligence Systems"
      ],
      "nlp": [
        "Tokenization & Stemming",
        "Word Embeddings (Word2Vec, GloVe)",
        "Transformer Architectures (BERT, GPT)",
        "Text Classification & Sentiment Analysis",
        "Named Entity Recognition (NER)",
        "Machine Translation",
        "Large Language Models (LLMs)",
        "Regular Expressions"
      ],
      "cybersec": [
        "Network Security Protocols",
        "Cryptography & Encryption Standards",
        "Ethical Hacking & Penetration Testing",
        "OWASP Top 10 Vulnerabilities",
        "Firewalls, IDS & IPS Systems",
        "Linux Command Line",
        "Incident Response Planning",
        "Security Audits & Compliance"
      ],
      "networking": [
        "TCP/IP Suite & OSI Model",
        "Subnetting & IP Addressing",
        "Routing Protocols (OSPF, BGP)",
        "DNS, DHCP & HTTP Protocols",
        "Wireshark & Packet Analysis",
        "VPNs & Secure Tunnels",
        "Network Virtualization"
      ],
      "cloud": [
        "Cloud Infrastructure Design",
        "Serverless Computing (AWS Lambda)",
        "Cloud Storage Solutions",
        "Identity & Access Management (IAM)",
        "Virtual Private Clouds (VPC)",
        "Cost Optimization strategies",
        "Disaster Recovery & Backups"
      ],
      "embedded": [
        "C & C++ Programming",
        "Microcontrollers (ARM, AVR)",
        "RTOS (Real-Time Operating Systems)",
        "I2C, SPI & UART Protocols",
        "Embedded Linux",
        "Hardware Debugging & Oscilloscopes",
        "Memory Management"
      ],
      "game-dev": [
        "C# & Unity Engine",
        "C++ & Unreal Engine",
        "3D Mathematics & Physics",
        "Game Loop & Rendering Pipelines",
        "UI/UX Design for Games",
        "Animation Systems & State Machines",
        "Shaders & Material Creation"
      ],
      "product": [
        "Product Lifecycle Management",
        "Agile & Scrum Methodologies",
        "User Persona Development",
        "A/B Testing & User Analytics",
        "Roadmapping & Prioritization Frameworks",
        "Market Research & Competitor Analysis",
        "Product Requirements Documents (PRD)"
      ],
      "hr": [
        "Behavioral Questioning (STAR Method)",
        "Company Culture Fit Assessment",
        "Conflict Resolution Scenarios",
        "Negotiation & Compensation",
        "Career Growth & Pathing",
        "Onboarding & Training Practices",
        "Diversity, Equity & Inclusion (DEI)"
      ]
    },
    branches: {
      cse: ["Operating Systems", "Computer Networks", "Database Management Systems", "Compiler Design"],
      aiml: ["Mathematical Foundations for ML", "Data Mining", "Neural Networks"],
      ds: ["Statistical Inference", "Big Data Analytics", "Data Warehousing"],
      cyber: ["Information Security", "Digital Forensics", "Network Security Protocols"],
      ece: ["Digital Electronics", "Microprocessors", "Signal Processing"],
      eee: ["Control Systems", "Power Systems", "Electrical Machines"],
      mech: ["Thermodynamics", "Fluid Mechanics", "Strength of Materials"],
      civil: ["Structural Analysis", "Geotechnical Engineering", "Fluid Mechanics"],
      other: ["General Aptitude", "Logical Reasoning", "Communication Skills"]
    }
  };

  let currentStep = 1;
  let activeCategory = '';
  let selectedSubjects = new Set();

  // Maps each category card to its best-matching domain value in #field-domain
  const categoryDomainMap = {
    hr:     'hr',
    sde:    'backend',
    web:    'web-dev',
    data:   'data-analyst',
    custom: '',          // custom lets the user pick freely
  };

  function openModal(category) {
    // Company-Specific Prep has its own dedicated overlay
    if (category === 'company') {
      if (typeof window.openCompanyModal === 'function') window.openCompanyModal();
      return;
    }
    activeCategory = category;
    resetModalForm();

    const label = categoryLabels[category] || 'Interview';
    const chipLabel = qs('#setup-chip-label');
    if (chipLabel) chipLabel.textContent = label;

    const chip = qs('#setup-category-chip');
    if (chip) {
      chip.className = 'setup-category-chip';
      chip.classList.add(`chip-${category}`);
    }

    // Pre-select the matching domain so Step 3 is already filled in
    const presetDomain = categoryDomainMap[category] || '';
    const domainSelect = qs('#field-domain');
    if (domainSelect && presetDomain) {
      domainSelect.value = presetDomain;
      // Pre-populate subjects for Step 4 immediately
      updateSubjectsList();
    }

    overlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      qs('#field-branch')?.focus();
    }, 100);
  }

  function closeModal() {
    overlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function resetModalForm() {
    currentStep = 1;
    selectedSubjects.clear();

    const branchSelect = qs('#field-branch');
    if (branchSelect) branchSelect.value = '';

    const domainSelect = qs('#field-domain');
    if (domainSelect) domainSelect.value = '';

    const checkedRadio = qs('input[name="year"]:checked');
    if (checkedRadio) checkedRadio.checked = false;

    if (subjectSearch) subjectSearch.value = '';

    qsa('.setup-field-hint').forEach(el => el.textContent = '');

    updateProgress(1);
    showPanel(1);
  }

  function updateProgress(step) {
    const currentStepText = qs('#setup-current-step');
    if (currentStepText) currentStepText.textContent = step;

    const progressFill = qs('#setup-progress-fill');
    if (progressFill) {
      const percent = ((step - 1) / 3) * 100;
      progressFill.style.width = `${percent}%`;
    }

    for (let i = 1; i <= 4; i++) {
      const dot = qs(`#step-ind-${i}`);
      if (!dot) continue;
      if (i < step) {
        dot.className = 'setup-step completed';
      } else if (i === step) {
        dot.className = 'setup-step active';
      } else {
        dot.className = 'setup-step';
      }
    }

    if (btnBack) {
      btnBack.style.visibility = step === 1 ? 'hidden' : 'visible';
    }

    if (step === 4) {
      if (btnNext) btnNext.hidden = true;
      if (btnStart) btnStart.removeAttribute('hidden');
    } else {
      if (btnNext) btnNext.removeAttribute('hidden');
      if (btnStart) btnStart.hidden = true;
    }
  }

  function showPanel(step) {
    for (let i = 1; i <= 4; i++) {
      const panel = qs(`#panel-${i}`);
      if (panel) {
        if (i === step) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      }
    }
  }

  function validateStep(step) {
    let isValid = true;

    if (step === 1) {
      const branchVal = qs('#field-branch')?.value;
      const errorEl = qs('#branch-error');
      if (!branchVal) {
        if (errorEl) errorEl.textContent = 'Please select your branch before continuing.';
        isValid = false;
      } else {
        if (errorEl) errorEl.textContent = '';
      }
    }
    else if (step === 2) {
      const checkedRadio = qs('input[name="year"]:checked');
      const errorEl = qs('#year-error');
      if (!checkedRadio) {
        if (errorEl) errorEl.textContent = 'Please select your academic year before continuing.';
        isValid = false;
      } else {
        if (errorEl) errorEl.textContent = '';
      }
    }
    else if (step === 3) {
      const domainVal = qs('#field-domain')?.value;
      const errorEl = qs('#domain-error');
      if (!domainVal) {
        if (errorEl) errorEl.textContent = 'Please select your domain of interest before continuing.';
        isValid = false;
      } else {
        if (errorEl) errorEl.textContent = '';
      }
    }
    else if (step === 4) {
      const errorEl = qs('#subjects-error');
      if (selectedSubjects.size === 0) {
        if (errorEl) errorEl.textContent = 'Please select at least one subject before starting.';
        isValid = false;
      } else {
        if (errorEl) errorEl.textContent = '';
      }
    }

    return isValid;
  }

  function updateSubjectsList() {
    const branchVal = qs('#field-branch')?.value || 'other';
    const domainVal = qs('#field-domain')?.value || 'other';

    let list = branchDomainSubjects.domains[domainVal] || [];
    if (list.length < 5) {
      list = [...list, ...branchDomainSubjects.default];
    }
    const branchList = branchDomainSubjects.branches[branchVal] || [];
    const combinedList = [...new Set([...list, ...branchList])];

    const grid = qs('#subjects-grid');
    if (!grid) return;

    grid.innerHTML = '';
    combinedList.forEach(sub => {
      const pill = document.createElement('div');
      pill.className = 'subject-pill';
      if (selectedSubjects.has(sub)) {
        pill.classList.add('selected');
      }
      pill.textContent = sub;
      pill.dataset.name = sub;

      pill.addEventListener('click', () => {
        if (selectedSubjects.has(sub)) {
          selectedSubjects.delete(sub);
          pill.classList.remove('selected');
        } else {
          selectedSubjects.add(sub);
          pill.classList.add('selected');
        }
        updateSubjectsCount();
        if (selectedSubjects.size > 0) {
          const errorEl = qs('#subjects-error');
          if (errorEl) errorEl.textContent = '';
        }
      });

      grid.appendChild(pill);
    });

    updateSubjectsCount();
  }

  function updateSubjectsCount() {
    const countVal = qs('#subjects-count');
    if (countVal) {
      const count = selectedSubjects.size;
      countVal.textContent = count === 1 ? '1 subject' : `${count} subjects`;
    }
  }

  function filterSubjects() {
    const query = subjectSearch?.value.toLowerCase() || '';
    const pills = qsa('.subject-pill', qs('#subjects-grid'));
    pills.forEach(pill => {
      const text = pill.dataset.name.toLowerCase();
      if (text.includes(query)) {
        pill.classList.remove('hidden');
      } else {
        pill.classList.add('hidden');
      }
    });
  }

  function animateCounterIncrease(el, startVal, endVal, suffix = '', duration = 800) {
    const start = performance.now();
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(startVal + easeOut(progress) * (endVal - startVal));
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function submitSetup() {
    if (!validateStep(4)) return;

    closeModal();

    const label = categoryLabels[activeCategory] || 'Interview';
    const color = categoryColors[activeCategory] || '#00d4ff';

    // Show starting success toast
    showToast(
      `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="${color}" stroke="none"/></svg>`,
      `Starting <strong>${label}</strong> — AI session configured!`
    );

    // Add activity feed entry
    const branchSelect = qs('#field-branch');
    const branchText = branchSelect?.options[branchSelect.selectedIndex]?.textContent || 'CSE';

    const domainSelect = qs('#field-domain');
    const domainText = domainSelect?.options[domainSelect.selectedIndex]?.textContent || 'Web Dev';

    const yrVal = qs('input[name="year"]:checked')?.value || '1';
    const yrOrdinal = yrVal === '1' ? '1st' : yrVal === '2' ? '2nd' : yrVal === '3' ? '3rd' : '4th';

    const chosenSubjects = Array.from(selectedSubjects);
    const subjectsSummary = chosenSubjects.slice(0, 3).join(', ') + (chosenSubjects.length > 3 ? '...' : '');

    addActivityEntry(
      activeCategory === 'data' ? 'green' : activeCategory === 'sde' ? 'violet' : activeCategory === 'web' ? 'blue' : 'cyan',
      `<strong>${label}</strong> started — ${branchText} (${yrOrdinal} Yr) | Domain: ${domainText} | Topics: ${subjectsSummary}`
    );

    // Dashboard stat counters are updated by endSession() via HireMindStore

    // Start the interview session logic
    if (typeof window.startInterviewSession === 'function') {
      const yrVal = qs('input[name="year"]:checked')?.value || '1';
      const branchVal = qs('#field-branch')?.value || 'other';
      const domainVal = qs('#field-domain')?.value || 'other';
      const chosenSubjects = Array.from(selectedSubjects);
      window.startInterviewSession(activeCategory, yrVal, branchVal, domainVal, chosenSubjects);
    }
  }

  // Bind Category Cards — event delegation covers dashboard + interviews section cards
  document.addEventListener('click', e => {
    const card = e.target.closest('.category-card');
    if (!card) return;
    card.style.transform = 'scale(0.97)';
    setTimeout(() => { card.style.transform = ''; }, 180);
    openModal(card.dataset.category);
  });
  document.addEventListener('keydown', e => {
    const card = e.target.closest('.category-card');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      card.click();
    }
  });

  // Bind dropdowns changes to update Step 4 subjects reactively
  qs('#field-branch')?.addEventListener('change', updateSubjectsList);
  qs('#field-domain')?.addEventListener('change', updateSubjectsList);

  // Close triggers
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) {
      closeModal();
    }
  });

  // Next and Back triggers
  btnBack?.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateProgress(currentStep);
      showPanel(currentStep);
    }
  });

  btnNext?.addEventListener('click', () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        currentStep++;
        if (currentStep === 4) {
          updateSubjectsList();
        }
        updateProgress(currentStep);
        showPanel(currentStep);
      }
    }
  });

  btnStart?.addEventListener('click', submitSetup);

  // Step 4 search and clear triggers
  subjectSearch?.addEventListener('input', filterSubjects);

  clearSubjectsBtn?.addEventListener('click', () => {
    selectedSubjects.clear();
    const pills = qsa('.subject-pill', qs('#subjects-grid'));
    pills.forEach(pill => pill.classList.remove('selected'));
    updateSubjectsCount();
  });
})();

/* ============================================================
   6.5  COMPANY-SPECIFIC PREP MODAL
   ============================================================ */
(function initCompanyModal() {
  const overlay  = qs('#company-setup-overlay');
  if (!overlay) return;

  const backdrop  = qs('#company-setup-backdrop');
  const closeBtn  = qs('#cmodal-close-btn');
  const btnBack   = qs('#cmodal-btn-back');
  const btnNext   = qs('#cmodal-btn-next');
  const btnStart  = qs('#cmodal-btn-start');

  /* ── DATA ────────────────────────────────────────── */
  const COMPANIES = [
    { id: 'Google',     abbr: 'GO',  color: '#4285F4', bg: 'rgba(66,133,244,.12)'   },
    { id: 'Microsoft',  abbr: 'MS',  color: '#00A4EF', bg: 'rgba(0,164,239,.12)'    },
    { id: 'Amazon',     abbr: 'AMZ', color: '#FF9900', bg: 'rgba(255,153,0,.12)'    },
    { id: 'Apple',      abbr: 'APL', color: '#a0a0a0', bg: 'rgba(160,160,160,.1)'   },
    { id: 'Meta',       abbr: 'META',color: '#0866FF', bg: 'rgba(8,102,255,.12)'    },
    { id: 'Flipkart',   abbr: 'FK',  color: '#2874F0', bg: 'rgba(40,116,240,.12)'   },
    { id: 'TCS',        abbr: 'TCS', color: '#0047A8', bg: 'rgba(0,71,168,.12)'     },
    { id: 'Infosys',    abbr: 'INF', color: '#007CC3', bg: 'rgba(0,124,195,.12)'    },
    { id: 'Wipro',      abbr: 'WPR', color: '#36B37E', bg: 'rgba(54,179,126,.12)'   },
    { id: 'Accenture',  abbr: 'ACC', color: '#A100FF', bg: 'rgba(161,0,255,.12)'    },
    { id: 'Cognizant',  abbr: 'CTS', color: '#1B3A7A', bg: 'rgba(27,58,122,.14)'    },
    { id: 'Deloitte',   abbr: 'DLT', color: '#86BC25', bg: 'rgba(134,188,37,.12)'   },
    { id: 'IBM',        abbr: 'IBM', color: '#1F70C1', bg: 'rgba(31,112,193,.12)'   },
    { id: 'Oracle',     abbr: 'ORC', color: '#C74634', bg: 'rgba(199,70,52,.12)'    },
    { id: 'Capgemini',  abbr: 'CAP', color: '#0070AD', bg: 'rgba(0,112,173,.12)'    },
    { id: 'Adobe',      abbr: 'ADB', color: '#FA0F00', bg: 'rgba(250,15,0,.10)'     },
    { id: 'Salesforce', abbr: 'SF',  color: '#00A1E0', bg: 'rgba(0,161,224,.12)'    },
    { id: 'NVIDIA',     abbr: 'NV',  color: '#76B900', bg: 'rgba(118,185,0,.12)'    },
  ];

  const ROLES = [
    { id: 'Software Engineer',      label: 'Software Engineer',     icon: '💻',
      subjects: ['Data Structures & Algorithms', 'System Design', 'Object Oriented Design', 'Coding Patterns', 'Problem Solving', 'Databases'] },
    { id: 'Data Scientist',         label: 'Data Scientist / ML',   icon: '🤖',
      subjects: ['Machine Learning', 'Python & NumPy', 'Statistics & Probability', 'SQL & Databases', 'Deep Learning', 'Model Evaluation'] },
    { id: 'Web Developer',          label: 'Web Developer',          icon: '🌐',
      subjects: ['HTML5 & CSS3', 'JavaScript (ES6+)', 'React & Vue', 'REST APIs', 'Node.js & Express', 'TypeScript'] },
    { id: 'DevOps Engineer',        label: 'DevOps / Cloud',         icon: '☁️',
      subjects: ['Docker & Kubernetes', 'CI/CD Pipelines', 'AWS / GCP / Azure', 'Linux Administration', 'Infrastructure as Code', 'Monitoring'] },
    { id: 'Product Manager',        label: 'Product Manager',        icon: '📋',
      subjects: ['Product Lifecycle', 'User Research', 'Agile & Scrum', 'Data Analytics', 'A/B Testing', 'Roadmapping'] },
    { id: 'Business Analyst',       label: 'Business Analyst',       icon: '📊',
      subjects: ['Requirements Analysis', 'Process Modelling', 'SQL Queries', 'Stakeholder Management', 'Data Visualization', 'Communication Skills'] },
    { id: 'Cybersecurity Analyst',  label: 'Cybersecurity',          icon: '🔒',
      subjects: ['Network Security', 'OWASP Top 10', 'Penetration Testing', 'Cryptography', 'Incident Response', 'Security Audits'] },
    { id: 'Full Stack Developer',   label: 'Full Stack Dev',         icon: '⚡',
      subjects: ['Frontend Frameworks', 'Backend APIs', 'SQL & NoSQL Databases', 'Authentication & JWT', 'System Architecture', 'CI/CD Pipelines'] },
  ];

  let cStep = 1;
  let selectedCompany = null;
  let selectedRole    = null;

  /* ── BUILD COMPANY GRID ──────────────────────────────── */
  const companyGrid = qs('#company-select-grid');
  if (companyGrid) {
    COMPANIES.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'company-select-btn';
      btn.dataset.company = c.id;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.innerHTML = `
        <div class="company-logo" style="background:${c.bg};color:${c.color};">${c.abbr}</div>
        <span>${c.id}</span>
      `;
      btn.addEventListener('click', () => {
        selectedCompany = c;
        qsa('.company-select-btn', companyGrid).forEach(b => {
          b.classList.remove('selected');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
        const err = qs('#cstep1-error');
        if (err) err.textContent = '';
      });
      companyGrid.appendChild(btn);
    });
  }

  /* ── BUILD ROLE GRID ─────────────────────────────────── */
  const roleGrid = qs('#role-select-grid');
  if (roleGrid) {
    ROLES.forEach(r => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'role-select-btn';
      btn.dataset.role = r.id;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.innerHTML = `<span class="role-btn-icon">${r.icon}</span><span>${r.label}</span>`;
      btn.addEventListener('click', () => {
        selectedRole = r;
        qsa('.role-select-btn', roleGrid).forEach(b => {
          b.classList.remove('selected');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
        const err = qs('#cstep3-error');
        if (err) err.textContent = '';
      });
      roleGrid.appendChild(btn);
    });
  }

  /* ── HELPERS ────────────────────────────────────────── */
  function showCPanel(step) {
    for (let i = 1; i <= 3; i++) {
      const p = qs(`#cpanel-${i}`);
      if (p) p.classList.toggle('active', i === step);
    }
  }

  function updateCProgress(step) {
    const stepText = qs('#cmodal-current-step');
    if (stepText) stepText.textContent = step;

    const fill = qs('#cmodal-progress-fill');
    if (fill) fill.style.width = `${((step - 1) / 2) * 100}%`;

    for (let i = 1; i <= 3; i++) {
      const ind = qs(`#cstep-ind-${i}`);
      if (!ind) continue;
      if      (i < step)  ind.className = 'cmodal-step completed';
      else if (i === step) ind.className = 'cmodal-step active';
      else                ind.className = 'cmodal-step';
    }

    if (btnBack) btnBack.style.visibility = step === 1 ? 'hidden' : 'visible';
    if (step === 3) {
      if (btnNext)  btnNext.hidden  = true;
      if (btnStart) btnStart.removeAttribute('hidden');
    } else {
      if (btnNext)  btnNext.removeAttribute('hidden');
      if (btnStart) btnStart.hidden = true;
    }

    // Populate banner on step 3
    if (step === 3 && selectedCompany) {
      const logo = qs('#cmodal-banner-logo');
      const name = qs('#cmodal-banner-name');
      const sub  = qs('#cmodal-banner-sub');
      const hint = qs('#cmodal-role-company-name');
      if (logo) {
        logo.textContent = selectedCompany.abbr;
        logo.style.cssText = `background:${selectedCompany.bg};color:${selectedCompany.color};`;
      }
      if (name) name.textContent = selectedCompany.id;
      const yr = qs('input[name="cmp-year"]:checked')?.value || '?';
      const yrLabel = yr === '1' ? '1st Year' : yr === '2' ? '2nd Year' : yr === '3' ? '3rd Year' : '4th Year';
      if (sub)  sub.textContent  = `${yrLabel} — Choose your target role below`;
      if (hint) hint.textContent = selectedCompany.id;
    }
  }

  function validateCStep(step) {
    if (step === 1) {
      if (!selectedCompany) {
        const el = qs('#cstep1-error');
        if (el) el.textContent = 'Please select a company before continuing.';
        return false;
      }
    } else if (step === 2) {
      if (!qs('input[name="cmp-year"]:checked')) {
        const el = qs('#cstep2-error');
        if (el) el.textContent = 'Please select your academic year before continuing.';
        return false;
      }
    } else if (step === 3) {
      if (!selectedRole) {
        const el = qs('#cstep3-error');
        if (el) el.textContent = 'Please select your target role before starting.';
        return false;
      }
    }
    return true;
  }

  /* ── OPEN / CLOSE ─────────────────────────────────────── */
  function openCModal() {
    cStep = 1;
    selectedCompany = null;
    selectedRole    = null;

    // Reset selections
    qsa('.company-select-btn', companyGrid).forEach(b => {
      b.classList.remove('selected');
      b.setAttribute('aria-checked', 'false');
    });
    qsa('.role-select-btn', roleGrid).forEach(b => {
      b.classList.remove('selected');
      b.setAttribute('aria-checked', 'false');
    });
    const checked = qs('input[name="cmp-year"]:checked');
    if (checked) checked.checked = false;
    qsa('.cstep-error').forEach(el => el.textContent = '');

    updateCProgress(1);
    showCPanel(1);
    overlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    setTimeout(() => qs('#company-select-grid')?.querySelector('.company-select-btn')?.focus(), 120);
  }

  window.openCompanyModal = openCModal;

  function closeCModal() {
    overlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  /* ── SUBMIT ───────────────────────────────────────────── */
  function submitCompanySetup() {
    if (!validateCStep(3)) return;

    closeCModal();

    const company  = selectedCompany.id;
    const role     = selectedRole.id;
    const year     = qs('input[name="cmp-year"]:checked')?.value || '1';
    const domain   = `${company} - ${role}`;  // e.g. "Google - Software Engineer"
    const subjects = selectedRole.subjects || [];
    const yrOrdinal = year === '1' ? '1st' : year === '2' ? '2nd' : year === '3' ? '3rd' : '4th';

    showToast(
      `<svg viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      `Starting <strong>${company}</strong> prep — ${role} (${yrOrdinal} Year)!`
    );

    addActivityEntry(
      'orange',
      `<strong>Company Prep</strong> started — <strong>${company}</strong> | ${role} | ${yrOrdinal} Year`
    );

    if (typeof window.startInterviewSession === 'function') {
      window.startInterviewSession('company', year, 'cse', domain, subjects);
    }
  }

  /* ── EVENT BINDING ─────────────────────────────────────── */
  closeBtn?.addEventListener('click', closeCModal);
  backdrop?.addEventListener('click', closeCModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) closeCModal();
  });

  btnBack?.addEventListener('click', () => {
    if (cStep > 1) {
      cStep--;
      updateCProgress(cStep);
      showCPanel(cStep);
    }
  });

  btnNext?.addEventListener('click', () => {
    if (validateCStep(cStep) && cStep < 3) {
      cStep++;
      updateCProgress(cStep);
      showCPanel(cStep);
    }
  });

  btnStart?.addEventListener('click', submitCompanySetup);
})();

/* ============================================================
   6.1  SECTION RENDERERS — Interviews · History · Profile
   ============================================================ */

/** Populate the Interviews section recent-sessions list. */
function renderInterviewsSection() {
  const all      = HireMindStore.getSessions();
  const recent   = all.slice(0, 5);
  const colorMap = { hr: 'cyan', sde: 'violet', web: 'blue', data: 'green', custom: 'violet', company: 'orange' };

  const badge = qs('#int-session-count');
  if (badge) badge.textContent = `${all.length} Session${all.length !== 1 ? 's' : ''}`;

  const list = qs('#int-sessions-list');
  if (!list) return;
  list.innerHTML = '';

  if (!recent.length) {
    list.innerHTML = `<div class="history-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
      <p>No sessions yet — select a category above to begin!</p></div>`;
    return;
  }

  recent.forEach(rec => {
    const color = colorMap[rec.category] || 'cyan';
    const d     = new Date(rec.date);
    const when  = isNaN(d) ? 'Unknown date' :
      d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="history-card-icon status-pill-icon ${color}" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="history-card-info">
        <div class="history-card-title">${rec.categoryLabel || 'Interview'}</div>
        <div class="history-card-meta">${when} · ${rec.answered}/${rec.total} answered · ${rec.timeTaken}</div>
      </div>
      <div class="history-card-score-action">
        <div class="history-card-score">${rec.scorePct}%</div>
        ${rec.report ? `<button class="view-report-btn" data-id="${rec.id}">View Report</button>` : ''}
      </div>`;
    list.appendChild(card);
  });
}
function renderHistorySection() {
  const sessions = HireMindStore.getSessions();
  const { totalInterviews, bestScore, avgScore, practiceHours } =
    HireMindStore.computeDisplayStats(HireMindStore.getStats());
  const colorMap = { hr: 'cyan', sde: 'violet', web: 'blue', data: 'green', custom: 'violet', company: 'orange' };
  const set = (id, v) => { const el = qs(id); if (el) el.textContent = v; };

  set('#hist-total-label',   `${sessions.length} Session${sessions.length !== 1 ? 's' : ''}`);
  set('#hist-session-badge', `${sessions.length} Total`);
  set('#hist-stat-total',    totalInterviews);
  set('#hist-stat-best',     `${bestScore}%`);
  set('#hist-stat-avg',      `${avgScore}%`);
  set('#hist-stat-hours',    `${practiceHours}h`);

  const list = qs('#hist-sessions-list');
  if (!list) return;
  list.innerHTML = '';

  if (!sessions.length) {
    list.innerHTML = `<div class="history-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <p>No interview history yet — start your first session!</p></div>`;
    return;
  }

  sessions.forEach(rec => {
    const color = colorMap[rec.category] || 'cyan';
    const d     = new Date(rec.date);
    const when  = isNaN(d) ? 'Unknown date' :
      d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="history-card-icon status-pill-icon ${color}" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="history-card-info">
        <div class="history-card-title">${rec.categoryLabel || 'Interview'}</div>
        <div class="history-card-meta">${when} · ${rec.answered}/${rec.total} answered · ${rec.timeTaken}</div>
      </div>
      <div class="history-card-score-action">
        <div class="history-card-score">${rec.scorePct}%</div>
        ${rec.report ? `<button class="view-report-btn" data-id="${rec.id}">View Report</button>` : ''}
      </div>`;
    list.appendChild(card);
  });
}

/** Populate the Profile section with stats from localStorage. */
function renderProfileSection() {
  const sessions = HireMindStore.getSessions();
  const { totalInterviews, bestScore, avgScore, practiceHours } =
    HireMindStore.computeDisplayStats(HireMindStore.getStats());
  const set = (id, v) => { const el = qs(id); if (el) el.textContent = v; };

  set('#profile-total', totalInterviews);
  set('#profile-best',  `${bestScore}%`);
  set('#profile-avg',   `${avgScore}%`);
  set('#pf-total',      totalInterviews);
  set('#pf-best',       `${bestScore}%`);
  set('#pf-avg',        `${avgScore}%`);
  set('#pf-hours',      `${practiceHours}h`);
  set('#pf-answered',   sessions.reduce((s, r) => s + (r.answered || 0), 0));

  if (sessions.length) {
    const oldest = sessions[sessions.length - 1];
    const d = new Date(oldest.date);
    set('#pf-since', isNaN(d) ? 'Unknown' :
      d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }));
    const catCount = {};
    sessions.forEach(s => { catCount[s.categoryLabel] = (catCount[s.categoryLabel] || 0) + 1; });
    const fav = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0];
    set('#pf-fav-cat', fav || '—');
  } else {
    set('#pf-since',   'No sessions yet');
    set('#pf-fav-cat', '—');
  }

  // ── Dynamic badge system ──
  const badgeTitle = qs('#pf-badge-title');
  const badgeDesc  = qs('#pf-badge-desc');
  const progressWrap  = qs('#pf-badge-progress-wrap');
  const progressFill  = qs('#pf-badge-progress-fill');
  const progressLabel = qs('#pf-badge-progress-label');

  const badgeLevels = [
    { threshold: 0,  title: 'Interview Novice',   desc: 'Complete 5 sessions to unlock <strong>Interview Pro</strong>.', next: 5 },
    { threshold: 5,  title: 'Interview Pro',       desc: 'Complete 15 sessions to unlock <strong>Interview Expert</strong>.', next: 15 },
    { threshold: 15, title: 'Interview Expert',    desc: 'Complete 30 sessions to unlock <strong>Interview Master</strong>.', next: 30 },
    { threshold: 30, title: 'Interview Master',    desc: 'Complete 50 sessions to unlock <strong>Interview Legend</strong>.', next: 50 },
    { threshold: 50, title: 'Interview Legend',    desc: 'You have reached the highest rank. Keep practising!', next: null },
  ];

  const n = totalInterviews;
  // Find current badge level
  let level = badgeLevels[0];
  for (let i = badgeLevels.length - 1; i >= 0; i--) {
    if (n >= badgeLevels[i].threshold) { level = badgeLevels[i]; break; }
  }

  if (badgeTitle) badgeTitle.textContent = level.title;
  if (badgeDesc)  badgeDesc.innerHTML  = level.desc;

  // Progress bar to next level
  if (progressWrap && progressFill && progressLabel && level.next !== null) {
    const prev = level.threshold;
    const range = level.next - prev;
    const progress = Math.min(((n - prev) / range) * 100, 100);
    progressWrap.style.display = '';
    progressFill.style.width = `${progress}%`;
    progressLabel.textContent = `${n - prev} / ${range} sessions to ${badgeLevels[badgeLevels.findIndex(b => b.threshold === level.threshold) + 1]?.title || 'next level'}`;
  } else if (progressWrap) {
    progressWrap.style.display = 'none';
  }
}

/* ============================================================
   6.2  SETTINGS SECTION INIT
   ============================================================ */
(function initSettingsSection() {
  // Load persisted toggle states
  const micDefault = HireMindStore.getSetting('defaultMic', true);
  const camDefault = HireMindStore.getSetting('defaultCam', false);

  const micToggle = qs('#set-default-mic');
  const camToggle = qs('#set-default-cam');

  // Apply loaded states
  if (micToggle) {
    if (micDefault) { micToggle.classList.add('on'); micToggle.setAttribute('aria-pressed', 'true'); }
    else            { micToggle.classList.remove('on'); micToggle.setAttribute('aria-pressed', 'false'); }
  }
  if (camToggle) {
    if (camDefault) { camToggle.classList.add('on'); camToggle.setAttribute('aria-pressed', 'true'); }
    else            { camToggle.classList.remove('on'); camToggle.setAttribute('aria-pressed', 'false'); }
  }

  // Toggle switches with persistence
  qsa('.settings-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.classList.toggle('on');
      btn.setAttribute('aria-pressed', String(on));
      if (btn.id === 'set-default-mic') HireMindStore.saveSetting('defaultMic', on);
      if (btn.id === 'set-default-cam') HireMindStore.saveSetting('defaultCam', on);
    });
  });

  // Display Name settings input binding
  const usernameInput = qs('#set-username');
  if (usernameInput) {
    // Populate value initially
    usernameInput.value = HireMindStore.getSetting('username', 'HireMind User');
    usernameInput.addEventListener('input', (e) => {
      HireMindStore.saveSetting('username', e.target.value);
      window.updateProfileUI();
    });
  }

  // Clear all data
  qs('#set-clear-data')?.addEventListener('click', () => {
    if (!confirm('Clear all interview history and stats? This cannot be undone.')) return;
    HireMindStore.clearAll();
    showToast(
      `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
      'All interview history cleared.'
    );
    ['val-total','val-best','val-avg'].forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.textContent = id === 'val-total' ? '0' : '0%';
    });
    const h = qs('#val-hours'); if (h) h.textContent = '0h';
  });

  // ── AI Backend connectivity check ──
  (async function checkBackendStatus() {
    const statusEl = qs('#set-backend-status');
    if (!statusEl) return;
    try {
      const res = await fetch('/', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        statusEl.textContent = 'Connected';
        statusEl.style.color = '#22c55e';
      } else {
        statusEl.textContent = 'Error (' + res.status + ')';
        statusEl.style.color = '#ef4444';
      }
    } catch (_) {
      statusEl.textContent = 'Offline';
      statusEl.style.color = '#ef4444';
    }
  })();

  // Wire Quick-Access sidebar buttons to section switches
  [['qnav-new-interview', 'interviews'],
   ['qnav-history',       'history'],
   ['qnav-profile',       'profile']].forEach(([id, sec]) => {
    qs(`#${id}`)?.addEventListener('click', e => {
      e.preventDefault();
      window._showSection?.(sec);
      // Sync nav active state
      const label = sec;
      qsa('.nav-links li a, .mobile-nav a').forEach(a => {
        a.classList.toggle('active', a.textContent.trim().toLowerCase() === label);
      });
    });
  });

  // Upload Resume quick-access — show coming-soon toast
  qs('#qnav-resume')?.addEventListener('click', e => {
    e.preventDefault();
    showToast(
      '<svg viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
      'Resume upload coming soon! This feature is under development.', 4000
    );
  });
})();

/* ============================================================
   6.3  REPORT VIEW MODAL (HISTORY OVERLAY)
   ============================================================ */
(function initReportOverlay() {
  const overlay = qs('#report-overlay');
  const backdrop = qs('#report-backdrop');
  const closeBtn = qs('#report-close-btn');
  const body = qs('#report-modal-body');
  const chipLabel = qs('#report-chip-label');
  const categoryChip = qs('#report-category-chip');

  if (!overlay) return;

  function openReportModal(sessionId) {
    const sessions = HireMindStore.getSessions();
    const session = sessions.find(s => s.id == sessionId);
    if (!session || !session.report) return;

    if (chipLabel) chipLabel.textContent = session.categoryLabel || 'Interview';
    if (categoryChip) {
      categoryChip.className = 'setup-category-chip';
      categoryChip.classList.add(`chip-${session.category || 'hr'}`);
    }

    _renderReport(session.report, '#report-modal-body');
    overlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeReportModal() {
    overlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (body) body.innerHTML = '';
  }

  // Use event delegation for dynamically loaded history items
  document.addEventListener('click', e => {
    const btn = e.target.closest('.view-report-btn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      openReportModal(btn.dataset.id);
    }
  });

  closeBtn?.addEventListener('click', closeReportModal);
  backdrop?.addEventListener('click', closeReportModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) {
      closeReportModal();
    }
  });
})();

/* ============================================================
   7. TOAST NOTIFICATION SYSTEM
   ============================================================ */
function showToast(iconHtml, message, duration = 4000) {
  const container = qs('#toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `${iconHtml}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ============================================================
   8. ACTIVITY FEED — Add Entry Helper
   ============================================================ */
function addActivityEntry(color, text) {
  const feed = qs('.activity-timeline');
  if (!feed) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const item = document.createElement('div');
  item.className = 'activity-item';
  item.style.cssText = 'opacity:0;transform:translateX(-12px);transition:opacity .4s ease,transform .4s cubic-bezier(.34,1.56,.64,1)';
  item.innerHTML = `
    <div class="activity-dot-col" aria-hidden="true">
      <span class="activity-dot ${color}"></span>
      <span class="activity-line"></span>
    </div>
    <div class="activity-content">
      <p class="activity-text">${text}</p>
      <span class="activity-time">${timeStr}</span>
    </div>
  `;

  feed.insertBefore(item, feed.firstChild);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    item.style.opacity = '1';
    item.style.transform = 'translateX(0)';
  }));

  // Cap at 8 entries
  while (feed.children.length > 8) {
    const last = feed.lastElementChild;
    if (last) { last.style.opacity = '0'; setTimeout(() => last.remove(), 400); }
  }
}

/* ============================================================
   9. LIVE ACTIVITY EVENTS (cosmetic auto-feed)
   ============================================================ */
(function initLiveActivity() {
  const events = [
    { color: 'cyan', text: '<strong>AI Engine heartbeat</strong> — All interview modules responding normally.' },
    { color: 'violet', text: '<strong>Question Bank updated</strong> — 240 new behavioral questions loaded.' },
    { color: 'green', text: '<strong>Resume Analysis ready</strong> — Upload your CV for instant AI feedback.' },
    { color: 'blue', text: '<strong>Performance Tracking</strong> — Progress graph synced to your profile.' },
    { color: 'cyan', text: '<strong>AI Recruiter Avatar</strong> — New personality model: "Senior Tech Lead" available.' },
  ];

  let idx = 0;
  let _liveActivityInterval = null; // FIX: store the ID so we can clear it

  setTimeout(() => {
    addActivityEntry(events[idx % events.length].color, events[idx % events.length].text);
    idx++;
    if (!_liveActivityInterval) { // FIX: guard against duplicate intervals
      _liveActivityInterval = setInterval(() => {
        addActivityEntry(events[idx % events.length].color, events[idx % events.length].text);
        idx++;
      }, 20000);
    }
  }, 15000);

  /* Exposed so the interview session can pause cosmetic feed updates */
  window._liveActivity = {
    stop() {
      if (_liveActivityInterval) { clearInterval(_liveActivityInterval); _liveActivityInterval = null; }
    },
    start() {
      if (_liveActivityInterval) return; // already running
      _liveActivityInterval = setInterval(() => {
        addActivityEntry(events[idx % events.length].color, events[idx % events.length].text);
        idx++;
      }, 20000);
    }
  };
})();

/* ============================================================
   10. MOUSE PARALLAX — Orb Tracking
   ============================================================ */
(function initParallax() {
  const orb1 = qs('.orb-1');
  const orb2 = qs('.orb-2');
  const orb3 = qs('.orb-3');
  if (!orb1 || !orb2 || !orb3) return;

  let tX = 0, tY = 0, cX = 0, cY = 0;
  let _rafId  = null;   // FIX: store the RAF handle so we can cancel it
  let _running = false; // FIX: explicit running flag prevents an unstoppable loop

  window.addEventListener('mousemove', (e) => {
    tX = (e.clientX / window.innerWidth - 0.5) * 30;
    tY = (e.clientY / window.innerHeight - 0.5) * 30;
  });

  function animate() {
    if (!_running) return;   // FIX: bail out immediately when stopped
    cX += (tX - cX) * 0.04;
    cY += (tY - cY) * 0.04;
    orb1.style.transform = `translate(${cX * .8}px, ${cY * .8}px)`;
    orb2.style.transform = `translate(${-cX * .6}px, ${-cY * .6}px)`;
    orb3.style.transform = `translate(${cX * 1.2}px, ${cY * 1.2}px) translateX(-50%) translateY(-50%)`;
    _rafId = requestAnimationFrame(animate); // FIX: capture handle
  }

  /* Exposed so session management can pause the loop during interviews */
  window._parallax = {
    start() {
      if (_running) return;
      _running = true;
      _rafId = requestAnimationFrame(animate);
    },
    stop() {
      _running = false;
      if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
    }
  };

  window._parallax.start();
})();

/* ============================================================
   11. PANEL CURSOR SPOTLIGHT
   ============================================================ */
(function initPanelSpotlight() {
  qsa('.glass-panel').forEach(panel => {
    panel.addEventListener('mousemove', (e) => {
      const r = panel.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      panel.style.backgroundImage = `
        radial-gradient(circle at ${x}% ${y}%, rgba(0,212,255,.04) 0%, transparent 50%),
        linear-gradient(135deg, rgba(0,212,255,.08) 0%, rgba(124,58,237,.08) 100%)
      `;
    });
    panel.addEventListener('mouseleave', () => { panel.style.backgroundImage = ''; });
  });
})();

/* ============================================================
   12. AVATAR KEYBOARD A11Y
   ============================================================ */
(function initAvatarA11y() {
  const avatar = qs('#nav-avatar');
  if (!avatar) return;
  avatar.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); avatar.click(); }
  });
})();

/* ============================================================
   13. INTERVIEW SESSION & COMPLETE NAVIGATION
   ============================================================ */
(function initSessionNavigation() {

  /* ── API CONFIG ────────────────────────────────────────── */
  const API_BASE = window.location.origin;

  /* ── FALLBACK sample questions (used when backend is offline) */
  const sampleQuestions = {
    hr: [
      { id: null, text: "Tell me about yourself and your academic background.", difficulty: "Easy", topic: "Introduction", hint: "Structure it: background, key achievements, and core interests." },
      { id: null, text: "Why do you want to join our organization, and what value can you bring?", difficulty: "Easy", topic: "Company Fit", hint: "Show you researched the company and connect their mission with your skills." },
      { id: null, text: "What are your long-term career goals for the next five years?", difficulty: "Easy", topic: "Career Path", hint: "Discuss growth, learning, and alignment with company goals." },
      { id: null, text: "Describe a time you faced a difficult conflict in a team project and how you resolved it.", difficulty: "Medium", topic: "Conflict Resolution", hint: "Use the STAR method (Situation, Task, Action, Result)." },
      { id: null, text: "What is your greatest weakness, and what steps have you taken to improve it?", difficulty: "Medium", topic: "Self Awareness", hint: "Choose a real weakness and focus on your improvement steps." }
    ],
    web: {
      "1": [
        { id: null, text: "Introduce yourself. Why are you interested in Web Development and how are you starting to learn HTML, CSS, and JS?", difficulty: "Easy", topic: "Self Intro", hint: "Talk about your background, web projects or online courses." },
        { id: null, text: "What is the difference between HTML `<div>` and `<span>` tags? Explain block vs inline layout.", difficulty: "Easy", topic: "HTML/CSS Basics", hint: "Div is block-level (full width); Span is inline (wraps content)." },
        { id: null, text: "What is the difference between `let`, `const`, and `var` in JavaScript?", difficulty: "Easy", topic: "JS Fundamentals", hint: "Var is function-scoped; Let and Const are block-scoped." },
        { id: null, text: "What is the DOM (Document Object Model) and how does JavaScript interact with it?", difficulty: "Easy", topic: "DOM Basics", hint: "DOM represents document structure as nodes manipulated by JS." },
        { id: null, text: "How do you ensure a web page looks good on both mobile screens and desktop monitors?", difficulty: "Easy", topic: "Responsive Web", hint: "Use CSS media queries, responsive units, and flexbox/grid." }
      ],
      "2": [
        { id: null, text: "Explain event bubbling and event capturing in JavaScript. How does event delegation work?", difficulty: "Medium", topic: "Event Handling", hint: "Bubbling propagates up; Event delegation uses single parent listener." },
        { id: null, text: "What is the difference between CSS Flexbox and CSS Grid?", difficulty: "Medium", topic: "Frontend Layout", hint: "Flexbox is 1D (row/col); Grid is 2D (rows AND cols)." },
        { id: null, text: "How do Promises and `async/await` work in JavaScript when making API requests?", difficulty: "Medium", topic: "Async JS", hint: "Promises manage async operations; async/await is cleaner syntax." },
        { id: null, text: "Explain HTTP methods (GET, POST, PUT, DELETE) and standard status codes (200, 404, 500).", difficulty: "Medium", topic: "REST APIs", hint: "GET reads, POST creates, PUT updates, DELETE removes. 200 OK, 404 Not Found." },
        { id: null, text: "Describe a team web project you worked on recently. How did you handle version control?", difficulty: "Medium", topic: "Web Project", hint: "Discuss Git branches, PRs, merge conflicts, and team collaboration." }
      ],
      "3": [
        { id: null, text: "Explain Client-Side Rendering (CSR) vs Server-Side Rendering (SSR). What are trade-offs for SEO?", difficulty: "Medium", topic: "Rendering Systems", hint: "CSR renders in browser; SSR pre-renders on server for better SEO." },
        { id: null, text: "In React (or your framework), explain Props vs State and component lifecycle.", difficulty: "Medium", topic: "Frontend Frameworks", hint: "Props are read-only inputs; State is local mutable component data." },
        { id: null, text: "What is CORS and how do you secure web APIs using JWT authentication?", difficulty: "Medium", topic: "Web Security & Auth", hint: "CORS controls cross-origin requests; JWT tokens store signed headers." },
        { id: null, text: "How do you optimize web application performance (lazy loading, code splitting, CDN)?", difficulty: "Medium", topic: "Web Optimization", hint: "Reduce bundle size, defer offscreen assets, cache on CDN." },
        { id: null, text: "Walk me through a full-stack project you built connecting frontend to backend database.", difficulty: "Medium", topic: "Fullstack Project", hint: "Detail API integration, state management, DB persistence, and hosting." }
      ],
      "4": [
        { id: null, text: "How would you design the web architecture for a real-time collaborative app scaling to 100k active users?", difficulty: "Hard", topic: "Web Architecture", hint: "Use WebSockets, Redis pub-sub, stateless node workers, DB sharding." },
        { id: null, text: "Explain OWASP Top 10 vulnerabilities (XSS, CSRF, SQL Injection) and how to prevent each.", difficulty: "Hard", topic: "Web Security", hint: "Sanitize inputs (XSS), anti-CSRF tokens, parameterized queries (SQLi)." },
        { id: null, text: "Compare WebSockets, Server-Sent Events (SSE), and HTTP Long Polling for real-time communication.", difficulty: "Hard", topic: "Real-time Protocols", hint: "WebSockets=duplex, SSE=server stream, Long Polling=repeated client requests." },
        { id: null, text: "How do you set up a Web CI/CD pipeline with Docker, E2E tests, and zero-downtime deployment?", difficulty: "Hard", topic: "Web DevOps", hint: "Automate build, test with Cypress, containerize, and deploy to cloud." },
        { id: null, text: "Tell me about a critical production performance bug you resolved in a live web app.", difficulty: "Hard", topic: "Web Leadership", hint: "Detail profiling tools, root cause analysis, and measurable optimization." }
      ]
    },
    data: {
      "1": [
        { id: null, text: "Introduce yourself. Why are you interested in Data Analytics and how do you work with data?", difficulty: "Easy", topic: "Introduction", hint: "Mention background, interest in data insights, and tools like Excel." },
        { id: null, text: "What is the difference between VLOOKUP and XLOOKUP in Microsoft Excel?", difficulty: "Easy", topic: "Spreadsheets", hint: "XLOOKUP searches any direction and defaults to exact match." },
        { id: null, text: "Explain Mean, Median, and Mode. When is Median preferred over Mean?", difficulty: "Easy", topic: "Descriptive Stats", hint: "Median is middle value; preferred when data has extreme outliers." },
        { id: null, text: "What is the difference between a Bar Chart and a Line Chart? When should you use each?", difficulty: "Easy", topic: "Data Visualization", hint: "Bar charts compare categories; Line charts show continuous trends." },
        { id: null, text: "How do you organize messy data in a spreadsheet before beginning analysis?", difficulty: "Easy", topic: "Data Preparation", hint: "Remove duplicates, fix formatting, handle missing values." }
      ],
      "2": [
        { id: null, text: "Write the SQL query structure to select records where `sales > 10000` grouped by region.", difficulty: "Medium", topic: "SQL Queries", hint: "SELECT region, SUM(sales) FROM data WHERE sales > 10000 GROUP BY region;" },
        { id: null, text: "What is data cleaning, and how do you handle missing values in a dataset?", difficulty: "Medium", topic: "Data Cleaning", hint: "Impute mean/median for numerical data, mode for categorical, or drop if sparse." },
        { id: null, text: "In Python Pandas, what is the difference between a Series and a DataFrame?", difficulty: "Medium", topic: "Python Pandas", hint: "Series is a 1D labeled array; DataFrame is a 2D tabular structure." },
        { id: null, text: "Explain Population vs Sample in statistics. Why is random sampling essential?", difficulty: "Medium", topic: "Statistical Sampling", hint: "Population is entire set; Sample is subset. Random sampling avoids bias." },
        { id: null, text: "Describe a project where you analyzed a dataset to extract actionable insights.", difficulty: "Medium", topic: "Analytics Project", hint: "Explain dataset, tools (Excel/SQL/Python), metrics, and conclusions." }
      ],
      "3": [
        { id: null, text: "Explain SQL Joins (INNER, LEFT, RIGHT, FULL) with a concrete business example.", difficulty: "Medium", topic: "Advanced SQL", hint: "INNER matches both; LEFT keeps all left; FULL keeps all records." },
        { id: null, text: "What is Exploratory Data Analysis (EDA)? Walk me through your step-by-step process.", difficulty: "Medium", topic: "Analytics Pipeline", hint: "Inspect shape, dtypes, summary stats, missing values, correlation." },
        { id: null, text: "How do you calculate Key Performance Indicators (KPIs) like CAC and Retention Rate?", difficulty: "Medium", topic: "Business Intelligence", hint: "CAC = Total Marketing / New Customers; Retention = Active / Starting." },
        { id: null, text: "Explain hypothesis testing, null hypothesis ($H_0$), p-value, and significance level.", difficulty: "Medium", topic: "Inferential Stats", hint: "H0 assumes no effect; Reject H0 if p-value < alpha (0.05)." },
        { id: null, text: "Describe a dashboard you built in Tableau/Power BI to communicate findings.", difficulty: "Medium", topic: "BI Dashboards", hint: "Focus on executive KPIs at top, trends in middle, interactive filters." }
      ],
      "4": [
        { id: null, text: "What are SQL Window Functions (`ROW_NUMBER()`, `RANK()`, `LEAD()`, `LAG()`)? Give an example query.", difficulty: "Hard", topic: "Complex SQL", hint: "RANK() OVER (PARTITION BY dept ORDER BY sales DESC) ranks within group." },
        { id: null, text: "How do you design and evaluate an A/B test for a major product feature?", difficulty: "Hard", topic: "Experimental Design", hint: "Define metric, calculate sample size for power, split traffic, run t-test." },
        { id: null, text: "Explain dimensional modeling in Data Warehousing: Star Schema vs Snowflake Schema.", difficulty: "Hard", topic: "Data Warehousing", hint: "Fact tables contain metrics; Dimension tables contain descriptive context." },
        { id: null, text: "How do you handle big datasets in Python when operations exceed available RAM?", difficulty: "Hard", topic: "Big Data Analytics", hint: "Process in chunks via Pandas chunksize, use Parquet format, or PySpark." },
        { id: null, text: "Describe a scenario where your data analysis led to a recommendation contested by stakeholders.", difficulty: "Hard", topic: "Stakeholder Management", hint: "Use STAR method: detail data validation, sensitivity tests, visual evidence." }
      ]
    },
    sde: {
      "1": [
        { id: null, text: "Introduce yourself. Why did you choose Software Development as your career goal?", difficulty: "Easy", topic: "Self Intro", hint: "Summarize your background, interests, and coding journey." },
        { id: null, text: "What is the difference between a variable and a constant in programming?", difficulty: "Easy", topic: "Fundamentals", hint: "Variable values change; constants are fixed immutable values." },
        { id: null, text: "Explain `if-else` vs `switch` statement in programming logic.", difficulty: "Easy", topic: "Control Flow", hint: "If-else evaluates dynamic booleans; Switch evaluates discrete values." },
        { id: null, text: "What is an array and how do you access elements in a basic language?", difficulty: "Easy", topic: "Data Structures", hint: "Arrays store elements sequentially using 0-based indexing." },
        { id: null, text: "How do you approach debugging when code produces an unexpected error?", difficulty: "Easy", topic: "Debugging", hint: "Inspect print logs, check edge inputs, step through line by line." }
      ],
      "2": [
        { id: null, text: "Explain Object-Oriented Programming (OOP) and its 4 main pillars.", difficulty: "Medium", topic: "OOP Principles", hint: "Encapsulation, Inheritance, Polymorphism, Abstraction." },
        { id: null, text: "What is the difference between Array and Linked List in memory structure?", difficulty: "Medium", topic: "Data Structures", hint: "Array has contiguous memory O(1) access; Linked list uses pointers." },
        { id: null, text: "Explain Stack vs Queue in data structures with real-world applications.", difficulty: "Medium", topic: "Data Structures", hint: "Stack is LIFO (undo buffer); Queue is FIFO (task processing)." },
        { id: null, text: "What is time complexity of Linear Search vs Binary Search?", difficulty: "Medium", topic: "Algorithms", hint: "Linear search is O(n); Binary search is O(log n) on sorted array." },
        { id: null, text: "Describe a team project where you fixed a tricky bug during integration.", difficulty: "Medium", topic: "Team Debugging", hint: "Discuss reproduction steps, isolating module bug, writing tests." }
      ],
      "3": [
        { id: null, text: "How would you design a simple RESTful API for a library system?", difficulty: "Medium", topic: "API Design", hint: "Define endpoints, GET/POST/PUT/DELETE verbs, and standard status codes." },
        { id: null, text: "Explain SQL vs NoSQL databases. When would you choose NoSQL?", difficulty: "Medium", topic: "Databases", hint: "SQL has strict schema ACID; NoSQL scales horizontally BASE." },
        { id: null, text: "Explain Singleton and Factory design patterns with practical software examples.", difficulty: "Medium", topic: "Design Patterns", hint: "Singleton ensures 1 instance; Factory encapsulates object creation." },
        { id: null, text: "What is the difference between Process and Thread, and how does virtual memory work?", difficulty: "Medium", topic: "Operating Systems", hint: "Process has isolated memory; Threads share process memory space." },
        { id: null, text: "Describe a complex software project you built using the STAR method.", difficulty: "Medium", topic: "Project Work", hint: "Explain Situation, Task, Action (tech stack), and quantitative Result." }
      ],
      "4": [
        { id: null, text: "How would you design a scalable URL shortener or notification service for millions of users?", difficulty: "Hard", topic: "System Design", hint: "Use load balancers, Redis cache, Kafka queues, database partitioning." },
        { id: null, text: "Explain the CAP theorem in distributed systems during network partitions.", difficulty: "Hard", topic: "Distributed Systems", hint: "Consistency vs Availability trade-offs under network partition tolerance." },
        { id: null, text: "How do you detect and resolve memory leaks or CPU bottlenecks in production?", difficulty: "Hard", topic: "Performance Optimization", hint: "Use memory profilers, heap dumps, flame graphs, and query tuning." },
        { id: null, text: "How do you refactor a legacy codebase without breaking existing API functionality?", difficulty: "Hard", topic: "Software Quality", hint: "Write integration tests first, use Strangler Fig pattern, deploy safely." },
        { id: null, text: "Tell me about a technical decision you regretted. What did you learn?", difficulty: "Hard", topic: "Engineering Judgement", hint: "Share trade-off analysis, honest retrospectives, and corrective actions." }
      ]
    },
    company: [
      { id: null, text: "Why do you want to work at this company specifically? What excites you about its products?", difficulty: "Easy", topic: "Company Fit", hint: "Research the company's culture, values, and recent projects before answering." },
      { id: null, text: "Given an array of integers, find two numbers that sum to a target value.", difficulty: "Medium", topic: "Algorithms", hint: "Think about hash maps for O(n) time complexity (Two Sum pattern)." },
      { id: null, text: "How would you design a scalable notification system that handles millions of users?", difficulty: "Hard", topic: "System Design", hint: "Discuss message queues (Kafka/SQS), fan-out patterns, and delivery guarantees." },
      { id: null, text: "Tell me about a time you disagreed with a technical decision and how you handled it.", difficulty: "Medium", topic: "Behavioral", hint: "Use the STAR method. Show data-driven reasoning and respect for team decisions." },
      { id: null, text: "What is the difference between horizontal and vertical scaling? When would you choose each?", difficulty: "Medium", topic: "System Design", hint: "Cover stateless services (horizontal) vs. resource upgrades (vertical) and trade-offs." }
    ],
    custom: [
      { id: null, text: "Describe your background and interest in your chosen custom interview topic.", difficulty: "Easy", topic: "Background", hint: "Focus on your learning journey, projects, and motivation." },
      { id: null, text: "What are the core foundational principles of your target subject area?", difficulty: "Easy", topic: "Fundamentals", hint: "Define the key terms, use cases, and core mechanisms." },
      { id: null, text: "Tell me about a project or practical application where you applied these concepts.", difficulty: "Medium", topic: "Project Work", hint: "Explain the problem, your technical approach, and key takeaways." },
      { id: null, text: "Describe a complex problem you encountered in this domain and how you debugged it.", difficulty: "Hard", topic: "Problem Solving", hint: "Detail your troubleshooting methodology, tools used, and results." },
      { id: null, text: "How do you stay updated with advances and best practices in this field?", difficulty: "Easy", topic: "Continuous Learning", hint: "Discuss technical blogs, documentation, open source, and projects." }
    ]
  };

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const categoryLabels = {
    hr: 'HR Interview',
    sde: 'Software Developer Interview',
    web: 'Web Developer Interview',
    data: 'Data Analyst Interview',
    custom: 'Custom Interview',
    company: 'Company-Specific Interview',
  };

  /* â”€â”€ SESSION STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  let sessionState = {
    activeCategory: 'hr',
    activeYear: '1',
    activeBranch: 'cse',
    activeDomain: 'web-dev',
    activeSubjects: [],
    questions: [],           // [{id, text, difficulty, topic, hint}, ...]
    currentIndex: 0,
    answers: [],             // raw text per question
    skips: [],               // bool per question
    evaluations: [],         // {score, feedback} per question (from API)
    sessionId: null,         // backend session ID
    isBackendOnline: false,  // whether API calls succeeded
    startTime: null,
    timerSecondsRemaining: 90,
    timerDuration: 90,
    timerInterval: null,
    isMicOn: false,
    isCamOn: false,
    mediaStream: null,
    isSessionActive: false,
    recognition: null,
    isRecognitionActive: false,
    preSpeechText: '',
    isSpeechRestarting: false
  };

  let micInterval = null;

  /* â”€â”€ DOM REFS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const isessEndBtn = qs('#isess-end-btn');
  const scompleteRetryBtn = qs('#scomplete-retry-btn');
  const scompleteDashboardBtn = qs('#scomplete-dashboard-btn');
  const isessSkipBtn = qs('#isess-skip-btn');
  const isessNextBtn = qs('#isess-next-btn');
  const isessMicBtn = qs('#isess-mic-btn');
  const isessCamBtn = qs('#isess-cam-btn');
  const isessTextarea = qs('#isess-textarea');
  const isessCharCount = qs('#isess-char-count');
  const interviewSession = qs('#interview-session');
  const sessionComplete = qs('#session-complete');
  const navbar = qs('.navbar');
  const mobileNav = qs('#mobile-nav');
  const pageWrapper = qs('.page-wrapper');

  /* â”€â”€ LOADING OVERLAY HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function showLoadingOverlay(message = 'AI is thinkingâ€¦') {
    let overlay = qs('#hiremind-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hiremind-loading-overlay';
      overlay.innerHTML = `
        <div class="hm-loading-box">
          <div class="hm-loading-spinner"></div>
          <p class="hm-loading-msg"></p>
        </div>`;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('.hm-loading-msg').textContent = message;
    overlay.classList.add('active');
  }

  function hideLoadingOverlay() {
    const overlay = qs('#hiremind-loading-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  function setNextBtnLoading(loading) {
    if (!isessNextBtn) return;
    const label = qs('#isess-next-label');
    if (loading) {
      isessNextBtn.disabled = true;
      if (label) label.textContent = 'Evaluatingâ€¦';
    } else {
      isessNextBtn.disabled = false;
    }
  }

  /* â”€â”€ API HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function showErrorToast(message) {
    showToast(
      '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      message, 5000
    );
  }

  function showSuccessToast(message) {
    showToast(
      '<svg viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>',
      message, 4000
    );
  }

  /* â”€â”€ MAIN ENTRY POINT (called by setup modal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.startInterviewSession = async function (category, year, branch, domain, subjects) {
    sessionState.activeCategory = category;
    sessionState.activeYear = year || '1';
    sessionState.activeBranch = branch || 'other';
    sessionState.activeDomain = domain || 'other';
    sessionState.activeSubjects = subjects || [];
    sessionState.sessionId = null;
    sessionState.isBackendOnline = false;
    sessionState.evaluations = [];

    // —— Show UI immediately, then load questions ——————————————
    _showSessionScreen(category);

    // Show AI loading overlay while fetching questions
    showLoadingOverlay('Interviewer AI is crafting your questions...');

    let questions = [];

    try {
      // 1. Create backend session
      const subjectsStr = (subjects || []).join(',');
      const sessionData = await apiPost('/api/sessions/', {
        category, branch, domain,
        subjects: subjectsStr,
        year: year || '1'
      });
      sessionState.sessionId = sessionData.id;
      sessionState.isBackendOnline = true;

      // 2. Generate AI questions for this session
      const aiQuestions = await apiPost(`/api/sessions/${sessionData.id}/generate-questions`, {});
      if (aiQuestions && aiQuestions.length > 0) {
        questions = aiQuestions;
        showSuccessToast('✨ AI-generated questions loaded!');
      } else {
        throw new Error('No questions returned from AI.');
      }
    } catch (err) {
      console.warn('Backend unavailable, using fallback questions:', err.message);
      showErrorToast('Backend offline — using built-in questions. Start backend for AI mode.');

      // Fallback to sample questions (Domain x Year aware)
      let pool = null;
      const yrKey = String(year || '1');
      const domKey = (domain || category || '').toLowerCase();
      if (domKey.includes('web') && sampleQuestions.web) {
        pool = sampleQuestions.web[yrKey] || sampleQuestions.web['1'];
      } else if ((domKey.includes('data') || domKey.includes('analyst')) && sampleQuestions.data) {
        pool = sampleQuestions.data[yrKey] || sampleQuestions.data['1'];
      } else if (sampleQuestions.sde && sampleQuestions.sde[yrKey]) {
        pool = sampleQuestions.sde[yrKey];
      } else {
        pool = sampleQuestions[category] || sampleQuestions['custom'];
      }
      const shuffled = [...(pool || sampleQuestions.custom)].sort(() => 0.5 - Math.random());
      questions = shuffled.slice(0, 5);
    } finally {
      hideLoadingOverlay();
    }

    // —— Initialise state ——————————————————————————————————————
    sessionState.questions = questions;
    sessionState.currentIndex = 0;
    sessionState.answers = Array(questions.length).fill('');
    sessionState.skips = Array(questions.length).fill(false);
    sessionState.evaluations = Array(questions.length).fill(null);
    sessionState.startTime = new Date();
    sessionState.isSessionActive = true;

    // —— Render question dots ——————————————————————————————————
    const dotsRow = qs('#isess-dots-row');
    if (dotsRow) {
      dotsRow.innerHTML = '';
      questions.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'isess-dot-item';
        dot.dataset.index = i;
        dotsRow.appendChild(dot);
      });
    }

    loadQuestion(0);
  };

  /* â”€â”€ SHOW/HIDE SESSION SCREEN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function _showSessionScreen(category) {
    // Reset camera & mic states
    sessionState.isMicOn = false;
    sessionState.isCamOn = false;
    if (isessMicBtn) isessMicBtn.classList.add('off');
    if (isessCamBtn) isessCamBtn.classList.add('off');

    // Autostart microphone and camera based on settings
    setTimeout(() => {
      const micDefault = HireMindStore.getSetting('defaultMic', true);
      const camDefault = HireMindStore.getSetting('defaultCam', false);
      if (micDefault && !sessionState.isMicOn) toggleMic();
      if (camDefault && !sessionState.isCamOn) toggleCamera();
    }, 200);

    const camVideo = qs('#isess-cam-video');
    const placeholder = qs('#isess-cam-placeholder');
    const offBadge = qs('#isess-cam-off-badge');
    if (camVideo) { camVideo.srcObject = null; camVideo.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
    if (offBadge) offBadge.hidden = false;

    if (micInterval) { clearInterval(micInterval); micInterval = null; }
    qsa('#isess-mic-viz span').forEach(s => s.style.height = '3px');

    // Reset report toggle button for a fresh session
    const rToggleWrap = qs('#scomplete-report-toggle-wrap');
    const rToggleBtn  = qs('#scomplete-report-toggle-btn');
    const rToggleLbl  = qs('#scomplete-report-toggle-label');
    const rSection    = qs('#scomplete-report-section');
    if (rToggleWrap) rToggleWrap.style.display = 'none';
    if (rToggleBtn) {
      rToggleBtn.setAttribute('aria-expanded', 'false');
      delete rToggleBtn.dataset.reportToggleInit;
    }
    if (rToggleLbl) rToggleLbl.textContent = 'View AI Performance Report';
    if (rSection) { rSection.style.display = 'none'; rSection.innerHTML = ''; }

    // Pause background animations while the interview screen is active
    // to stop the infinite RAF loop and live-activity interval from running
    // against invisible DOM elements and wasting memory.
    window._parallax?.stop();
    window._liveActivity?.stop();

    // Switch panels
    if (navbar) navbar.style.display = 'none';
    if (mobileNav) mobileNav.style.display = 'none';
    if (pageWrapper) pageWrapper.style.display = 'none';
    if (interviewSession) {
      interviewSession.removeAttribute('hidden');
      interviewSession.style.display = '';
    }

    // Set label
    const label = categoryLabels[category] || 'Interview';
    window.currentInterviewLabel = label;
    const sessionCatLabel = qs('#isess-cat-label');
    if (sessionCatLabel) sessionCatLabel.textContent = label;
  }


  /* â”€â”€ LOAD & RENDER QUESTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function loadQuestion(index) {
    if (!sessionState.isSessionActive) return;
    sessionState.currentIndex = index;

    const total = sessionState.questions.length;
    const q = sessionState.questions[index];

    // Reset textarea
    if (isessTextarea) {
      isessTextarea.value = sessionState.answers[index] || '';
      if (isessCharCount) {
        isessCharCount.textContent = `${isessTextarea.value.length} / 1000`;
      }
    }

    // Next / Finish button label
    const nextLabel = qs('#isess-next-label');
    if (nextLabel) {
      nextLabel.textContent = (index + 1 === total) ? 'Finish Interview' : 'Next Question';
    }

    // Counters & progress
    const qCounter = qs('#isess-q-counter');
    if (qCounter) qCounter.textContent = `Question ${index + 1} of ${total}`;

    const progFill = qs('#isess-prog-fill');
    if (progFill) progFill.style.width = `${((index + 1) / total) * 100}%`;

    const qNumTag = qs('#isess-q-num-tag');
    if (qNumTag) qNumTag.textContent = `${index + 1 < 10 ? '0' : ''}${index + 1} / ${total < 10 ? '0' : ''}${total}`;

    // Difficulty / Topic pills
    const diffPill = qs('#isess-diff-pill');
    if (diffPill) {
      diffPill.textContent = q.difficulty;
      diffPill.className = `isess-diff-pill pill-${q.difficulty.toLowerCase()}`;
    }
    const topicPill = qs('#isess-topic-pill');
    if (topicPill) topicPill.textContent = q.topic;

    // Question text & hint — hint is hidden by default, revealed only on user request
    const qText = qs('#isess-question-text');
    if (qText) qText.textContent = q.text;

    // Store hint text but keep panel collapsed until candidate clicks "Need a Hint?"
    const hintText = qs('#isess-hint-text');
    if (hintText) hintText.textContent = q.hint || '';
    const hintBar = qs('#isess-hint-bar');
    const hintToggle = qs('#isess-hint-toggle');
    if (hintBar) { hintBar.hidden = true; }
    if (hintToggle) { hintToggle.setAttribute('aria-expanded', 'false'); hintToggle.classList.remove('active'); }

    // Update dot states
    qsa('.isess-dot-item').forEach((dot, i) => {
      dot.className = 'isess-dot-item';
      if (i === index) dot.classList.add('active');
      else if (i < index) dot.classList.add(sessionState.skips[i] ? 'skipped' : 'completed');
    });

    // AI Speaking waveform
    const aiWaveform = qs('#isess-waveform');
    const aiStatusText = qs('#isess-ai-status-text');
    if (aiWaveform) {
      aiWaveform.classList.add('speaking');
      if (aiStatusText) aiStatusText.textContent = 'AI Recruiter speakingâ€¦';
      setTimeout(() => {
        if (sessionState.currentIndex === index && sessionState.isSessionActive) {
          aiWaveform.classList.remove('speaking');
          if (aiStatusText) aiStatusText.textContent = 'AI Recruiter listening';
        }
      }, 3000);
    }

    startTimer();
  }

  /* â”€â”€ TIMER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function startTimer() {
    if (sessionState.timerInterval) clearInterval(sessionState.timerInterval);

    sessionState.timerSecondsRemaining = 90;
    const totalDuration = 90;
    const dashArray = 150.79;

    const timerVal = qs('#isess-timer-val');
    const ringProg = qs('#isess-ring-prog');

    function updateTimerUI() {
      const min = Math.floor(sessionState.timerSecondsRemaining / 60);
      const sec = sessionState.timerSecondsRemaining % 60;
      if (timerVal) timerVal.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;
      if (ringProg) {
        const offset = dashArray * (1 - sessionState.timerSecondsRemaining / totalDuration);
        ringProg.style.strokeDashoffset = offset;
      }
    }

    updateTimerUI();

    sessionState.timerInterval = setInterval(() => {
      if (!sessionState.isSessionActive) { clearInterval(sessionState.timerInterval); return; }

      sessionState.timerSecondsRemaining--;
      if (sessionState.timerSecondsRemaining < 0) {
        clearInterval(sessionState.timerInterval);
        disableMic();
        const typedText = isessTextarea ? isessTextarea.value.trim() : '';
        if (typedText) {
          sessionState.answers[sessionState.currentIndex] = typedText;
          sessionState.skips[sessionState.currentIndex] = false;
        } else {
          sessionState.answers[sessionState.currentIndex] = '';
          sessionState.skips[sessionState.currentIndex] = true;
        }
        if (sessionState.currentIndex + 1 < sessionState.questions.length) {
          loadQuestion(sessionState.currentIndex + 1);
        } else {
          endSession();
        }
      } else {
        updateTimerUI();
      }
    }, 1000);
  }

  /* â”€â”€ NEXT / SKIP / END â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function nextQuestion() {
    disableMic();
    if (sessionState.timerInterval) clearInterval(sessionState.timerInterval);

    const idx = sessionState.currentIndex;
    const answer = isessTextarea ? isessTextarea.value.trim() : '';

    sessionState.answers[idx] = answer;
    sessionState.skips[idx] = false;

    // —— Evaluate via backend if online ———————————————————————
    if (sessionState.isBackendOnline && sessionState.sessionId) {
      const qId = sessionState.questions[idx]?.id;
      if (qId) {
        try {
          setNextBtnLoading(true);
          const evalResult = await apiPost(`/api/questions/${qId}/evaluate`, {
            text: answer,
            is_skipped: false
          });
          sessionState.evaluations[idx] = {
            score: evalResult.score || 0,
            feedback: evalResult.feedback || ''
          };
        } catch (err) {
          console.warn('Evaluation failed:', err.message);
          sessionState.evaluations[idx] = { score: 0, feedback: 'Evaluation unavailable.' };
        } finally {
          setNextBtnLoading(false);
        }
      }
    }

    _advance();
  }

  async function skipQuestion() {
    disableMic();
    if (sessionState.timerInterval) clearInterval(sessionState.timerInterval);

    const idx = sessionState.currentIndex;
    sessionState.answers[idx] = '';
    sessionState.skips[idx] = true;

    // Record skipped answer in backend
    if (sessionState.isBackendOnline && sessionState.sessionId) {
      const qId = sessionState.questions[idx]?.id;
      if (qId) {
        apiPost(`/api/questions/${qId}/evaluate`, { text: '', is_skipped: true })
          .then(res => { sessionState.evaluations[idx] = { score: 0, feedback: 'Question skipped.' }; })
          .catch(() => { });
      }
    }

    _advance();
  }

  function _advance() {
    if (sessionState.currentIndex + 1 < sessionState.questions.length) {
      loadQuestion(sessionState.currentIndex + 1);
    } else {
      endSession();
    }
  }

  /* â”€â”€ END SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function endSession() {
    sessionState.isSessionActive = false;
    if (sessionState.timerInterval) clearInterval(sessionState.timerInterval);

    disableMic();
    if (micInterval) { clearInterval(micInterval); micInterval = null; }

    if (sessionState.mediaStream) {
      sessionState.mediaStream.getTracks().forEach(t => t.stop());
      sessionState.mediaStream = null;
    }

    // Switch to complete panel immediately with basic stats
    if (interviewSession) { interviewSession.setAttribute('hidden', ''); interviewSession.style.display = 'none'; }
    if (sessionComplete) { sessionComplete.removeAttribute('hidden'); sessionComplete.style.display = ''; }

    // —— Basic stats ———————————————————————————————————————————
    const total = sessionState.questions.length;
    let answered = 0;
    let skipped = 0;
    sessionState.skips.forEach(s => s ? skipped++ : answered++);

    const elapsedMs = new Date() - sessionState.startTime;
    const totalSecs = Math.floor(elapsedMs / 1000);
    const timeTakenStr = `${Math.floor(totalSecs / 60)}m ${totalSecs % 60}s`;

    // Calculate local score from evaluations (AI scores) or simple ratio
    let aiScorePct = 0;
    const evalScores = sessionState.evaluations.filter(e => e && !isNaN(e.score));
    if (evalScores.length > 0 && sessionState.isBackendOnline) {
      const sum = evalScores.reduce((acc, e) => acc + (e.score || 0), 0);
      // Each question scored out of 10 â†’ convert to percentage
      aiScorePct = Math.round((sum / (total * 10)) * 100);
    } else {
      aiScorePct = Math.round((answered / total) * 100);
    }

    // Render basic stats
    const scompleteCatLabel = qs('#scomplete-cat-label');
    if (scompleteCatLabel) scompleteCatLabel.textContent = window.currentInterviewLabel;

    const answeredEl = qs('#scomplete-answered');
    const skippedEl = qs('#scomplete-skipped');
    const timeTakenEl = qs('#scomplete-time-taken');
    const scoreEl = qs('#scomplete-score');
    const progFill = qs('#scomplete-prog-fill');
    const progPct = qs('#scomplete-prog-pct');
    const completeMsg = qs('#scomplete-message');

    if (answeredEl) answeredEl.textContent = answered;
    if (skippedEl) skippedEl.textContent = skipped;
    if (timeTakenEl) timeTakenEl.textContent = timeTakenStr;
    if (scoreEl) scoreEl.textContent = `${aiScorePct}%`;
    if (progFill) progFill.style.width = `${aiScorePct}%`;
    if (progPct) progPct.textContent = `${aiScorePct}% Score`;

    if (completeMsg) {
      if (aiScorePct >= 80) {
        completeMsg.textContent = '🚀 Outstanding! Your readiness is exceptional. Keep it up!';
      } else if (aiScorePct >= 50) {
        completeMsg.textContent = 'ðŸ‘ Great job! You\'ve got a solid foundation. Continue practicing!';
      } else {
        completeMsg.textContent = '📚 Keep practicing — consistency is the key to interview success!';
      }
    }

    // —— Render Q&A review with AI evaluations —————————————————
    _renderReview();

    // —— Persist to localStorage ———————————————————————————————
    const sessionRecord = {
      id: sessionState.sessionId || Date.now(),
      date: new Date().toISOString(),
      category: sessionState.activeCategory,
      categoryLabel: window.currentInterviewLabel || 'Interview',
      year: sessionState.activeYear,
      branch: sessionState.activeBranch,
      domain: sessionState.activeDomain,
      subjects: (sessionState.activeSubjects || []).slice(),
      answered, skipped, total,
      scorePct: aiScorePct,
      timeTaken: timeTakenStr,
      totalSeconds: totalSecs
    };
    const updatedStats = HireMindStore.saveSession(sessionRecord);
    const displayStats = HireMindStore.computeDisplayStats(updatedStats);

    // Refresh dashboard counters
    const valTotal = qs('#val-total');
    const valBest = qs('#val-best');
    const valAvg = qs('#val-avg');
    const valHours = qs('#val-hours');
    if (valTotal) valTotal.textContent = String(displayStats.totalInterviews);
    if (valBest) valBest.textContent = displayStats.bestScore + '%';
    if (valAvg) valAvg.textContent = displayStats.avgScore + '%';
    if (valHours) valHours.textContent = displayStats.practiceHours + 'h';

    // ── Fetch AI Report from backend (async, updates UI when done) ─
    if (sessionState.isBackendOnline && sessionState.sessionId) {
      _fetchAndRenderReport(sessionState.sessionId);
    } else {
      const fallbackReport = generateFallbackReport();
      HireMindStore.updateSessionReport(sessionRecord.id, fallbackReport);
      _renderReport(fallbackReport);
      _showReportToggleBtn();
    }
  }

  /* â”€â”€ RENDER Q&A REVIEW LIST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function _renderReview() {
    const reviewList = qs('#scomplete-review-list');
    if (!reviewList) return;
    reviewList.innerHTML = '';

    sessionState.questions.forEach((q, i) => {
      const answer = (sessionState.answers[i] || '').trim();
      const isSkipped = sessionState.skips[i] === true || answer === '';
      const evalData = sessionState.evaluations[i];
      const hasEval = evalData && sessionState.isBackendOnline;

      const badgeClass = isSkipped ? 'skipped' : 'answered';
      const badgeText = isSkipped ? 'Skipped' : 'Answered';
      const idxStr = `Question ${i + 1 < 10 ? '0' : ''}${i + 1}`;

      const answerHtml = isSkipped
        ? `<div class="scomplete-review-answer-box skipped">No response provided (Skipped or Timed out).</div>`
        : `<div class="scomplete-review-answer-box">${escapeHtml(answer)}</div>`;

      // AI feedback block
      let aiFeedbackHtml = '';
      if (hasEval && !isSkipped) {
        const scoreColor = evalData.score >= 7 ? '#22c55e' : evalData.score >= 4 ? '#f59e0b' : '#ef4444';
        const scoreStars = Math.round(evalData.score / 2); // out of 5
        aiFeedbackHtml = `
          <div class="scomplete-ai-eval">
            <div class="scomplete-ai-eval-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
              AI Score: <strong style="color:${scoreColor}">${evalData.score}/10</strong>
            </div>
            <p class="scomplete-ai-feedback">${escapeHtml(evalData.feedback)}</p>
          </div>`;
      }

      const item = document.createElement('div');
      item.className = 'scomplete-review-item';
      item.innerHTML = `
        <div class="scomplete-review-header">
          <div class="scomplete-review-meta">
            <span class="scomplete-review-num">${idxStr}</span>
            <span class="isess-topic-pill">${escapeHtml(q.topic)}</span>
            <span class="isess-diff-pill pill-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
          </div>
          <span class="scomplete-review-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="scomplete-review-question">${escapeHtml(q.text)}</div>
        ${answerHtml}
        ${aiFeedbackHtml}
        <div class="scomplete-review-hint-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span><strong>Talking Points:</strong> ${escapeHtml(q.hint || '')}</span>
        </div>`;
      reviewList.appendChild(item);
    });
  }

  /* ── FALLBACK REPORT GENERATOR ──────────────────────────── */
  function generateFallbackReport() {
    const total = sessionState.questions.length;
    let answered = 0;
    let skipped = 0;
    sessionState.skips.forEach(s => s ? skipped++ : answered++);

    const scorePct = sessionState.isBackendOnline
      ? Math.round((sessionState.evaluations.reduce((sum, e) => sum + (e ? e.score : 0), 0) / (total * 10)) * 100)
      : Math.round((answered / total) * 100);

    const commScore = Math.max(40, Math.min(95, Math.round(scorePct * 0.95 + (Math.random() * 10 - 5))));
    const techScore = Math.max(35, Math.min(95, Math.round(scorePct * 1.02 + (Math.random() * 10 - 5))));
    const confScore = Math.max(45, Math.min(95, Math.round((answered / total) * 90 + (Math.random() * 10))));

    // Ideal Answers
    const idealAnswers = sessionState.questions.map((q, i) => {
      return {
        question: q.text,
        ideal: q.hint ? `Focus on: ${q.hint}. Address the core query directly, provide a clear structured example, and state the positive outcome or key takeaway.`
                     : "Provide a structured explanation defining the key terminology, followed by a concrete real-world scenario illustrating the application."
      };
    });

    const report = {
      overall_feedback: `Offline Session Summary: You answered ${answered} out of ${total} questions. ${scorePct >= 80 ? 'You demonstrated an excellent understanding of the domain concepts.' : scorePct >= 50 ? 'You showed a solid grasp of foundational concepts, but have key growth opportunities.' : 'Consistent practice will help build core confidence and fluency in this area.'}`,
      strengths: sessionState.questions.filter((_, i) => !sessionState.skips[i]).map(q => `- Solid understanding of ${q.topic}`).slice(0, 3).join('\n') || '- Commendable effort to practice and complete the interview session.',
      weaknesses: sessionState.questions.filter((_, i) => sessionState.skips[i]).map(q => `- Review the concepts under ${q.topic}`).slice(0, 3).join('\n') || '- Optimize response speed and lower the question skip rate.',
      communication_score: commScore,
      technical_score: techScore,
      confidence_score: confScore,
      grammar_corrections: JSON.stringify([
        { original: "Me and my team did this.", corrected: "My team and I did this." },
        { original: "I have went to class yesterday.", corrected: "I went to class yesterday." }
      ]),
      ideal_answers: JSON.stringify(idealAnswers),
      improvement_suggestions: `- Focus on answering within the 90-second limit to mimic real interview pressure.\n- Structure technical concepts systematically using bullet points or chronological steps.\n- Review the suggested talking points for skipped questions before retrying.`
    };

    return report;
  }

  /* ── FETCH AI REPORT & RENDER STRENGTHS/WEAKNESSES ──────── */
  async function _fetchAndRenderReport(sessionId) {
    // Show the toggle button wrapper immediately (with loading state inside report section)
    const rToggleWrap = qs('#scomplete-report-toggle-wrap');
    const rToggleBtn  = qs('#scomplete-report-toggle-btn');
    const rToggleLbl  = qs('#scomplete-report-toggle-label');
    if (rToggleWrap) rToggleWrap.style.display = '';
    if (rToggleLbl) rToggleLbl.textContent = 'Generating AI Report…';
    if (rToggleBtn) rToggleBtn.setAttribute('aria-expanded', 'true');

    // Show loading spinner inside report section
    const reportSection = qs('#scomplete-report-section');
    if (reportSection) {
      reportSection.innerHTML = `
        <div class="scomplete-report-loading">
          <div class="hm-spinner-sm"></div>
          <span>Gemini AI is analysing your performance…</span>
        </div>`;
      reportSection.style.display = '';
    }

    try {
      const report = await apiPost(`/api/sessions/${sessionId}/generate-report`, {});
      // Save report in local storage
      HireMindStore.updateSessionReport(sessionId, report);
      _renderReport(report);
      _showReportToggleBtn();
      if (rToggleLbl) rToggleLbl.textContent = 'View AI Performance Report';
      if (rToggleBtn) rToggleBtn.setAttribute('aria-expanded', 'false');
      // Collapse the section back so user can click to expand
      if (reportSection) reportSection.style.display = 'none';
    } catch (err) {
      console.warn('Report generation failed:', err.message);
      // Fallback on API failure
      const fallbackReport = generateFallbackReport();
      HireMindStore.updateSessionReport(sessionId, fallbackReport);
      _renderReport(fallbackReport);
      _showReportToggleBtn();
      if (rToggleLbl) rToggleLbl.textContent = 'View AI Performance Report';
      if (rToggleBtn) rToggleBtn.setAttribute('aria-expanded', 'false');
      if (reportSection) reportSection.style.display = 'none';
    }
  }


  /* ── SHOW REPORT TOGGLE BUTTON ─────────────────────────────── */
  function _showReportToggleBtn() {
    const wrap = qs('#scomplete-report-toggle-wrap');
    const btn  = qs('#scomplete-report-toggle-btn');
    const label = qs('#scomplete-report-toggle-label');
    const reportSection = qs('#scomplete-report-section');
    if (!wrap || !btn) return;

    wrap.style.display = '';

    // Only attach listener once
    if (btn.dataset.reportToggleInit) return;
    btn.dataset.reportToggleInit = '1';

    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        // Collapse
        btn.setAttribute('aria-expanded', 'false');
        if (label) label.textContent = 'View AI Performance Report';
        if (reportSection) {
          reportSection.style.maxHeight = reportSection.scrollHeight + 'px';
          reportSection.style.overflow = 'hidden';
          requestAnimationFrame(() => {
            reportSection.style.transition = 'max-height 0.4s ease, opacity 0.3s ease';
            reportSection.style.maxHeight = '0';
            reportSection.style.opacity = '0';
          });
          setTimeout(() => {
            reportSection.style.display = 'none';
            reportSection.style.maxHeight = '';
            reportSection.style.overflow = '';
            reportSection.style.transition = '';
            reportSection.style.opacity = '';
          }, 420);
        }
      } else {
        // Expand
        btn.setAttribute('aria-expanded', 'true');
        if (label) label.textContent = 'Hide AI Performance Report';
        if (reportSection) {
          reportSection.style.display = '';
          reportSection.style.maxHeight = '0';
          reportSection.style.overflow = 'hidden';
          reportSection.style.opacity = '0';
          reportSection.style.transition = 'max-height 0.5s ease, opacity 0.35s ease';
          requestAnimationFrame(() => {
            reportSection.style.maxHeight = reportSection.scrollHeight + 'px';
            reportSection.style.opacity = '1';
          });
          setTimeout(() => {
            reportSection.style.maxHeight = '';
            reportSection.style.overflow = '';
            reportSection.style.transition = '';
          }, 520);
          // Scroll to report
          setTimeout(() => btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        }
      }
    });
  }


  function _renderReport(report, targetContainer = '#scomplete-report-section') {
    const reportSection = qs(targetContainer);
    if (!reportSection || !report) return;

    // Parse bullet lines from newlines or bullet chars
    const parseBullets = (text) => {
      if (!text) return [];
      return text.split(/\n|•|–|-/)
        .map(l => l.trim())
        .filter(l => l.length > 3);
    };

    const strengthLines = parseBullets(report.strengths);
    const weaknessLines = parseBullets(report.weaknesses);

    const strengthHtml = strengthLines.map(s =>
      `<li><svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>${escapeHtml(s)}</li>`
    ).join('');

    const weaknessHtml = weaknessLines.map(w =>
      `<li><svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" width="14" height="14"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>${escapeHtml(w)}</li>`
    ).join('');

    // Parse scores
    const commScore = report.communication_score || 0;
    const techScore = report.technical_score || 0;
    const confScore = report.confidence_score || 0;

    // Safe JSON parsing for grammar and ideal answers
    let grammarArr = [];
    try {
      if (typeof report.grammar_corrections === 'string') {
        grammarArr = JSON.parse(report.grammar_corrections || '[]');
      } else if (Array.isArray(report.grammar_corrections)) {
        grammarArr = report.grammar_corrections;
      }
    } catch (e) {
      console.warn("Failed to parse grammar corrections", e);
    }

    let idealAnswersArr = [];
    try {
      if (typeof report.ideal_answers === 'string') {
        idealAnswersArr = JSON.parse(report.ideal_answers || '[]');
      } else if (Array.isArray(report.ideal_answers)) {
        idealAnswersArr = report.ideal_answers;
      }
    } catch (e) {
      console.warn("Failed to parse ideal answers", e);
    }

    // Render grammar section html
    let grammarHtml = '';
    if (grammarArr && grammarArr.length > 0) {
      grammarHtml = `
        <div class="report-section-block grammar-corrections">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" width="16" height="16">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Grammar &amp; Vocabulary Polish
          </h4>
          <div class="grammar-items-list">
            ${grammarArr.map(g => `
              <div class="grammar-card">
                <div class="grammar-original"><span class="label-badge original">You said:</span> "${escapeHtml(g.original)}"</div>
                <div class="grammar-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
                <div class="grammar-corrected"><span class="label-badge corrected">AI Suggestion:</span> "${escapeHtml(g.corrected)}"</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    } else {
      grammarHtml = `
        <div class="report-section-block grammar-corrections">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" width="16" height="16">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Grammar &amp; Vocabulary Polish
          </h4>
          <div class="grammar-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" width="20" height="20" style="margin-right:8px; vertical-align:middle;"><path d="M22 11.08v0a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Excellent grammar! No core errors or sentence structure issues were detected during the session.</span>
          </div>
        </div>`;
    }

    // Render ideal answers accordion html
    let idealAnswersHtml = '';
    if (idealAnswersArr && idealAnswersArr.length > 0) {
      idealAnswersHtml = `
        <div class="report-section-block ideal-answers-section">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Ideal Answer Keys
          </h4>
          <div class="ideal-accordion">
            ${idealAnswersArr.map((item, idx) => `
              <div class="ideal-acc-item">
                <button class="ideal-acc-trigger" onclick="this.parentElement.classList.toggle('open')">
                  <span class="ideal-acc-title">Q${idx+1}: ${escapeHtml(item.question)}</span>
                  <svg class="ideal-acc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="ideal-acc-content">
                  <p>${escapeHtml(item.ideal)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    // Render suggestions
    const suggestionsText = report.improvement_suggestions || report.suggestions || '';
    const suggestionsLines = parseBullets(suggestionsText);
    const suggestionsHtml = suggestionsLines.map(s => `
      <li>
        <svg class="suggest-bullet-icon" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>${escapeHtml(s)}</span>
      </li>
    `).join('');

    let suggestionsBlock = '';
    if (suggestionsHtml) {
      suggestionsBlock = `
        <div class="report-section-block suggestions-section">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" width="16" height="16">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Personalized Improvement Tips
          </h4>
          <ul class="suggestions-list">${suggestionsHtml}</ul>
        </div>`;
    }

    reportSection.innerHTML = `
      <div class="scomplete-report">
        <div class="scomplete-report-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="url(#rg)" stroke-width="2" width="20" height="20">
            <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00d4ff"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs>
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          <h3>AI Performance Report</h3>
        </div>

        <div class="scomplete-report-summary">
          <p>${escapeHtml(report.overall_feedback)}</p>
        </div>

        <!-- 3-Score Gauges Panel -->
        <div class="scomplete-report-scores">
          <div class="score-gauge-item">
            <div class="score-gauge">
              <svg class="score-gauge-svg" viewBox="0 0 100 100">
                <circle class="score-gauge-bg" cx="50" cy="50" r="40"/>
                <circle class="score-gauge-fill comm-fill" cx="50" cy="50" r="40" style="stroke-dasharray: 251.2; stroke-dashoffset: ${251.2 * (1 - commScore / 100)}"/>
              </svg>
              <span class="score-gauge-text">${commScore}%</span>
            </div>
            <span class="score-gauge-label">Communication</span>
          </div>

          <div class="score-gauge-item">
            <div class="score-gauge">
              <svg class="score-gauge-svg" viewBox="0 0 100 100">
                <circle class="score-gauge-bg" cx="50" cy="50" r="40"/>
                <circle class="score-gauge-fill tech-fill" cx="50" cy="50" r="40" style="stroke-dasharray: 251.2; stroke-dashoffset: ${251.2 * (1 - techScore / 100)}"/>
              </svg>
              <span class="score-gauge-text">${techScore}%</span>
            </div>
            <span class="score-gauge-label">Technical Depth</span>
          </div>

          <div class="score-gauge-item">
            <div class="score-gauge">
              <svg class="score-gauge-svg" viewBox="0 0 100 100">
                <circle class="score-gauge-bg" cx="50" cy="50" r="40"/>
                <circle class="score-gauge-fill conf-fill" cx="50" cy="50" r="40" style="stroke-dasharray: 251.2; stroke-dashoffset: ${251.2 * (1 - confScore / 100)}"/>
              </svg>
              <span class="score-gauge-text">${confScore}%</span>
            </div>
            <span class="score-gauge-label">Confidence</span>
          </div>
        </div>

        <div class="scomplete-report-cols">
          <div class="scomplete-report-col strengths">
            <h4><svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" width="14" height="14"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> Strengths</h4>
            <ul>${strengthHtml || '<li>Continue building on your current knowledge.</li>'}</ul>
          </div>
          <div class="scomplete-report-col weaknesses">
            <h4><svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Areas to Improve</h4>
            <ul>${weaknessHtml || '<li>Keep practicing to identify specific improvement areas.</li>'}</ul>
          </div>
        </div>

        ${grammarHtml}
        ${idealAnswersHtml}
        ${suggestionsBlock}
      </div>`;
    reportSection.style.display = '';
  }

  /* â”€â”€ CAMERA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function toggleCamera() {
    const camVideo = qs('#isess-cam-video');
    const placeholder = qs('#isess-cam-placeholder');
    const offBadge = qs('#isess-cam-off-badge');

    if (!sessionState.isCamOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        sessionState.mediaStream = stream;
        if (camVideo) { camVideo.srcObject = stream; camVideo.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (offBadge) offBadge.hidden = true;
        sessionState.isCamOn = true;
        if (isessCamBtn) isessCamBtn.classList.remove('off');
      } catch (err) {
        console.warn('Webcam access denied/unavailable:', err);
        showErrorToast('Camera unavailable. Using animated profile avatar.');
        if (placeholder) placeholder.style.display = 'flex';
        sessionState.isCamOn = false;
        if (isessCamBtn) isessCamBtn.classList.add('off');
      }
    } else {
      // FIX: stop ALL tracks (video + audio) not just video tracks, to fully
      // release the camera MediaStream and its associated hardware buffer.
      if (sessionState.mediaStream) sessionState.mediaStream.getTracks().forEach(t => t.stop());
      if (camVideo) { camVideo.srcObject = null; camVideo.style.display = 'none'; }
      if (placeholder) placeholder.style.display = 'flex';
      if (offBadge) offBadge.hidden = false;
      sessionState.isCamOn = false;
      if (isessCamBtn) isessCamBtn.classList.add('off');
    }
  }

  /* â”€â”€ SPEECH RECOGNITION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  /**
   * FIX: Fully destroy the current SpeechRecognition instance.
   * Nulls all event handlers, calls abort(), and clears the state reference.
   * Safe to call even when recognition is already null or stopped.
   * Must be called before creating any new instance to prevent stale closures
   * and accumulated result lists from accumulating in memory.
   */
  function _destroyRecognition() {
    if (!sessionState.recognition) return;
    sessionState.isSpeechRestarting = false;
    sessionState.isRecognitionActive = false;
    const rec = sessionState.recognition;
    sessionState.recognition = null; // clear reference FIRST so onend can't re-trigger
    rec.onstart  = null;
    rec.onresult = null;
    rec.onerror  = null;
    rec.onend    = null;
    try { rec.abort(); } catch (_) {}
  }

  function startSpeechRecognition() {
    if (!SpeechRecognition) { console.warn('Speech Recognition not supported.'); return; }

    // FIX: Always destroy the old instance before creating a new one.
    // This prevents stale SpeechRecognitionResultList objects from persisting
    // in memory and keeps event-handler closures from leaking.
    _destroyRecognition();

    sessionState.preSpeechText = isessTextarea ? isessTextarea.value.trim() : '';

    const rec = new SpeechRecognition();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.onstart = () => { sessionState.isRecognitionActive = true; };

    rec.onresult = (e) => {
      // FIX: Use e.resultIndex to process ONLY new/changed results instead of
      // iterating the entire accumulated SpeechRecognitionResultList from i=0.
      // This prevents the result list from growing unboundedly over a long session.
      let interimTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          // Commit finalised speech into preSpeechText so it survives restarts
          sessionState.preSpeechText += (sessionState.preSpeechText ? ' ' : '') + text.trim();
        } else {
          interimTranscript += text;
        }
      }
      if (isessTextarea) {
        isessTextarea.value = sessionState.preSpeechText +
          (interimTranscript ? (sessionState.preSpeechText ? ' ' : '') + interimTranscript : '');
        isessTextarea.dispatchEvent(new Event('input'));
      }
    };

    rec.onerror = (e) => {
      console.error('Speech error:', e.error);
      if (e.error === 'not-allowed') {
        showErrorToast('Microphone permission blocked. Voice input disabled.');
        if (sessionState.isMicOn) toggleMic();
      }
    };

    rec.onend = () => {
      sessionState.isRecognitionActive = false;
      // FIX: Auto-restart only when the mic is still intentionally on AND the
      // session is still active. disableMic() / endSession() set isMicOn=false
      // or isSessionActive=false BEFORE stopping recognition, so this guard
      // cleanly prevents the restart loop from firing during intentional stops.
      if (sessionState.isMicOn && sessionState.isSessionActive && sessionState.recognition) {
        sessionState.preSpeechText = isessTextarea ? isessTextarea.value.trim() : '';
        try { sessionState.recognition.start(); } catch (_) {}
      }
    };

    sessionState.recognition = rec;
    try { sessionState.recognition.start(); } catch (_) {}
  }

  function stopSpeechRecognition() {
    if (sessionState.recognition && sessionState.isRecognitionActive) {
      sessionState.isRecognitionActive = false;
      try { sessionState.recognition.stop(); } catch (_) {}
    }
  }

  function restartSpeechRecognition() {
    // FIX: No longer restarts recognition on every keystroke.
    // With e.resultIndex tracking, preSpeechText is updated correctly by the
    // onresult handler as results are finalised. We only need to sync the
    // textarea's current value so the next speech result appends correctly.
    if (sessionState.isRecognitionActive) {
      sessionState.preSpeechText = isessTextarea ? isessTextarea.value.trim() : '';
    }
  }

  /* â”€â”€ MIC TOGGLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function toggleMic() {
    if (!sessionState.isMicOn) {
      sessionState.isMicOn = true;
      if (isessMicBtn) isessMicBtn.classList.remove('off');
      startSpeechRecognition();
      const spans = qsa('#isess-mic-viz span');
      if (spans.length > 0) {
        // FIX: always clear the previous interval before creating a new one
        // to prevent a second interval from running if toggleMic fires rapidly.
        if (micInterval) { clearInterval(micInterval); micInterval = null; }
        micInterval = setInterval(() => {
          spans.forEach(s => { s.style.height = `${Math.floor(Math.random() * 12) + 3}px`; });
        }, 120);
      }
    } else {
      sessionState.isMicOn = false;
      if (isessMicBtn) isessMicBtn.classList.add('off');
      stopSpeechRecognition();
      _destroyRecognition(); // FIX: fully release the SpeechRecognition object
      if (micInterval) { clearInterval(micInterval); micInterval = null; }
      qsa('#isess-mic-viz span').forEach(s => s.style.height = '3px');
    }
  }

  function disableMic() {
    if (sessionState.isMicOn) {
      sessionState.isMicOn = false;
      if (isessMicBtn) isessMicBtn.classList.add('off');
      stopSpeechRecognition();
      _destroyRecognition(); // FIX: fully release the SpeechRecognition object
      if (micInterval) { clearInterval(micInterval); micInterval = null; }
      qsa('#isess-mic-viz span').forEach(s => s.style.height = '3px');
    }
  }

  /* â”€â”€ TEXTAREA EVENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  if (isessTextarea) {
    isessTextarea.addEventListener('input', (e) => {
      if (isessCharCount) isessCharCount.textContent = `${isessTextarea.value.length} / 1000`;
      // FIX: Sync preSpeechText on real user edits so subsequent speech results
      // append after the typed text. We no longer restart recognition on every
      // keystroke — the e.resultIndex-based onresult handler correctly tracks
      // final vs interim speech without needing a full recognition restart.
      if (e.isTrusted && sessionState.isRecognitionActive) {
        sessionState.preSpeechText = isessTextarea.value.trim();
      }
    });
    isessTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); nextQuestion(); }
    });
  }

  /* â”€â”€ ACTION BUTTON BINDINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  if (isessEndBtn) isessEndBtn.addEventListener('click', endSession);
  if (isessSkipBtn) isessSkipBtn.addEventListener('click', skipQuestion);
  if (isessNextBtn) isessNextBtn.addEventListener('click', nextQuestion);
  if (isessMicBtn) isessMicBtn.addEventListener('click', toggleMic);
  if (isessCamBtn) isessCamBtn.addEventListener('click', toggleCamera);

  if (scompleteRetryBtn) {
    scompleteRetryBtn.addEventListener('click', () => {
      if (sessionComplete) { sessionComplete.setAttribute('hidden', ''); sessionComplete.style.display = 'none'; }
      // FIX: fully clean up all resources from the previous session before
      // starting a new one, so recognition objects, intervals, and streams
      // don't accumulate across retries.
      _destroyRecognition();
      if (micInterval) { clearInterval(micInterval); micInterval = null; }
      if (sessionState.mediaStream) {
        sessionState.mediaStream.getTracks().forEach(t => t.stop());
        sessionState.mediaStream = null;
      }
      window.startInterviewSession(
        sessionState.activeCategory,
        sessionState.activeYear,
        sessionState.activeBranch,
        sessionState.activeDomain,
        sessionState.activeSubjects
      );
    });
  }

  if (scompleteDashboardBtn) {
    scompleteDashboardBtn.addEventListener('click', () => {
      if (sessionComplete) { sessionComplete.setAttribute('hidden', ''); sessionComplete.style.display = 'none'; }
      if (navbar) navbar.style.display = '';
      if (mobileNav) mobileNav.style.display = '';
      if (pageWrapper) pageWrapper.style.display = '';
      // Restore nav active state and show Dashboard section
      window._showSection?.('dashboard');
      qsa('.nav-links li a, .mobile-nav a').forEach(a => {
        a.classList.toggle('active', a.textContent.trim().toLowerCase() === 'dashboard');
      });
      // FIX: resume background animations now that the dashboard is visible again
      window._parallax?.start();
      window._liveActivity?.start();
      // Refresh dashboard stats after session
      const rawStats = HireMindStore.getStats();
      const { totalInterviews, bestScore, avgScore, practiceHours } = HireMindStore.computeDisplayStats(rawStats);
      const set = (id, v) => { const el = qs(id); if (el) el.textContent = v; };
      set('#val-total', String(totalInterviews));
      set('#val-best',  bestScore + '%');
      set('#val-avg',   avgScore + '%');
      set('#val-hours', practiceHours + 'h');
    });
  }
})();

/* ============================================================
   INIT LOG
   ============================================================ */
console.log(
  '%c HireMind v1.0 %c AI Interview Platform Ready — Phase 4 Active ',
  'background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#fff;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:700;',
  'background:#0a1224;color:#8fa3cc;padding:4px 8px;border-radius:0 4px 4px 0;'
);

