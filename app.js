/**
 * HireMind â€” Dashboard Interactions & Animations
 * app.js
 */

'use strict';

const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ============================================================
   0.5  HIREMIND STORAGE â€” localStorage Persistence Layer
   ============================================================ */
const HireMindStore = (function () {
  const KEY = 'hiremind_data';

  function _empty() {
    return {
      stats: {
        totalInterviews: 0,
        bestScore:       0,
        sumScores:       0,   // running sum of all scorePct values (for avg)
        totalSeconds:    0    // total practice seconds (for hours display)
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
        stats:    Object.assign(base.stats,    parsed.stats    || {}),
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
      };
    } catch (_) {
      return _empty();
    }
  }

  function _persist(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (_) { /* quota exceeded â€” silently ignore */ }
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
    const best  = stats.bestScore;
    const avg   = total > 0 ? Math.round(stats.sumScores / total) : 0;
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
    data.stats.sumScores       = data.sessions.reduce((s, r) => s + (r.scorePct    || 0), 0);
    data.stats.totalSeconds    = data.sessions.reduce((s, r) => s + (r.totalSeconds || 0), 0);
    data.stats.bestScore       = data.sessions.reduce((b, r) => Math.max(b, r.scorePct || 0), 0);

    _persist(data);
    return data.stats;
  }

  /** Wipe all stored data (utility â€” not yet wired to UI). */
  function clearAll() {
    try { localStorage.removeItem(KEY); } catch (_) {}
  }

  return { getStats, getSessions, saveSession, computeDisplayStats, clearAll };
})();

/* ============================================================
   1. MOBILE HAMBURGER MENU
   ============================================================ */
