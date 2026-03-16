(function() {
  var canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ctx = canvas.getContext('2d');
  var particles = [];
  var mouse = { x: -1000, y: -1000 };
  var COUNT = 70;
  var CONNECT = 150;
  var MOUSE_RADIUS = 200;
  var w, h;

  var colors = [
    { r: 0, g: 212, b: 170 },   // teal
    { r: 124, g: 92, b: 252 },   // purple
    { r: 255, g: 107, b: 157 },  // pink
  ];

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }

  function init() {
    resize();
    particles = [];
    for (var i = 0; i < COUNT; i++) {
      var c = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2.5 + 0.8,
        color: c,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // connections
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT) {
          var alpha = 0.15 * (1 - dist / CONNECT);
          var c1 = particles[i].color;
          var c2 = particles[j].color;
          var mr = (c1.r + c2.r) / 2;
          var mg = (c1.g + c2.g) / 2;
          var mb = (c1.b + c2.b) / 2;
          ctx.strokeStyle = 'rgba(' + mr + ',' + mg + ',' + mb + ',' + alpha + ')';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // particles with glow
    particles.forEach(function(p) {
      // mouse interaction - gentle push
      var mdx = p.x - mouse.x;
      var mdy = p.y - mouse.y;
      var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mdist < MOUSE_RADIUS && mdist > 0) {
        var force = (1 - mdist / MOUSE_RADIUS) * 0.5;
        p.vx += (mdx / mdist) * force;
        p.vy += (mdy / mdist) * force;
      }

      // damping
      p.vx *= 0.99;
      p.vy *= 0.99;

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      // pulse
      p.pulse += p.pulseSpeed;
      var pulseAlpha = 0.5 + 0.3 * Math.sin(p.pulse);
      var c = p.color;

      // glow
      var glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      glow.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (pulseAlpha * 0.4) + ')');
      glow.addColorStop(1, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();

      // core
      ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + pulseAlpha + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener('mouseleave', function() {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  window.addEventListener('resize', resize);
  init();
  draw();
})();
