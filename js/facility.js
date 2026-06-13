/* facility.js — Facility Worker interface. Requires db.js loaded first. */
(function () {
  'use strict';

  DB.init();

  /* ── Login guard ─────────────────────────────────────────── */
  var _PORTAL    = 'facility';
  var _AUTH_KEY  = 'tc_auth_facility';
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
      var cred = DB.CREDENTIALS[_PORTAL];
      var metaEl = document.getElementById('workerMeta');
      if (metaEl && cred) metaEl.textContent = cred.name + ' · ' + cred.role;
      _initMain();
    } else {
      if (errEl) { errEl.textContent = 'Invalid ID or password. Please try again.'; errEl.style.display = ''; }
    }
  }

  function _initMain() {

  /* ── Demo context ──────────────────────────────────────────── */
  var FACILITY_ID = 1;
  var facility    = DB.getFacility(FACILITY_ID) || {};

  /* ── Tab switching ──────────────────────────────────────── */
  var tabBtns   = document.querySelectorAll('.fac-tab-btn');
  var tabPanels = document.querySelectorAll('.fac-panel');

  function showTab(name) {
    tabBtns.forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-tab')===name); });
    tabPanels.forEach(function(p){ p.classList.toggle('is-active', p.id==='tab-'+name); });
    if(name==='patients')     renderPatients();
    if(name==='referrals')    renderReferrals();
    if(name==='records')      renderRecords();
    if(name==='facility')     renderFacilityTab();
    if(name==='consultation') resetConsultation();
  }

  tabBtns.forEach(function(b){
    b.addEventListener('click', function(){ showTab(b.getAttribute('data-tab')); });
  });

  /* ── Helpers ─────────────────────────────────────────────── */
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(iso) {
    if(!iso) return '—';
    return iso.slice(0,10);
  }

  function calcAge(dob) {
    if(!dob) return '—';
    var diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / 31557600000);
  }

  function lastConsultation(patientId) {
    var cases = DB.getCases().filter(function(c){ return c.patient_id===patientId; });
    if(!cases.length) return '—';
    cases.sort(function(a,b){ return new Date(b.created_at)-new Date(a.created_at); });
    return cases[0].created_at ? cases[0].created_at.slice(0,10) : '—';
  }

  /* ── PATIENTS TAB ───────────────────────────────────────── */
  var patientSearch    = document.getElementById('patientSearch');
  var patientSearchBtn = document.getElementById('patientSearchBtn');
  var patientTableBody = document.getElementById('patientTableBody');
  var emptyPatients    = document.getElementById('emptyPatients');

  function renderPatients(filter) {
    var patients = DB.getPatients().filter(function(p){ return p.facility_id===FACILITY_ID; });
    if(filter) {
      var q = filter.toLowerCase();
      patients = patients.filter(function(p){
        return (p.name||'').toLowerCase().includes(q) || (p.id||'').toLowerCase().includes(q);
      });
    }
    patientTableBody.innerHTML = '';
    emptyPatients.classList.toggle('hidden', patients.length>0);
    patients.forEach(function(p){
      var tr = document.createElement('tr');
      tr.className = 'is-clickable';
      tr.innerHTML =
        '<td style="font-weight:700;color:var(--accent);font-size:var(--t-xs)">'+esc(p.id)+'</td>'+
        '<td style="font-weight:600;color:var(--ink)">'+esc(p.name)+'</td>'+
        '<td>'+esc(calcAge(p.dob))+' / '+esc(p.sex)+'</td>'+
        '<td>'+esc(p.district)+'</td>'+
        '<td>'+lastConsultation(p.id)+'</td>'+
        '<td><button class="btn btn-sm btn-outline" data-pid="'+esc(p.id)+'">View Profile</button></td>';
      tr.querySelector('[data-pid]').addEventListener('click', function(e){
        e.stopPropagation();
        openPatientSlideover(p.id);
      });
      tr.addEventListener('click', function(){ openPatientSlideover(p.id); });
      patientTableBody.appendChild(tr);
    });
  }

  if(patientSearchBtn) patientSearchBtn.addEventListener('click', function(){
    renderPatients(patientSearch.value.trim());
  });
  if(patientSearch) patientSearch.addEventListener('keydown', function(e){
    if(e.key==='Enter') renderPatients(patientSearch.value.trim());
  });

  /* ── Register patient modal ─────────────────────────────── */
  var registerModal      = document.getElementById('registerModal');
  var registerPatientBtn = document.getElementById('registerPatientBtn');
  var closeRegisterModal = document.getElementById('closeRegisterModal');
  var cancelRegisterBtn  = document.getElementById('cancelRegisterBtn');
  var confirmRegisterBtn = document.getElementById('confirmRegisterBtn');
  var registerError      = document.getElementById('registerError');

  function openRegisterModal() { registerModal.classList.add('is-open'); }
  function closeRegister() {
    registerModal.classList.remove('is-open');
    registerError.textContent = '';
  }

  if(registerPatientBtn) registerPatientBtn.addEventListener('click', openRegisterModal);
  if(closeRegisterModal) closeRegisterModal.addEventListener('click', closeRegister);
  if(cancelRegisterBtn)  cancelRegisterBtn.addEventListener('click', closeRegister);
  registerModal.addEventListener('click', function(e){ if(e.target===registerModal) closeRegister(); });

  if(document.getElementById('registerFromConsult')){
    document.getElementById('registerFromConsult').addEventListener('click', openRegisterModal);
  }

  if(confirmRegisterBtn) confirmRegisterBtn.addEventListener('click', function(){
    registerError.textContent = '';
    var name     = document.getElementById('p-name').value.trim();
    var dob      = document.getElementById('p-dob').value;
    var sex      = document.getElementById('p-sex').value;
    var district = document.getElementById('p-district').value;
    var consent  = document.getElementById('p-consent').checked;

    if(!name)    { registerError.textContent='Full name is required.'; return; }
    if(!dob)     { registerError.textContent='Date of birth is required.'; return; }
    if(!sex)     { registerError.textContent='Sex is required.'; return; }
    if(!district){ registerError.textContent='District is required.'; return; }
    if(!consent) { registerError.textContent='Patient consent is required.'; return; }

    var chronic = Array.from(document.querySelectorAll('#registerModal input[type="checkbox"]:checked'))
      .filter(function(cb){ return cb.id!=='p-consent'; })
      .map(function(cb){ return cb.value; });

    var phone    = document.getElementById('p-phone').value.trim();
    var nid      = document.getElementById('p-nid').value.trim();
    var allergies= document.getElementById('p-allergies').value.trim();
    var insurance= document.getElementById('p-insurance').value.trim();

    var age   = calcAge(dob);
    var newId = DB.generatePatientId();

    DB.addPatient({
      id: newId, name: name, sex: sex, dob: dob,
      age: typeof age==='number' ? age : parseInt(age,10),
      district: district, facility_id: FACILITY_ID,
      phone: phone||null, national_id: nid||null,
      chronic_conditions: chronic,
      allergies: allergies ? [allergies] : [],
      insurance: insurance||null,
      registered_at: new Date().toISOString(),
      registered_by: 'Facility Worker'
    });

    closeRegister();
    renderPatients();
    renderConsultPatientList();
    renderRecPatientDropdown();

    var banner = document.createElement('div');
    banner.className = 'info-banner info-banner--green';
    banner.style.cssText = 'position:fixed;bottom:50px;left:50%;transform:translateX(-50%);z-index:600;white-space:nowrap;box-shadow:var(--shadow-sm)';
    banner.innerHTML = 'Patient registered: <strong>'+esc(newId)+'</strong>';
    document.body.appendChild(banner);
    setTimeout(function(){ banner.remove(); }, 3500);
  });

  /* ── Patient profile slideover ──────────────────────────── */
  var patientSlideover        = document.getElementById('patientSlideover');
  var patientSlideoverOverlay = document.getElementById('patientSlideoverOverlay');
  var slideoverPatientName    = document.getElementById('slideoverPatientName');
  var slideoverDemographics   = document.getElementById('slideoverDemographics');
  var slideoverConsultations  = document.getElementById('slideoverConsultations');
  var slideoverDocuments      = document.getElementById('slideoverDocuments');
  var slideoverReferrals      = document.getElementById('slideoverReferrals');

  function openPatientSlideover(pid) {
    var p = DB.getPatient(pid); if(!p) return;
    slideoverPatientName.textContent = p.name;

    slideoverDemographics.innerHTML =
      '<h3 class="panel-label">Demographics</h3>'+
      '<div class="detail-grid">'+
        detailRow('Patient ID', p.id)+
        detailRow('Name', p.name)+
        detailRow('Age / Sex', calcAge(p.dob)+' yrs / '+p.sex)+
        detailRow('District', p.district)+
        detailRow('DOB', formatDate(p.dob))+
        (p.chronic_conditions&&p.chronic_conditions.length ? detailRow('Chronic conditions', p.chronic_conditions.join(', ')) : '')+
        (p.allergies&&p.allergies.length ? detailRow('Allergies', p.allergies.join(', ')) : '')+
        detailRow('DHIS2 Status', '<span class="status-badge status-active">Registered</span>')+
      '</div>';

    var cases = DB.getCases().filter(function(c){ return c.patient_id===pid; });
    var caseHtml = '<h3 class="panel-label" style="margin-top:var(--s3)">Consultations ('+cases.length+')</h3>';
    if(!cases.length) {
      caseHtml += '<p class="empty-msg">No consultations yet.</p>';
    } else {
      caseHtml += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Case ID</th><th>Date</th><th>Diagnosis</th><th>Status</th></tr></thead><tbody>';
      cases.forEach(function(c){
        var sc = c.status==='closed'?'status-active':'status-pending';
        caseHtml += '<tr>'+
          '<td style="font-weight:700;color:var(--accent);font-size:var(--t-xs)">'+esc(c.id)+'</td>'+
          '<td>'+formatDate(c.created_at)+'</td>'+
          '<td>'+(c.diagnosis?esc(c.diagnosis):'<em style="color:var(--ink-3)">Pending</em>')+'</td>'+
          '<td><span class="status-badge '+sc+'">'+esc(c.status)+'</span></td>'+
          '</tr>';
      });
      caseHtml += '</tbody></table></div>';
    }
    slideoverConsultations.innerHTML = caseHtml;

    var docs = DB.getDocumentsByPatient(pid);
    var docHtml = '<h3 class="panel-label" style="margin-top:var(--s3)">Documents ('+docs.length+')</h3>';
    if(!docs.length) {
      docHtml += '<p class="empty-msg">No documents uploaded.</p>';
    } else {
      docHtml += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Filename</th><th>Type</th><th>Date</th><th></th></tr></thead><tbody>';
      docs.forEach(function(d){
        docHtml += '<tr>'+
          '<td style="font-weight:600">'+esc(d.filename)+'</td>'+
          '<td>'+esc(d.type)+'</td>'+
          '<td>'+formatDate(d.date)+'</td>'+
          '<td><button class="btn btn-xs btn-outline" onclick="alert(\'In production this downloads the encrypted file.\')">View</button></td>'+
          '</tr>';
      });
      docHtml += '</tbody></table></div>';
    }
    slideoverDocuments.innerHTML = docHtml;

    var refs = DB.getReferrals().filter(function(r){ return r.patient_id===pid; });
    var refHtml = '<h3 class="panel-label" style="margin-top:var(--s3)">Referrals ('+refs.length+')</h3>';
    if(!refs.length) {
      refHtml += '<p class="empty-msg">No referrals.</p>';
    } else {
      refs.forEach(function(r){
        var sc = r.status==='Responded'?'status-active':r.status==='Pending'?'status-pending':'status-teal';
        refHtml += '<div style="border:1px solid var(--rule);border-radius:var(--radius);padding:var(--s2);margin-bottom:var(--s1)">'+
          '<div style="display:flex;align-items:center;gap:var(--s1);margin-bottom:0.5rem">'+
          '<strong>'+esc(r.specialist)+'</strong> · '+esc(r.specialty)+
          '<span class="status-badge '+sc+'" style="margin-left:auto">'+esc(r.status)+'</span></div>'+
          '<div style="font-size:var(--t-xs);color:var(--ink-3)">'+esc(r.reason)+'</div>'+
          (r.specialist_assessment?'<div style="font-size:var(--t-sm);color:var(--ink-2);margin-top:0.5rem;font-family:var(--font-text)">'+esc(r.specialist_assessment)+'</div>':'')+
          '</div>';
      });
    }
    slideoverReferrals.innerHTML = refHtml;

    patientSlideover.classList.add('is-open');
    patientSlideoverOverlay.classList.add('is-open');
  }

  function detailRow(k,v) {
    return '<div class="detail-row"><span class="detail-key">'+esc(k)+'</span><span class="detail-val">'+v+'</span></div>';
  }

  document.getElementById('closePatientSlideover').addEventListener('click', function(){
    patientSlideover.classList.remove('is-open');
    patientSlideoverOverlay.classList.remove('is-open');
  });
  patientSlideoverOverlay.addEventListener('click', function(){
    patientSlideover.classList.remove('is-open');
    patientSlideoverOverlay.classList.remove('is-open');
  });

  /* ── NEW CONSULTATION ───────────────────────────────────── */
  var currentConsultStep = 1;
  var selectedPatient    = null;
  var selectedDoctor     = null;

  function consultStep(n) {
    currentConsultStep = n;
    document.querySelectorAll('.consult-step').forEach(function(el){
      el.classList.toggle('active', el.id==='cstep'+n);
    });
    document.querySelectorAll('.cs-step').forEach(function(el){
      var s = parseInt(el.getAttribute('data-step'),10);
      el.classList.remove('active','done');
      if(s===n) el.classList.add('active');
      if(s<n)   el.classList.add('done');
    });
  }

  function resetConsultation() {
    selectedPatient = null;
    selectedDoctor  = null;
    consultStep(1);
    renderConsultPatientList();
    document.getElementById('cstep1Next').disabled = true;
    document.getElementById('cstep2Next').disabled = true;
    document.getElementById('c-bodyArea').value = '';
    document.getElementById('c-duration').value = '';
    document.getElementById('c-complaint').value = '';
    document.getElementById('c-type').value = 'text';
    document.querySelectorAll('#cstep3 input[type="checkbox"]').forEach(function(cb){ cb.checked=false; });
    document.getElementById('intakeFormError').textContent = '';
    document.getElementById('videoTzNote').classList.add('hidden');
  }

  function renderConsultPatientList(filter) {
    var list = document.getElementById('consultPatientList');
    var patients = DB.getPatients().filter(function(p){ return p.facility_id===FACILITY_ID; });
    if(filter){
      var q=filter.toLowerCase();
      patients=patients.filter(function(p){ return (p.name||'').toLowerCase().includes(q)||(p.id||'').toLowerCase().includes(q); });
    }
    list.innerHTML = '';
    patients.forEach(function(p){
      var item = document.createElement('div');
      item.className = 'patient-select-item'+(selectedPatient&&selectedPatient.id===p.id?' is-selected':'');
      item.innerHTML =
        '<div>'+
          '<div class="psi-name">'+esc(p.name)+'</div>'+
          '<div class="psi-meta">'+calcAge(p.dob)+' yrs · '+esc(p.sex)+' · '+esc(p.district)+'</div>'+
        '</div>'+
        '<span class="psi-id">'+esc(p.id)+'</span>';
      item.addEventListener('click', function(){
        selectedPatient = p;
        renderConsultPatientList(filter);
        document.getElementById('cstep1Next').disabled = false;
      });
      list.appendChild(item);
    });
    if(!patients.length){
      list.innerHTML = '<p class="empty-msg">No patients found. <button class="btn btn-sm btn-outline" onclick="document.getElementById(\'registerPatientBtn\').click()">Register patient first</button></p>';
    }
  }

  var consultPatientSearch = document.getElementById('consultPatientSearch');
  if(consultPatientSearch) consultPatientSearch.addEventListener('input', function(){
    renderConsultPatientList(consultPatientSearch.value.trim());
  });

  document.getElementById('cstep1Next').addEventListener('click', function(){
    if(!selectedPatient) return;
    renderConsultDoctorList();
    consultStep(2);
  });

  function renderConsultDoctorList() {
    var list = document.getElementById('consultDoctorList');
    var doctors = DB.getDoctors().filter(function(d){ return d.facility_id===FACILITY_ID; });
    list.innerHTML = '';
    doctors.forEach(function(d){
      var item = document.createElement('div');
      item.className = 'doctor-select-item'+(selectedDoctor&&selectedDoctor.id===d.id?' is-selected':'');
      item.innerHTML =
        '<div>'+
          '<div class="dsi-name">'+esc(d.name)+'</div>'+
          '<div class="dsi-spec">'+esc(d.specialty)+' · '+esc(d.facility)+'</div>'+
        '</div>'+
        '<span class="dsi-status"><span class="status-badge status-active">'+esc(d.status)+'</span></span>';
      item.addEventListener('click', function(){
        selectedDoctor = d;
        renderConsultDoctorList();
        document.getElementById('cstep2Next').disabled = false;
      });
      list.appendChild(item);
    });
    if(!doctors.length){
      list.innerHTML = '<p class="empty-msg">No doctors available at this facility.</p>';
    }
  }

  document.getElementById('cstep2Back').addEventListener('click', function(){ consultStep(1); });
  document.getElementById('cstep2Next').addEventListener('click', function(){
    if(!selectedDoctor) return;
    consultStep(3);
  });

  document.getElementById('c-type').addEventListener('change', function(){
    var isVideo = this.value==='video';
    var note = document.getElementById('videoTzNote');
    note.classList.toggle('hidden', !isVideo);
    if(isVideo && selectedDoctor){
      document.getElementById('doctorTzDisplay').textContent = selectedDoctor.facility+' (UTC+3 EAT)';
    }
  });

  document.getElementById('cstep3Back').addEventListener('click', function(){ consultStep(2); });

  document.getElementById('cstep3Next').addEventListener('click', function(){
    var bodyArea = document.getElementById('c-bodyArea').value;
    var duration = document.getElementById('c-duration').value;
    var complaint= document.getElementById('c-complaint').value.trim();
    var symptoms = Array.from(document.querySelectorAll('#cstep3 input[type="checkbox"]:checked'))
      .map(function(cb){ return cb.value; });
    var errEl = document.getElementById('intakeFormError');
    errEl.textContent = '';
    if(!bodyArea)       { errEl.textContent='Please select a body area.'; return; }
    if(!duration)       { errEl.textContent='Please select duration.'; return; }
    if(!symptoms.length){ errEl.textContent='Please select at least one symptom.'; return; }

    var type = document.getElementById('c-type').value;
    var box  = document.getElementById('consultConfirmBox');
    box.innerHTML =
      '<h3 class="panel-label">Review Consultation</h3>'+
      '<div class="detail-grid">'+
        detailRow('Patient', esc(selectedPatient.name)+' <span style="color:var(--accent);font-size:var(--t-xs)">'+esc(selectedPatient.id)+'</span>')+
        detailRow('Doctor', esc(selectedDoctor.name)+' · '+esc(selectedDoctor.specialty))+
        detailRow('Body area', esc(bodyArea))+
        detailRow('Duration', esc(duration))+
        detailRow('Symptoms', esc(symptoms.join(', ')))+
        (complaint?detailRow('Complaint', esc(complaint)):'')+
        detailRow('Type', type==='video'?'Video Call (Jitsi)':'Text (Async)')+
        detailRow('Urgency', calcUrgency(symptoms,selectedPatient.age))+
      '</div>';

    consultStep(4);
  });

  document.getElementById('cstep4Back').addEventListener('click', function(){ consultStep(3); });

  document.getElementById('submitConsultBtn').addEventListener('click', function(){
    var bodyArea = document.getElementById('c-bodyArea').value;
    var duration = document.getElementById('c-duration').value;
    var complaint= document.getElementById('c-complaint').value.trim();
    var type     = document.getElementById('c-type').value;
    var symptoms = Array.from(document.querySelectorAll('#cstep3 input[type="checkbox"]:checked'))
      .map(function(cb){ return cb.value; });
    var urgency  = calcUrgency(symptoms, selectedPatient.age);

    var caseId   = DB.generateCaseId();
    var jitsiUrl = type==='video'
      ? 'https://meet.jit.si/telecaafimaad-'+caseId.toLowerCase()+'-'+Math.random().toString(36).slice(2,8)
      : null;

    DB.addCase({
      id: caseId, status:'pending', created_at: new Date().toISOString(), closed_at:null,
      patient_id: selectedPatient.id, patient_name: selectedPatient.name,
      facility_id: FACILITY_ID,
      age: selectedPatient.age||calcAge(selectedPatient.dob),
      sex: selectedPatient.sex,
      body_area: bodyArea, symptoms: symptoms, duration: duration,
      complaint: complaint||'No additional detail provided.',
      district: selectedPatient.district, urgency: urgency, type: type,
      assigned_doctor: selectedDoctor.name, assigned_doctor_id: selectedDoctor.id,
      specialty: selectedDoctor.specialty,
      diagnosis:null, pathway:null, clinical_notes:null, pathway_data:null,
      dhis2_status:null,
      video_url: jitsiUrl, video_requested: type==='video',
      video_status: type==='video'?'pending':null,
      referral_id:null, submitted:'Just now'
    });

    var box = document.getElementById('consultSuccessBox');
    box.innerHTML =
      '<div class="detail-grid">'+
        detailRow('Case ID', '<strong style="color:var(--accent);font-size:var(--t-md)">'+esc(caseId)+'</strong>')+
        detailRow('Patient', esc(selectedPatient.name))+
        detailRow('Assigned to', esc(selectedDoctor.name))+
        detailRow('Type', type==='video'?'Video Call':'Text')+
        detailRow('Status', '<span class="status-badge status-pending">Pending · Awaiting Doctor</span>')+
        detailRow('Estimated response', 'Within 24 hours')+
        (jitsiUrl?detailRow('Video room', '<a href="'+esc(jitsiUrl)+'" target="_blank" class="btn btn-primary btn-sm">Join Jitsi Call</a>'):'')+'</div>';

    consultStep(5);
  });

  document.getElementById('newConsultBtn').addEventListener('click', function(){
    resetConsultation();
  });

  function calcUrgency(symptoms, age) {
    if(symptoms.indexOf('Fever')>-1 || symptoms.indexOf('Shortness of breath')>-1) return 'high';
    if(symptoms.indexOf('Vomiting')>-1 || symptoms.indexOf('Dizziness')>-1 || age<12) return 'medium';
    return 'low';
  }

  /* ── REFERRALS TAB ──────────────────────────────────────── */
  function renderReferrals() {
    var tbody   = document.getElementById('referralTableBody');
    var emptyEl = document.getElementById('emptyReferrals');
    var refs    = DB.getReferrals().filter(function(r){
      var p = DB.getPatient(r.patient_id);
      return p && p.facility_id===FACILITY_ID;
    });
    tbody.innerHTML = '';
    emptyEl.classList.toggle('hidden', refs.length>0);
    document.getElementById('referralDetailPanel').classList.add('hidden');
    refs.forEach(function(r){
      var sc = r.status==='Responded'?'status-active':r.status==='Pending'?'status-pending':'status-teal';
      var tr = document.createElement('tr');
      tr.className = 'is-clickable';
      tr.innerHTML =
        '<td style="font-weight:700;color:var(--accent);font-size:var(--t-xs)">'+esc(r.id)+'</td>'+
        '<td style="font-weight:600">'+esc(r.patient_name)+'</td>'+
        '<td>'+esc(r.referring_doctor)+'</td>'+
        '<td>'+esc(r.specialist)+'</td>'+
        '<td><span class="status-badge '+sc+'">'+esc(r.status)+'</span></td>'+
        '<td>'+formatDate(r.created_at)+'</td>';
      tr.addEventListener('click', function(){ showReferralDetail(r); });
      tbody.appendChild(tr);
    });
  }

  function showReferralDetail(r) {
    var panel   = document.getElementById('referralDetailPanel');
    var content = document.getElementById('referralDetailContent');
    var sc      = r.status==='Responded'?'status-active':r.status==='Pending'?'status-pending':'status-teal';
    content.innerHTML =
      '<div class="detail-grid">'+
        detailRow('Referral ID', esc(r.id))+
        detailRow('Patient', esc(r.patient_name))+
        detailRow('Referring doctor', esc(r.referring_doctor))+
        detailRow('Specialist', esc(r.specialist)+' · '+esc(r.specialty))+
        detailRow('Reason', esc(r.reason))+
        detailRow('Urgency', '<span class="urgency-badge urgency-'+r.urgency.toLowerCase()+'">'+esc(r.urgency)+'</span>')+
        detailRow('Status', '<span class="status-badge '+sc+'">'+esc(r.status)+'</span>')+
        (r.specialist_assessment?
          detailRow('Specialist assessment', esc(r.specialist_assessment))+
          detailRow('Recommendation', esc(r.specialist_recommendation))+
          detailRow('Instructions', esc(r.specialist_instructions))
        : '')+
      '</div>';
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  document.getElementById('closeReferralDetail').addEventListener('click', function(){
    document.getElementById('referralDetailPanel').classList.add('hidden');
  });

  /* ── RECORDS TAB ────────────────────────────────────────── */
  function renderRecPatientDropdown() {
    var sel = document.getElementById('rec-patient');
    var cur = sel.value;
    sel.innerHTML = '<option value="">Select patient</option>';
    DB.getPatients().filter(function(p){ return p.facility_id===FACILITY_ID; }).forEach(function(p){
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name+' ('+p.id+')';
      if(p.id===cur) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderRecords() {
    renderRecPatientDropdown();
    renderDocumentsTable();
  }

  function renderDocumentsTable() {
    var tbody   = document.getElementById('documentTableBody');
    var emptyEl = document.getElementById('emptyDocuments');
    var docs    = DB.getDocuments().filter(function(d){
      var p = DB.getPatient(d.patient_id);
      return p && p.facility_id===FACILITY_ID;
    });
    tbody.innerHTML = '';
    emptyEl.classList.toggle('hidden', docs.length>0);
    docs.forEach(function(d){
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="font-weight:600">'+esc(d.patient_name)+'</td>'+
        '<td>'+esc(d.filename)+'</td>'+
        '<td>'+esc(d.type)+'</td>'+
        '<td>'+formatDate(d.date)+'</td>'+
        '<td style="font-size:var(--t-xs);color:var(--ink-3)">'+esc(d.uploaded_by)+'</td>'+
        '<td>'+
          '<button class="btn btn-xs btn-outline" onclick="alert(\'In production this downloads the encrypted file.\')">View</button>'+
          ' <button class="btn btn-xs btn-outline" onclick="alert(\'In production this downloads the encrypted file.\')">Download</button>'+
        '</td>';
      tbody.appendChild(tr);
    });
  }

  document.getElementById('uploadRecordBtn').addEventListener('click', function(){
    var errEl    = document.getElementById('recError');
    var pid      = document.getElementById('rec-patient').value;
    var type     = document.getElementById('rec-type').value;
    var filename = document.getElementById('rec-filename').value.trim();
    var date     = document.getElementById('rec-date').value;
    var notes    = document.getElementById('rec-notes').value.trim();
    errEl.textContent = '';
    if(!pid)      { errEl.textContent='Please select a patient.'; return; }
    if(!filename) { errEl.textContent='Please enter a filename.'; return; }
    if(!date)     { errEl.textContent='Please enter the record date.'; return; }

    var p = DB.getPatient(pid);
    var docId = 'DOC-'+String(DB.getDocuments().length+1).padStart(3,'0');
    DB.addDocument({
      id: docId, patient_id: pid, patient_name: p?p.name:pid,
      filename: filename, type: type, date: date, notes: notes,
      uploaded_by: 'Facility Worker', facility_id: FACILITY_ID,
      uploaded_at: new Date().toISOString()
    });
    document.getElementById('rec-filename').value='';
    document.getElementById('rec-date').value='';
    document.getElementById('rec-notes').value='';
    renderDocumentsTable();
  });

  /* ── MY FACILITY TAB ────────────────────────────────────── */
  function renderFacilityTab() {
    var fac = DB.getFacility(FACILITY_ID)||{};
    var profile = document.getElementById('facilityProfile');
    profile.innerHTML =
      '<div class="detail-row"><span class="detail-key">Name</span><span class="detail-val">'+esc(fac.name)+'</span></div>'+
      '<div class="detail-row"><span class="detail-key">Type</span><span class="detail-val"><span class="type-badge type-'+((fac.type||'').toLowerCase())+'">'+esc(fac.type)+'</span></span></div>'+
      '<div class="detail-row"><span class="detail-key">District</span><span class="detail-val">'+esc(fac.district)+'</span></div>'+
      '<div class="detail-row"><span class="detail-key">Services</span><span class="detail-val">'+esc((fac.services||[]).join(', '))+'</span></div>'+
      '<div class="detail-row"><span class="detail-key">Coordinates</span><span class="detail-val">'+esc(fac.lat)+', '+esc(fac.lng)+'</span></div>'+
      '<div class="detail-row"><span class="detail-key">Contact</span><span class="detail-val">'+esc(fac.contact)+'</span></div>'+
      '<div class="detail-row"><span class="detail-key">Status</span><span class="detail-val"><span class="status-badge status-active">Active</span></span></div>';

    var doctors = DB.getDoctors().filter(function(d){ return d.facility_id===FACILITY_ID; });
    var staff   = document.getElementById('facilityStaff');
    var staffHtml = '<div class="detail-row"><span class="detail-key">Facility Workers</span><span class="detail-val">1 (current session)</span></div>';
    doctors.forEach(function(d){
      staffHtml += '<div class="detail-row"><span class="detail-key">Doctor</span><span class="detail-val">'+esc(d.name)+' · '+esc(d.specialty)+'</span></div>';
    });
    staff.innerHTML = staffHtml;

    var log  = DB.getDHIS2Log();
    var last = log[0] ? log[0].ts.replace('T',' ').slice(0,16)+' UTC' : '—';
    document.getElementById('dhis2LastSync').textContent = last;
  }

  /* ── Storage events ─────────────────────────────────────── */
  window.addEventListener('storage', function(e){
    if(e.key==='tc_cases'){
      var activeTab = document.querySelector('.fac-tab-btn.is-active');
      if(activeTab && activeTab.getAttribute('data-tab')==='patients') renderPatients();
    }
    if(e.key==='tc_referrals'){
      var activeTab2 = document.querySelector('.fac-tab-btn.is-active');
      if(activeTab2 && activeTab2.getAttribute('data-tab')==='referrals') renderReferrals();
    }
  });

  /* ── Init ───────────────────────────────────────────────── */
  var fac0 = DB.getFacility(FACILITY_ID);
  if(fac0){
    document.getElementById('facilityDisplayName').innerHTML =
      esc(fac0.name)+' <span class="type-badge type-'+(fac0.type||'').toLowerCase()+'">'+esc(fac0.type)+'</span>';
    var metaEl2 = document.getElementById('workerMeta');
    if(metaEl2) metaEl2.textContent = DB.CREDENTIALS.facility.name+' · Facility Worker';
  }

  renderPatients();
  renderConsultPatientList();

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
