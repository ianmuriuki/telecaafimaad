/* =============================================================
   db.js — TeleCaafimaad Data Layer v2
   All interfaces share this module. Call DB.init() on every page.
   Call DB.reset() to restore seed data.
   ============================================================= */

var DB = (function () {
  'use strict';

  var KEYS = {
    PATIENTS:   'tc_patients',
    CASES:      'tc_cases',
    REFERRALS:  'tc_referrals',
    FACILITIES: 'tc_facilities',
    DOCTORS:    'tc_doctors',
    SPECIALISTS:'tc_specialists',
    DOCUMENTS:  'tc_documents',
    DHIS2_LOG:  'tc_dhis2_log',
    DONATIONS:  'tc_donations',
    SESSIONS:   'tc_sessions',
    AVAILABILITY:'tc_availability'
  };

  /* ── Seed data ──────────────────────────────────────────── */

  function _seedFacilities() {
    return [
      { id:1, name:'Banadir Regional Hospital', type:'Public',  district:'Banadir',
        lat:2.0469, lng:45.3182, services:['General','Paediatrics','Surgery'],
        status:'Active', contact:'+252 61 000 0001' },
      { id:2, name:'Kahda Primary Health Unit', type:'Public',  district:'Banadir',
        lat:2.0892, lng:45.2731, services:['General Practice','Maternal Health'],
        status:'Active', contact:'+252 61 000 0002' },
      { id:3, name:'Bay Regional Hospital',     type:'Public',  district:'Bay',
        lat:3.1177, lng:43.6478, services:['General','Internal Medicine'],
        status:'Active', contact:'+252 68 000 0003' },
      { id:4, name:'Daryeel Private Clinic',    type:'Private', district:'Banadir',
        lat:2.0523, lng:45.3401, services:['General','Cardiology'],
        status:'Active', contact:'+252 61 000 0004' }
    ];
  }

  function _seedDoctors() {
    return [
      { id:1, name:'Dr. Fadumo Warsame', specialty:'General Practice',
        facility_id:1, facility:'Banadir Regional Hospital',
        district:'Banadir', status:'Active', nhpc:true,
        joined:'Jan 2026', cases:12, languages:['Somali','Arabic'],
        qualif:'MBChB · University of Mogadishu', license:'NHPC-SO-0012' },
      { id:2, name:'Dr. Hassan Nur', specialty:'Internal Medicine',
        facility_id:3, facility:'Bay Regional Hospital',
        district:'Bay', status:'Active', nhpc:true,
        joined:'Jan 2026', cases:8, languages:['Somali','English'],
        qualif:'MBChB · Jazeera University', license:'NHPC-SO-0015' },
      { id:3, name:'Dr. Amina Sheikh', specialty:'Paediatrics',
        facility_id:2, facility:'Kahda Primary Health Unit',
        district:'Banadir', status:'Active', nhpc:true,
        joined:'Feb 2026', cases:10, languages:['Somali'],
        qualif:'MBChB, DCH · University of Mogadishu', license:'NHPC-SO-0021' }
    ];
  }

  function _seedSpecialists() {
    return [
      { id:1, name:'Dr. Omar Farah',   specialty:'Cardiology',
        location:'Toronto, Canada',  languages:['Somali','English'],
        status:'Active', nhpc:true, cases_reviewed:19,
        joined:'Feb 2026', qualif:'MD, FRCPC · University of Toronto',
        license:'CPSO Ontario', response_time_avg:'4h' },
      { id:2, name:'Dr. Asad Warsame', specialty:'Obstetrics',
        location:'Oslo, Norway',     languages:['Somali','English','Norwegian'],
        status:'Active', nhpc:true, cases_reviewed:11,
        joined:'Mar 2026', qualif:'MBChB, DRCOG · University of Oslo',
        license:'Helsedirektoratet', response_time_avg:'6h' },
      { id:3, name:'Dr. Liban Hassan', specialty:'Neurology',
        location:'London, UK',       languages:['Somali','English','Arabic'],
        status:'Active', nhpc:true, cases_reviewed:7,
        joined:'Mar 2026', qualif:'MD, MRCP · King\'s College London',
        license:'GMC UK', response_time_avg:'8h' }
    ];
  }

  function _seedPatients() {
    return [
      { id:'SOK-2026-0001', name:'Hodan Abdi',  sex:'Female', dob:'1992-03-14', age:34,
        district:'Banadir', facility_id:1, phone:null, national_id:null,
        chronic_conditions:[], allergies:[], insurance:null,
        registered_at:'2026-05-18T08:00:00Z', registered_by:'Facility Worker' },
      { id:'SOK-2026-0002', name:'Yusuf Jama',  sex:'Male',   dob:'1974-07-22', age:52,
        district:'Bay',     facility_id:3, phone:null, national_id:null,
        chronic_conditions:['Hypertension'], allergies:[], insurance:null,
        registered_at:'2026-05-19T09:00:00Z', registered_by:'Facility Worker' },
      { id:'SOK-2026-0003', name:'Fadumo Ali',  sex:'Female', dob:'2007-01-05', age:19,
        district:'Banadir', facility_id:1, phone:null, national_id:null,
        chronic_conditions:[], allergies:[], insurance:null,
        registered_at:'2026-05-27T10:00:00Z', registered_by:'Facility Worker' }
    ];
  }

  function _seedCases() {
    return [
      { id:'TC-2026-0001', status:'closed',
        created_at:'2026-05-20T09:00:00Z', closed_at:'2026-05-20T11:30:00Z',
        patient_id:'SOK-2026-0001', patient_name:'Hodan Abdi',
        facility_id:1, age:34, sex:'Female', body_area:'Chest',
        symptoms:['Fever','Cough'], duration:'1-3 days',
        complaint:'Fever and cough for 2 days, worse at night.',
        district:'Banadir', urgency:'medium', type:'text',
        assigned_doctor:'Dr. Fadumo Warsame', assigned_doctor_id:1,
        specialty:'General Practice',
        diagnosis:'Upper Respiratory Infection',
        pathway:'prescription',
        clinical_notes:'Patient presents with fever and cough consistent with URI. Prescribed paracetamol and amoxicillin.',
        pathway_data:{ medication:'Amoxicillin 500mg', dosage:'1 capsule', frequency:'Twice daily', duration:'5 days', pharmacy:'Isha Pharmacy · Mogadishu' },
        dhis2_status:'Success',
        video_url:null, video_requested:false, video_status:null,
        referral_id:null },
      { id:'TC-2026-0002', status:'closed',
        created_at:'2026-05-22T07:00:00Z', closed_at:'2026-05-22T09:15:00Z',
        patient_id:'SOK-2026-0002', patient_name:'Yusuf Jama',
        facility_id:3, age:52, sex:'Male', body_area:'General',
        symptoms:['Headache','Fatigue'], duration:'4-7 days',
        complaint:'Persistent headache and fatigue, known hypertension.',
        district:'Bay', urgency:'medium', type:'text',
        assigned_doctor:'Dr. Hassan Nur', assigned_doctor_id:2,
        specialty:'Internal Medicine',
        diagnosis:'Hypertension Stage 1',
        pathway:'referral',
        clinical_notes:'BP elevated at 155/95. Managed with existing medication adjustment. Referred to Dr. Omar Farah for cardiac evaluation.',
        pathway_data:{ facility:'Dr. Omar Farah · Cardiology (Specialist)', reason:'Cardiac evaluation for hypertension management', urgency:'Routine' },
        dhis2_status:'Success',
        video_url:null, video_requested:false, video_status:null,
        referral_id:'REF-2026-0001' },
      { id:'TC-2026-0003', status:'pending',
        created_at:'2026-05-28T07:00:00Z', closed_at:null,
        patient_id:'SOK-2026-0003', patient_name:'Fadumo Ali',
        facility_id:1, age:19, sex:'Female', body_area:'Abdomen',
        symptoms:['Pain','Nausea'], duration:'1-3 days',
        complaint:'Lower abdominal pain and nausea since yesterday morning.',
        district:'Banadir', urgency:'medium', type:'text',
        assigned_doctor:'Dr. Amina Sheikh', assigned_doctor_id:3,
        specialty:'Paediatrics',
        diagnosis:null, pathway:null, clinical_notes:null, pathway_data:null,
        dhis2_status:null,
        video_url:null, video_requested:false, video_status:null,
        referral_id:null,
        submitted:'1 hour ago' }
    ];
  }

  function _seedReferrals() {
    return [
      { id:'REF-2026-0001',
        case_id:'TC-2026-0002',
        patient_id:'SOK-2026-0002', patient_name:'Yusuf Jama',
        patient_age:52, patient_sex:'Male', patient_district:'Bay',
        referring_doctor_id:2, referring_doctor:'Dr. Hassan Nur',
        referring_facility:'Bay Regional Hospital',
        specialist_id:1, specialist:'Dr. Omar Farah', specialty:'Cardiology',
        reason:'Cardiac evaluation required for hypertension management',
        urgency:'Routine',
        clinical_summary:'Patient is 52M with Stage 1 hypertension on current regimen. BP remains elevated at 155/95 despite treatment. Requesting cardiac evaluation and medication adjustment guidance.',
        mode:'async',
        status:'Responded',
        created_at:'2026-05-22T09:30:00Z',
        responded_at:'2026-05-22T14:00:00Z',
        specialist_assessment:'Review of clinical summary indicates good candidate for ACE inhibitor addition. ECG and lipid panel recommended.',
        specialist_recommendation:'Medication adjustment',
        specialist_instructions:'Add lisinopril 5mg once daily. Repeat BP check in 2 weeks. Order ECG and fasting lipid panel at next facility visit.',
        follow_up:'2 weeks',
        video_requested:false, video_url:null,
        attached_documents:['ecg_report.pdf'],
        feedback_submitted:true,
        dhis2_logged:true }
    ];
  }

  function _seedDocuments() {
    return [
      { id:'DOC-001', patient_id:'SOK-2026-0001', patient_name:'Hodan Abdi',
        filename:'prescription_001.pdf', type:'Prescription',
        date:'2026-05-20', notes:'Amoxicillin and Paracetamol prescription',
        uploaded_by:'Dr. Fadumo Warsame', facility_id:1,
        uploaded_at:'2026-05-20T11:45:00Z' },
      { id:'DOC-002', patient_id:'SOK-2026-0002', patient_name:'Yusuf Jama',
        filename:'ecg_report.pdf', type:'Lab Result',
        date:'2026-05-19', notes:'Baseline ECG prior to specialist referral',
        uploaded_by:'Banadir Regional Hospital', facility_id:3,
        uploaded_at:'2026-05-19T14:00:00Z' }
    ];
  }

  function _seedDHIS2Log(cases, referrals) {
    var log = [];
    var msgs = {
      Success:'Tracked entity created · /api/tracker accepted',
      Retry:'Service temporarily unavailable · retry scheduled',
      Failed:'Option set validation error · diagnosis code not found'
    };
    cases.filter(function(c){ return c.status==='closed'; }).forEach(function(c){
      var t = new Date(c.closed_at);
      t.setMinutes(t.getMinutes()+3);
      log.push({
        ts:c.closed_at, case_id:c.id, district:c.district,
        type:'Consultation', status:c.dhis2_status||'Success',
        code:c.dhis2_status==='Success'?200:422,
        msg:msgs[c.dhis2_status||'Success']
      });
    });
    referrals.filter(function(r){ return r.dhis2_logged; }).forEach(function(r){
      log.push({
        ts:r.responded_at, case_id:r.case_id, district:r.patient_district,
        type:'Specialist Referral', status:'Success', code:200,
        msg:'Specialist consultation logged, outcome: '+r.specialist_recommendation
      });
    });
    log.sort(function(a,b){ return new Date(b.ts)-new Date(a.ts); });
    return log;
  }

  function _seedDonations() {
    return [
      { id:'TC-DON-000001', name:'Diaspora Donor', amount:50, currency:'USD',
        message:'In memory of my father', method:'International Card',
        date:'2026-05-10', anonymous:false },
      { id:'TC-DON-000002', name:'Anonymous', amount:200, currency:'USD',
        message:'Supporting Somali healthcare', method:'International Card',
        date:'2026-05-18', anonymous:true }
    ];
  }

  /* ── Internal read/write ────────────────────────────────── */
  function _get(key) {
    try { var r=localStorage.getItem(key); return r?JSON.parse(r):null; }
    catch(e){ return null; }
  }

  function _set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      window.dispatchEvent(new StorageEvent('storage',{ key:key }));
      return true;
    } catch(e){ return false; }
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    var facilities = _seedFacilities();
    var doctors    = _seedDoctors();
    var specialists= _seedSpecialists();
    var patients   = _seedPatients();
    var cases      = _seedCases();
    var referrals  = _seedReferrals();
    var documents  = _seedDocuments();
    var donations  = _seedDonations();

    if(!localStorage.getItem(KEYS.FACILITIES))  _set(KEYS.FACILITIES,  facilities);
    var _storedDoctors = _get(KEYS.DOCTORS);
    if(!_storedDoctors || !_storedDoctors.length || !_storedDoctors[0].facility_id) _set(KEYS.DOCTORS, doctors);
    if(!localStorage.getItem(KEYS.SPECIALISTS))  _set(KEYS.SPECIALISTS, specialists);
    if(!localStorage.getItem(KEYS.PATIENTS))     _set(KEYS.PATIENTS,    patients);
    if(!localStorage.getItem(KEYS.CASES))        _set(KEYS.CASES,       cases);
    if(!localStorage.getItem(KEYS.REFERRALS))    _set(KEYS.REFERRALS,   referrals);
    if(!localStorage.getItem(KEYS.DOCUMENTS))    _set(KEYS.DOCUMENTS,   documents);
    if(!localStorage.getItem(KEYS.DONATIONS))    _set(KEYS.DONATIONS,   donations);
    if(!localStorage.getItem(KEYS.SESSIONS))     _set(KEYS.SESSIONS,    {});
    if(!localStorage.getItem(KEYS.AVAILABILITY)) _set(KEYS.AVAILABILITY,{});
    if(!localStorage.getItem(KEYS.DHIS2_LOG)) {
      var c2 = _get(KEYS.CASES)||cases;
      var r2 = _get(KEYS.REFERRALS)||referrals;
      _set(KEYS.DHIS2_LOG, _seedDHIS2Log(c2,r2));
    }
  }

  function reset() {
    Object.values(KEYS).forEach(function(k){ localStorage.removeItem(k); });
    init();
    return true;
  }

  /* ── Patient API ────────────────────────────────────────── */
  function getPatients()     { return _get(KEYS.PATIENTS)||[]; }
  function getPatient(id)    { return getPatients().find(function(p){ return p.id===id; })||null; }

  function addPatient(obj) {
    var list=getPatients(); list.push(obj);
    _set(KEYS.PATIENTS,list);
  }

  function updatePatient(id,updates) {
    var list=getPatients();
    for(var i=0;i<list.length;i++){
      if(list[i].id===id){ Object.assign(list[i],updates); _set(KEYS.PATIENTS,list); return true; }
    }
    return false;
  }

  function generatePatientId() {
    var list=getPatients(); var max=0;
    list.forEach(function(p){
      var n=parseInt((p.id||'').split('-')[2],10);
      if(!isNaN(n)&&n>max) max=n;
    });
    return 'SOK-2026-'+String(max+1).padStart(4,'0');
  }

  /* ── Case API ───────────────────────────────────────────── */
  function getCases()        { return _get(KEYS.CASES)||[]; }
  function getPendingCases() { return getCases().filter(function(c){ return c.status==='pending'; }); }
  function getClosedCases()  { return getCases().filter(function(c){ return c.status==='closed'; }); }
  function getCase(id)       { return getCases().find(function(c){ return c.id===id; })||null; }

  function addCase(obj) {
    var list=getCases(); list.push(obj);
    _set(KEYS.CASES,list);
  }

  function updateCase(id,updates) {
    var list=getCases();
    for(var i=0;i<list.length;i++){
      if(list[i].id===id){ Object.assign(list[i],updates); _set(KEYS.CASES,list); return true; }
    }
    return false;
  }

  function generateCaseId() {
    var list=getCases(); var max=3;
    list.forEach(function(c){
      var n=parseInt((c.id||'').split('-')[2],10);
      if(!isNaN(n)&&n>max) max=n;
    });
    return 'TC-2026-'+String(max+1).padStart(4,'0');
  }

  /* ── Referral API ───────────────────────────────────────── */
  function getReferrals()    { return _get(KEYS.REFERRALS)||[]; }
  function getReferral(id)   { return getReferrals().find(function(r){ return r.id===id; })||null; }

  function addReferral(obj) {
    var list=getReferrals(); list.push(obj);
    _set(KEYS.REFERRALS,list);
  }

  function updateReferral(id,updates) {
    var list=getReferrals();
    for(var i=0;i<list.length;i++){
      if(list[i].id===id){ Object.assign(list[i],updates); _set(KEYS.REFERRALS,list); return true; }
    }
    return false;
  }

  function generateReferralId() {
    var list=getReferrals(); var max=1;
    list.forEach(function(r){
      var n=parseInt((r.id||'').split('-')[2],10);
      if(!isNaN(n)&&n>max) max=n;
    });
    return 'REF-2026-'+String(max+1).padStart(4,'0');
  }

  /* ── Facility API ───────────────────────────────────────── */
  function getFacilities()   { return _get(KEYS.FACILITIES)||[]; }
  function getFacility(id)   { return getFacilities().find(function(f){ return f.id===id; })||null; }

  /* ── Doctor API ─────────────────────────────────────────── */
  function getDoctors()      { return _get(KEYS.DOCTORS)||[]; }
  function getDoctor(id)     { return getDoctors().find(function(d){ return d.id===id; })||null; }

  function updateDoctor(id,updates) {
    var list=getDoctors();
    for(var i=0;i<list.length;i++){
      if(list[i].id===id){ Object.assign(list[i],updates); _set(KEYS.DOCTORS,list); return true; }
    }
    return false;
  }

  /* ── Specialist API ─────────────────────────────────────── */
  function getSpecialists()  { return _get(KEYS.SPECIALISTS)||[]; }
  function getSpecialist(id) { return getSpecialists().find(function(s){ return s.id===id; })||null; }

  function updateSpecialist(id,updates) {
    var list=getSpecialists();
    for(var i=0;i<list.length;i++){
      if(list[i].id===id){ Object.assign(list[i],updates); _set(KEYS.SPECIALISTS,list); return true; }
    }
    return false;
  }

  /* ── Document API ───────────────────────────────────────── */
  function getDocuments()            { return _get(KEYS.DOCUMENTS)||[]; }
  function getDocumentsByPatient(pid){ return getDocuments().filter(function(d){ return d.patient_id===pid; }); }

  function addDocument(obj) {
    var list=getDocuments(); list.push(obj);
    _set(KEYS.DOCUMENTS,list);
  }

  /* ── DHIS2 log API ──────────────────────────────────────── */
  function getDHIS2Log() { return _get(KEYS.DHIS2_LOG)||[]; }

  function addDHIS2Entry(entry) {
    var log=getDHIS2Log(); log.unshift(entry);
    if(log.length>200) log=log.slice(0,200);
    _set(KEYS.DHIS2_LOG,log);
  }

  function updateDHIS2Entry(caseId,updates) {
    var log=getDHIS2Log();
    for(var i=0;i<log.length;i++){
      if(log[i].case_id===caseId){ Object.assign(log[i],updates); _set(KEYS.DHIS2_LOG,log); return; }
    }
  }

  /* ── Donation API ───────────────────────────────────────── */
  function getDonations() { return _get(KEYS.DONATIONS)||[]; }

  function addDonation(obj) {
    var list=getDonations(); list.push(obj);
    _set(KEYS.DONATIONS,list);
  }

  /* ── Session API ────────────────────────────────────────── */
  function getAvailability()      { return _get(KEYS.AVAILABILITY)||{}; }
  function setAvailability(slots) { _set(KEYS.AVAILABILITY,slots); }

  function saveSession(token,caseId) {
    var s=_get(KEYS.SESSIONS)||{};
    s[token]={ case_id:caseId, created_at:new Date().toISOString() };
    _set(KEYS.SESSIONS,s);
  }

  function getSession(token) {
    var s=_get(KEYS.SESSIONS)||{};
    return s[token]||null;
  }

  /* ── Stats ──────────────────────────────────────────────── */
  function getStats() {
    var cases      = getCases();
    var closed     = getClosedCases();
    var pending    = getPendingCases();
    var patients   = getPatients();
    var facilities = getFacilities();
    var doctors    = getDoctors();
    var specialists= getSpecialists();
    var referrals  = getReferrals();
    var dhisLog    = getDHIS2Log();
    var donations  = getDonations();
    var now        = new Date();
    var weekAgo    = new Date(now.getTime()-7*24*3600000);
    var monthAgo   = new Date(now.getTime()-30*24*3600000);

    var thisWeek  = closed.filter(function(c){ return c.closed_at&&new Date(c.closed_at)>weekAgo; }).length;
    var thisMonth = closed.filter(function(c){ return c.closed_at&&new Date(c.closed_at)>monthAgo; }).length;

    var dhisTotal   = dhisLog.length;
    var dhisSuccess = dhisLog.filter(function(e){ return e.status==='Success'; }).length;
    var dhisRate    = dhisTotal?((dhisSuccess/dhisTotal)*100).toFixed(1):'0.0';

    var rx  = closed.filter(function(c){ return c.pathway==='prescription'; }).length;
    var lab = closed.filter(function(c){ return c.pathway==='lab'; }).length;
    var ref = closed.filter(function(c){ return c.pathway==='referral'; }).length;
    var fu  = closed.filter(function(c){ return c.pathway==='followup'; }).length;
    var na  = closed.filter(function(c){ return c.pathway==='noaction'; }).length;

    var refCompleted  = referrals.filter(function(r){ return r.status==='Responded'||r.status==='Complete'; }).length;
    var refTotal      = referrals.length;
    var spUsed        = new Set(referrals.map(function(r){ return r.specialist_id; })).size;

    var donTotal   = donations.reduce(function(acc,d){ return acc+d.amount; },0);
    var districts  = {};
    patients.forEach(function(p){ districts[p.district]=(districts[p.district]||0)+1; });

    var publicFacilities  = facilities.filter(function(f){ return f.type==='Public'; }).length;
    var privateFacilities = facilities.filter(function(f){ return f.type==='Private'; }).length;
    var pubCases = closed.filter(function(c){ var f=getFacility(c.facility_id); return f&&f.type==='Public'; }).length;
    var privCases= closed.filter(function(c){ var f=getFacility(c.facility_id); return f&&f.type==='Private'; }).length;

    return {
      total:            closed.length,
      pending:          pending.length,
      this_week:        thisWeek,
      this_month:       thisMonth,
      patients:         patients.length,
      facilities:       facilities.length,
      active_doctors:   doctors.filter(function(d){ return d.status==='Active'; }).length,
      total_doctors:    doctors.length,
      active_specialists: specialists.filter(function(s){ return s.status==='Active'; }).length,
      total_specialists:  specialists.length,
      specialists_used:   spUsed,
      referrals_total:    refTotal,
      referrals_completed:refCompleted,
      followup_rate:      refTotal?((refCompleted/refTotal)*100).toFixed(0):'0',
      dhis2_rate:         dhisRate+'%',
      prescriptions:      rx,
      lab_orders:         lab,
      referrals:          ref,
      followups:          fu,
      no_action:          na,
      video_calls:        cases.filter(function(c){ return c.video_url; }).length,
      donations_count:    donations.length,
      donations_total:    donTotal,
      districts:          districts,
      public_facilities:  publicFacilities,
      private_facilities: privateFacilities,
      public_cases:       pubCases,
      private_cases:      privCases
    };
  }

  /* ── Credentials ────────────────────────────────────────── */
  var CREDENTIALS = {
    facility:   { id: 'FW-001',    password: 'facility2026',   name: 'Xarunta Banadir',    role: 'Facility Worker'      },
    doctor:     { id: 'DR-001',    password: 'doctor2026',     name: 'Dr. Fadumo Warsame', role: 'Local Doctor'         },
    specialist: { id: 'SP-001',    password: 'specialist2026', name: 'Dr. Omar Farah',     role: 'Diaspora Specialist'  },
    admin:      { id: 'ADMIN-001', password: 'admin2026',      name: 'Admin Portal',       role: 'Administrator'        }
  };

  function checkCredentials(portal, id, password) {
    var cred = CREDENTIALS[portal];
    if (!cred) return false;
    return cred.id === id && cred.password === password;
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {
    init, reset,
    getPatients, getPatient, addPatient, updatePatient, generatePatientId,
    getCases, getPendingCases, getClosedCases, getCase, addCase, updateCase, generateCaseId,
    getReferrals, getReferral, addReferral, updateReferral, generateReferralId,
    getFacilities, getFacility,
    getDoctors, getDoctor, updateDoctor,
    getSpecialists, getSpecialist, updateSpecialist,
    getDocuments, getDocumentsByPatient, addDocument,
    getDHIS2Log, addDHIS2Entry, updateDHIS2Entry,
    getDonations, addDonation,
    getAvailability, setAvailability,
    saveSession, getSession,
    getStats,
    CREDENTIALS, checkCredentials,
    KEYS
  };

})();
