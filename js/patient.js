/* patient.js — Patient interface. Requires db.js loaded first. */
(function () {
  'use strict';

  DB.init();

  var currentStep  = 1;
  var currentLang  = 'so';
  var sessionToken = '';
  var submittedId  = '';

  /* ── DOM refs ─────────────────────────────────────────── */
  var langToggle    = document.getElementById('langToggle');
  var sendCodeBtn   = document.getElementById('sendCodeBtn');
  var otpSection    = document.getElementById('otpSection');
  var otpSentMsg    = document.getElementById('otpSentMsg');
  var phoneInput    = document.getElementById('phoneInput');
  var phoneError    = document.getElementById('phoneError');
  var otpInput      = document.getElementById('otpInput');
  var otpError      = document.getElementById('otpError');
  var verifyBtn     = document.getElementById('verifyBtn');
  var submitCaseBtn = document.getElementById('submitCaseBtn');
  var intakeError   = document.getElementById('intakeError');
  var caseRef       = document.getElementById('caseRef');
  var viewResultBtn = document.getElementById('viewResultBtn');

  /* ── Language toggle ────────────────────────────────────── */
  langToggle.addEventListener('click', function () {
    currentLang = currentLang === 'so' ? 'en' : 'so';
    document.body.classList.toggle('lang-so', currentLang === 'so');
    document.body.classList.toggle('lang-en', currentLang === 'en');
  });

  /* ── Step navigation ────────────────────────────────────── */
  function goToStep(n) {
    document.querySelectorAll('.p-step').forEach(function (el) {
      el.classList.remove('active');
    });
    var t = document.getElementById('step' + n);
    if (t) t.classList.add('active');
    document.querySelectorAll('.progress-step').forEach(function (el) {
      var s = parseInt(el.getAttribute('data-step'), 10);
      el.classList.remove('active','done');
      if (s === n) el.classList.add('active');
      if (s < n)   el.classList.add('done');
    });
    currentStep = n;
    window.scrollTo(0, 0);
  }

  /* ── Step 1: Phone ──────────────────────────────────────── */
  sendCodeBtn.addEventListener('click', function () {
    phoneError.textContent = '';
    var raw = phoneInput.value.trim().replace(/\s+/g,'');
    if (!raw || raw.length < 8) {
      phoneError.textContent = currentLang==='so'
        ? 'Fadlan lambar saxda ah gali.'
        : 'Please enter a valid phone number.';
      return;
    }
    var mockCode = Math.floor(100000 + Math.random() * 900000);
    otpSentMsg.textContent = currentLang==='so'
      ? 'Kood loo diray +252' + raw + ': ' + mockCode + ' (demo)'
      : 'Code sent to +252' + raw + ': ' + mockCode + ' (demo)';
    otpSection.classList.remove('hidden');
    sendCodeBtn.disabled = true;
    otpInput.focus();
  });

  verifyBtn.addEventListener('click', function () {
    otpError.textContent = '';
    var code = otpInput.value.trim();
    if (!code || code.length < 6 || !/^\d+$/.test(code)) {
      otpError.textContent = currentLang==='so'
        ? 'Fadlan lambarka 6-xarafka gali.'
        : 'Please enter the 6-digit code.';
      return;
    }
    sessionToken = 'SES-' + Date.now().toString(36).toUpperCase();
    goToStep(2);
  });

  otpInput.addEventListener('keydown', function(e){ if(e.key==='Enter') verifyBtn.click(); });
  phoneInput.addEventListener('keydown', function(e){ if(e.key==='Enter') sendCodeBtn.click(); });

  /* ── Step 2: Intake ─────────────────────────────────────── */
  submitCaseBtn.addEventListener('click', function () {
    intakeError.textContent = '';

    var bodyArea = document.getElementById('bodyArea').value;
    var duration = document.getElementById('duration').value;
    var age      = document.getElementById('ageInput').value;
    var sex      = document.getElementById('sexSelect').value;
    var complaint= document.getElementById('complaint').value.trim();
    var symptoms = Array.from(
      document.querySelectorAll('#symptomsGrid input[type="checkbox"]:checked')
    ).map(function(cb){ return cb.value; });

    if (!bodyArea || !duration || !age || !sex) {
      intakeError.textContent = currentLang==='so'
        ? 'Fadlan dhammaan meelaha lagaab ka buuxi.'
        : 'Please complete all required fields.';
      return;
    }
    if (symptoms.length === 0) {
      intakeError.textContent = currentLang==='so'
        ? 'Fadlan ugu yaraan calaamad hal ah dooro.'
        : 'Please select at least one symptom.';
      return;
    }

    var newId = DB.generateCaseId();
    submittedId = newId;

    /* urgency heuristic */
    var urgency = 'low';
    if (symptoms.indexOf('fever') > -1 || symptoms.indexOf('breath') > -1) urgency = 'high';
    else if (symptoms.indexOf('vomiting') > -1 || symptoms.indexOf('dizziness') > -1 || parseInt(age,10) < 12) urgency = 'medium';

    var newCase = {
      id:              newId,
      status:          'pending',
      created_at:      new Date().toISOString(),
      age:             parseInt(age, 10),
      sex:             sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : 'Unspecified',
      body_area:       bodyArea.charAt(0).toUpperCase() + bodyArea.slice(1),
      symptoms:        symptoms.map(function(s){ return s.charAt(0).toUpperCase()+s.slice(1); }),
      duration:        duration,
      complaint:       complaint || 'No additional detail provided.',
      district:        'Banadir',
      urgency:         urgency,
      assigned_doctor: 'Dr. Amina Hassan',
      specialty:       'Cardiology',
      submitted:       'Just now'
    };

    DB.addCase(newCase);
    DB.saveSession(sessionToken, newId);

    caseRef.textContent = newId;
    goToStep(3);
    var _pollInterval = setInterval(function () {
      var c = DB.getCase(submittedId);
      if (!c) return;
      if (c.status === 'closed') {
        var el = document.getElementById('responseReady');
        if (el) el.style.display = 'block';
        clearInterval(_pollInterval);
      } else if (c.video_url && c.video_requested === true) {
        var inv = document.getElementById('videoInvite');
        var lnk = document.getElementById('videoJoinLink');
        if (inv && lnk) { lnk.href = c.video_url; inv.style.display = 'block'; }
        clearInterval(_pollInterval);
      }
    }, 3000);
  });

  /* ── Step 3: View result ────────────────────────────────── */
  viewResultBtn.addEventListener('click', function () {
    var session  = DB.getSession(sessionToken);
    var liveCase = session ? DB.getCase(session.case_id) : null;

    if (liveCase && liveCase.status === 'closed' && liveCase.diagnosis) {
      /* Real response exists — overwrite the mock content */
      var noteEnEl = document.querySelector('#step4 .result-note-text .t-en');
      var noteSoEl = document.querySelector('#step4 .result-note-text .t-so');
      var diagEl   = document.querySelector('#step4 .diag-value');

      if (noteEnEl) noteEnEl.textContent = liveCase.clinical_notes || 'Assessment complete.';
      if (noteSoEl) noteSoEl.textContent = liveCase.clinical_notes || 'Baaritaanka la dhameystay.';
      if (diagEl)   diagEl.textContent   = liveCase.diagnosis;

      /* Update pathway card if prescription */
      if (liveCase.pathway === 'prescription' && liveCase.pathway_data) {
        var pd = liveCase.pathway_data;
        var rows = document.querySelectorAll('#step4 .pd-value');
        if (rows[0]) rows[0].textContent = pd.medication  || rows[0].textContent;
        if (rows[1]) rows[1].textContent = (pd.dosage || '') + (pd.frequency ? ' — ' + pd.frequency : '');
        if (rows[2]) rows[2].textContent = pd.duration  || rows[2].textContent;
        if (rows[3]) rows[3].textContent = pd.pharmacy  || rows[3].textContent;
      }
    }
    goToStep(4);
  });

  /* ── Init ───────────────────────────────────────────────── */
  goToStep(1);

})();
