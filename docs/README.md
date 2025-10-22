---
layout: default
---

<style>
:root{
  --bg:#0e1116;
  --panel:#121826;
  --text:#e5e7eb;
  --muted:#a1a1aa;
  --line:#1f2937;
  --accent1:#93c5fd;
  --accent2:#f0abfc;
  --accent3:#fb7185;
  --glass:rgba(255,255,255,0.06);
}

html{ scroll-behavior:smooth; }
body{
  background:var(--bg);
  color:var(--text);
  font-family:"Segoe UI","Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif;
  line-height:1.8;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
}

h1,h2,h3{ color:var(--text); letter-spacing:-0.2px; }
h2{ border-bottom:none !important; margin:0 0 .35em 0 !important; font-weight:700; }
h3{ color:#cbd5e1; font-weight:600; }
a{ color:var(--accent1); text-decoration:none; }
a:hover{ color:#bfdbfe; }

.wrap{ max-width:980px; margin:0 auto; padding:0 20px; }

/* mini nav */
.nav{
  position:sticky; top:0; z-index:10;
  background:rgba(14,17,22,0.85);
  backdrop-filter:saturate(120%) blur(4px);
  border-bottom:1px solid var(--line);
}
.nav-inner{
  max-width:980px; margin:0 auto; padding:10px 20px;
  display:flex; align-items:center; justify-content:center; gap:14px;
  font-weight:600; color:#d1d5db;
}
.nav a{ color:#d1d5db; }
.nav a:hover{ color:#ffffff; }
.sep{ color:#6b7280; }

/* section separator */
hr{
  height:2px; border:0; margin:2.2em 0;
  background:linear-gradient(90deg, rgba(147,197,253,.4), rgba(240,171,252,.45), rgba(251,113,133,.35));
  border-radius:2px;
}

/* cards */
.card{
  background:linear-gradient(to bottom right, var(--panel), var(--bg));
  border:1px solid var(--line);
  border-radius:16px;
  padding:20px;
  box-shadow:0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.02);
}

/* table */
.table{
  width:100%;
  border-collapse:collapse;
  overflow:hidden;
  border-radius:12px;
  border:1px solid var(--line);
}
.table th,.table td{
  padding:12px 14px; text-align:center; font-size:15px;
  border-bottom:1px solid var(--line);
}
.table th{
  background:linear-gradient(90deg, rgba(147,197,253,.12), rgba(240,171,252,.12));
  color:#e2e8f0; font-weight:700;
}
.table tr:nth-child(even){ background:rgba(255,255,255,0.02); }
.table tr:hover{ background:rgba(147,197,253,0.06); }

/* tech badges */
.badges{ text-align:center; }
.badge{
  display:inline-block; margin:6px; padding:10px 16px;
  font-size:14px; font-weight:700; letter-spacing:.2px;
  color:#f3f4f6; border-radius:999px;
  background:linear-gradient(135deg, rgba(147,197,253,.22), rgba(240,171,252,.24));
  border:1px solid rgba(148,163,184,.35);
  box-shadow:0 8px 20px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter:saturate(120%) blur(2px);
  transition:transform .25s ease, box-shadow .25s ease, background .25s ease, border .25s ease;
}
.badge:hover{
  transform:translateY(-3px);
  background:linear-gradient(135deg, rgba(147,197,253,.35), rgba(240,171,252,.38));
  box-shadow:0 14px 30px rgba(0,0,0,.5);
  border-color:rgba(148,163,184,.6);
}

.lead{ font-size:16px; color:#d1d5db; }
.muted{ color:var(--muted); }

/* spacing */
.section{ margin:1.2em 0; }
</style>

<div class="nav"><div class="nav-inner">
  <a href="#about">About</a><span class="sep">|</span>
  <a href="#proposal">Proposal</a><span class="sep">|</span>
  <a href="#contact">Contact</a>
</div></div>

<div class="wrap">
  <div class="section header">
    <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f172a,100:111827&height=210&text=PureCare%20AI%20Project&fontColor=ffffff&fontSize=54&fontAlignY=40" alt="header">
    <h3>Hanyang University - CSE4006 Software Engineering (Fall 2025)</h3>
  </div>
  <hr>

  <div class="section" align="center">
    <h2 style="color:var(--accent1)">AI-Driven Smart Air Purifier: PureCare</h2>
    <p class="lead">
      Welcome to Group 07’s official project page for the <b>Software Engineering (CSE4006)</b> course at Hanyang University.<br>
      Our project, <b>PureCare</b>, explores how <b>AI sound recognition</b> and <b>embedded systems</b> can enable air purifiers to respond intelligently to user environments.<br>
      This page summarizes our proposal, development plan, and progress throughout the semester.
    </p>
  </div>
  <hr>

  <div id="proposal" class="section">
    <h2 style="color:var(--accent2)">Project Overview</h2>
    <div class="card">
      <p>
        <b>PureCare</b> is an <b>AI-enhanced air-purification system</b> that reacts to human activities and environmental conditions using sound-based event detection.<br><br>
        🧠 <b>Core Idea:</b> The system detects patterns such as coughing, sneezing, or cooking noise and automatically adjusts purification intensity.<br>
        🔉 <b>Input:</b> Audio signals captured by embedded microphones.<br>
        ☁️ <b>Processing:</b> Local inference on a Raspberry Pi using <b>TinyML / TFLite</b> models.<br>
        🧾 <b>Output:</b> Real-time air-quality response with event logging (no raw audio storage, ensuring privacy).<br><br>
        Our goal is to design a <b>secure, privacy-preserving</b> architecture demonstrating the integration of <b>AI + IoT + software engineering principles.</b>
      </p>
    </div>
  </div>
  <hr>

  <div class="section">
    <h2 style="color:var(--accent1)">System Methodology</h2>
    <div class="card">
      <ol>
        <li><b>Requirements & Design</b> – Define functional and non-functional specs (DoD, UML, dataflow).</li>
        <li><b>Data Collection & QA</b> – Collect sound events (cough, sneeze, snore, ambient), anonymize and augment.</li>
        <li><b>Model Development</b> – Build STFT/Mel-spectrogram pipeline, train CNN/RNN models in TensorFlow & PyTorch.</li>
        <li><b>Edge Deployment</b> – Quantize and convert to TFLite for Raspberry Pi / ESP32 inference.</li>
        <li><b>Privacy & Security</b> – Log only statistical data (event counts, timestamps) and secure all transmissions with HTTPS + JWT.</li>
        <li><b>Testing & Evaluation</b> – Validate on-device accuracy, latency, and energy efficiency.</li>
        <li><b>Documentation</b> – Maintain GitHub Wiki and this page as a traceable SE artifact.</li>
      </ol>
    </div>
  </div>
  <hr>

  <div class="section" align="center">
    <h2 style="color:var(--accent1)">Tech Stack</h2>
    <div class="badges">
      <span class="badge">Python</span><span class="badge">TensorFlow Lite</span><span class="badge">PyTorch</span>
      <span class="badge">Flask</span><span class="badge">Raspberry Pi OS</span><span class="badge">ESP32</span>
      <span class="badge">Figma</span><span class="badge">GitHub Actions</span><span class="badge">MySQL</span>
    </div>
  </div>
  <hr>

  <div id="about" class="section">
    <h2 style="color:var(--accent2)">Team Members</h2>
    <div class="card">
      <ul style="list-style-type:disc; padding-left:18px">
        <li><b>Minjin Kim</b> – PM / Backend Engineer / System Design</li>
        <li><b>Jimmy MacDonald</b> – ML Engineer / Model Optimization / QA</li>
        <li><b>Yeonwoo Kim</b> – IoT Integration / Edge Deployment</li>
        <li><b>Soobeen Yim</b> – Frontend / UX Design / Documentation</li>
      </ul>
    </div>
  </div>
  <hr>

  <div class="section">
    <h2 style="color:var(--accent1)">Progress Log</h2>
    <table class="table">
      <tr><th>Task</th><th>Description</th><th>Status</th></tr>
      <tr><td>Week 1</td><td>Team formation & project ideation</td><td>✅ Completed</td></tr>
      <tr><td>Week 2</td><td>Requirements analysis and DoD draft</td><td>✅ Completed</td></tr>
      <tr><td>Week 3</td><td>Privacy & security architecture review</td><td>🟡 In Progress</td></tr>
      <tr><td>Week 4</td><td>Data collection and preprocessing</td><td>⏳ Upcoming</td></tr>
      <tr><td>Week 5</td><td>Model training & TFLite conversion</td><td>Pending</td></tr>
      <tr><td>Final</td><td>Integration + demo + report</td><td>Pending</td></tr>
    </table>
  </div>
  <hr>

  <div id="contact" class="section" align="center">
    <h2 style="color:var(--accent1)">Contact</h2>
    <div class="badges">
      <a href="#"><span class="badge" style="background:linear-gradient(135deg, rgba(2,6,23,.55), rgba(30,41,59,.55)); border-color:#334155">Notion</span></a>
      <a href="#"><span class="badge" style="background:linear-gradient(135deg, rgba(251,113,133,.38), rgba(244,114,182,.34))">Youtube</span></a>
      <a href="#"><span class="badge" style="background:linear-gradient(135deg, rgba(147,197,253,.35), rgba(125,211,252,.28))">Hanyang Univ</span></a>
    </div>
  </div>

  <footer class="section muted">
    Last Updated: October 23 2025 – Hanyang University – Dept. of Information Systems – Group 07 PureCare Project
  </footer>
</div>