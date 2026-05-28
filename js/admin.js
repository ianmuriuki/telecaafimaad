/* admin.js — Administration interface. Requires db.js loaded first. */
(function () {
  'use strict';

  DB.init();

  var currentPage  = 1;
  var PAGE_SIZE    = 10;
  var expandedDoc  = null;

  /* ── DOM refs ─────────────────────────────────────────── */
  var tabBtns          = document.querySelectorAll('.tab-btn');
  var tabPanels        = document.querySelectorAll('.tab-panel');
  var caseTableBody    = document.getElementById('caseTableBody');
  var pagination       = document.getElementById('pagination');
  var caselogMeta      = document.getElementById('caselogMeta');
  var doctorRegistry   = document.getElementById('doctorRegistry');
  var dhis2TableBody   = document.getElementById('dhis2TableBody');
  var reconcileSummary = document.getElementById('reconcileSummary');
  var pathwayBreakdown = document.getElementById('pathwayBreakdown');
  var districtList     = document.getElementById('districtList');
  var resetBtn         = document.getElementById('resetDataBtn');

  /* ── Tab switching ────────────────────────────────────── */
  tabBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      var tab = btn.getAttribute('data-tab');
      tabBtns.forEach(function(b){ b.classList.remove('is-active'); b.setAttribute('aria-selected','false'); });
      tabPanels.forEach(function(p){ p.classList.remove('is-active'); });
      btn.classList.add('is-active'); btn.setAttribute('aria-selected','true');
      var panel = document.getElementById('tab-'+tab);
      if (panel) panel.classList.add('is-active');
    });
  });

  /* ── Overview ─────────────────────────────────────────── */
  function renderOverview() {
    var s = DB.getStats();

    var fields = {
      'stat-total':    s.total,
      'stat-week':     s.this_week,
      'stat-doctors':  s.active_doctors + ' / ' + s.total_doctors,
      'stat-dhis2':    s.dhis2_rate,
      'stat-referrals':s.referrals,
      'stat-rx':       s.prescriptions,
      'stat-followup': s.followups,
      'stat-video':    s.video_calls
    };

    Object.keys(fields).forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.textContent = fields[id];
    });

    renderPathwayBreakdown(s);
    renderDistrictList();
  }

  function renderPathwayBreakdown(stats) {
    if (!pathwayBreakdown) return;
    var rows = [
      { name:'Prescription',  count:stats.prescriptions },
      { name:'Lab Order',     count:stats.lab_orders },
      { name:'Referral',      count:stats.referrals },
      { name:'Follow-up',     count:stats.followups },
      { name:'No Action',     count:stats.no_action }
    ];
    var total = stats.total || 1;
    pathwayBreakdown.innerHTML = '';
    rows.forEach(function(r){
      var pct = Math.round((r.count/total)*100);
      var div = document.createElement('div');
      div.className = 'pb-row';
      div.innerHTML = '<span class="pb-name">'+r.name+'</span><span class="pb-count">'+r.count+'</span><span class="pb-pct">'+pct+'%</span>';
      pathwayBreakdown.appendChild(div);
    });
  }

  function renderDistrictList() {
    if (!districtList) return;
    var cases = DB.getClosedCases();
    var counts = {};
    cases.forEach(function(c){ counts[c.district] = (counts[c.district]||0) + 1; });
    districtList.innerHTML = '';
    Object.keys(counts).sort().forEach(function(d){
      var div = document.createElement('div');
      div.className = 'dl-row';
      div.innerHTML = '<span class="dl-name">'+d+'</span><span class="dl-count">'+counts[d]+' consultations</span>';
      districtList.appendChild(div);
    });
  }

  /* ── Case Log ─────────────────────────────────────────── */
  function dhis2Class(s) {
    return s==='Success'||s==='Pushed' ? 'status-active'
         : s==='Pending'||s==='Retry'  ? 'status-pending'
         : s==='Failed'               ? 'status-failed'
         : 'status-closed';
  }

  function renderCasePage(page) {
    currentPage = page;
    var all   = DB.getCases().slice().reverse();
    var start = (page-1)*PAGE_SIZE;
    var slice = all.slice(start, start+PAGE_SIZE);

    caseTableBody.innerHTML = '';
    slice.forEach(function(c){
      var tr = document.createElement('tr');
      var ds = c.dhis2_status || (c.status==='closed' ? 'Pushed' : 'Pending');
      tr.innerHTML =
        '<td style="font-weight:600;color:var(--accent);font-size:var(--t-xs)">'+c.id+'</td>'+
        '<td>'+(c.closed_at||c.created_at||'').slice(0,10)+'</td>'+
        '<td>'+(c.district||'—')+'</td>'+
        '<td>'+(c.specialty||'—')+'</td>'+
        '<td>'+(c.diagnosis||c.status==='pending'?'<em style="color:var(--ink-3)">Pending</em>':c.diagnosis||'—')+'</td>'+
        '<td>'+(c.pathway ? c.pathway.charAt(0).toUpperCase()+c.pathway.slice(1) + (c.video_url ? ' · Video' : '') : c.status==='pending'?'<em style="color:var(--ink-3)">Awaiting</em>':'—')+'</td>'+
        '<td><span class="status-badge '+dhis2Class(ds)+'">'+ds+'</span></td>';
      caseTableBody.appendChild(tr);
    });

    var total = Math.ceil(all.length/PAGE_SIZE);
    if (caselogMeta) caselogMeta.textContent = 'Showing '+(start+1)+'–'+Math.min(start+PAGE_SIZE,all.length)+' of '+all.length;
    renderPagination(page, total);
  }

  function renderPagination(current, total) {
    if (!pagination) return;
    pagination.innerHTML = '';

    var prev = document.createElement('button');
    prev.className='page-btn'; prev.textContent='←'; prev.disabled=current===1;
    prev.addEventListener('click', function(){ if(current>1) renderCasePage(current-1); });
    pagination.appendChild(prev);

    for (var i=1; i<=total; i++) {
      (function(p){
        var btn=document.createElement('button');
        btn.className='page-btn'+(p===current?' is-active':'');
        btn.textContent=p;
        btn.addEventListener('click', function(){ renderCasePage(p); });
        pagination.appendChild(btn);
      })(i);
    }

    var next=document.createElement('button');
    next.className='page-btn'; next.textContent='→'; next.disabled=current===total;
    next.addEventListener('click', function(){ if(current<total) renderCasePage(current+1); });
    pagination.appendChild(next);
  }

  /* ── Doctor Registry ──────────────────────────────────── */
  function renderDoctorRegistry() {
    if (!doctorRegistry) return;
    doctorRegistry.innerHTML = '';
    var doctors = DB.getDoctors();
    doctors.forEach(function(doc){
      var row = document.createElement('div');
      row.className = 'dr-reg-row';
      var sc = doc.status==='Active'?'status-active':doc.status==='Pending'?'status-pending':'status-closed';
      var main = document.createElement('div');
      main.className = 'dr-reg-main';
      main.innerHTML =
        '<div><div class="dr-name">'+doc.name+'</div><div class="dr-spec">'+doc.spec+'</div></div>'+
        '<div class="dr-loc">'+doc.loc+'</div>'+
        '<span class="status-badge '+sc+'">'+doc.status+'</span>'+
        '<div class="dr-cases">'+doc.cases+' cases</div>'+
        '<div class="dr-expand">'+(expandedDoc===doc.id?'▲ Hide':'▼ View')+'</div>';

      main.addEventListener('click', function(){
        expandedDoc = expandedDoc===doc.id ? null : doc.id;
        renderDoctorRegistry();
      });
      row.appendChild(main);

      if (expandedDoc === doc.id) {
        var det = document.createElement('div');
        det.className = 'dr-reg-detail is-open';
        var ns = doc.nhpc
          ? '<span class="status-badge status-active">Verified</span>'
          : '<span class="status-badge status-pending">In Review</span>';
        det.innerHTML =
          '<div class="dr-detail-grid">'+
            '<div class="dr-detail-row"><span class="ddr-key">Full name</span><span class="ddr-val">'+doc.name+'</span></div>'+
            '<div class="dr-detail-row"><span class="ddr-key">Specialty</span><span class="ddr-val">'+doc.spec+'</span></div>'+
            '<div class="dr-detail-row"><span class="ddr-key">Location</span><span class="ddr-val">'+doc.loc+'</span></div>'+
            '<div class="dr-detail-row"><span class="ddr-key">Qualification</span><span class="ddr-val">'+doc.qualif+'</span></div>'+
            '<div class="dr-detail-row"><span class="ddr-key">License</span><span class="ddr-val">'+doc.license+'</span></div>'+
            '<div class="dr-detail-row"><span class="ddr-key">Joined</span><span class="ddr-val">'+doc.joined+'</span></div>'+
            '<div class="dr-detail-row"><span class="ddr-key">Cases closed</span><span class="ddr-val">'+doc.cases+'</span></div>'+
            '<div class="dr-detail-row"><span class="ddr-key">NHPC status</span><span class="ddr-val">'+ns+'</span></div>'+
          '</div>';
        row.appendChild(det);
      }
      doctorRegistry.appendChild(row);
    });
  }

  /* ── DHIS2 Sync ───────────────────────────────────────── */
  function renderReconcileSummary() {
    if (!reconcileSummary) return;
    var log = DB.getDHIS2Log();
    var pushed  = log.filter(function(e){ return e.status==='Success'||e.status==='Pushed'; }).length;
    var retries = log.filter(function(e){ return e.status==='Retry'||e.status==='Pending'; }).length;
    var failed  = log.filter(function(e){ return e.status==='Failed'; }).length;
    var mostRecent = log[0] ? new Date(log[0].ts) : null;
    var ago = mostRecent ? Math.round((Date.now()-mostRecent.getTime())/60000) + ' min ago' : '—';

    reconcileSummary.innerHTML =
      '<div class="recon-item"><span class="recon-label">Last sync</span><span class="recon-value">'+ago+'</span></div>'+
      '<div class="recon-item"><span class="recon-label">Pushed today</span><span class="recon-value recon-value--success">'+pushed+'</span></div>'+
      '<div class="recon-item"><span class="recon-label">Pending retries</span><span class="recon-value'+(retries?' recon-value--warn':'')+'">'+retries+'</span></div>'+
      '<div class="recon-item"><span class="recon-label">Failed</span><span class="recon-value'+(failed?' recon-value--error':'')+'">'+failed+'</span></div>';
  }

  function renderDHIS2Log() {
    if (!dhis2TableBody) return;
    var log = DB.getDHIS2Log();
    dhis2TableBody.innerHTML = '';
    log.slice(0,30).forEach(function(r){
      var sc   = r.status==='Success'?'status-active':r.status==='Retry'||r.status==='Pending'?'status-pending':'status-failed';
      var cc   = r.code===200?'http-ok':r.code===503?'http-retry':'http-error';
      var ts   = r.ts ? r.ts.replace('T',' ').slice(0,19)+' UTC' : '—';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="white-space:nowrap;font-size:var(--t-xs)">'+ts+'</td>'+
        '<td style="font-weight:600;color:var(--accent);font-size:var(--t-xs)">'+r.case_id+'</td>'+
        '<td>'+(r.district||'—')+'</td>'+
        '<td><span class="status-badge '+sc+'">'+r.status+'</span></td>'+
        '<td><span class="'+(r.code?cc:'')+'">'+r.code+'</span></td>'+
        '<td style="font-size:var(--t-xs);color:var(--ink-3)">'+r.msg+'</td>';
      dhis2TableBody.appendChild(tr);
    });
  }

  /* ── Reset button ─────────────────────────────────────── */
  if (resetBtn) {
    resetBtn.addEventListener('click', function(){
      if (confirm('Reset all demo data to its original state? This cannot be undone.')) {
        DB.reset();
        location.reload();
      }
    });
  }

  /* ── Init ───────────────────────────────────────────────── */
  if (tabPanels.length) tabPanels[0].classList.add('is-active');
  renderOverview();
  renderCasePage(1);
  renderDoctorRegistry();
  renderReconcileSummary();
  renderDHIS2Log();

  window.addEventListener('storage', function (e) {
    if (e.key === 'tc_cases' || e.key === 'tc_doctors' || e.key === 'tc_dhis2_log') {
      renderOverview();
      renderCasePage(1);
      renderReconcileSummary();
      renderDHIS2Log();
    }
  });

})();
