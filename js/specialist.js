/* specialist.js — Diaspora specialist interface. Requires db.js loaded first. */
(function () {
  'use strict';

  DB.init();

  /* ── Login guard ─────────────────────────────────────────── */
  var _PORTAL    = 'specialist';
  var _AUTH_KEY  = 'tc_auth_specialist';
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

  /* Default to first specialist in seed data */
  var SPECIALIST_ID = 1;
  var specialist = DB.getSpecialist(SPECIALIST_ID) || {
    id:1, name:'Dr. Amina Hassan', specialty:'Cardiology',
    location:'Toronto, Canada', languages:['Somali','English'],
    status:'Active', cases:0
  };

  var currentRefId  = null;
  var currentView   = 'queue';
  var isOnline      = true;

  /* ── DOM refs ─────────────────────────────────────────── */
  var snavItems     = document.querySelectorAll('.snav-item');
  var queueBadge    = document.getElementById('queueBadge');
  var mobileBadge   = document.getElementById('mobileQueueBadge');
  var queueMeta     = document.getElementById('queueMeta');
  var referralQueue = document.getElementById('referralQueue');
  var emptyQueue    = document.getElementById('emptyQueue');
  var backToQueue   = document.getElementById('backToQueue');
  var detailRefId   = document.getElementById('detailRefId');
  var mobileMenuBtn = document.getElementById('mobileMenuBtn');
  var mobileViewTitle = document.getElementById('mobileViewTitle');
  var sidebar       = document.querySelector('.sp-sidebar');
  var sidebarBackdrop = document.getElementById('sidebarBackdrop');

  /* ── Populate header ───────────────────────────────────── */
  document.getElementById('spName').textContent = specialist.name;
  document.getElementById('spSpec').textContent = specialist.specialty + ' · ' + specialist.location;

  /* ── View switching ────────────────────────────────────── */
  function showView(viewId) {
    document.querySelectorAll('.sp-view').forEach(function(v){ v.classList.remove('is-active'); });
    var t = document.getElementById('view-'+viewId);
    if(t) t.classList.add('is-active');
    snavItems.forEach(function(btn){
      btn.classList.toggle('is-active', btn.getAttribute('data-view')===viewId);
    });
    var titles = { queue:'Referral Queue', active:'Active Cases', video:'Video Calls', profile:'Profile', casedetail:'Referral Detail' };
    if(mobileViewTitle) mobileViewTitle.textContent = titles[viewId]||'';
    currentView = viewId;
    if(sidebar) sidebar.classList.remove('is-open');
    if(sidebarBackdrop) sidebarBackdrop.classList.remove('is-visible');
    if(viewId==='active')  renderActiveCases();
    if(viewId==='video')   renderVideoCalls();
    if(viewId==='profile') renderProfile();
  }

  snavItems.forEach(function(btn){
    btn.addEventListener('click', function(){ showView(btn.getAttribute('data-view')); });
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

  /* ── Online toggle ─────────────────────────────────────── */
  document.getElementById('onlineToggle').addEventListener('change', function(){
    isOnline = this.checked;
    var label = document.getElementById('onlineLabel');
    var dot   = document.querySelector('.status-dot');
    if(label) label.textContent = isOnline ? 'Online' : 'Offline';
    if(dot){ dot.classList.toggle('status-dot--active', isOnline); dot.classList.toggle('status-dot--inactive', !isOnline); }
    DB.updateSpecialist(SPECIALIST_ID, { status: isOnline ? 'Active' : 'Offline' });
  });

  /* ── Helpers ───────────────────────────────────────────── */
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function capitalise(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }

  function relTime(iso){
    if(!iso) return '';
    var diff = (Date.now()-new Date(iso).getTime())/60000;
    if(diff<1)  return 'Just now';
    if(diff<60) return Math.round(diff)+' min ago';
    if(diff<1440) return Math.round(diff/60)+' hr ago';
    return Math.round(diff/1440)+' day'+(Math.round(diff/1440)>1?'s':'')+' ago';
  }

  function urgencyClass(u){
    return { Emergency:'urgency-critical', Urgent:'urgency-high', Routine:'urgency-low' }[u] || 'urgency-low';
  }

  /* ── Render queue ──────────────────────────────────────── */
  function renderQueue(){
    var refs = DB.getReferrals()
      .filter(function(r){ return r.specialist_id===SPECIALIST_ID && r.status==='Pending'; })
      .slice().reverse();

    updateBadges(refs.length);
    if(queueMeta) queueMeta.textContent = refs.length + ' pending referral'+(refs.length!==1?'s':'');
    referralQueue.innerHTML = '';
    emptyQueue.classList.toggle('hidden', refs.length>0);

    refs.forEach(function(r){
      var card = document.createElement('div');
      card.className = 'referral-card';
      card.innerHTML =
        '<div class="rc-top">'+
          '<span class="rc-id">'+esc(r.id)+'</span>'+
          '<span class="urgency-badge '+urgencyClass(r.urgency)+'">'+esc(r.urgency)+'</span>'+
          (r.video_requested ? '<span class="rc-video-tag">Video</span>' : '')+
        '</div>'+
        '<div class="rc-meta">'+
          '<span class="rc-spec">'+esc(r.specialty)+'</span>'+
          '<span class="rc-from">from '+esc(r.referring_facility||r.referring_doctor)+'</span>'+
        '</div>'+
        '<div class="rc-reason">'+esc(r.reason)+'</div>'+
        '<div class="rc-time">'+relTime(r.created_at)+'</div>';
      card.addEventListener('click', function(){ openReferral(r.id); });
      referralQueue.appendChild(card);
    });
  }

  function updateBadges(n){
    if(queueBadge)  queueBadge.textContent  = n;
    if(mobileBadge) mobileBadge.textContent = n;
  }

  /* ── Open referral ─────────────────────────────────────── */
  function openReferral(id){
    var r = DB.getReferral(id); if(!r) return;
    currentRefId = id;
    detailRefId.textContent = r.id;

    var intake = document.getElementById('refIntakeDisplay');
    intake.innerHTML = '';
    var rows = [
      ['Referral ID',   r.id],
      ['Patient',       anonymisePatient(r)],
      ['Age / Sex',     (r.patient_age||'—')+' yrs / '+(r.patient_sex||'—')],
      ['District',      r.patient_district||'—'],
      ['Referring doctor', r.referring_doctor],
      ['Facility',      r.referring_facility||'—'],
      ['Specialty',     r.specialty],
      ['Urgency',       r.urgency],
      ['Mode',          capitalise(r.mode||'async')],
      ['Submitted',     relTime(r.created_at)],
    ];
    rows.forEach(function(row){
      var div = document.createElement('div');
      div.className = 'intake-row';
      div.innerHTML = '<span class="intake-key">'+esc(row[0])+'</span><span class="intake-val">'+esc(row[1])+'</span>';
      intake.appendChild(div);
    });

    /* Clinical summary */
    var csBlock = document.getElementById('clinicalSummaryBlock');
    csBlock.textContent = r.clinical_summary || 'No clinical summary provided.';

    /* Attached docs */
    var docsEl = document.getElementById('attachedDocsList');
    var docs   = r.attached_documents || [];
    docsEl.innerHTML = docs.length
      ? docs.map(function(d){ return '<div class="doc-tag">'+esc(d)+'</div>'; }).join('')
      : '<p style="font-size:var(--t-sm);color:var(--ink-3)">No documents attached.</p>';

    /* Video panel */
    var videoPanel = document.getElementById('videoPanel');
    var joinLink   = document.getElementById('spJoinLink');
    if(r.video_requested || r.mode==='video'){
      videoPanel.style.display = 'block';
      if(r.video_url) joinLink.href = r.video_url;
      else { joinLink.textContent = 'Awaiting room URL'; joinLink.removeAttribute('href'); }
    } else {
      videoPanel.style.display = 'none';
    }

    /* Reset form */
    document.getElementById('spAssessment').value     = r.specialist_assessment || '';
    document.getElementById('spRecommendation').value = r.specialist_recommendation || '';
    document.getElementById('spInstructions').value   = r.specialist_instructions || '';
    document.getElementById('spFollowUp').value       = r.follow_up || 'No follow-up needed';
    document.getElementById('spRequestVideo').checked = !!(r.video_requested && !r.video_url);
    document.getElementById('responseError').textContent = '';
    document.getElementById('submitSuccess').classList.add('hidden');

    showView('casedetail');
  }

  function anonymisePatient(r){
    var initials = (r.patient_name||'Anonymous').split(' ').map(function(n){ return n[0]; }).join('.') + '.';
    return initials + ' · ' + (r.patient_sex||'') + ', ' + (r.patient_age||'?') + ' yrs';
  }

  if(backToQueue) backToQueue.addEventListener('click', function(){ renderQueue(); showView('queue'); });

  /* ── Submit specialist response ────────────────────────── */
  document.getElementById('submitResponseBtn').addEventListener('click', function(){
    var errEl     = document.getElementById('responseError');
    var successEl = document.getElementById('submitSuccess');
    errEl.textContent = '';
    successEl.classList.add('hidden');

    var assessment     = document.getElementById('spAssessment').value.trim();
    var recommendation = document.getElementById('spRecommendation').value;
    var instructions   = document.getElementById('spInstructions').value.trim();
    var followUp       = document.getElementById('spFollowUp').value;
    var wantsVideo     = document.getElementById('spRequestVideo').checked;

    if(!assessment)    { errEl.textContent = 'Please enter a clinical assessment.'; return; }
    if(!recommendation){ errEl.textContent = 'Please select a recommendation.'; return; }

    var now = new Date().toISOString();
    var videoUrl = null;
    if(wantsVideo){
      videoUrl = 'https://meet.jit.si/telecaafimaad-'+currentRefId.toLowerCase()+'-'+Math.random().toString(36).slice(2,8);
    }

    DB.updateReferral(currentRefId, {
      status: 'Responded',
      responded_at: now,
      specialist_assessment: assessment,
      specialist_recommendation: recommendation,
      specialist_instructions: instructions,
      follow_up: followUp,
      video_url: videoUrl || undefined,
      video_requested: wantsVideo || undefined
    });

    var spData = DB.getSpecialist(SPECIALIST_ID);
    if(spData) DB.updateSpecialist(SPECIALIST_ID, { cases:(spData.cases||0)+1 });

    var ref = DB.getReferral(currentRefId);
    DB.addDHIS2Entry({
      ts: now,
      case_id: currentRefId,
      district: (ref&&ref.patient_district) || 'Banadir',
      type: 'Specialist Referral',
      status: 'Success',
      code: 200,
      msg: 'Specialist response submitted, recommendation: '+recommendation
    });

    successEl.textContent = 'Response submitted successfully. The referring doctor has been notified.';
    successEl.classList.remove('hidden');
    updateBadges(DB.getReferrals().filter(function(r){ return r.specialist_id===SPECIALIST_ID&&r.status==='Pending'; }).length);
  });

  /* ── Active Cases ──────────────────────────────────────── */
  function renderActiveCases(){
    var el = document.getElementById('activeCasesList');
    var empty = document.getElementById('emptyActive');
    var refs = DB.getReferrals()
      .filter(function(r){ return r.specialist_id===SPECIALIST_ID && r.status==='Responded'; })
      .slice().reverse();
    el.innerHTML = '';
    empty.classList.toggle('hidden', refs.length>0);
    refs.forEach(function(r){
      var card = document.createElement('div');
      card.className = 'referral-card is-responded';
      card.innerHTML =
        '<div class="rc-top">'+
          '<span class="rc-id">'+esc(r.id)+'</span>'+
          '<span class="status-badge status-active">Responded</span>'+
        '</div>'+
        '<div class="rc-meta">'+
          '<span class="rc-from">'+esc(r.referring_doctor)+' · '+esc(r.specialty)+'</span>'+
          '<span class="rc-time">'+relTime(r.responded_at)+'</span>'+
        '</div>'+
        '<div class="rc-reason">'+esc(r.specialist_recommendation||'')+'</div>';
      el.appendChild(card);
    });
  }

  /* ── Video Calls ───────────────────────────────────────── */
  function renderVideoCalls(){
    var el    = document.getElementById('videoCallsList');
    var empty = document.getElementById('emptyVideo');
    var refs = DB.getReferrals()
      .filter(function(r){ return r.specialist_id===SPECIALIST_ID && (r.mode==='video'||r.video_requested); });
    el.innerHTML = '';
    empty.classList.toggle('hidden', refs.length>0);
    refs.forEach(function(r){
      var card = document.createElement('div');
      card.className = 'referral-card';
      card.innerHTML =
        '<div class="rc-top">'+
          '<span class="rc-id">'+esc(r.id)+'</span>'+
          '<span class="urgency-badge '+urgencyClass(r.urgency)+'">'+esc(r.urgency)+'</span>'+
        '</div>'+
        '<div class="rc-meta">'+
          '<span class="rc-from">'+esc(r.referring_doctor)+' · '+esc(r.referring_facility||'')+'</span>'+
        '</div>'+
        (r.video_url
          ? '<a href="'+esc(r.video_url)+'" target="_blank" class="btn btn-primary btn-sm" style="margin-top:0.75rem">Join Call</a>'
          : '<span class="rc-time" style="margin-top:0.5rem;display:block">Room pending…</span>');
      el.appendChild(card);
    });
  }

  /* ── Profile ───────────────────────────────────────────── */
  function renderProfile(){
    var grid = document.getElementById('profileGrid');
    var sp   = DB.getSpecialist(SPECIALIST_ID) || specialist;
    var rows = [
      ['Full name',   sp.name],
      ['Specialty',   sp.specialty],
      ['Location',    sp.location],
      ['Languages',   (sp.languages||[]).join(', ')],
      ['Status',      sp.status],
      ['License',     sp.license||'—'],
      ['Joined',      sp.joined||'—']
    ];
    grid.innerHTML = rows.map(function(r){
      return '<div class="profile-row"><span class="pr-label">'+esc(r[0])+'</span><span class="pr-value">'+esc(r[1])+'</span></div>';
    }).join('');
    var allRefs  = DB.getReferrals().filter(function(r){ return r.specialist_id===SPECIALIST_ID; });
    var responded = allRefs.filter(function(r){ return r.status==='Responded'; }).length;
    var pending   = allRefs.filter(function(r){ return r.status==='Pending'; }).length;
    var rEl = document.getElementById('profRespondedCount');
    var pEl = document.getElementById('profPendingCount');
    if(rEl) rEl.textContent = responded;
    if(pEl) pEl.textContent = pending;
  }

  /* ── Storage event ─────────────────────────────────────── */
  window.addEventListener('storage', function(e){
    if(e.key==='tc_referrals'){
      renderQueue();
      if(currentView==='active')  renderActiveCases();
      if(currentView==='video')   renderVideoCalls();
      if(currentView==='profile') renderProfile();
    }
  });

  var _lastRefCount = -1;
  setInterval(function(){
    var n = DB.getReferrals().filter(function(r){ return r.specialist_id===SPECIALIST_ID&&r.status==='Pending'; }).length;
    if(n!==_lastRefCount){ _lastRefCount=n; renderQueue(); }
  }, 4000);

  /* ── Init ──────────────────────────────────────────────── */
  renderQueue();
  showView('queue');

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