(function initMobileMenu() {
  const btn       = qs('#hamburger-btn');
  const mobileNav = qs('#mobile-nav');
  if (!btn || !mobileNav) return;

  btn.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    const spans = qsa('span', btn);
    if (isOpen) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity   = '0';
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
   2. NAV ACTIVE STATE
   ============================================================ */
(function initNavActive() {
  const navItems    = qsa('.nav-links li a');
  const mobileItems = qsa('.mobile-nav a');

  function setActive(items, clicked) {
    items.forEach(a => a.classList.remove('active'));
    clicked.classList.add('active');
  }

  navItems.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setActive(navItems, a);
      const label = a.textContent.trim().toLowerCase();
      mobileItems.forEach(m => {
        if (m.textContent.trim().toLowerCase() === label) setActive(mobileItems, m);
      });
    });
  });

  mobileItems.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setActive(mobileItems, a);
      const label = a.textContent.trim().toLowerCase();
      navItems.forEach(n => {
        if (n.textContent.trim().toLowerCase() === label) setActive(navItems, n);
      });
      qs('#mobile-nav')?.classList.remove('open');
      qs('#hamburger-btn')?.setAttribute('aria-expanded', 'false');
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
    el.style.opacity   = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity .55s ease ${i * 60}ms, transform .55s cubic-bezier(.34,1.56,.64,1) ${i * 60}ms`;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  targets.forEach(el => observer.observe(el));
})();

/* ============================================================
   5. ANIMATED STAT COUNTERS â€” driven by localStorage
   ============================================================ */
(function initStatCounters() {
  const rawStats = HireMindStore.getStats();
  const { totalInterviews, bestScore, avgScore, practiceHours } =
    HireMindStore.computeDisplayStats(rawStats);

  const statConfig = {
    'val-total': { end: totalInterviews, suffix: '',  duration: 1200, decimals: 0 },
    'val-best':  { end: bestScore,       suffix: '%', duration: 1400, decimals: 0 },
    'val-avg':   { end: avgScore,        suffix: '%', duration: 1300, decimals: 0 },
    'val-hours': { end: practiceHours,   suffix: 'h', duration: 1100, decimals: 1 },
  };

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCounter(el, end, suffix, duration, decimals) {
    if (end === 0) { el.textContent = '0' + suffix; return; }
    const start = performance.now();
    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const raw      = easeOut(progress) * end;
      const current  = decimals > 0
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
   5.5  HISTORY FEED â€” Restore last 3 sessions on page load
   ============================================================ */
(function initHistoryFeed() {
  const sessions = HireMindStore.getSessions();
  if (!sessions || sessions.length === 0) return;

  const recent = sessions.slice(0, 3);
  const colorMap = {
    hr: 'cyan', sde: 'violet', web: 'blue', data: 'green', custom: 'violet'
  };

  // Insert entries after the dashboard has settled
  setTimeout(() => {
    // Reverse so the newest lands at the top of the feed
    [...recent].reverse().forEach(rec => {
      const color = colorMap[rec.category] || 'cyan';
      const d     = new Date(rec.date);
      const when  = isNaN(d) ? 'Earlier' :
        d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const text  = `<strong>${rec.categoryLabel}</strong> completed â€” ` +
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
    hr:     'HR Interview',
    sde:    'Software Developer Interview',
    web:    'Web Developer Interview',
    data:   'Data Analyst Interview',
    custom: 'Custom Interview',
  };

  const categoryColors = {
    hr:     'rgba(0, 212, 255, 1)',
    sde:    'rgba(124, 58, 237, 1)',
    web:    'rgba(59, 130, 246, 1)',
    data:   'rgba(34, 197, 94, 1)',
    custom: 'rgba(168, 85, 247, 1)',
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

  function openModal(category) {
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
      `Starting <strong>${label}</strong> â€” AI session configured!`
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
      `<strong>${label}</strong> started â€” ${branchText} (${yrOrdinal} Yr) | Domain: ${domainText} | Topics: ${subjectsSummary}`
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

  // Bind Category Cards
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.category;
      
      // Pulse animation
      card.style.transform = 'scale(0.97)';
      setTimeout(() => { card.style.transform = ''; }, 180);

      openModal(cat);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { 
        e.preventDefault(); 
        card.click(); 
      }
    });
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
   8. ACTIVITY FEED â€” Add Entry Helper
   ============================================================ */
function addActivityEntry(color, text) {
  const feed = qs('.activity-timeline');
  if (!feed) return;

  const now     = new Date();
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
    item.style.opacity   = '1';
    item.style.transform = 'translateX(0)';
  }));

  // Cap at 8 entries
  while (feed.children.length > 8) {
    const last = feed.lastChild;
    if (last) { last.style.opacity = '0'; setTimeout(() => last.remove(), 400); }
  }
}

/* ============================================================
   9. LIVE ACTIVITY EVENTS (cosmetic auto-feed)
   ============================================================ */
(function initLiveActivity() {
  const events = [
    { color: 'cyan',   text: '<strong>AI Engine heartbeat</strong> â€” All interview modules responding normally.' },
    { color: 'violet', text: '<strong>Question Bank updated</strong> â€” 240 new behavioral questions loaded.' },
    { color: 'green',  text: '<strong>Resume Analysis ready</strong> â€” Upload your CV for instant AI feedback.' },
    { color: 'blue',   text: '<strong>Performance Tracking</strong> â€” Progress graph synced to your profile.' },
    { color: 'cyan',   text: '<strong>AI Recruiter Avatar</strong> â€” New personality model: "Senior Tech Lead" available.' },
  ];

  let idx = 0;
  setTimeout(() => {
    addActivityEntry(events[idx % events.length].color, events[idx % events.length].text);
    idx++;
    setInterval(() => {
      addActivityEntry(events[idx % events.length].color, events[idx % events.length].text);
      idx++;
    }, 20000);
  }, 15000);
})();

/* ============================================================
   10. MOUSE PARALLAX â€” Orb Tracking
   ============================================================ */
(function initParallax() {
  const orb1 = qs('.orb-1');
  const orb2 = qs('.orb-2');
  const orb3 = qs('.orb-3');
  if (!orb1 || !orb2 || !orb3) return;

  let tX = 0, tY = 0, cX = 0, cY = 0;

  window.addEventListener('mousemove', (e) => {
    tX = (e.clientX / window.innerWidth  - 0.5) * 30;
    tY = (e.clientY / window.innerHeight - 0.5) * 30;
  });

  function animate() {
    cX += (tX - cX) * 0.04;
    cY += (tY - cY) * 0.04;
    orb1.style.transform = `translate(${cX * .8}px, ${cY * .8}px)`;
    orb2.style.transform = `translate(${-cX * .6}px, ${-cY * .6}px)`;
    orb3.style.transform = `translate(${cX * 1.2}px, ${cY * 1.2}px) translateX(-50%) translateY(-50%)`;
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();

/* ============================================================
   11. PANEL CURSOR SPOTLIGHT
   ============================================================ */
(function initPanelSpotlight() {
  qsa('.glass-panel').forEach(panel => {
    panel.addEventListener('mousemove', (e) => {
      const r = panel.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width)  * 100;
      const y = ((e.clientY - r.top)  / r.height) * 100;
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

  /* â”€â”€ API CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const API_BASE = 'http://localhost:8000';

  /* â”€â”€ FALLBACK sample questions (used when backend is offline) */
  const sampleQuestions = {
    hr: [
      { id: null, text: "Tell me about yourself and your professional background.", difficulty: "Easy", topic: "Introduction", hint: "Structure it: who you are, your experience, and what you're looking for." },
      { id: null, text: "Why do you want to join our organization, and what value can you bring?", difficulty: "Easy", topic: "Company Fit", hint: "Show you researched the company and connect their mission with your skills." },
      { id: null, text: "What are your long-term career goals for the next five years?", difficulty: "Easy", topic: "Career Path", hint: "Discuss growth, learning, and alignment with company goals." },
      { id: null, text: "Describe a time you faced a difficult conflict at work and how you resolved it.", difficulty: "Medium", topic: "Conflict Resolution", hint: "Use the STAR method (Situation, Task, Action, Result)." },
      { id: null, text: "What is your greatest weakness, and what steps have you taken to improve it?", difficulty: "Medium", topic: "Self Awareness", hint: "Choose a real weakness and focus on your recovery plan." }
    ],
    sde: [
      { id: null, text: "What is the time and space complexity of QuickSort and MergeSort?", difficulty: "Easy", topic: "Algorithms", hint: "Cover best, worst, and average cases." },
      { id: null, text: "Explain the concepts of ACID properties in DBMS.", difficulty: "Easy", topic: "Databases", hint: "Detail Atomicity, Consistency, Isolation, and Durability." },
      { id: null, text: "Explain the difference between a process and a thread.", difficulty: "Medium", topic: "Operating Systems", hint: "Discuss virtual space, concurrency overhead, and IPC." },
      { id: null, text: "How would you design a scalable URL shortening service like Bitly?", difficulty: "Hard", topic: "System Design", hint: "Discuss base62 encoding, caching, and redirection." },
      { id: null, text: "Explain the CAP theorem in distributed database systems.", difficulty: "Hard", topic: "Distributed Systems", hint: "Consistency, Availability, Partition tolerance trade-offs." }
    ],
    custom: [
      { id: null, text: "Describe your experience working on software projects.", difficulty: "Easy", topic: "Experience", hint: "Focus on your contribution, tech stack, and outcomes." },
      { id: null, text: "How do you stay updated with the latest trends in your industry?", difficulty: "Easy", topic: "Continuous Learning", hint: "Talk about blogs, open-source work, and conferences." },
      { id: null, text: "Tell me about a project that you're proud of.", difficulty: "Medium", topic: "Project Work", hint: "Explain the problem, your approach, and how you solved issues." },
      { id: null, text: "Describe a complex technical issue you encountered and fixed.", difficulty: "Hard", topic: "Problem Solving", hint: "Detail your debugging methodology and post-mortem analysis." },
      { id: null, text: "What motivates you in your career?", difficulty: "Easy", topic: "Motivation", hint: "Be genuine and connect with your goals." }
    ]
  };

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const categoryLabels = {
    hr:     'HR Interview',
    sde:    'Software Developer Interview',
    web:    'Web Developer Interview',
    data:   'Data Analyst Interview',
    custom: 'Custom Interview',
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
  const isessEndBtn           = qs('#isess-end-btn');
  const scompleteRetryBtn     = qs('#scomplete-retry-btn');
  const scompleteDashboardBtn = qs('#scomplete-dashboard-btn');
  const isessSkipBtn          = qs('#isess-skip-btn');
  const isessNextBtn          = qs('#isess-next-btn');
  const isessMicBtn           = qs('#isess-mic-btn');
  const isessCamBtn           = qs('#isess-cam-btn');
  const isessTextarea         = qs('#isess-textarea');
  const isessCharCount        = qs('#isess-char-count');
  const interviewSession      = qs('#interview-session');
  const sessionComplete       = qs('#session-complete');
  const navbar                = qs('.navbar');
  const mobileNav             = qs('#mobile-nav');
  const pageWrapper           = qs('.page-wrapper');

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
  window.startInterviewSession = async function(category, year, branch, domain, subjects) {
    sessionState.activeCategory = category;
    sessionState.activeYear     = year    || '1';
    sessionState.activeBranch   = branch  || 'other';
    sessionState.activeDomain   = domain  || 'other';
    sessionState.activeSubjects = subjects || [];
    sessionState.sessionId      = null;
    sessionState.isBackendOnline = false;
    sessionState.evaluations    = [];

    // â”€â”€ Show UI immediately, then load questions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _showSessionScreen(category);

    // â”€â”€ Show AI loading overlay while fetching questions â”€â”€â”€â”€â”€â”€
    showLoadingOverlay('ðŸ¤– Gemini AI is crafting your questionsâ€¦');

    let questions = [];

    try {
      // 1. Create backend session
      const subjectsStr = (subjects || []).join(',');
      const sessionData = await apiPost('/api/sessions/', {
        category, branch, domain,
        subjects: subjectsStr,
        year: year || '1'
      });
      sessionState.sessionId      = sessionData.id;
      sessionState.isBackendOnline = true;

      // 2. Generate AI questions for this session
      const aiQuestions = await apiPost(`/api/sessions/${sessionData.id}/generate-questions`, {});
      if (aiQuestions && aiQuestions.length > 0) {
        questions = aiQuestions;
        showSuccessToast('âœ¨ AI-generated questions loaded!');
      } else {
        throw new Error('No questions returned from AI.');
      }
    } catch (err) {
      console.warn('Backend unavailable, using fallback questions:', err.message);
      showErrorToast('Backend offline â€” using built-in questions. Start backend for AI mode.');

      // Fallback to sample questions
      const pool = sampleQuestions[domain] || sampleQuestions[category] || sampleQuestions['custom'];
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      questions = shuffled.slice(0, 5);
    } finally {
      hideLoadingOverlay();
    }

    // â”€â”€ Initialise state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    sessionState.questions   = questions;
    sessionState.currentIndex = 0;
    sessionState.answers     = Array(questions.length).fill('');
    sessionState.skips       = Array(questions.length).fill(false);
    sessionState.evaluations = Array(questions.length).fill(null);
    sessionState.startTime   = new Date();
    sessionState.isSessionActive = true;

    // â”€â”€ Render question dots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    const camVideo    = qs('#isess-cam-video');
    const placeholder = qs('#isess-cam-placeholder');
    const offBadge    = qs('#isess-cam-off-badge');
    if (camVideo)    { camVideo.srcObject = null; camVideo.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
    if (offBadge)    offBadge.hidden = false;

    if (micInterval) { clearInterval(micInterval); micInterval = null; }
    qsa('#isess-mic-viz span').forEach(s => s.style.height = '3px');

    // Switch panels
    if (navbar)      navbar.style.display = 'none';
    if (mobileNav)   mobileNav.style.display = 'none';
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
    const q     = sessionState.questions[index];

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

    // Question text & hint
    const qText = qs('#isess-question-text');
    if (qText) qText.textContent = q.text;

    const hintText = qs('#isess-hint-text');
    if (hintText) hintText.textContent = q.hint || '';

    // Update dot states
    qsa('.isess-dot-item').forEach((dot, i) => {
      dot.className = 'isess-dot-item';
      if (i === index)       dot.classList.add('active');
      else if (i < index)    dot.classList.add(sessionState.skips[i] ? 'skipped' : 'completed');
    });

    // AI Speaking waveform
    const aiWaveform    = qs('#isess-waveform');
    const aiStatusText  = qs('#isess-ai-status-text');
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
    const dashArray     = 150.79;

    const timerVal  = qs('#isess-timer-val');
    const ringProg  = qs('#isess-ring-prog');

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
          sessionState.skips[sessionState.currentIndex]   = false;
        } else {
          sessionState.answers[sessionState.currentIndex] = '';
          sessionState.skips[sessionState.currentIndex]   = true;
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

    const idx    = sessionState.currentIndex;
    const answer = isessTextarea ? isessTextarea.value.trim() : '';

    sessionState.answers[idx] = answer;
    sessionState.skips[idx]   = false;

    // â”€â”€ Evaluate via backend if online â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            score:    evalResult.score || 0,
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
    sessionState.skips[idx]   = true;

    // Record skipped answer in backend
    if (sessionState.isBackendOnline && sessionState.sessionId) {
      const qId = sessionState.questions[idx]?.id;
      if (qId) {
        apiPost(`/api/questions/${qId}/evaluate`, { text: '', is_skipped: true })
          .then(res => { sessionState.evaluations[idx] = { score: 0, feedback: 'Question skipped.' }; })
          .catch(() => {});
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
    if (sessionComplete)  { sessionComplete.removeAttribute('hidden'); sessionComplete.style.display = ''; }

    // â”€â”€ Basic stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const total   = sessionState.questions.length;
    let answered  = 0;
    let skipped   = 0;
    sessionState.skips.forEach(s => s ? skipped++ : answered++);

    const elapsedMs      = new Date() - sessionState.startTime;
    const totalSecs      = Math.floor(elapsedMs / 1000);
    const timeTakenStr   = `${Math.floor(totalSecs / 60)}m ${totalSecs % 60}s`;

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

    const answeredEl  = qs('#scomplete-answered');
    const skippedEl   = qs('#scomplete-skipped');
    const timeTakenEl = qs('#scomplete-time-taken');
    const scoreEl     = qs('#scomplete-score');
    const progFill    = qs('#scomplete-prog-fill');
    const progPct     = qs('#scomplete-prog-pct');
    const completeMsg = qs('#scomplete-message');

    if (answeredEl)  answeredEl.textContent  = answered;
    if (skippedEl)   skippedEl.textContent   = skipped;
    if (timeTakenEl) timeTakenEl.textContent = timeTakenStr;
    if (scoreEl)     scoreEl.textContent     = `${aiScorePct}%`;
    if (progFill)    progFill.style.width    = `${aiScorePct}%`;
    if (progPct)     progPct.textContent     = `${aiScorePct}% Score`;

    if (completeMsg) {
      if (aiScorePct >= 80) {
        completeMsg.textContent = 'ðŸš€ Outstanding! Your readiness is exceptional. Keep it up!';
      } else if (aiScorePct >= 50) {
        completeMsg.textContent = 'ðŸ‘ Great job! You\'ve got a solid foundation. Continue practicing!';
      } else {
        completeMsg.textContent = 'ðŸ“š Keep practicing â€” consistency is the key to interview success!';
      }
    }

    // â”€â”€ Render Q&A review with AI evaluations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _renderReview();

    // â”€â”€ Persist to localStorage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const sessionRecord = {
      id:            sessionState.sessionId || Date.now(),
      date:          new Date().toISOString(),
      category:      sessionState.activeCategory,
      categoryLabel: window.currentInterviewLabel || 'Interview',
      year:          sessionState.activeYear,
      branch:        sessionState.activeBranch,
      domain:        sessionState.activeDomain,
      subjects:      (sessionState.activeSubjects || []).slice(),
      answered, skipped, total,
      scorePct:      aiScorePct,
      timeTaken:     timeTakenStr,
      totalSeconds:  totalSecs
    };
    const updatedStats = HireMindStore.saveSession(sessionRecord);
    const displayStats = HireMindStore.computeDisplayStats(updatedStats);

    // Refresh dashboard counters
    const valTotal = qs('#val-total');
    const valBest  = qs('#val-best');
    const valAvg   = qs('#val-avg');
    const valHours = qs('#val-hours');
    if (valTotal) valTotal.textContent = String(displayStats.totalInterviews);
    if (valBest)  valBest.textContent  = displayStats.bestScore + '%';
    if (valAvg)   valAvg.textContent   = displayStats.avgScore  + '%';
    if (valHours) valHours.textContent = displayStats.practiceHours + 'h';

    // â”€â”€ Fetch AI Report from backend (async, updates UI when done) â”€
    if (sessionState.isBackendOnline && sessionState.sessionId) {
      _fetchAndRenderReport(sessionState.sessionId);
    }
  }

  /* â”€â”€ RENDER Q&A REVIEW LIST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function _renderReview() {
    const reviewList = qs('#scomplete-review-list');
    if (!reviewList) return;
    reviewList.innerHTML = '';

    sessionState.questions.forEach((q, i) => {
      const answer    = (sessionState.answers[i] || '').trim();
      const isSkipped = sessionState.skips[i] === true || answer === '';
      const evalData  = sessionState.evaluations[i];
      const hasEval   = evalData && sessionState.isBackendOnline;

      const badgeClass = isSkipped ? 'skipped' : 'answered';
      const badgeText  = isSkipped ? 'Skipped'  : 'Answered';
      const idxStr     = `Question ${i + 1 < 10 ? '0' : ''}${i + 1}`;

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

  /* â”€â”€ FETCH AI REPORT & RENDER STRENGTHS/WEAKNESSES â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function _fetchAndRenderReport(sessionId) {
    // Show report loading state
    const reportSection = qs('#scomplete-report-section');
    if (reportSection) {
      reportSection.innerHTML = `
        <div class="scomplete-report-loading">
          <div class="hm-spinner-sm"></div>
          <span>Generating your AI performance reportâ€¦</span>
        </div>`;
      reportSection.style.display = '';
    }

    try {
      const report = await apiPost(`/api/sessions/${sessionId}/generate-report`, {});
      _renderReport(report);
    } catch (err) {
      console.warn('Report generation failed:', err.message);
      if (reportSection) {
        reportSection.innerHTML = `
          <div class="scomplete-report-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            AI report unavailable â€” check your Gemini API key in the backend <code>.env</code> file.
          </div>`;
      }
    }
  }

  function _renderReport(report) {
    const reportSection = qs('#scomplete-report-section');
    if (!reportSection || !report) return;

    // Parse bullet lines from newlines or bullet chars
    const parseBullets = (text) => {
      if (!text) return [];
      return text.split(/\n|â€¢|â€“|-/)
        .map(l => l.trim())
        .filter(l => l.length > 3);
    };

    const strengthLines  = parseBullets(report.strengths);
    const weaknessLines  = parseBullets(report.weaknesses);

    const strengthHtml = strengthLines.map(s =>
      `<li><svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>${escapeHtml(s)}</li>`
    ).join('');

    const weaknessHtml = weaknessLines.map(w =>
      `<li><svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" width="14" height="14"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>${escapeHtml(w)}</li>`
    ).join('');

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
      </div>`;
  }

  /* â”€â”€ CAMERA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function toggleCamera() {
    const camVideo    = qs('#isess-cam-video');
    const placeholder = qs('#isess-cam-placeholder');
    const offBadge    = qs('#isess-cam-off-badge');

    if (!sessionState.isCamOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        sessionState.mediaStream = stream;
        if (camVideo)    { camVideo.srcObject = stream; camVideo.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (offBadge)    offBadge.hidden = true;
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
      if (sessionState.mediaStream) sessionState.mediaStream.getVideoTracks().forEach(t => t.stop());
      if (camVideo)    { camVideo.srcObject = null; camVideo.style.display = 'none'; }
      if (placeholder) placeholder.style.display = 'flex';
      if (offBadge)    offBadge.hidden = false;
      sessionState.isCamOn = false;
      if (isessCamBtn) isessCamBtn.classList.add('off');
    }
  }

  /* â”€â”€ SPEECH RECOGNITION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function startSpeechRecognition() {
    if (!SpeechRecognition) { console.warn('Speech Recognition not supported.'); return; }

    if (!sessionState.recognition) {
      sessionState.recognition = new SpeechRecognition();
      sessionState.recognition.continuous      = true;
      sessionState.recognition.interimResults  = true;
      sessionState.recognition.lang            = 'en-US';

      sessionState.recognition.onstart = () => { sessionState.isRecognitionActive = true; };

      sessionState.recognition.onresult = (e) => {
        let transcript = '';
        for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
        if (isessTextarea) {
          isessTextarea.value = sessionState.preSpeechText + (sessionState.preSpeechText ? ' ' : '') + transcript;
          isessTextarea.dispatchEvent(new Event('input'));
        }
      };

      sessionState.recognition.onerror = (e) => {
        console.error('Speech error:', e);
        if (e.error === 'not-allowed') {
          showErrorToast('Microphone permission blocked. Voice input disabled.');
          if (sessionState.isMicOn) toggleMic();
        }
      };

      sessionState.recognition.onend = () => {
        sessionState.isRecognitionActive = false;
        if (sessionState.isSpeechRestarting) {
          sessionState.isSpeechRestarting = false;
          if (isessTextarea) sessionState.preSpeechText = isessTextarea.value.trim();
          try { sessionState.recognition.start(); } catch (err) {}
        }
      };
    }

    if (!sessionState.isRecognitionActive) {
      if (isessTextarea) sessionState.preSpeechText = isessTextarea.value.trim();
      try { sessionState.recognition.start(); } catch (err) {}
    }
  }

  function stopSpeechRecognition() {
    if (sessionState.recognition && sessionState.isRecognitionActive) {
      sessionState.recognition.stop();
      sessionState.isRecognitionActive = false;
    }
  }

  function restartSpeechRecognition() {
    if (sessionState.recognition && sessionState.isRecognitionActive) {
      sessionState.isSpeechRestarting = true;
      sessionState.recognition.stop();
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
        micInterval = setInterval(() => {
          spans.forEach(s => { s.style.height = `${Math.floor(Math.random() * 12) + 3}px`; });
        }, 120);
      }
    } else {
      sessionState.isMicOn = false;
      if (isessMicBtn) isessMicBtn.classList.add('off');
      stopSpeechRecognition();
      if (micInterval) { clearInterval(micInterval); micInterval = null; }
      qsa('#isess-mic-viz span').forEach(s => s.style.height = '3px');
    }
  }

  function disableMic() {
    if (sessionState.isMicOn) {
      sessionState.isMicOn = false;
      if (isessMicBtn) isessMicBtn.classList.add('off');
      stopSpeechRecognition();
      if (micInterval) { clearInterval(micInterval); micInterval = null; }
      qsa('#isess-mic-viz span').forEach(s => s.style.height = '3px');
    }
  }

  /* â”€â”€ TEXTAREA EVENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  if (isessTextarea) {
    isessTextarea.addEventListener('input', (e) => {
      if (isessCharCount) isessCharCount.textContent = `${isessTextarea.value.length} / 1000`;
      if (e.isTrusted && sessionState.isRecognitionActive) restartSpeechRecognition();
    });
    isessTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); nextQuestion(); }
    });
  }

  /* â”€â”€ ACTION BUTTON BINDINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  if (isessEndBtn)  isessEndBtn.addEventListener('click',  endSession);
  if (isessSkipBtn) isessSkipBtn.addEventListener('click', skipQuestion);
  if (isessNextBtn) isessNextBtn.addEventListener('click', nextQuestion);
  if (isessMicBtn)  isessMicBtn.addEventListener('click',  toggleMic);
  if (isessCamBtn)  isessCamBtn.addEventListener('click',  toggleCamera);

  if (scompleteRetryBtn) {
    scompleteRetryBtn.addEventListener('click', () => {
      if (sessionComplete) { sessionComplete.setAttribute('hidden', ''); sessionComplete.style.display = 'none'; }
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
      if (navbar)      navbar.style.display = '';
      if (mobileNav)   mobileNav.style.display = '';
      if (pageWrapper) pageWrapper.style.display = '';
    });
  }
})();

/* ============================================================
   INIT LOG
   ============================================================ */
console.log(
  '%c HireMind v1.0 %c AI Interview Platform Ready â€” Phase 4 Active ',
  'background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#fff;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:700;',
  'background:#0a1224;color:#8fa3cc;padding:4px 8px;border-radius:0 4px 4px 0;'
);

