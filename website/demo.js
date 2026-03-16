// ===== Scroll Animation Observer =====
(function() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.anim').forEach(function(el) { observer.observe(el); });
})();

// ===== Terminal Demo =====
var demoRunning = false;

function runDemo() {
  if (demoRunning) return;
  demoRunning = true;
  var body = document.getElementById('terminalBody');
  var playBtn = document.getElementById('demoPlay');
  var resetBtn = document.getElementById('demoReset');
  if (playBtn) playBtn.style.display = 'none';
  if (resetBtn) resetBtn.style.display = 'inline-block';
  body.innerHTML = '';

  var steps = [
    { type: 'comment', text: '# Step 1: Discover PACT endpoints', delay: 0 },
    { type: 'cmd', text: '$ curl -s https://pharma-db.example.com/.well-known/pact.json', delay: 500 },
    { type: 'json', text: '{\n  "pact": "1.0",\n  "site": "pharma-db.example.com",\n  "schemas": ["pact:health/clinical-trial@1"],\n  "endpoints": {\n    "pact:health/clinical-trial@1": {\n      "list": "/pact/trials",\n      "search": "/pact/trials?q={query}"\n    }\n  },\n  "rate_limit": { "rpm": 60 }\n}', delay: 1000 },
    { type: 'comment', text: '\n# Step 2: Search clinical trials for diabetes', delay: 2200 },
    { type: 'cmd', text: '$ curl -s "https://pharma-db.example.com/pact/trials?q=diabetes" \\\n    -H "Accept: application/pact+json"', delay: 2700 },
    { type: 'json', text: '{\n  "$pact": "1.0",\n  "$s": "pact:health/clinical-trial@1",\n  "$t": 1710590400,\n  "$ttl": 3600,\n  "items": [\n    {\n      "id": "NCT06012345",\n      "n": "Phase III Diabetes Prevention Trial",\n      "phase": "III",\n      "status": "recruiting",\n      "condition": "Type 2 Diabetes Mellitus",\n      "intervention": "GLP-1 receptor agonist",\n      "sponsor": "Seoul National University Hospital",\n      "enrollment": 450\n    }\n  ],\n  "total": 1\n}', delay: 3200 },
    { type: 'comment', text: '\n# Result: 180 tokens vs ~8,000 from HTML scraping', delay: 5000 },
    { type: 'success', text: '# 44x token reduction achieved', delay: 5600 }
  ];

  var i = 0;
  function next() {
    if (i >= steps.length) { demoRunning = false; return; }
    var s = steps[i];
    var line = document.createElement('div');
    line.className = 'terminal__line';
    if (s.type === 'comment') line.className += ' terminal__line--comment';
    else if (s.type === 'cmd') line.className += ' terminal__line--cmd';
    else if (s.type === 'json') line.className += ' terminal__line--json';
    else if (s.type === 'success') line.className += ' terminal__line--success';
    line.textContent = s.text;
    line.style.opacity = '0';
    line.style.transition = 'opacity 0.3s ease';
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
    requestAnimationFrame(function() { line.style.opacity = '1'; });
    i++;
    if (i < steps.length) setTimeout(next, steps[i].delay - s.delay);
  }
  setTimeout(next, 300);
}

function resetDemo() {
  demoRunning = false;
  var body = document.getElementById('terminalBody');
  var playBtn = document.getElementById('demoPlay');
  var resetBtn = document.getElementById('demoReset');
  body.innerHTML = '<div class="terminal__line terminal__line--comment"># Click "Play Demo" to watch PACT in action</div>';
  if (playBtn) playBtn.style.display = 'inline-block';
  if (resetBtn) resetBtn.style.display = 'none';
}

// ===== Quickstart Tabs =====
document.addEventListener('click', function(e) {
  var tab = e.target.closest('.quickstart-tab');
  if (!tab) return;
  var tabId = tab.dataset.tab;
  document.querySelectorAll('.quickstart-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.quickstart-panel').forEach(function(p) { p.classList.remove('active'); });
  tab.classList.add('active');
  var panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.add('active');
});

// ===== Copy Code =====
function copyCode(btn) {
  var block = btn.closest('.code-block') || btn.closest('.quickstart-tabs');
  var code = block ? block.querySelector('.active code, code') : null;
  if (!code) return;
  navigator.clipboard.writeText(code.textContent).then(function() {
    var orig = btn.textContent;
    btn.textContent = btn.closest('[lang="ko"]') ? '복사됨!' : 'Copied!';
    setTimeout(function() { btn.textContent = orig; }, 2000);
  });
}

// ===== Animated Counter =====
(function() {
  var counters = document.querySelectorAll('.count-up');
  if (!counters.length) return;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var target = parseInt(el.dataset.target, 10);
      var suffix = el.dataset.suffix || '';
      var prefix = el.dataset.prefix || '';
      var duration = 1200;
      var start = performance.now();
      function tick(now) {
        var progress = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = prefix + Math.round(target * eased).toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(function(el) { obs.observe(el); });
})();
