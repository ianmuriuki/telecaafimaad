/* =============================================================
   db.js — TeleCaafimaad Data Layer
   All interfaces (patient, doctor, admin) share this module.
   Data is stored in localStorage. Call DB.init() on every page.
   Call DB.reset() to restore seed data and reload.
   ============================================================= */

var DB = (function () {
  'use strict';

  /* ── Storage keys ───────────────────────────────────────── */
  var KEYS = {
    CASES:        'tc_cases',
    DOCTORS:      'tc_doctors',
    AVAILABILITY: 'tc_availability',
    DHIS2_LOG:    'tc_dhis2_log',
    SESSIONS:     'tc_sessions'
  };

  /* ── Seed helpers ───────────────────────────────────────── */
  var _DIAG = [
    'Upper Respiratory Infection', 'Acute Gastroenteritis', 'Malaria (P. falciparum)',
    'Hypertension Stage 1', 'Type 2 Diabetes', 'Anaemia', 'Urinary Tract Infection',
    'Tension Headache', 'Contact Dermatitis', 'Acute Bronchitis', 'Dehydration',
    'Pneumonia', 'Peptic Ulcer Disease', 'Migraine', 'Scabies'
  ];
  var _PATH  = ['prescription','prescription','prescription','lab','referral','followup','noaction'];
  var _DIST  = ['Banadir','Bay','Lower Shabelle'];
  var _SPEC  = ['Cardiology','Paediatrics','General Practice','Internal Medicine','Obstetrics'];
  var _DOCS  = ['Dr. Amina Hassan','Dr. Omar Farah','Dr. Fadumo Warsame','Dr. Mahad Idle','Dr. Asad Warsame'];

  function _seedClosedCases() {
    return [
      {
        id: 'TC-2026-0001', status: 'closed',
        created_at: '2026-05-20T09:00:00Z', closed_at: '2026-05-20T11:30:00Z',
        age: 45, sex: 'Female', body_area: 'Chest', symptoms: ['Fever', 'Cough'],
        duration: '1-3 days',
        complaint: 'Patient presented with symptoms consistent with upper respiratory infection.',
        district: 'Banadir', urgency: 'high', assigned_doctor: 'Dr. Amina Hassan',
        specialty: 'Cardiology', diagnosis: 'Upper Respiratory Infection',
        pathway: 'prescription',
        clinical_notes: 'Assessment and management completed. Outcome documented.',
        pathway_data: { detail: 'Managed per prescription protocol.' },
        dhis2_status: 'Success',
        video_url: null, video_requested: false, video_status: null
      },
      {
        id: 'TC-2026-0002', status: 'closed',
        created_at: '2026-05-22T07:00:00Z', closed_at: '2026-05-22T09:15:00Z',
        age: 62, sex: 'Male', body_area: 'Abdomen', symptoms: ['Pain', 'Fatigue'],
        duration: '4-7 days',
        complaint: 'Patient presented with symptoms consistent with peptic ulcer disease.',
        district: 'Bay', urgency: 'medium', assigned_doctor: 'Dr. Omar Farah',
        specialty: 'Paediatrics', diagnosis: 'Peptic Ulcer Disease',
        pathway: 'referral',
        clinical_notes: 'Assessment and management completed. Outcome documented.',
        pathway_data: { detail: 'Managed per referral protocol.' },
        dhis2_status: 'Success',
        video_url: null, video_requested: false, video_status: null
      },
      {
        id: 'TC-2026-0003', status: 'closed',
        created_at: '2026-05-23T12:00:00Z', closed_at: '2026-05-23T14:45:00Z',
        age: 31, sex: 'Female', body_area: 'General',
        symptoms: ['Fever', 'Vomiting', 'Diarrhoea'],
        duration: '1-3 days',
        complaint: 'Patient presented with symptoms consistent with acute gastroenteritis.',
        district: 'Lower Shabelle', urgency: 'medium', assigned_doctor: 'Dr. Fadumo Warsame',
        specialty: 'General Practice', diagnosis: 'Acute Gastroenteritis',
        pathway: 'lab',
        clinical_notes: 'Assessment and management completed. Outcome documented.',
        pathway_data: { detail: 'Managed per lab protocol.' },
        dhis2_status: 'Retry',
        video_url: null, video_requested: false, video_status: null
      }
    ];
  }

  /* 2 pending cases visible in doctor queue on fresh load */
  var _PENDING = [
    {
      id:'TC-2026-0004', status:'pending', created_at:'2026-05-28T05:00:00Z',
      age:28, sex:'Male', body_area:'Head', symptoms:['Dizziness','Pain'],
      duration:'1-3 days', complaint:'Dizziness and head pain since yesterday.',
      district:'Banadir', urgency:'medium', assigned_doctor:'Dr. Amina Hassan',
      specialty:'Cardiology', submitted:'3 hours ago',
      video_url: null, video_requested: false, video_status: null
    },
    {
      id:'TC-2026-0005', status:'pending', created_at:'2026-05-28T02:00:00Z',
      age:19, sex:'Female', body_area:'Skin', symptoms:['Rash','Fatigue'],
      duration:'4-7 days', complaint:'Skin rash and fatigue for several days.',
      district:'Bay', urgency:'low', assigned_doctor:'Dr. Omar Farah',
      specialty:'Paediatrics', submitted:'6 hours ago',
      video_url: null, video_requested: false, video_status: null
    }
  ];

  var _DOCTORS_SEED = [
    { id:1, name:'Dr. Amina Hassan',   spec:'Cardiology',        loc:'Toronto, Canada',   status:'Active',  cases:47, nhpc:true,  joined:'Feb 2026', license:'CPSO Ontario',     qualif:'MBChB, FRCPC' },
    { id:2, name:'Dr. Omar Farah',     spec:'Paediatrics',       loc:'London, UK',        status:'Active',  cases:39, nhpc:true,  joined:'Feb 2026', license:'GMC UK',           qualif:'MBBCh, MRCPCH' },
    { id:3, name:'Dr. Fadumo Warsame', spec:'General Practice',  loc:'Dubai, UAE',        status:'Active',  cases:52, nhpc:true,  joined:'Mar 2026', license:'DHA Dubai',        qualif:'MBChB, MRCGP' },
    { id:4, name:'Dr. Mahad Idle',     spec:'Internal Medicine', loc:'Minneapolis, USA',  status:'Active',  cases:28, nhpc:true,  joined:'Mar 2026', license:'ABIM Board Cert',  qualif:'MD, FACP' },
    { id:5, name:'Dr. Asad Warsame',   spec:'Obstetrics',        loc:'Oslo, Norway',      status:'Pending', cases:0,  nhpc:false, joined:'May 2026', license:'Helsedir Norway',  qualif:'MBChB, DRCOG' }
  ];

  function _seedDHIS2Log(cases) {
    var log = [];
    var codes   = { Success:200, Retry:503, Failed:422 };
    var msgs    = {
      Success: 'Tracked entity created — /api/tracker accepted',
      Retry:   'Service temporarily unavailable — retry scheduled in 5 min',
      Failed:  'Option set validation error — diagnosis code not found in DHIS2 metadata'
    };
    var closedCases = cases.filter(function(c){ return c.status==='closed'; });
    closedCases.forEach(function(c, i) {
      var t = new Date(c.closed_at || '2026-05-25T00:00:00Z');
      t.setMinutes(t.getMinutes() + 3);
      log.push({
        ts:       t.toISOString(),
        case_id:  c.id,
        district: c.district,
        status:   c.dhis2_status || 'Success',
        code:     codes[c.dhis2_status || 'Success'],
        msg:      msgs[c.dhis2_status || 'Success']
      });
    });
    return log;
  }

  /* ── Internal read/write ────────────────────────────────── */
  function _get(key) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
    catch(e) { return null; }
  }

  function _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e) { return false; }
  }

  /* ── Init: write seed data if keys are absent ───────────── */
  function init() {
    if (!localStorage.getItem(KEYS.CASES)) {
      var allCases = _seedClosedCases().concat(_PENDING);
      _set(KEYS.CASES, allCases);
    }
    if (!localStorage.getItem(KEYS.DOCTORS)) {
      _set(KEYS.DOCTORS, _DOCTORS_SEED);
    }
    if (!localStorage.getItem(KEYS.AVAILABILITY)) {
      _set(KEYS.AVAILABILITY, {});
    }
    if (!localStorage.getItem(KEYS.DHIS2_LOG)) {
      _set(KEYS.DHIS2_LOG, _seedDHIS2Log(_get(KEYS.CASES) || []));
    }
    if (!localStorage.getItem(KEYS.SESSIONS)) {
      _set(KEYS.SESSIONS, {});
    }
  }

  /* ── Reset: wipe all keys and re-seed ───────────────────── */
  function reset() {
    Object.keys(KEYS).forEach(function(k) { localStorage.removeItem(KEYS[k]); });
    init();
    return true;
  }

  /* ── Case API ───────────────────────────────────────────── */
  function getCases()        { return _get(KEYS.CASES) || []; }
  function getPendingCases() { return getCases().filter(function(c){ return c.status==='pending'; }); }
  function getClosedCases()  { return getCases().filter(function(c){ return c.status==='closed'; }); }

  function getCase(id) {
    return getCases().find(function(c){ return c.id===id; }) || null;
  }

  function addCase(obj) {
    var cases = getCases();
    cases.push(obj);
    _set(KEYS.CASES, cases);
  }

  function updateCase(id, updates) {
    var cases = getCases();
    for (var i=0; i<cases.length; i++) {
      if (cases[i].id === id) {
        var keys = Object.keys(updates);
        for (var k=0; k<keys.length; k++) cases[i][keys[k]] = updates[keys[k]];
        _set(KEYS.CASES, cases);
        return true;
      }
    }
    return false;
  }

  function generateCaseId() {
    var cases = getCases();
    var max = 5;
    cases.forEach(function(c) {
      var n = parseInt((c.id || '').split('-')[2], 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'TC-2026-' + String(max + 1).padStart(4,'0');
  }

  /* ── Doctor API ─────────────────────────────────────────── */
  function getDoctors() { return _get(KEYS.DOCTORS) || []; }

  function updateDoctor(id, updates) {
    var docs = getDoctors();
    for (var i=0; i<docs.length; i++) {
      if (docs[i].id === id) {
        var keys = Object.keys(updates);
        for (var k=0; k<keys.length; k++) docs[i][keys[k]] = updates[keys[k]];
        _set(KEYS.DOCTORS, docs);
        return;
      }
    }
  }

  /* ── Availability API ───────────────────────────────────── */
  function getAvailability()     { return _get(KEYS.AVAILABILITY) || {}; }
  function setAvailability(slots){ _set(KEYS.AVAILABILITY, slots); }

  /* ── DHIS2 log API ──────────────────────────────────────── */
  function getDHIS2Log() { return _get(KEYS.DHIS2_LOG) || []; }

  function addDHIS2Entry(entry) {
    var log = getDHIS2Log();
    log.unshift(entry);
    if (log.length > 100) log = log.slice(0, 100);
    _set(KEYS.DHIS2_LOG, log);
  }

  function updateDHIS2Entry(caseId, updates) {
    var log = getDHIS2Log();
    for (var i=0; i<log.length; i++) {
      if (log[i].case_id === caseId) {
        var keys = Object.keys(updates);
        for (var k=0; k<keys.length; k++) log[i][keys[k]] = updates[keys[k]];
        _set(KEYS.DHIS2_LOG, log);
        return;
      }
    }
  }

  /* ── Session API (patient phone sessions) ───────────────── */
  function saveSession(token, caseId) {
    var sessions = _get(KEYS.SESSIONS) || {};
    sessions[token] = { case_id: caseId, created_at: new Date().toISOString() };
    _set(KEYS.SESSIONS, sessions);
  }

  function getSession(token) {
    var sessions = _get(KEYS.SESSIONS) || {};
    return sessions[token] || null;
  }

  /* ── Stats helper (computed from real data) ─────────────── */
  function getStats() {
    var cases   = getCases();
    var closed  = getClosedCases();
    var doctors = getDoctors();
    var dhisLog = getDHIS2Log();
    var now     = new Date();
    var weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);

    var thisWeek = closed.filter(function(c) {
      return c.closed_at && new Date(c.closed_at) > weekAgo;
    }).length;

    var dhisTotal   = dhisLog.length;
    var dhisSuccess = dhisLog.filter(function(e){ return e.status==='Success'; }).length;
    var dhisRate    = dhisTotal ? ((dhisSuccess/dhisTotal)*100).toFixed(1) : '0.0';

    var rx  = closed.filter(function(c){ return c.pathway==='prescription'; }).length;
    var lab = closed.filter(function(c){ return c.pathway==='lab'; }).length;
    var ref = closed.filter(function(c){ return c.pathway==='referral'; }).length;
    var fu  = closed.filter(function(c){ return c.pathway==='followup'; }).length;
    var na  = closed.filter(function(c){ return c.pathway==='noaction'; }).length;

    return {
      total:           closed.length,
      pending:         getPendingCases().length,
      this_week:       thisWeek,
      active_doctors:  doctors.filter(function(d){ return d.status==='Active'; }).length,
      total_doctors:   doctors.length,
      dhis2_rate:      dhisRate + '%',
      prescriptions:   rx,
      lab_orders:      lab,
      referrals:       ref,
      followups:       fu,
      no_action:       na,
      video_calls:     getCases().filter(function(c){ return c.video_url; }).length
    };
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {
    init:             init,
    reset:            reset,
    getCases:         getCases,
    getPendingCases:  getPendingCases,
    getClosedCases:   getClosedCases,
    getCase:          getCase,
    addCase:          addCase,
    updateCase:       updateCase,
    generateCaseId:   generateCaseId,
    getDoctors:       getDoctors,
    updateDoctor:     updateDoctor,
    getAvailability:  getAvailability,
    setAvailability:  setAvailability,
    getDHIS2Log:      getDHIS2Log,
    addDHIS2Entry:    addDHIS2Entry,
    updateDHIS2Entry: updateDHIS2Entry,
    saveSession:      saveSession,
    getSession:       getSession,
    getStats:         getStats,
    KEYS:             KEYS
  };

})();
