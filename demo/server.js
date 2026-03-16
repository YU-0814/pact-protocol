#!/usr/bin/env node
import http from 'node:http';

const PORT = 8790;

// ===== PACT Discovery =====
const discovery = {
  pact: "1.0",
  site: "clinicaltrials-pact.demo",
  description: "PACT-enabled clinical trial database (demo)",
  schemas: ["pact:health/clinical-trial@1"],
  endpoints: {
    "pact:health/clinical-trial@1": {
      list: "/pact/trials",
      item: "/pact/trials/{id}",
      search: "/pact/trials?q={query}"
    }
  },
  rate_limit: { rpm: 60 },
  auth: { type: "public" },
  license: { ai_input: true, ai_train: false, attribution: true },
  conformance: "L3"
};

// ===== Demo Clinical Trial Data =====
const trials = [
  { id:"NCT06012345", n:"Phase III Diabetes Prevention Trial", ph:"III", st:"recruiting", cond:"Type 2 Diabetes Mellitus", intv:"GLP-1 receptor agonist (semaglutide)", sp:"Seoul National University Hospital", enr:450, start:"2026-01", end:"2028-06", loc:["Seoul","Busan","Daejeon"], pi:"Dr. Kim Minjun", ct:"trial@snuh.org" },
  { id:"NCT06023456", n:"AI-guided Breast Cancer Screening", ph:"II", st:"recruiting", cond:"Breast Cancer", intv:"AI-assisted mammography + standard screening", sp:"Samsung Medical Center", enr:2000, start:"2025-09", end:"2027-12", loc:["Seoul","Suwon"], pi:"Dr. Park Soojin", ct:"onco@smc.kr" },
  { id:"NCT06034567", n:"mRNA Vaccine for Pancreatic Cancer", ph:"I", st:"active", cond:"Pancreatic Ductal Adenocarcinoma", intv:"Personalized mRNA neoantigen vaccine", sp:"Moderna + Yonsei Severance", enr:90, start:"2025-06", end:"2027-03", loc:["Seoul"], pi:"Dr. Lee Hyunwoo", ct:"vaccine@yuhs.ac" },
  { id:"NCT06045678", n:"Wearable ECG for Arrhythmia Detection", ph:"III", st:"recruiting", cond:"Atrial Fibrillation", intv:"Continuous wearable ECG patch vs standard Holter", sp:"Asan Medical Center", enr:1200, start:"2026-03", end:"2028-09", loc:["Seoul","Daegu","Gwangju"], pi:"Dr. Choi Youngho", ct:"cardio@amc.kr" },
  { id:"NCT06056789", n:"Stem Cell Therapy for Spinal Cord Injury", ph:"II", st:"recruiting", cond:"Spinal Cord Injury, Complete", intv:"Autologous mesenchymal stem cell transplant", sp:"Korea University Anam Hospital", enr:60, start:"2025-11", end:"2028-05", loc:["Seoul"], pi:"Dr. Jang Eunji", ct:"stemcell@kumc.kr" },
  { id:"NCT06067890", n:"Digital Therapeutics for Insomnia (CBT-I)", ph:"III", st:"completed", cond:"Chronic Insomnia Disorder", intv:"App-based CBT-I vs pharmacotherapy (zolpidem)", sp:"KAIST + Somnia Health", enr:320, start:"2024-08", end:"2026-02", loc:["Daejeon","Seoul","Busan"], pi:"Dr. Oh Minseo", ct:"sleep@kaist.ac.kr" },
  { id:"NCT06078901", n:"CAR-T Cell Therapy for B-Cell Lymphoma", ph:"II", st:"active", cond:"Diffuse Large B-Cell Lymphoma", intv:"Anti-CD19 CAR-T cells (autologous)", sp:"National Cancer Center Korea", enr:75, start:"2025-04", end:"2027-10", loc:["Goyang"], pi:"Dr. Seo Jihye", ct:"cart@ncc.re.kr" },
  { id:"NCT06089012", n:"Gut Microbiome Modulation in Obesity", ph:"II", st:"recruiting", cond:"Obesity, Metabolic Syndrome", intv:"Fecal microbiota transplant + dietary intervention", sp:"Seoul National University Bundang", enr:180, start:"2026-01", end:"2028-01", loc:["Seongnam","Seoul"], pi:"Dr. Yoon Taehyung", ct:"microbiome@snubh.org" },
];

