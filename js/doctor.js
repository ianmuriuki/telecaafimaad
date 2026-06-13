/* doctor.js — Doctor interface. Requires db.js loaded first. */
(function () {
  'use strict';

  DB.init();

  /* ── Login guard ─────────────────────────────────────────── */
  var _PORTAL    = 'doctor';
  var _AUTH_KEY  = 'tc_auth_doctor';
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

  var DOCTOR_ID   = 1; /* Dr. Fadumo Warsame */
  var DOCTOR_NAME = 'Dr. Fadumo Warsame';

  var PHARMACIES = ['Isha Pharmacy · Mogadishu','Daryeel Chemist · Baidoa','Al-Shifa Pharmacy · Kismayo'];
  var LABS       = ['Somali Diagnostic Centre · Mogadishu','Health Point Lab · Baidoa'];

  var currentCaseId        = null;
  var currentView          = 'queue';
  var availSlots           = DB.getAvailability();
  var selectedSpecialistId = null;
  var _uploadedFiles       = [];

  /* ── DOM refs ─────────────────────────────────────────── */
  var snavItems     = document.querySelectorAll('.snav-item');
  var queueBadge    = document.getElementById('queueBadge');
  var mobileBadge   = document.getElementById('mobileQueueBadge');
  var caseListEl    = document.getElementById('caseList');
  var emptyQueue    = document.getElementById('emptyQueue');
  var queueMeta     = document.getElementById('queueMeta');
  var backToQueue   = document.getElementById('backToQueue');
  var intakeDisplay = document.getElementById('intakeDisplay');
  var detailCaseId  = document.getElementById('detailCaseId');
  var pathwaySelect = document.getElementById('pathwaySelect');
  var pathwayFields = document.getElementById('pathwayFields');
  var diagInput     = document.getElementById('diagInput');
  var clinicalNotes = document.getElementById('clinicalNotes');
  var responseError = document.getElementById('responseError');
  var submitResponseBtn = document.getElementById('submitResponseBtn');
  var myCasesList   = document.getElementById('myCasesList');
  var emptyMyCases  = document.getElementById('emptyMyCases');
  var scheduleGrid  = document.getElementById('scheduleGrid');
  var mobileMenuBtn = document.getElementById('mobileMenuBtn');
  var mobileViewTitle = document.getElementById('mobileViewTitle');
  var sidebar       = document.querySelector('.dr-sidebar');
  var sidebarBackdrop = document.getElementById('sidebarBackdrop');

  /* ── View switching ───────────────────────────────────── */
  function showView(viewId) {
    document.querySelectorAll('.dr-view').forEach(function(v){ v.classList.remove('is-active'); });
    var t = document.getElementById('view-'+viewId);
    if(t) t.classList.add('is-active');
    snavItems.forEach(function(btn){
      btn.classList.toggle('is-active', btn.getAttribute('data-view')===viewId);
    });
    var titles = {
      queue:'Case Queue', mycases:'My Cases', casedetail:'Case Detail',
      refer:'Refer to Specialist', records:'Patient Records',
      schedule:'Schedule', profile:'Profile'
    };
    if(mobileViewTitle) mobileViewTitle.textContent = titles[viewId]||'';
    currentView = viewId;
    if(sidebar) sidebar.classList.remove('is-open');
    if(sidebarBackdrop) sidebarBackdrop.classList.remove('is-visible');
    if(viewId==='refer')   renderSpecialistList();
    if(viewId==='records') renderRecordsView();
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

  /* ── Helpers ─────────────────────────────────────────── */
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function capitalise(s){ return s?s.charAt(0).toUpperCase()+s.slice(1):''; }

  function formatRelativeTime(iso){
    if(!iso) return '';
    var diff=(Date.now()-new Date(iso).getTime())/60000;
    if(diff<1)  return 'Just now';
    if(diff<60) return Math.round(diff)+' min ago';
    return Math.round(diff/60)+' hour'+(Math.round(diff/60)>1?'s':'')+' ago';
  }

  function dRow(k,v){ return '<div class="detail-row"><span class="detail-key">'+esc(k)+'</span><span class="detail-val">'+v+'</span></div>'; }

  /* ── Badge update ─────────────────────────────────────── */
  function updateBadge(){
    var n = DB.getPendingCases().filter(function(c){ return c.assigned_doctor_id===DOCTOR_ID; }).length;
    if(queueBadge) queueBadge.textContent = n;
    if(mobileBadge) mobileBadge.textContent = n;
  }

  /* ── Render queue ─────────────────────────────────────── */
  function renderQueue(){
    var queue = DB.getPendingCases()
      .filter(function(c){ return c.assigned_doctor_id===DOCTOR_ID; })
      .slice().reverse();
    updateBadge();
    if(queueMeta) queueMeta.textContent = queue.length+' pending case'+(queue.length!==1?'s':'');
    caseListEl.innerHTML='';
    emptyQueue.classList.toggle('hidden', queue.length>0);

    queue.forEach(function(c){
      var submitted = c.submitted || formatRelativeTime(c.created_at);
      var card = document.createElement('div');
      card.className = 'case-card';
      var patientDisplay = c.patient_name || (c.sex+', '+c.age+' yrs');
      card.innerHTML =
        '<div><div class="cc-id">'+esc(c.id)+'</div></div>'+
        '<div class="cc-meta">'+
          '<span class="cc-patient">'+esc(patientDisplay)+'</span>'+
          '<span class="cc-detail">'+esc((c.symptoms||[]).slice(0,3).join(', '))+
            ' · '+esc(c.duration||'')+' · '+esc(c.district||'')+'</span>'+
        '</div>'+
        '<div class="cc-right">'+
          '<span class="cc-time">'+esc(submitted)+'</span>'+
          '<span class="urgency-badge urgency-'+(c.urgency||'low')+'">'+capitalise(c.urgency||'low')+'</span>'+
        '</div>';
      card.addEventListener('click', function(){ openCase(c.id); });
      caseListEl.appendChild(card);
    });
  }

  /* ── Open case ────────────────────────────────────────── */
  function openCase(id){
    var c = DB.getCase(id); if(!c) return;
    currentCaseId = id;
    detailCaseId.textContent = c.id;
    intakeDisplay.innerHTML='';

    var rows = [
      ['Case ID',       c.id],
      ['Patient',       (c.patient_name||'—')+(c.patient_id?' ('+c.patient_id+')':'')],
      ['Sex & Age',     c.sex+', '+c.age+' years'],
      ['Body Area',     c.body_area],
      ['Symptoms',      (c.symptoms||[]).join(', ')],
      ['Duration',      c.duration],
      ['District',      c.district],
      ['Facility',      (DB.getFacility(c.facility_id)||{}).name||'—'],
      ['EAT (UTC+3)',   'Patient is in Mogadishu · UTC+3 (East Africa Time)'],
      ['Submitted',     formatRelativeTime(c.created_at)],
      ['Complaint',     c.complaint]
    ];

    rows.forEach(function(row){
      var div = document.createElement('div');
      div.className = 'intake-row';
      div.innerHTML = '<span class="intake-key">'+esc(row[0])+'</span><span class="intake-val">'+esc(row[1])+'</span>';
      intakeDisplay.appendChild(div);
    });

    var linkEl = document.getElementById('patientRecordLink');
    if(c.patient_id){
      linkEl.innerHTML = '<button class="btn btn-ghost btn-sm" data-pid="'+esc(c.patient_id)+
        '">View Full Patient Record &rarr;</button>';
      linkEl.querySelector('[data-pid]').addEventListener('click', function(){
        openPatientRecordSlideover(c.patient_id);
      });
    } else {
      linkEl.innerHTML = '';
    }

    diagInput.value=''; pathwaySelect.value=''; pathwayFields.innerHTML='';
    clinicalNotes.value=''; responseError.textContent='';

    var idleEl    = document.getElementById('videoCallIdle');
    var pendingEl = document.getElementById('videoCallPending');
    var joinLink  = document.getElementById('doctorJoinLink');
    if(c.video_requested){
      idleEl.style.display='none'; pendingEl.style.display='block';
      if(joinLink) joinLink.href=c.video_url||'#';
    } else {
      idleEl.style.display='block'; pendingEl.style.display='none';
    }
    showView('casedetail');
  }

  if(backToQueue) backToQueue.addEventListener('click', function(){
    showView('queue'); renderQueue();
  });

  /* ── Video call handlers ──────────────────────────────── */
  var initiateVideoBtn = document.getElementById('initiateVideoBtn');
  var cancelVideoBtn   = document.getElementById('cancelVideoBtn');
  var doctorJoinLink   = document.getElementById('doctorJoinLink');

  if(initiateVideoBtn) initiateVideoBtn.addEventListener('click', function(){
    if(!currentCaseId) return;
    var roomUrl = 'https://meet.jit.si/telecaafimaad-'+currentCaseId.toLowerCase()+'-'+Math.random().toString(36).slice(2,8);
    DB.updateCase(currentCaseId,{ video_url:roomUrl, video_requested:true, video_status:'pending' });
    DB.addDHIS2Entry({ ts:new Date().toISOString(), case_id:currentCaseId,
      district:(DB.getCase(currentCaseId)||{}).district||'Banadir',
      type:'Consultation', status:'Success', code:200,
      msg:'Video call initiated · modality updated to Video' });
    if(doctorJoinLink) doctorJoinLink.href=roomUrl;
    document.getElementById('videoCallIdle').style.display='none';
    document.getElementById('videoCallPending').style.display='block';
  });

  if(cancelVideoBtn) cancelVideoBtn.addEventListener('click', function(){
    if(!currentCaseId) return;
    DB.updateCase(currentCaseId,{ video_url:null, video_requested:false, video_status:null });
    document.getElementById('videoCallIdle').style.display='block';
    document.getElementById('videoCallPending').style.display='none';
  });

  /* ── Pathway fields ───────────────────────────────────── */
  function sel(arr){
    return arr.map(function(o){ return '<option value="'+esc(o)+'">'+esc(o)+'</option>'; }).join('');
  }

  pathwaySelect.addEventListener('change', function(){
    var val = pathwaySelect.value;
    pathwayFields.innerHTML='';
    if(!val) return;
    var block=document.createElement('div');
    block.className='pathway-fields-block';
    var lbl=document.createElement('div');
    lbl.className='pathway-fields-label';
    lbl.textContent=capitalise(val)+' Details';
    block.appendChild(lbl);
    var inner='';
    if(val==='prescription'){
      inner=
        '<div class="form-group"><label class="form-label">Medication name</label><input type="text" class="form-input" id="pf-med" placeholder="e.g. Paracetamol 500mg"></div>'+
        '<div class="form-group"><label class="form-label">Dosage</label><input type="text" class="form-input" id="pf-dos" placeholder="e.g. 1 tablet"></div>'+
        '<div class="form-row">'+
          '<div class="form-group"><label class="form-label">Frequency</label><select class="form-select" id="pf-freq"><option value="">Select</option><option>Once daily</option><option>Twice daily</option><option>Three times daily</option><option>As needed</option></select></div>'+
          '<div class="form-group"><label class="form-label">Duration</label><select class="form-select" id="pf-dur"><option value="">Select</option><option>3 days</option><option>5 days</option><option>7 days</option><option>14 days</option><option>Ongoing</option></select></div>'+
        '</div>'+
        '<div class="form-group"><label class="form-label">Pharmacy</label><select class="form-select" id="pf-pharm"><option value="">Select</option>'+sel(PHARMACIES)+'</select></div>';
    } else if(val==='lab'){
      inner=
        '<div class="form-group"><label class="form-label">Test name</label><input type="text" class="form-input" id="pf-test" placeholder="e.g. Full blood count, Malaria RDT"></div>'+
        '<div class="form-group"><label class="form-label">Laboratory</label><select class="form-select" id="pf-lab"><option value="">Select</option>'+sel(LABS)+'</select></div>'+
        '<div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="pf-pri"><option>Normal</option><option>Urgent</option></select></div>';
    } else if(val==='referral'){
      inner=
        '<div class="form-group"><label class="form-label">Referred to</label><input type="text" class="form-input" id="pf-fac" placeholder="Facility or specialist name"></div>'+
        '<div class="form-group"><label class="form-label">Reason</label><textarea class="form-textarea" id="pf-ref" rows="2"></textarea></div>'+
        '<div class="form-group"><label class="form-label">Urgency</label><select class="form-select" id="pf-urg"><option>Routine</option><option>Urgent</option><option>Emergency</option></select></div>';
    } else if(val==='followup'){
      inner=
        '<div class="form-group"><label class="form-label">Follow-up date</label><input type="date" class="form-input" id="pf-date"></div>'+
        '<div class="form-group"><label class="form-label">Instructions</label><textarea class="form-textarea" id="pf-fnotes" rows="2"></textarea></div>';
    } else if(val==='noaction'){
      inner='<div class="form-group"><label class="form-label">Reason</label><textarea class="form-textarea" id="pf-nor" rows="2" placeholder="Explain why no further action is required…"></textarea></div>';
    }
    block.insertAdjacentHTML('beforeend', inner);
    pathwayFields.appendChild(block);
  });

  /* ── Submit response ──────────────────────────────────── */
  submitResponseBtn.addEventListener('click', function(){
    responseError.textContent='';
    if(!diagInput.value.trim()){ responseError.textContent='Please enter a diagnosis.'; return; }
    if(!pathwaySelect.value)   { responseError.textContent='Please select a pathway.'; return; }

    var now = new Date().toISOString();
    var pathway = pathwaySelect.value;
    var pathwayData = collectPathwayData(pathway);
    var precase = DB.getCase(currentCaseId);
    var modality = (precase&&precase.video_url)?'Video':'Text';

    DB.updateCase(currentCaseId,{
      status:'closed', closed_at:now,
      diagnosis:diagInput.value.trim(),
      pathway:pathway,
      clinical_notes:clinicalNotes.value.trim(),
      pathway_data:pathwayData,
      dhis2_status:'Pending',
      modality:modality.toLowerCase()
    });

    var doc = DB.getDoctor(DOCTOR_ID);
    if(doc) DB.updateDoctor(DOCTOR_ID,{ cases:(doc.cases||0)+1 });

    var caseObj = DB.getCase(currentCaseId);
    DB.addDHIS2Entry({
      ts:now, case_id:currentCaseId,
      district:caseObj?caseObj.district:'Banadir',
      type:'Consultation', status:'Pending', code:0,
      msg:'Push queued · processing'
    });

    var closedId = currentCaseId;
    var capturedPathway = pathway;
    setTimeout(function(){
      var ok = Math.random()>0.08;
      DB.updateCase(closedId,{ dhis2_status:ok?'Pushed':'Failed' });
      DB.updateDHIS2Entry(closedId,{
        status:ok?'Success':'Failed', code:ok?200:422,
        msg:ok?'Tracked entity created · modality:'+modality+' pathway:'+capturedPathway
           :'Validation error · diagnosis code not found'
      });
      if(currentView==='mycases') renderMyCases();
    }, 2500);

    currentCaseId=null;
    renderQueue();
    renderMyCases();
    showView('queue');
  });

  function collectPathwayData(p){
    var g=function(id){ var el=document.getElementById(id); return el?el.value:''; };
    if(p==='prescription') return{ medication:g('pf-med'),dosage:g('pf-dos'),frequency:g('pf-freq'),duration:g('pf-dur'),pharmacy:g('pf-pharm') };
    if(p==='lab')          return{ test:g('pf-test'),lab:g('pf-lab'),priority:g('pf-pri') };
    if(p==='referral')     return{ facility:g('pf-fac'),reason:g('pf-ref'),urgency:g('pf-urg') };
    if(p==='followup')     return{ date:g('pf-date'),notes:g('pf-fnotes') };
    if(p==='noaction')     return{ reason:g('pf-nor') };
    return {};
  }

  /* ── Request Specialist Input button ─────────────────── */
  document.getElementById('requestSpecialistBtn').addEventListener('click', function(){
    showView('refer');
    if(currentCaseId){
      var c = DB.getCase(currentCaseId);
      if(c&&c.patient_id){
        setTimeout(function(){
          var selEl = document.getElementById('ref-patient');
          if(selEl) selEl.value = c.patient_id;
        }, 50);
      }
    }
  });

  /* ── My Cases ─────────────────────────────────────────── */
  function renderMyCases(){
    var closed = DB.getClosedCases().filter(function(c){ return c.assigned_doctor_id===DOCTOR_ID; });
    myCasesList.innerHTML='';
    emptyMyCases.classList.toggle('hidden', closed.length>0);
    var statusClass = { Pushed:'status-active', Pending:'status-pending', Failed:'status-failed' };
    closed.slice(0,30).forEach(function(c){
      var div=document.createElement('div');
      div.className='closed-case-card';
      var dhis=c.dhis2_status||'Pushed';
      div.innerHTML=
        '<span class="ccc-id">'+esc(c.id)+'</span>'+
        '<div>'+
          '<div class="ccc-diag">'+(c.patient_name?esc(c.patient_name)+' — ':'')+esc(c.diagnosis||'—')+'</div>'+
          '<div class="ccc-detail">'+capitalise(c.pathway||'')+' · '+(c.closed_at||'').slice(0,10)+'</div>'+
        '</div>'+
        '<span class="status-badge '+(statusClass[dhis]||'status-closed')+'">'+esc(dhis)+'</span>';
      myCasesList.appendChild(div);
    });
    var doc = DB.getDoctor(DOCTOR_ID);
    var el  = document.getElementById('profileCaseCount');
    if(el && doc) el.textContent = doc.cases;
  }

  /* ── Refer to Specialist ──────────────────────────────── */

  /* Toggle: New Referral / History */
  var refTabNew     = document.getElementById('refTabNew');
  var refTabHistory = document.getElementById('refTabHistory');
  if(refTabNew) refTabNew.addEventListener('click', function(){
    refTabNew.classList.add('is-active');
    refTabHistory.classList.remove('is-active');
    document.getElementById('refer-new-panel').classList.remove('hidden');
    document.getElementById('refer-history-panel').classList.add('hidden');
  });
  if(refTabHistory) refTabHistory.addEventListener('click', function(){
    refTabHistory.classList.add('is-active');
    refTabNew.classList.remove('is-active');
    document.getElementById('refer-history-panel').classList.remove('hidden');
    document.getElementById('refer-new-panel').classList.add('hidden');
    renderRefHistory();
  });

  function renderSpecialistList(){
    var spec     = document.getElementById('spFilterSpec').value;
    var lang     = document.getElementById('spFilterLang').value;
    var list     = document.getElementById('specialistList');
    var specialists = DB.getSpecialists().filter(function(s){
      if(spec && s.specialty!==spec) return false;
      if(lang && (!s.languages||s.languages.indexOf(lang)<0)) return false;
      return true;
    });
    list.innerHTML='';
    specialists.forEach(function(s){
      var card=document.createElement('div');
      card.className='specialist-card'+(selectedSpecialistId===s.id?' is-selected':'');
      var langTags=(s.languages||[]).map(function(l){ return '<span class="sc-lang-tag">'+esc(l)+'</span>'; }).join('');
      card.innerHTML=
        '<div>'+
          '<div class="sc-name">'+esc(s.name)+'</div>'+
          '<div class="sc-spec">'+esc(s.specialty)+'</div>'+
          '<div class="sc-loc">'+esc(s.location)+'</div>'+
          '<div class="sc-lang">'+langTags+'</div>'+
        '</div>'+
        '<span class="status-badge status-active" style="margin-left:auto;flex-shrink:0">'+esc(s.status)+'</span>';
      card.addEventListener('click', function(){
        selectedSpecialistId = s.id;
        renderSpecialistList();
        showReferralForm(s);
      });
      list.appendChild(card);
    });
    if(!specialists.length) list.innerHTML='<p class="empty-msg">No specialists match the filter.</p>';
  }

  function showReferralForm(specialist){
    var block = document.getElementById('referralFormBlock');
    block.classList.remove('hidden');

    var selEl = document.getElementById('ref-patient');
    selEl.innerHTML='<option value="">Select patient</option>';
    DB.getPatients().forEach(function(p){
      var opt=document.createElement('option');
      opt.value=p.id;
      opt.textContent=p.name+' ('+p.id+')';
      selEl.appendChild(opt);
    });

    var docsList = document.getElementById('ref-docs-list');
    var docs     = DB.getDocuments();
    docsList.innerHTML='';
    if(!docs.length){
      docsList.innerHTML='<p style="font-size:var(--t-xs);color:var(--ink-3)">No uploaded documents available.</p>';
    } else {
      docs.forEach(function(d){
        var lbl=document.createElement('label');
        lbl.className='form-check';
        lbl.innerHTML='<input type="checkbox" value="'+esc(d.filename)+'"> '+esc(d.filename)+' · '+esc(d.patient_name);
        docsList.appendChild(lbl);
      });
    }

    /* Reset upload state */
    _uploadedFiles = [];
    var fileListEl = document.getElementById('uploadFileList');
    if(fileListEl) fileListEl.innerHTML = '';

    /* Wire upload zone */
    var uploadZone  = document.getElementById('uploadZone');
    var uploadInput = document.getElementById('uploadInput');

    function renderFileList(){
      if(!fileListEl) return;
      fileListEl.innerHTML = _uploadedFiles.map(function(f, i){
        var kb = Math.round((f.size||0)/1024);
        return '<div class="upload-file-item">'+
          '<span class="upload-file-name">'+esc(f.name)+'</span>'+
          '<span class="upload-file-size">'+(kb||'—')+' KB</span>'+
          '<button class="upload-file-remove" data-idx="'+i+'" type="button">&times;</button>'+
          '</div>';
      }).join('');
      fileListEl.querySelectorAll('.upload-file-remove').forEach(function(btn){
        btn.addEventListener('click', function(){
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          _uploadedFiles.splice(idx, 1);
          renderFileList();
        });
      });
    }

    if(uploadZone){
      var newZone = uploadZone.cloneNode(true);
      uploadZone.parentNode.replaceChild(newZone, uploadZone);
      var newInput = newZone.querySelector('#uploadInput');
      newZone.addEventListener('click', function(){ if(newInput) newInput.click(); });
      newZone.addEventListener('dragover', function(e){ e.preventDefault(); newZone.classList.add('is-dragover'); });
      newZone.addEventListener('dragleave', function(){ newZone.classList.remove('is-dragover'); });
      newZone.addEventListener('drop', function(e){
        e.preventDefault();
        newZone.classList.remove('is-dragover');
        _uploadedFiles = _uploadedFiles.concat(Array.from(e.dataTransfer.files));
        renderFileList();
      });
      if(newInput){
        newInput.addEventListener('change', function(){
          _uploadedFiles = _uploadedFiles.concat(Array.from(this.files));
          renderFileList();
          this.value = '';
        });
      }
    }

    block.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  document.getElementById('spFilterSpec').addEventListener('change', renderSpecialistList);
  document.getElementById('spFilterLang').addEventListener('change', renderSpecialistList);

  /* ── Submit referral → confirmation modal ─────────────── */
  document.getElementById('submitReferralBtn').addEventListener('click', function(){
    var errEl = document.getElementById('referralError');
    errEl.textContent = '';

    if(!selectedSpecialistId){ errEl.textContent='Please select a specialist.'; return; }
    var pid = document.getElementById('ref-patient').value;
    if(!pid){ errEl.textContent='Please select a patient.'; return; }
    var reason = document.getElementById('ref-reason').value.trim();
    if(!reason){ errEl.textContent='Please enter a reason for referral.'; return; }
    var summary = document.getElementById('ref-summary').value.trim();
    if(!summary){ errEl.textContent='Please enter a clinical summary.'; return; }

    var patient    = DB.getPatient(pid)||{};
    var spObj      = DB.getSpecialist(selectedSpecialistId)||{};
    var urgency    = document.getElementById('ref-urgency').value;
    var mode       = document.getElementById('ref-mode').value;
    var checkedDocs = Array.from(document.querySelectorAll('#ref-docs-list input:checked')).map(function(cb){ return cb.value; });
    var uploadedNames = _uploadedFiles.map(function(f){ return f.name; });
    var allDocs    = checkedDocs.concat(uploadedNames);

    var refId = DB.generateReferralId();
    var now   = new Date().toISOString();
    DB.addReferral({
      id: refId,
      case_id: currentCaseId || null,
      patient_id: pid, patient_name: patient.name||pid,
      patient_age: patient.age, patient_sex: patient.sex,
      patient_district: patient.district,
      referring_doctor_id: DOCTOR_ID, referring_doctor: DOCTOR_NAME,
      referring_facility: 'Banadir Regional Hospital',
      specialist_id: selectedSpecialistId, specialist: spObj.name,
      specialty: spObj.specialty,
      reason: reason, urgency: urgency,
      clinical_summary: summary,
      mode: mode,
      status: 'Pending',
      created_at: now,
      responded_at: null,
      specialist_assessment: null, specialist_recommendation: null,
      specialist_instructions: null, follow_up: null,
      video_requested: mode==='video', video_url: null,
      attached_documents: allDocs,
      feedback_submitted: false, dhis2_logged: false
    });

    /* Show confirmation modal */
    document.getElementById('refConfirmId').textContent = refId;
    var d = new Date(now);
    var timeStr = d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+' · '+d.toLocaleDateString('en-GB');
    document.getElementById('refConfirmDetails').innerHTML =
      dRow('Patient',           esc(patient.name||pid))+
      dRow('Specialist',        esc(spObj.name)+' · '+esc(spObj.specialty))+
      dRow('Urgency',           esc(urgency))+
      dRow('Documents attached', allDocs.length ? esc(allDocs.join(', ')) : 'None')+
      dRow('Submitted',         timeStr);
    document.getElementById('refConfirmModal').classList.add('is-open');

    /* Reset form */
    document.getElementById('ref-reason').value='';
    document.getElementById('ref-summary').value='';
    _uploadedFiles = [];
    var fle = document.getElementById('uploadFileList');
    if(fle) fle.innerHTML = '';
    selectedSpecialistId = null;
    renderSpecialistList();
    document.getElementById('referralFormBlock').classList.add('hidden');
  });

  /* ── Confirmation modal buttons ───────────────────────── */
  var refConfirmHistoryBtn = document.getElementById('refConfirmHistoryBtn');
  var refConfirmQueueBtn   = document.getElementById('refConfirmQueueBtn');

  if(refConfirmHistoryBtn) refConfirmHistoryBtn.addEventListener('click', function(){
    document.getElementById('refConfirmModal').classList.remove('is-open');
    showView('refer');
    if(refTabHistory) refTabHistory.classList.add('is-active');
    if(refTabNew)     refTabNew.classList.remove('is-active');
    var np = document.getElementById('refer-new-panel');
    var hp = document.getElementById('refer-history-panel');
    if(np) np.classList.add('hidden');
    if(hp) hp.classList.remove('hidden');
    renderRefHistory();
  });

  if(refConfirmQueueBtn) refConfirmQueueBtn.addEventListener('click', function(){
    document.getElementById('refConfirmModal').classList.remove('is-open');
    showView('queue');
    renderQueue();
  });

  /* ── Referral History ─────────────────────────────────── */
  function renderRefHistory(){
    var tbody   = document.getElementById('refHistoryBody');
    var emptyEl = document.getElementById('emptyRefHistory');
    if(!tbody) return;
    var refs = DB.getReferrals()
      .filter(function(r){ return r.referring_doctor_id===DOCTOR_ID; })
      .slice().reverse();
    tbody.innerHTML = '';
    if(emptyEl) emptyEl.classList.toggle('hidden', refs.length>0);
    refs.forEach(function(r){
      var sc = r.status==='Responded'?'status-active':r.status==='Pending'?'status-pending':'status-teal';
      var tr = document.createElement('tr');
      tr.className = 'is-clickable';
      tr.innerHTML =
        '<td style="font-weight:700;color:var(--accent);font-size:var(--t-xs)">'+esc(r.id)+'</td>'+
        '<td>'+esc(r.patient_name||'—')+'</td>'+
        '<td>'+esc(r.specialist||'—')+'</td>'+
        '<td><span class="status-badge '+sc+'">'+esc(r.status)+'</span></td>'+
        '<td>'+esc((r.created_at||'').slice(0,10))+'</td>'+
        '<td>'+esc(r.specialist_recommendation||'—')+'</td>';
      tbody.appendChild(tr);

      var detTr = document.createElement('tr');
      detTr.className = 'ref-hist-row-detail hidden';
      detTr.innerHTML = '<td colspan="6" style="padding:0">'+
        '<div style="padding:var(--s2);background:var(--surface);border-bottom:1px solid var(--rule)">'+
        '<div class="detail-grid">'+
          dRow('Patient',          esc(r.patient_name||'—'))+
          dRow('Specialist',       esc(r.specialist)+' · '+esc(r.specialty||'—'))+
          dRow('Reason',           esc(r.reason||'—'))+
          dRow('Clinical summary', esc(r.clinical_summary||'—'))+
          dRow('Urgency',          esc(r.urgency||'—'))+
          dRow('Mode',             esc(r.mode||'async'))+
          (r.attached_documents&&r.attached_documents.length ? dRow('Documents', esc(r.attached_documents.join(', '))) : '')+
          (r.status==='Responded' ?
            '<hr style="border:none;border-top:1px solid var(--rule);margin:var(--s2) 0">'+
            dRow('Assessment',    esc(r.specialist_assessment||'—'))+
            dRow('Recommendation',esc(r.specialist_recommendation||'—'))+
            dRow('Instructions',  esc(r.specialist_instructions||'—'))+
            dRow('Follow-up',     esc(r.follow_up||'—'))
          : '')+
        '</div></div></td>';
      tbody.appendChild(detTr);

      tr.addEventListener('click', function(){
        var allDets = tbody.querySelectorAll('.ref-hist-row-detail');
        allDets.forEach(function(d){
          if(d !== detTr) d.classList.add('hidden');
        });
        detTr.classList.toggle('hidden');
      });
    });
  }

  /* ── Patient Records view ─────────────────────────────── */
  function renderRecordsView(filter){
    var tbody   = document.getElementById('recTableBody');
    var emptyEl = document.getElementById('emptyRec');
    var docs    = DB.getDocuments();
    if(filter){
      var q=filter.toLowerCase();
      docs=docs.filter(function(d){
        return (d.patient_name||'').toLowerCase().includes(q)||(d.patient_id||'').toLowerCase().includes(q);
      });
    }
    tbody.innerHTML='';
    emptyEl.classList.toggle('hidden', docs.length>0);
    docs.forEach(function(d){
      var tr=document.createElement('tr');
      tr.innerHTML=
        '<td style="font-weight:600">'+esc(d.patient_name)+'</td>'+
        '<td>'+esc(d.filename)+'</td>'+
        '<td>'+esc(d.type)+'</td>'+
        '<td>'+esc(d.date)+'</td>'+
        '<td style="font-size:var(--t-xs);color:var(--ink-3)">'+esc(d.uploaded_by)+'</td>'+
        '<td>'+
          '<button class="btn btn-xs btn-outline" onclick="alert(\'In production this opens the encrypted file.\')">View</button>'+
          ' <button class="btn btn-xs btn-outline" onclick="alert(\'In production this downloads the encrypted file.\')">Download</button>'+
        '</td>';
      tbody.appendChild(tr);
    });
  }

  document.getElementById('recSearchBtn').addEventListener('click', function(){
    renderRecordsView(document.getElementById('recSearchInput').value.trim());
  });
  document.getElementById('recSearchInput').addEventListener('keydown', function(e){
    if(e.key==='Enter') renderRecordsView(this.value.trim());
  });

  /* ── Patient record slideover ─────────────────────────── */
  function openPatientRecordSlideover(pid){
    var p = DB.getPatient(pid); if(!p) return;
    document.getElementById('recordSlideoverName').textContent = p.name;
    var body = document.getElementById('recordSlideoverBody');
    var cases = DB.getCases().filter(function(c){ return c.patient_id===pid; });
    var docs  = DB.getDocumentsByPatient(pid);
    var age   = p.dob ? Math.floor((Date.now()-new Date(p.dob).getTime())/31557600000) : p.age;

    body.innerHTML =
      '<h3 class="panel-label">Demographics</h3>'+
      '<div class="detail-grid">'+
        dRow('Patient ID', esc(p.id))+
        dRow('Age / Sex', esc(age)+' yrs / '+esc(p.sex))+
        dRow('District',  esc(p.district))+
        dRow('Chronic',   esc((p.chronic_conditions||[]).join(', ')||'None'))+
      '</div>'+
      '<h3 class="panel-label" style="margin-top:var(--s3)">Consultations ('+cases.length+')</h3>'+
      (cases.length?
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Case</th><th>Date</th><th>Diagnosis</th><th>Status</th></tr></thead><tbody>'+
        cases.map(function(c){
          var sc=c.status==='closed'?'status-active':'status-pending';
          return '<tr><td style="font-weight:700;color:var(--accent);font-size:var(--t-xs)">'+esc(c.id)+'</td>'+
            '<td>'+esc(c.created_at.slice(0,10))+'</td>'+
            '<td>'+(c.diagnosis||'<em style="color:var(--ink-3)">Pending</em>')+'</td>'+
            '<td><span class="status-badge '+sc+'">'+esc(c.status)+'</span></td></tr>';
        }).join('')+
        '</tbody></table></div>'
        :'<p class="empty-msg">No consultations.</p>')+
      '<h3 class="panel-label" style="margin-top:var(--s3)">Documents ('+docs.length+')</h3>'+
      (docs.length?
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Filename</th><th>Type</th><th>Date</th><th></th></tr></thead><tbody>'+
        docs.map(function(d){
          return '<tr><td>'+esc(d.filename)+'</td><td>'+esc(d.type)+'</td><td>'+esc(d.date)+'</td>'+
            '<td><button class="btn btn-xs btn-outline" onclick="alert(\'In production this opens the file.\')">View</button></td></tr>';
        }).join('')+
        '</tbody></table></div>'
        :'<p class="empty-msg">No documents.</p>');

    document.getElementById('patientRecordSlideover').classList.add('is-open');
    document.getElementById('patientRecordOverlay').classList.add('is-open');
  }

  document.getElementById('closeRecordSlideover').addEventListener('click', function(){
    document.getElementById('patientRecordSlideover').classList.remove('is-open');
    document.getElementById('patientRecordOverlay').classList.remove('is-open');
  });
  document.getElementById('patientRecordOverlay').addEventListener('click', function(){
    document.getElementById('patientRecordSlideover').classList.remove('is-open');
    document.getElementById('patientRecordOverlay').classList.remove('is-open');
  });

  /* ── Schedule ─────────────────────────────────────────── */
  function buildSchedule(){
    function utcToTz(utcH, tz){
      try{
        var d=new Date(); d.setUTCHours(utcH,0,0,0);
        return d.toLocaleTimeString('en',{ timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false });
      } catch(e){ return utcH+':00'; }
    }
    var tzSel = document.getElementById('tzSelect');
    if(tzSel && !tzSel.options.length){
      var tzones=['UTC','Africa/Mogadishu','Africa/Nairobi','Europe/London','Europe/Oslo','Asia/Dubai','America/Toronto','America/New_York','America/Los_Angeles'];
      var browser=Intl.DateTimeFormat().resolvedOptions().timeZone;
      tzones.forEach(function(tz){
        var opt=document.createElement('option');
        opt.value=tz; opt.textContent=tz.replace('_',' ');
        if(tz===browser) opt.selected=true;
        tzSel.appendChild(opt);
      });
      tzSel.addEventListener('change', function(){ scheduleGrid.innerHTML=''; buildSchedule(); });
    }
    var tz = tzSel?tzSel.value:'UTC';
    var now=new Date(); var sun=new Date(now); sun.setDate(sun.getDate()-sun.getDay());
    var days=[]; var dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for(var d=0;d<7;d++){
      var dd=new Date(sun); dd.setDate(sun.getDate()+d);
      days.push({ name:dayNames[d], date:dd.getDate()+'/'+(dd.getMonth()+1) });
    }
    var times=['08:00','10:00','12:00','14:00','16:00','18:00','20:00'];
    var hdr=document.createElement('div'); hdr.className='schedule-header-row';
    hdr.innerHTML='<div class="schedule-col-head">UTC</div>';
    days.forEach(function(d){ hdr.innerHTML+='<div class="schedule-col-head">'+d.name+'<br>'+d.date+'</div>'; });
    scheduleGrid.appendChild(hdr);
    times.forEach(function(time){
      var row=document.createElement('div'); row.className='schedule-time-row';
      row.innerHTML='<div class="schedule-time-label"><span style="font-weight:600">'+time+'</span><span style="font-size:0.68rem;color:var(--ink-3)">'+utcToTz(parseInt(time),tz)+' local</span></div>';
      days.forEach(function(d){
        var key=d.date+'-'+time;
        var slot=document.createElement('div');
        slot.className='schedule-slot'+(availSlots[key]?' available':'');
        slot.addEventListener('click', function(){
          availSlots[key]=!availSlots[key];
          slot.classList.toggle('available',!!availSlots[key]);
          DB.setAvailability(availSlots);
        });
        row.appendChild(slot);
      });
      scheduleGrid.appendChild(row);
    });
  }

  /* ── Storage event ────────────────────────────────────── */
  window.addEventListener('storage', function(e){
    if(e.key==='tc_cases'){
      renderQueue(); renderMyCases();
    }
    if(e.key==='tc_referrals'){
      if(currentView==='refer') renderSpecialistList();
    }
  });

  var _lastCount = -1;
  setInterval(function(){
    var n = DB.getPendingCases().filter(function(c){ return c.assigned_doctor_id===DOCTOR_ID; }).length;
    if(n!==_lastCount){ _lastCount=n; renderQueue(); }
  }, 3000);

  /* ── Init ─────────────────────────────────────────────── */
  renderQueue();
  renderMyCases();
  buildSchedule();
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
