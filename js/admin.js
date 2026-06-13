/* admin.js — Administration console. Requires db.js + Leaflet loaded first. */
(function () {
  'use strict';

  DB.init();

  /* ── Login guard ─────────────────────────────────────────── */
  var _PORTAL    = 'admin';
  var _AUTH_KEY  = 'tc_auth_admin';
  var _loginOverlay  = document.getElementById('loginOverlay');
  var _mainInterface = document.getElementById('mainInterface');

  function _doLogin() {
    var id    = (document.getElementById('loginId')      ||{}).value||'';
    var pw    = (document.getElementById('loginPassword')||{}).value||'';
    var errEl = document.getElementById('loginError');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if (DB.checkCredentials(_PORTAL, id.trim(), pw)) {
      sessionStorage.setItem(_AUTH_KEY, '1');
      if (_loginOverlay)  _loginOverlay.style.display  = 'none';
      if (_mainInterface) _mainInterface.style.display = '';
      _initMain();
    } else {
      if (errEl) { errEl.textContent = 'Invalid ID or password. Please try again.'; errEl.style.display = ''; }
    }
  }

  function _initMain() {

  var currentTab    = 'overview';
  var expandedFacId = null;

  var DISTRICTS = [
    { name:'Banadir',           lat:2.0469,  lng:45.3182, cases:2 },
    { name:'Bay',               lat:3.1084,  lng:43.6499, cases:1 },
    { name:'Lower Shabelle',    lat:1.7833,  lng:44.6167, cases:0 },
    { name:'Middle Shabelle',   lat:2.8917,  lng:45.5000, cases:0 },
    { name:'Galgadud',          lat:5.1481,  lng:46.9625, cases:0 },
    { name:'Jubbaland',         lat:0.3528,  lng:42.5454, cases:0 },
  ];

  /* ── DOM refs ─────────────────────────────────────────── */
  var snavItems      = document.querySelectorAll('.snav-item');
  var mobileMenuBtn  = document.getElementById('mobileMenuBtn');
  var mobileViewTitle= document.getElementById('mobileViewTitle');
  var sidebar        = document.querySelector('.admin-sidebar');
  var sidebarBackdrop= document.getElementById('sidebarBackdrop');

  /* ── Helpers ─────────────────────────────────────────── */
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function capitalise(s){ return s?s.charAt(0).toUpperCase()+s.slice(1):''; }

  function dhis2Class(s){
    return s==='Success'||s==='Pushed'  ? 'status-active'
         : s==='Pending'||s==='Retry'   ? 'status-pending'
         : s==='Failed'                 ? 'status-failed'
         : 'status-closed';
  }

  /* ── Tab switching ────────────────────────────────────── */
  var tabTitles = {
    overview:'Overview', caselog:'Case Log', facilities:'Facilities',
    doctors:'Doctor Registry', specialists:'Specialist Registry',
    dhis2:'DHIS2 Sync', donor:'Donor Dashboard', reset:'Reset Data'
  };

  function showTab(tabId){
    document.querySelectorAll('.admin-tab').forEach(function(t){ t.classList.remove('is-active'); });
    var t = document.getElementById('tab-'+tabId);
    if(t) t.classList.add('is-active');
    snavItems.forEach(function(btn){
      btn.classList.toggle('is-active', btn.getAttribute('data-tab')===tabId);
    });
    if(mobileViewTitle) mobileViewTitle.textContent = tabTitles[tabId]||'';
    currentTab = tabId;
    if(sidebar)         sidebar.classList.remove('is-open');
    if(sidebarBackdrop) sidebarBackdrop.classList.remove('is-visible');

    if(tabId==='caselog')     renderCaseLog();
    if(tabId==='doctors')     renderDoctors();
    if(tabId==='specialists') renderSpecialists();
    if(tabId==='dhis2')       renderDHIS2();

    if(tabId==='facilities'){
      renderFacilities();
      if(!window._facilitiesMapInit && typeof L !== 'undefined'){
        window._facilitiesMapInit = true;
        var facs = DB.getFacilities();
        var facilMap = L.map('facilitiesMap').setView([5.1521, 46.1996], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
          attribution:'&copy; OpenStreetMap contributors', maxZoom:19
        }).addTo(facilMap);
        facs.forEach(function(f){
          if(f.lat && f.lng){
            var fcolor = (f.type==='Public') ? '#007A6E' : '#B45309';
            L.circleMarker([f.lat, f.lng], {
              radius:10, fillColor:fcolor, color:'#fff', weight:2, opacity:1, fillOpacity:0.85
            }).addTo(facilMap)
              .bindPopup('<strong>'+f.name+'</strong><br>'+f.type+'<br>'+f.district+'<br>'+(f.services||[]).join(', '));
          }
        });
        setTimeout(function(){ facilMap.invalidateSize(); }, 100);
      }
    }

    if(tabId==='donor'){
      renderDonorDash();
      if(!window._coverageMapInit && typeof L !== 'undefined'){
        window._coverageMapInit = true;
        var covMap = L.map('coverageMap').setView([2.5, 44.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
          attribution:'&copy; OpenStreetMap contributors', maxZoom:19
        }).addTo(covMap);
        var cases2 = DB.getCases();
        var distCounts2 = {};
        cases2.forEach(function(c){ distCounts2[c.district]=(distCounts2[c.district]||0)+1; });
        DISTRICTS.forEach(function(d){
          var count = distCounts2[d.name]||0;
          var color = count>1?'#007A6E':count>0?'#56b8b0':'#ccc';
          L.circleMarker([d.lat,d.lng],{
            radius:count?12:8, fillColor:color, color:'#fff', weight:2, opacity:1, fillOpacity:0.85
          }).addTo(covMap)
            .bindPopup('<strong>'+d.name+'</strong><br>'+count+' consultation'+(count!==1?'s':''));
        });
        setTimeout(function(){ covMap.invalidateSize(); }, 100);
      }
    }
  }

  snavItems.forEach(function(btn){
    btn.addEventListener('click', function(){ showTab(btn.getAttribute('data-tab')); });
  });

  if(mobileMenuBtn && sidebar){
    mobileMenuBtn.addEventListener('click', function(){
      var open = sidebar.classList.toggle('is-open');
      if(sidebarBackdrop) sidebarBackdrop.classList.toggle('is-visible', open);
    });
  }
  if(sidebarBackdrop){
    sidebarBackdrop.addEventListener('click', function(){
      sidebar.classList.remove('is-open');
      sidebarBackdrop.classList.remove('is-visible');
    });
  }

  /* ── Overview ─────────────────────────────────────────── */
  function renderOverview(){
    var s = DB.getStats();
    var dateEl = document.getElementById('overviewDate');
    if(dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});

    var statBand = document.getElementById('statBand');
    if(statBand){
      var stats = [
        { val:s.total,              label:'Total consultations' },
        { val:s.this_week,          label:'This week' },
        { val:s.active_doctors+' / '+s.total_doctors, label:'Active doctors' },
        { val:s.dhis2_rate,         label:'DHIS2 push rate' },
        { val:s.referrals,          label:'Referrals' },
        { val:s.patients,           label:'Registered patients' },
      ];
      statBand.innerHTML = stats.map(function(st){
        return '<div class="stat-card"><span class="sc-value">'+esc(st.val)+'</span><span class="sc-label">'+esc(st.label)+'</span></div>';
      }).join('');
    }

    var pathwayBars = document.getElementById('pathwayBars');
    if(pathwayBars){
      var total = s.total || 1;
      var rows = [
        { name:'Prescription', count:s.prescriptions },
        { name:'Lab Order',    count:s.lab_orders },
        { name:'Referral',     count:s.referrals },
        { name:'Follow-up',    count:s.followups },
        { name:'No Action',    count:s.no_action },
      ];
      pathwayBars.innerHTML = rows.map(function(r){
        var pct = Math.round((r.count/total)*100);
        return '<div class="pathway-bar-row">'+
          '<span class="pbr-name">'+esc(r.name)+'</span>'+
          '<div class="pbr-track"><div class="pbar-fill" style="width:'+pct+'%"></div></div>'+
          '<span class="pbr-count">'+r.count+'</span>'+
        '</div>';
      }).join('');
    }

    var recentEl = document.getElementById('recentActivity');
    if(recentEl){
      var log  = DB.getDHIS2Log().slice(0,8);
      if(!log.length){
        recentEl.innerHTML = '<p class="empty-msg">No activity yet.</p>';
      } else {
        recentEl.innerHTML = log.map(function(e){
          var sc = dhis2Class(e.status);
          return '<div class="activity-row">'+
            '<span class="activity-id">'+esc(e.case_id)+'</span>'+
            '<span class="activity-msg">'+esc(e.msg||'')+'</span>'+
            '<span class="status-badge '+sc+'">'+esc(e.status)+'</span>'+
          '</div>';
        }).join('');
      }
    }
  }

  /* ── Case Log ─────────────────────────────────────────── */
  function renderCaseLog(){
    var tbody  = document.getElementById('caselogBody');
    var meta   = document.getElementById('caselogMeta');
    var search = (document.getElementById('caseSearch')||{}).value||'';
    var status = (document.getElementById('caseStatusFilter')||{}).value||'';
    if(!tbody) return;

    var cases = DB.getCases().slice().reverse();
    if(search){
      var q = search.toLowerCase();
      cases = cases.filter(function(c){
        return (c.id||'').toLowerCase().includes(q)||(c.district||'').toLowerCase().includes(q)||(c.pathway||'').toLowerCase().includes(q)||(c.patient_name||'').toLowerCase().includes(q);
      });
    }
    if(status) cases = cases.filter(function(c){ return c.status===status; });
    if(meta) meta.textContent = cases.length + ' case'+(cases.length!==1?'s':'');

    tbody.innerHTML = '';
    var emptyEl = document.getElementById('emptyCaselog');
    if(emptyEl) emptyEl.classList.toggle('hidden', cases.length>0);
    cases.forEach(function(c){
      var ds = c.dhis2_status||(c.status==='closed'?'Pushed':'Pending');
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="font-weight:700;color:var(--accent);font-size:var(--t-xs)">'+esc(c.id)+'</td>'+
        '<td>'+esc(c.patient_name||'—')+'</td>'+
        '<td>'+esc(c.district||'—')+'</td>'+
        '<td>'+esc(c.facility_name||'—')+'</td>'+
        '<td>'+esc(c.doctor_name||'—')+'</td>'+
        '<td style="font-size:var(--t-xs)">'+esc((c.symptoms||[]).slice(0,2).join(', '))+'</td>'+
        '<td>'+capitalise(c.pathway||'')+''+(c.video_url?' · Video':'')+'</td>'+
        '<td><span class="status-badge '+(c.status==='closed'?'status-active':'status-pending')+'">'+capitalise(c.status)+'</span></td>'+
        '<td><span class="status-badge '+dhis2Class(ds)+'">'+esc(ds)+'</span></td>'+
        '<td style="white-space:nowrap;font-size:var(--t-xs)">'+esc((c.created_at||'').slice(0,10))+'</td>';
      tbody.appendChild(tr);
    });
  }

  var caseSearchEl   = document.getElementById('caseSearch');
  var caseStatusEl   = document.getElementById('caseStatusFilter');
  if(caseSearchEl) caseSearchEl.addEventListener('input', function(){ if(currentTab==='caselog') renderCaseLog(); });
  if(caseStatusEl) caseStatusEl.addEventListener('change', function(){ if(currentTab==='caselog') renderCaseLog(); });

  /* ── Facilities (table only — map init is in showTab) ──── */
  function renderFacilities(){
    var tbody = document.getElementById('facilitiesBody');
    if(!tbody) return;
    var facs  = DB.getFacilities();
    var cases = DB.getCases();

    tbody.innerHTML = '';
    facs.forEach(function(f){
      var fCases   = cases.filter(function(c){ return c.facility_id===f.id; }).length;
      var expanded = expandedFacId===f.id;
      var tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML =
        '<td style="color:var(--accent);font-size:0.8rem">'+esc(expanded?'▲':'▼')+'</td>'+
        '<td style="font-weight:700">'+esc(f.name)+'</td>'+
        '<td>'+esc(f.district)+'</td>'+
        '<td>'+esc(f.type)+'</td>'+
        '<td>'+esc(f.doctors)+'</td>'+
        '<td>'+fCases+'</td>'+
        '<td><span class="status-badge status-active">Active</span></td>';
      tr.addEventListener('click', function(){ expandedFacId=(expanded?null:f.id); renderFacilities(); });
      tbody.appendChild(tr);
      if(expanded){
        var det = document.createElement('tr');
        det.className = 'fac-detail-row';
        det.innerHTML = '<td colspan="7" class="fac-detail-cell">'+
          '<div class="fac-detail-grid">'+
            dRow('Phone',    f.phone||'—')+
            dRow('Address',  f.address||'—')+
            dRow('Lat/Lng',  f.lat+', '+f.lng)+
            dRow('DHIS2 OU', f.dhis2_ou||'—')+
          '</div></td>';
        tbody.appendChild(det);
      }
    });
  }

  function dRow(k,v){ return '<div class="fac-detail-row-item"><span class="fdr-key">'+esc(k)+'</span><span class="fdr-val">'+esc(v)+'</span></div>'; }

  /* ── Doctor Registry ──────────────────────────────────── */
  function renderDoctors(){
    var tbody = document.getElementById('doctorsBody');
    var meta  = document.getElementById('docRegistryMeta');
    if(!tbody) return;
    var docs  = DB.getDoctors();
    if(meta) meta.textContent = docs.length + ' registered doctor'+(docs.length!==1?'s':'');
    tbody.innerHTML = '';
    docs.forEach(function(d){
      var sc = d.status==='Active'?'status-active':d.status==='Pending'?'status-pending':'status-closed';
      var nhpc = d.nhpc
        ? '<span class="status-badge status-active">Verified</span>'
        : '<span class="status-badge status-pending">Pending</span>';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="font-weight:700">'+esc(d.name)+'</td>'+
        '<td>'+esc(d.spec||d.specialty||'—')+'</td>'+
        '<td>'+esc(d.facility||d.loc||'—')+'</td>'+
        '<td>'+esc(d.district||'—')+'</td>'+
        '<td>'+esc(d.cases)+'</td>'+
        '<td>'+nhpc+'</td>'+
        '<td><span class="status-badge '+sc+'">'+esc(d.status)+'</span></td>';
      tbody.appendChild(tr);
    });
  }

  /* ── Specialist Registry ──────────────────────────────── */
  function renderSpecialists(){
    var tbody = document.getElementById('specialistsBody');
    var meta  = document.getElementById('specRegistryMeta');
    if(!tbody) return;
    var specs = DB.getSpecialists();
    if(meta) meta.textContent = specs.length + ' registered specialist'+(specs.length!==1?'s':'');
    tbody.innerHTML = '';
    specs.forEach(function(s){
      var sc = s.status==='Active'?'status-active':s.status==='Offline'?'status-closed':'status-pending';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="font-weight:700">'+esc(s.name)+'</td>'+
        '<td>'+esc(s.specialty)+'</td>'+
        '<td>'+esc(s.location)+'</td>'+
        '<td>'+esc((s.languages||[]).join(', '))+'</td>'+
        '<td>'+esc(s.cases||0)+'</td>'+
        '<td><span class="status-badge '+sc+'">'+esc(s.status)+'</span></td>';
      tbody.appendChild(tr);
    });
  }

  /* ── DHIS2 Sync ───────────────────────────────────────── */
  function renderDHIS2(){
    var tbody  = document.getElementById('dhis2Body');
    var meta   = document.getElementById('dhis2Meta');
    var filter = (document.getElementById('dhis2StatusFilter')||{}).value||'';
    if(!tbody) return;
    var log = DB.getDHIS2Log();
    if(filter) log = log.filter(function(e){ return e.status===filter; });
    if(meta) meta.textContent = 'National instance · Somalia HMIS · /api/tracker · '+log.length+' entries';

    var all     = DB.getDHIS2Log();
    var pushed  = all.filter(function(e){ return e.status==='Success'; }).length;
    var failed  = all.filter(function(e){ return e.status==='Failed'; }).length;
    var pending = all.filter(function(e){ return e.status==='Pending'; }).length;
    var reconEl = document.getElementById('reconcileSummary');
    if(reconEl){
      reconEl.innerHTML =
        '<div class="recon-item"><span class="recon-label">Pushed</span><span class="recon-value recon-value--success">'+pushed+'</span></div>'+
        '<div class="recon-item"><span class="recon-label">Failed</span><span class="recon-value'+(failed?' recon-value--error':'')+'">'+failed+'</span></div>'+
        '<div class="recon-item"><span class="recon-label">Pending</span><span class="recon-value'+(pending?' recon-value--warn':'')+'">'+pending+'</span></div>';
    }

    tbody.innerHTML = '';
    log.slice(0,50).forEach(function(r){
      var sc = dhis2Class(r.status);
      var ts = (r.ts||'').replace('T',' ').slice(0,19);
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="white-space:nowrap;font-size:var(--t-xs)">'+esc(ts)+'</td>'+
        '<td style="font-weight:700;color:var(--accent);font-size:var(--t-xs)">'+esc(r.case_id)+'</td>'+
        '<td>'+esc(r.district||'—')+'</td>'+
        '<td>'+esc(r.type||'Consultation')+'</td>'+
        '<td><span class="status-badge '+sc+'">'+esc(r.status)+'</span></td>'+
        '<td style="font-size:var(--t-xs)">'+(r.code||'—')+'</td>'+
        '<td style="font-size:var(--t-xs);color:var(--ink-3)">'+esc(r.msg||'')+'</td>';
      tbody.appendChild(tr);
    });
  }

  var dhis2FilterEl = document.getElementById('dhis2StatusFilter');
  if(dhis2FilterEl) dhis2FilterEl.addEventListener('change', function(){ if(currentTab==='dhis2') renderDHIS2(); });

  var syncAllBtn = document.getElementById('syncAllBtn');
  if(syncAllBtn) syncAllBtn.addEventListener('click', function(){
    var log = DB.getDHIS2Log();
    var now = new Date().toISOString();
    log.forEach(function(e){
      if(e.status==='Failed'){
        var ok = Math.random() > 0.25;
        DB.updateDHIS2Entry(e.case_id, {
          status:ok?'Success':'Failed', code:ok?200:422,
          msg:ok?'Retry succeeded · tracker entity updated':'Retry failed · validation error', ts:now
        });
      }
    });
    renderDHIS2();
  });

  /* ── Donor Dashboard (stats/bars/log only — map init is in showTab) */
  function renderDonorDash(){
    var s = DB.getStats();

    var statBand = document.getElementById('donorStatBand');
    if(statBand){
      var donations = DB.getDonations();
      var total = donations.reduce(function(sum,d){ return sum+(d.amount||0); }, 0);
      var stats2 = [
        { val:'$'+total.toLocaleString(), label:'Total donations' },
        { val:donations.length, label:'Donors' },
        { val:s.total, label:'Consultations supported' },
        { val:s.patients, label:'Patients reached' },
      ];
      statBand.innerHTML = stats2.map(function(st){
        return '<div class="stat-card"><span class="sc-value">'+esc(st.val)+'</span><span class="sc-label">'+esc(st.label)+'</span></div>';
      }).join('');
    }

    var covEl = document.getElementById('districtCoverage');
    if(covEl){
      var cases = DB.getCases();
      var distCounts = {};
      cases.forEach(function(c){ distCounts[c.district]=(distCounts[c.district]||0)+1; });
      var maxCases = Math.max.apply(null, Object.values(distCounts).concat([1]));
      covEl.innerHTML = DISTRICTS.map(function(d){
        var count = distCounts[d.name]||0;
        var pct   = Math.round((count/maxCases)*100);
        var active = count>0;
        return '<div class="pathway-bar-row">'+
          '<span class="pbr-name" style="width:160px">'+esc(d.name)+'</span>'+
          '<div class="pbr-track"><div class="pbar-fill'+(active?'':' pbar-fill--inactive')+'" style="width:'+pct+'%"></div></div>'+
          '<span class="pbr-count">'+count+'</span>'+
        '</div>';
      }).join('');
    }

    var logBody   = document.getElementById('donationLogBody');
    var emptyEl   = document.getElementById('emptyDonations');
    var donations2 = DB.getDonations().slice().reverse();
    if(emptyEl) emptyEl.classList.toggle('hidden', donations2.length>0);
    if(logBody){
      logBody.innerHTML = '';
      donations2.forEach(function(d){
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>'+esc((d.ts||'').slice(0,10))+'</td>'+
          '<td>'+esc(d.donor_name||'Anonymous')+'</td>'+
          '<td style="font-weight:700">$'+esc(d.amount)+'</td>'+
          '<td>'+esc(d.method)+'</td>'+
          '<td>'+esc(d.tier||'—')+'</td>';
        logBody.appendChild(tr);
      });
    }
  }

  /* ── Reset ────────────────────────────────────────────── */
  var resetBtn = document.getElementById('resetBtn');
  if(resetBtn) resetBtn.addEventListener('click', function(){
    if(confirm('Wipe all data and re-seed the demo database? This cannot be undone.')){
      DB.reset();
      var successEl = document.getElementById('resetSuccess');
      if(successEl) successEl.classList.remove('hidden');
      setTimeout(function(){ location.reload(); }, 1200);
    }
  });

  /* ── Storage event ────────────────────────────────────── */
  window.addEventListener('storage', function(e){
    var watched = ['tc_cases','tc_doctors','tc_specialists','tc_dhis2_log',
                   'tc_referrals','tc_donations','tc_patients','tc_facilities'];
    if(watched.indexOf(e.key) > -1){
      if(currentTab==='overview')   renderOverview();
      if(currentTab==='caselog')    renderCaseLog();
      if(currentTab==='facilities') renderFacilities();
      if(currentTab==='doctors')    renderDoctors();
      if(currentTab==='specialists')renderSpecialists();
      if(currentTab==='dhis2')      renderDHIS2();
      if(currentTab==='donor')      renderDonorDash();
    }
  });

  /* ── Init ─────────────────────────────────────────────── */
  renderOverview();

  } /* end _initMain */

  /* ── Sign-in / sign-out wiring ──────────────────────────── */
  var _signInBtn = document.getElementById('signInBtn');
  if (_signInBtn) _signInBtn.addEventListener('click', _doLogin);
  var _pwInput = document.getElementById('loginPassword');
  if (_pwInput) _pwInput.addEventListener('keydown', function(e){ if(e.key==='Enter') _doLogin(); });

  if (sessionStorage.getItem(_AUTH_KEY) === '1') {
    if (_loginOverlay)  _loginOverlay.style.display  = 'none';
    if (_mainInterface) _mainInterface.style.display = '';
  }

  var _signOutBtn = document.getElementById('signOutBtn');
  if (_signOutBtn) {
    _signOutBtn.addEventListener('click', function() {
      sessionStorage.removeItem(_AUTH_KEY);
      location.reload();
    });
  }

  if (sessionStorage.getItem(_AUTH_KEY) !== '1') return;

  _initMain();

})();