// ===== Fake HTML page (bloated, realistic) =====
function generateHtmlPage(trial) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${trial.n} - ClinicalTrials Demo</title>
<meta name="description" content="${trial.n}">
<meta property="og:title" content="${trial.n}"><meta property="og:type" content="website">
<meta property="og:description" content="Clinical trial: ${trial.cond}">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${trial.n}">
<link rel="stylesheet" href="/assets/main.css"><link rel="stylesheet" href="/assets/components.css">
<link rel="stylesheet" href="/assets/material-icons.css"><link rel="preconnect" href="https://fonts.googleapis.com">
<script src="/assets/analytics.js" defer></script><script src="/assets/tracking.js" defer></script>
<script src="/assets/cookie-consent.js" defer></script><script src="/assets/gtm.js" defer></script>
<style>
:root{--md-sys-color-primary:#1a73e8;--md-sys-color-on-primary:#fff;--md-sys-color-surface:#fff;--md-sys-color-on-surface:#1f1f1f;--md-sys-color-outline:#747775;--md-ref-typeface-brand:Roboto;--md-ref-typeface-plain:Roboto;--md-sys-shape-corner-medium:12px;--md-sys-shape-corner-small:8px;--md-comp-elevated-button-container-height:40px;--md-comp-filled-button-container-height:40px;}
body{margin:0;font-family:Roboto,Arial,sans-serif;background:#fafafa;color:#1f1f1f;line-height:1.6;}
.header{background:#1a73e8;color:white;padding:16px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}
.header__logo{font-size:20px;font-weight:500;}.header__nav{display:flex;gap:24px;margin-left:auto;}
.header__nav a{color:rgba(255,255,255,0.85);text-decoration:none;font-size:14px;padding:8px 16px;border-radius:20px;}
.header__nav a:hover{background:rgba(255,255,255,0.15);}
.breadcrumb{padding:12px 24px;font-size:13px;color:#5f6368;border-bottom:1px solid #e0e0e0;background:white;}
.breadcrumb a{color:#1a73e8;text-decoration:none;}
.sidebar{width:280px;padding:24px;border-right:1px solid #e0e0e0;background:white;min-height:calc(100vh - 120px);}
.sidebar__section{margin-bottom:24px;}.sidebar__title{font-size:12px;font-weight:500;color:#5f6368;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;}
.sidebar__link{display:block;padding:8px 12px;font-size:14px;color:#1f1f1f;text-decoration:none;border-radius:8px;margin-bottom:2px;}
.sidebar__link:hover{background:#f1f3f4;}.sidebar__link--active{background:#e8f0fe;color:#1a73e8;font-weight:500;}
.main-layout{display:flex;max-width:1400px;margin:0 auto;}
.content{flex:1;padding:32px 48px;max-width:900px;}
.trial-header{margin-bottom:32px;}.trial-title{font-size:28px;font-weight:400;line-height:1.3;margin-bottom:16px;}
.trial-meta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;}
.status-badge--recruiting{background:#e6f4ea;color:#137333;}.status-badge--active{background:#fef7e0;color:#b06000;}
.status-badge--completed{background:#e8eaed;color:#5f6368;}
.info-table{width:100%;border-collapse:collapse;margin-bottom:24px;}
.info-table th{text-align:left;padding:12px 16px;font-size:13px;font-weight:500;color:#5f6368;background:#f8f9fa;border-bottom:1px solid #e0e0e0;width:200px;}
.info-table td{padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;}
.section-title{font-size:18px;font-weight:500;margin:32px 0 16px;padding-bottom:8px;border-bottom:2px solid #1a73e8;}
.cta-banner{background:linear-gradient(135deg,#1a73e8,#4285f4);color:white;padding:24px 32px;border-radius:12px;margin:32px 0;}
.cta-banner h3{margin-bottom:8px;font-size:18px;}.cta-banner p{margin-bottom:16px;font-size:14px;opacity:0.9;}
.cta-button{background:white;color:#1a73e8;border:none;padding:10px 24px;border-radius:20px;font-size:14px;font-weight:500;cursor:pointer;}
.related-trials{margin:32px 0;}.related-card{border:1px solid #e0e0e0;border-radius:12px;padding:16px;margin-bottom:12px;background:white;}
.related-card__title{font-size:15px;font-weight:500;margin-bottom:4px;}.related-card__meta{font-size:13px;color:#5f6368;}
.footer{background:#202124;color:#9aa0a6;padding:48px 24px;margin-top:64px;}
.footer__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;max-width:1200px;margin:0 auto;}
.footer__section h4{color:white;font-size:14px;margin-bottom:16px;}.footer__section a{display:block;color:#9aa0a6;text-decoration:none;font-size:13px;padding:4px 0;}
.footer__bottom{max-width:1200px;margin:32px auto 0;padding-top:24px;border-top:1px solid #3c4043;font-size:12px;display:flex;justify-content:space-between;}
.cookie-banner{position:fixed;bottom:0;left:0;right:0;background:white;padding:16px 24px;box-shadow:0 -2px 8px rgba(0,0,0,0.1);display:flex;align-items:center;gap:16px;z-index:1000;}
.ad-sidebar{width:300px;padding:24px;}.ad-card{background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:16px;text-align:center;font-size:12px;color:#9aa0a6;}
</style>
</head>
<body>
<!-- Header -->
<div class="header">
<span class="header__logo">ClinicalTrials Demo</span>
<div class="header__nav">
<a href="/search">Search Studies</a><a href="/trends">Trends</a><a href="/submit">Submit Research</a>
<a href="/about">About</a><a href="/api">API</a><a href="/help">Help</a>
</div>
</div>

<!-- Breadcrumb -->
<div class="breadcrumb">
<a href="/">Home</a> &gt; <a href="/search">Search</a> &gt; <a href="/results?cond=${encodeURIComponent(trial.cond)}">Results</a> &gt; ${trial.id}
</div>

<!-- Main Layout -->
<div class="main-layout">

<!-- Sidebar -->
<div class="sidebar">
<div class="sidebar__section"><div class="sidebar__title">Study Record</div>
<a href="#overview" class="sidebar__link sidebar__link--active">Overview</a>
<a href="#description" class="sidebar__link">Description</a><a href="#conditions" class="sidebar__link">Conditions</a>
<a href="#interventions" class="sidebar__link">Interventions</a><a href="#outcomes" class="sidebar__link">Outcomes</a>
<a href="#eligibility" class="sidebar__link">Eligibility</a><a href="#contacts" class="sidebar__link">Contacts</a>
<a href="#locations" class="sidebar__link">Locations</a><a href="#references" class="sidebar__link">References</a>
<a href="#results" class="sidebar__link">Study Results</a></div>
<div class="sidebar__section"><div class="sidebar__title">Related</div>
<a href="/related?id=${trial.id}" class="sidebar__link">Similar Studies</a>
<a href="/export?id=${trial.id}" class="sidebar__link">Download Data</a>
<a href="/cite?id=${trial.id}" class="sidebar__link">Cite This Study</a></div>
<div class="sidebar__section"><div class="sidebar__title">Resources</div>
<a href="/learn" class="sidebar__link">Understanding Clinical Trials</a>
<a href="/glossary" class="sidebar__link">Medical Glossary</a><a href="/faq" class="sidebar__link">FAQs</a></div>
</div>

<!-- Content -->
<div class="content">
<div class="trial-header">
<h1 class="trial-title">${trial.n}</h1>
<div class="trial-meta">
<span class="status-badge status-badge--${trial.st}">${trial.st.toUpperCase()}</span>
<span style="font-size:14px;color:#5f6368;">Phase ${trial.ph} | ${trial.id}</span>
</div>
</div>

<table class="info-table">
<tr><th>Study Type</th><td>Interventional</td></tr>
<tr><th>Condition</th><td>${trial.cond}</td></tr>
<tr><th>Intervention</th><td>${trial.intv}</td></tr>
<tr><th>Sponsor</th><td>${trial.sp}</td></tr>
<tr><th>Principal Investigator</th><td>${trial.pi}</td></tr>
<tr><th>Enrollment</th><td>${trial.enr} participants (estimated)</td></tr>
<tr><th>Phase</th><td>Phase ${trial.ph}</td></tr>
<tr><th>Start Date</th><td>${trial.start}</td></tr>
<tr><th>Estimated Completion</th><td>${trial.end}</td></tr>
<tr><th>Locations</th><td>${trial.loc.join(', ')}</td></tr>
<tr><th>Contact</th><td>${trial.ct}</td></tr>
</table>

<div class="section-title">Study Description</div>
<p style="font-size:15px;line-height:1.7;color:#3c4043;">
This is a ${trial.ph === 'III' ? 'pivotal' : trial.ph === 'II' ? 'proof-of-concept' : 'first-in-human'} clinical trial evaluating ${trial.intv.toLowerCase()} for patients with ${trial.cond.toLowerCase()}. The study aims to enroll ${trial.enr} participants across ${trial.loc.length} site(s) in South Korea. The primary endpoint will assess efficacy and safety over the study duration from ${trial.start} to ${trial.end}.
</p>

<div class="cta-banner"><h3>Interested in participating?</h3>
<p>Contact the study team to learn about eligibility and enrollment.</p>
<button class="cta-button">Contact Research Team</button></div>

<div class="section-title">Related Studies</div>
<div class="related-trials">
<div class="related-card"><div class="related-card__title">A Related Phase ${trial.ph} Study</div><div class="related-card__meta">Recruiting | 200 participants</div></div>
<div class="related-card"><div class="related-card__title">Another Study on ${trial.cond}</div><div class="related-card__meta">Active | 150 participants</div></div>
<div class="related-card"><div class="related-card__title">Historical Study Comparison</div><div class="related-card__meta">Completed | 500 participants</div></div>
</div>
</div>

<!-- Ad Sidebar -->
<div class="ad-sidebar">
<div class="ad-card">ADVERTISEMENT<br><br>Sponsored Research Tools<br>Try our clinical data platform</div>
<div class="ad-card">PARTNER CONTENT<br><br>Latest in ${trial.cond} Research<br>Subscribe to our newsletter</div>
</div>

</div>

<!-- Footer -->
<footer class="footer">
<div class="footer__grid">
<div class="footer__section"><h4>Clinical Trials</h4><a href="/search">Search Studies</a><a href="/trending">Trending</a><a href="/map">Map View</a><a href="/statistics">Statistics</a></div>
<div class="footer__section"><h4>Resources</h4><a href="/learn">Learn About Trials</a><a href="/glossary">Glossary</a><a href="/faq">FAQ</a><a href="/videos">Videos</a></div>
<div class="footer__section"><h4>Submit</h4><a href="/register">Register Study</a><a href="/results">Submit Results</a><a href="/guidelines">Guidelines</a><a href="/prs">Protocol Registration</a></div>
<div class="footer__section"><h4>About</h4><a href="/about">About Us</a><a href="/contact">Contact</a><a href="/policies">Policies</a><a href="/accessibility">Accessibility</a></div>
</div>
<div class="footer__bottom">
<span>&copy; 2026 ClinicalTrials Demo. For demonstration purposes only.</span>
<span><a href="/privacy" style="color:#9aa0a6;">Privacy</a> | <a href="/terms" style="color:#9aa0a6;">Terms</a> | <a href="/cookies" style="color:#9aa0a6;">Cookies</a></span>
</div>
</footer>

<!-- Cookie Banner -->
<div class="cookie-banner">
<span style="flex:1;">This site uses cookies to improve your experience. By continuing to browse, you agree to our use of cookies.</span>
<button style="background:#1a73e8;color:white;border:none;padding:8px 24px;border-radius:20px;cursor:pointer;">Accept All</button>
<button style="background:none;border:1px solid #dadce0;padding:8px 24px;border-radius:20px;cursor:pointer;">Manage</button>
</div>

<script>console.log('Analytics loaded');document.addEventListener('DOMContentLoaded',function(){console.log('Page ready');});</script>
</body></html>`;
}

// ===== PACT Response =====
function pactResponse(items, query) {
  let filtered = items;
  if (query) {
    const q = query.toLowerCase();
    filtered = items.filter(t =>
      t.n.toLowerCase().includes(q) ||
      t.cond.toLowerCase().includes(q) ||
      t.intv.toLowerCase().includes(q) ||
      t.sp.toLowerCase().includes(q)
    );
  }
  return {
    $pact: "1.0",
    $s: "pact:health/clinical-trial@1",
    $t: Math.floor(Date.now() / 1000),
    $ttl: 3600,
    items: filtered,
    total: filtered.length,
    page: { offset: 0, limit: 20 }
  };
}

function pactTable(items) {
  return {
    $pact: "1.0",
    $s: "pact:health/clinical-trial@1",
    $t: Math.floor(Date.now() / 1000),
    $ttl: 3600,
    $layout: "table",
    cols: ["id","n","ph","st","cond","intv","sp","enr","start","end"],
    rows: items.map(t => [t.id, t.n, t.ph, t.st, t.cond, t.intv, t.sp, t.enr, t.start, t.end]),
    total: items.length
  };
}

// ===== Token Counter (approximate) =====
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// ===== Server =====
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const accept = req.headers.accept || '';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Accept');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // --- PACT Discovery ---
  if (path === '/.well-known/pact.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' });
    res.end(JSON.stringify(discovery, null, 2));
    return;
  }

  // --- PACT Endpoints ---
  if (path === '/pact/trials') {
    const q = url.searchParams.get('q') || '';
    const layout = url.searchParams.get('layout');
    const data = layout === 'table' ? pactTable(trials) : pactResponse(trials, q);
    const json = JSON.stringify(data);
    res.writeHead(200, {
      'Content-Type': 'application/pact+json',
      'X-PACT': '1',
      'X-Token-Count': String(countTokens(json)),
    });
    res.end(json);
    return;
  }

  // --- Single trial (PACT or HTML) ---
  const trialMatch = path.match(/^\/pact\/trials\/(.+)$/);
  if (trialMatch) {
    const trial = trials.find(t => t.id === trialMatch[1]);
    if (!trial) { res.writeHead(404); res.end(JSON.stringify({ error: 'not_found' })); return; }
    const data = pactResponse([trial]);
    const json = JSON.stringify(data);
    res.writeHead(200, { 'Content-Type': 'application/pact+json', 'X-PACT': '1', 'X-Token-Count': String(countTokens(json)) });
    res.end(json);
    return;
  }

  // --- HTML version of trial ---
  const htmlMatch = path.match(/^\/trial\/(.+)$/);
  if (htmlMatch) {
    const trial = trials.find(t => t.id === htmlMatch[1]);
    if (!trial) { res.writeHead(404); res.end('Not found'); return; }
    const html = generateHtmlPage(trial);
    res.writeHead(200, { 'Content-Type': 'text/html', 'X-Token-Count': String(countTokens(html)) });
    res.end(html);
    return;
  }

  // --- Comparison Page ---
  if (path === '/' || path === '/compare') {
    const trial = trials[0];
    const pactData = pactResponse([trial]);
    const pactJson = JSON.stringify(pactData, null, 2);
    const htmlData = generateHtmlPage(trial);
    const pactTokens = countTokens(JSON.stringify(pactData));
    const htmlTokens = countTokens(htmlData);
    const ratio = Math.round(htmlTokens / pactTokens);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>PACT vs HTML - Live Comparison</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#050505;color:#f0f0f0;line-height:1.6;}
.hero{text-align:center;padding:4rem 2rem 2rem;background:linear-gradient(180deg,rgba(0,212,170,0.06) 0%,transparent 100%);}
.hero h1{font-size:2.5rem;font-weight:700;margin-bottom:0.5rem;background:linear-gradient(135deg,#fff,#00d4aa,#7c5cfc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.hero p{color:#999;font-size:1.1rem;max-width:600px;margin:0 auto;}
.compare{display:grid;grid-template-columns:1fr auto 1fr;gap:1.5rem;max-width:1200px;margin:2rem auto;padding:0 1.5rem;align-items:start;}
.panel{border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);}
.panel--html{border-color:rgba(255,85,85,0.2);}
.panel--pact{border-color:rgba(0,212,170,0.2);}
.panel__header{padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06);}
.panel--html .panel__header{background:rgba(255,85,85,0.06);}
.panel--pact .panel__header{background:rgba(0,212,170,0.06);}
.panel__label{font-family:'SF Mono',monospace;font-size:0.85rem;font-weight:600;}
.panel--html .panel__label{color:#ff5555;}
.panel--pact .panel__label{color:#00d4aa;}
.panel__tokens{font-family:'SF Mono',monospace;font-size:1.5rem;font-weight:700;}
.panel--html .panel__tokens{color:#ff5555;}
.panel--pact .panel__tokens{color:#00d4aa;}
.panel__code{padding:1rem;max-height:500px;overflow:auto;background:#0a0d12;font-family:'SF Mono',monospace;font-size:0.72rem;line-height:1.6;white-space:pre-wrap;word-break:break-all;color:#8b949e;}
.panel--pact .panel__code{color:#c9d1d9;}
.arrow{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;padding-top:3rem;}
.arrow__num{font-family:'SF Mono',monospace;font-size:3rem;font-weight:700;background:linear-gradient(135deg,#00d4aa,#7c5cfc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.arrow__label{font-family:'SF Mono',monospace;font-size:0.75rem;color:#666;text-transform:uppercase;letter-spacing:0.1em;}
.endpoints{max-width:1200px;margin:3rem auto;padding:0 1.5rem;}
.endpoints h2{font-size:1.5rem;margin-bottom:1.5rem;text-align:center;color:#00d4aa;}
.ep-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:1rem;}
.ep-card{background:rgba(18,18,22,0.8);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:1.25rem;transition:all 0.3s ease;}
.ep-card:hover{border-color:rgba(0,212,170,0.2);transform:translateY(-2px);}
.ep-card__method{font-family:'SF Mono',monospace;font-size:0.7rem;color:#00d4aa;background:rgba(0,212,170,0.1);padding:0.2rem 0.6rem;border-radius:4px;display:inline-block;margin-bottom:0.5rem;}
.ep-card__url{font-family:'SF Mono',monospace;font-size:0.8rem;color:#e0e0e0;margin-bottom:0.5rem;}
.ep-card__desc{font-size:0.85rem;color:#999;}
.ep-card__tokens{font-family:'SF Mono',monospace;font-size:0.75rem;color:#666;margin-top:0.5rem;}
@media(max-width:900px){.compare{grid-template-columns:1fr;}.arrow{flex-direction:row;padding:0;}}
</style></head><body>
<div class="hero">
<h1>PACT vs HTML: Live Comparison</h1>
<p>Same clinical trial data. Dramatically different token cost for AI agents.</p>
</div>
<div class="compare">
<div class="panel panel--html">
<div class="panel__header"><span class="panel__label">HTML Page</span><span class="panel__tokens">~${htmlTokens.toLocaleString()} tokens</span></div>
<div class="panel__code">${htmlData.replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0, 3000)}...\n\n[...truncated, ${htmlData.length} chars total]</div>
</div>
<div class="arrow"><span class="arrow__num">${ratio}x</span><span class="arrow__label">reduction</span></div>
<div class="panel panel--pact">
<div class="panel__header"><span class="panel__label">PACT Response</span><span class="panel__tokens">~${pactTokens.toLocaleString()} tokens</span></div>
<div class="panel__code">${pactJson.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
</div>
</div>
<div class="endpoints">
<h2>Try the API</h2>
<div class="ep-grid">
<div class="ep-card"><span class="ep-card__method">GET</span><div class="ep-card__url"><a href="/.well-known/pact.json" style="color:#e0e0e0;">/.well-known/pact.json</a></div><div class="ep-card__desc">PACT Discovery document</div></div>
<div class="ep-card"><span class="ep-card__method">GET</span><div class="ep-card__url"><a href="/pact/trials" style="color:#e0e0e0;">/pact/trials</a></div><div class="ep-card__desc">All clinical trials (PACT format)</div><div class="ep-card__tokens">~${countTokens(JSON.stringify(pactResponse(trials)))} tokens for ${trials.length} trials</div></div>
<div class="ep-card"><span class="ep-card__method">GET</span><div class="ep-card__url"><a href="/pact/trials?q=diabetes" style="color:#e0e0e0;">/pact/trials?q=diabetes</a></div><div class="ep-card__desc">Search: diabetes trials</div></div>
<div class="ep-card"><span class="ep-card__method">GET</span><div class="ep-card__url"><a href="/pact/trials?layout=table" style="color:#e0e0e0;">/pact/trials?layout=table</a></div><div class="ep-card__desc">Table layout (maximum compression)</div><div class="ep-card__tokens">~${countTokens(JSON.stringify(pactTable(trials)))} tokens for ${trials.length} trials</div></div>
<div class="ep-card"><span class="ep-card__method">GET</span><div class="ep-card__url"><a href="/trial/${trial.id}" style="color:#e0e0e0;">/trial/${trial.id}</a></div><div class="ep-card__desc">HTML version (for comparison)</div><div class="ep-card__tokens">~${htmlTokens.toLocaleString()} tokens</div></div>
<div class="ep-card"><span class="ep-card__method">GET</span><div class="ep-card__url"><a href="/pact/trials/${trial.id}" style="color:#e0e0e0;">/pact/trials/${trial.id}</a></div><div class="ep-card__desc">PACT version (same data)</div><div class="ep-card__tokens">~${pactTokens} tokens</div></div>
</div>
</div>
<div style="text-align:center;padding:3rem;color:#666;font-size:0.85rem;">
<p>Powered by <a href="http://10.125.208.217:8788/" style="color:#00d4aa;">PACT Protocol</a> | Demo with synthetic Korean clinical trial data</p>
</div>
</body></html>`);
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => {
  console.log(`\nPACT Clinical Trial Demo Server`);
  console.log(`================================`);
  console.log(`Compare page:  http://10.125.208.217:${PORT}/`);
  console.log(`Discovery:     http://10.125.208.217:${PORT}/.well-known/pact.json`);
  console.log(`PACT trials:   http://10.125.208.217:${PORT}/pact/trials`);
  console.log(`Search:        http://10.125.208.217:${PORT}/pact/trials?q=diabetes`);
  console.log(`Table mode:    http://10.125.208.217:${PORT}/pact/trials?layout=table`);
  console.log(`HTML trial:    http://10.125.208.217:${PORT}/trial/NCT06012345`);
  console.log(`PACT trial:    http://10.125.208.217:${PORT}/pact/trials/NCT06012345`);
});
