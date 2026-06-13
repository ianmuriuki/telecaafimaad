/* patient.js — Private Patient flow. Requires db.js loaded first. */
(function () {
  'use strict';

  DB.init();

  /* ── State ─────────────────────────────────────────────── */
  var currentStep = 1;
  var state = {
    patientId:   '',
    patientName: '',
    phone:       '',
    email:       '',
    age:         0,
    sex:         '',
    langPref:    'English',
    doctor:      null,
    symptoms:    [],
    bodyArea:    '',
    duration:    '',
    complaint:   '',
    consultType: 'text',
    totalFee:    0,
    payMethod:   'EVC Plus',
    payRef:      '',
    caseId:      ''
  };

  /* ── Language toggle (default EN for private patients) ─── */
  var currentLang = 'en';
  document.getElementById('langToggle').addEventListener('click', function () {
    currentLang = currentLang === 'en' ? 'so' : 'en';
    document.body.classList.toggle('lang-en', currentLang === 'en');
    document.body.classList.toggle('lang-so', currentLang === 'so');
    this.textContent = currentLang === 'en' ? 'SO' : 'EN';
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
      el.classList.remove('active', 'done');
      if (s === n) el.classList.add('active');
      if (s < n)   el.classList.add('done');
    });
    currentStep = n;
    window.scrollTo(0, 0);
  }

  /* ── ID generators ─────────────────────────────────────── */
  function rand4() { return Math.floor(1000 + Math.random() * 9000); }

  function generatePatientId() { return 'PP-' + rand4() + '-' + rand4(); }

  function generateCaseRef() { return 'TC-PRIV-' + rand4(); }

  function generatePayRef() {
    return 'TC-PAY-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  /* ── Utility ────────────────────────────────────────────── */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var MOBILE_METHODS = ['EVC Plus', 'ZAAD', 'Sahal'];

  /* ── Step 1: Account Setup ─────────────────────────────── */
  document.getElementById('step1Btn').addEventListener('click', function () {
    var err   = document.getElementById('step1Error');
    err.textContent = '';

    var name  = document.getElementById('pp-name').value.trim();
    var phone = document.getElementById('pp-phone').value.trim().replace(/\s+/g, '');
    var email = document.getElementById('pp-email').value.trim();
    var age   = parseInt(document.getElementById('pp-age').value, 10);
    var sex   = document.getElementById('pp-sex').value;
    var lang  = document.getElementById('pp-lang').value;
    var pw    = document.getElementById('pp-pw').value;
    var pw2   = document.getElementById('pp-pw2').value;

    if (!name)                        { err.textContent = 'Full name is required.'; return; }
    if (!phone || phone.length < 7)   { err.textContent = 'A valid phone number is required.'; return; }
    if (!age || age < 1 || age > 120) { err.textContent = 'Please enter a valid age.'; return; }
    if (!sex)                         { err.textContent = 'Please select your sex.'; return; }
    if (!pw || pw.length < 8)         { err.textContent = 'Password must be at least 8 characters.'; return; }
    if (pw !== pw2)                   { err.textContent = 'Passwords do not match.'; return; }

    state.patientId   = generatePatientId();
    state.patientName = name;
    state.phone       = phone;
    state.email       = email;
    state.age         = age;
    state.sex         = sex;
    state.langPref    = lang;

    DB.addPatient({
      id:          state.patientId,
      name:        name,
      phone:       '+252' + phone,
      email:       email || null,
      dob:         null,
      age:         age,
      sex:         sex,
      district:    'Private',
      facility_id: null,
      type:        'private',
      lang_pref:   lang,
      allergies:   [],
      chronic_conditions: [],
      insurance:   null,
      nid:         null,
      created_at:  new Date().toISOString()
    });

    goToStep(2);
  });

  document.getElementById('signInLink').addEventListener('click', function (e) {
    e.preventDefault();
    alert('Sign-in is not available in the pilot demo. Please create a new account.');
  });

  /* ── Step 2: Doctor selection ──────────────────────────── */
  document.querySelectorAll('.pp-doc-card').forEach(function (card) {
    card.addEventListener('click', function () {
      document.querySelectorAll('.pp-doc-card').forEach(function (c) {
        c.classList.remove('is-selected');
      });
      card.classList.add('is-selected');
      state.doctor = {
        id:   parseInt(card.getAttribute('data-id'), 10),
        name: card.getAttribute('data-name'),
        spec: card.getAttribute('data-spec'),
        loc:  card.getAttribute('data-loc'),
        fee:  parseInt(card.getAttribute('data-fee'), 10)
      };
    });
  });

  document.getElementById('step2Btn').addEventListener('click', function () {
    var err = document.getElementById('step2Error');
    err.textContent = '';

    if (!state.doctor) {
      err.textContent = 'Please select a doctor.';
      return;
    }

    var symptoms = Array.from(
      document.querySelectorAll('#ppSymptomsGrid input[type="checkbox"]:checked')
    ).map(function (cb) { return cb.value; });

    if (symptoms.length === 0) {
      err.textContent = 'Please select at least one symptom.';
      return;
    }

    state.bodyArea    = document.getElementById('pp-body').value;
    state.duration    = document.getElementById('pp-duration').value;
    state.complaint   = document.getElementById('pp-complaint').value.trim();
    state.symptoms    = symptoms;
    state.consultType = document.getElementById('pp-type').value;
    state.totalFee    = state.doctor.fee + (state.consultType === 'video' ? 10 : 0);

    buildPaymentSummary();
    goToStep(3);
  });

  /* ── Step 3: Payment ───────────────────────────────────── */
  function buildPaymentSummary() {
    var videoLine = state.consultType === 'video'
      ? '<div style="display:flex;justify-content:space-between;font-size:var(--t-sm);' +
        'color:var(--ink-2);margin-top:0.3rem"><span>Video call surcharge</span><span>+$10</span></div>'
      : '';

    document.getElementById('paymentSummary').innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:baseline;' +
        'margin-bottom:0.4rem">' +
        '<span style="font-weight:700;color:var(--ink)">' + esc(state.doctor.name) + '</span>' +
        '<span style="font-size:var(--t-xs);color:var(--ink-3)">' + esc(state.doctor.spec) + '</span>' +
      '</div>' +
      '<div style="font-size:var(--t-sm);color:var(--ink-2)">' + esc(state.doctor.loc) + '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:var(--t-sm);' +
        'color:var(--ink-2);margin-top:var(--s2)">' +
        '<span>Consultation type</span>' +
        '<span>' + (state.consultType === 'video' ? 'Video Call' : 'Text (Async)') + '</span>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:var(--t-sm);' +
        'color:var(--ink-2);margin-top:0.3rem">' +
        '<span>Consultation fee</span><span>$' + state.doctor.fee + '</span>' +
      '</div>' +
      videoLine +
      '<div class="pp-summary-total">Total: $' + state.totalFee + '</div>';

    syncPayBtn();
  }

  function syncPayBtn() {
    var checked = document.querySelector('input[name="ppPayMethod"]:checked');
    var method  = checked ? checked.value : 'EVC Plus';
    var label   = method === 'International Card' ? 'Card' : method;
    document.getElementById('step3Btn').textContent =
      'Pay $' + state.totalFee + ' via ' + label;
  }

  document.querySelectorAll('input[name="ppPayMethod"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      state.payMethod = this.value;
      var isMobile    = MOBILE_METHODS.indexOf(this.value) > -1;
      document.getElementById('mobileMoneyFields').classList.toggle('hidden', !isMobile);
      document.getElementById('cardFields').classList.toggle('hidden', isMobile);
      syncPayBtn();
    });
  });

  document.getElementById('step3Btn').addEventListener('click', function () {
    var err = document.getElementById('step3Error');
    err.textContent = '';

    var method   = (document.querySelector('input[name="ppPayMethod"]:checked') || {}).value || 'EVC Plus';
    var isMobile = MOBILE_METHODS.indexOf(method) > -1;

    if (isMobile) {
      var payPhone = document.getElementById('pp-pay-phone').value.trim().replace(/\s+/g, '');
      if (!payPhone || payPhone.length < 7) {
        err.textContent = 'Please enter your payment phone number.';
        return;
      }
    } else {
      var cardNum = document.getElementById('pp-card-num').value.replace(/\D/g, '');
      var cardExp = document.getElementById('pp-card-exp').value.trim();
      var cardCvv = document.getElementById('pp-card-cvv').value.trim();
      if (cardNum.length < 16 || !cardExp || cardCvv.length < 3) {
        err.textContent = 'Please complete all card fields.';
        return;
      }
    }

    state.payMethod = method;
    this.disabled = true;

    var processing = document.getElementById('payProcessing');
    processing.classList.remove('hidden');

    setTimeout(function () {
      processing.classList.add('hidden');

      var ref = generatePayRef();
      state.payRef = ref;

      var successEl = document.getElementById('paySuccess');
      successEl.textContent =
        'Payment of $' + state.totalFee + ' received. Reference: ' + ref;
      successEl.classList.remove('hidden');

      setTimeout(function () {
        saveConsultation();
        buildConfirmation();
        goToStep(4);
      }, 1500);
    }, 2000);
  });

  /* ── Persist to DB ─────────────────────────────────────── */
  function saveConsultation() {
    var ref = generateCaseRef();
    state.caseId = ref;

    DB.addCase({
      id:                 ref,
      status:             'pending',
      created_at:         new Date().toISOString(),
      patient_id:         state.patientId,
      patient_name:       state.patientName,
      facility_id:        null,
      age:                state.age,
      sex:                state.sex,
      body_area:          state.bodyArea || 'General',
      symptoms:           state.symptoms,
      duration:           state.duration || 'Not specified',
      complaint:          state.complaint || 'No additional detail provided.',
      district:           'Private',
      urgency:            'medium',
      type:               state.consultType,
      assigned_doctor:    state.doctor.name,
      assigned_doctor_id: state.doctor.id,
      specialty:          state.doctor.spec,
      diagnosis:          null,
      pathway:            null,
      clinical_notes:     null,
      pathway_data:       {},
      dhis2_status:       null,
      video_url:          null,
      video_requested:    state.consultType === 'video',
      video_status:       null,
      referral_id:        null,
      closed_at:          null,
      fee_paid:           state.totalFee,
      pay_method:         state.payMethod,
      pay_ref:            state.payRef,
      case_type:          'private'
    });
  }

  /* ── Step 4: Confirmation ──────────────────────────────── */
  function buildConfirmation() {
    var estimatedResponse;
    if (state.consultType === 'video') {
      var t = new Date(Date.now() + 2 * 60 * 60 * 1000);
      estimatedResponse = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' today (EAT)';
    } else {
      estimatedResponse = 'Within 24 hours';
    }

    var rows = [
      ['Patient ID',         state.patientId],
      ['Consultation Ref',   state.caseId],
      ['Doctor',             state.doctor.name + ' · ' + state.doctor.spec],
      ['Consultation Type',  state.consultType === 'video' ? 'Video Call' : 'Text (Async)'],
      ['Estimated Response', estimatedResponse],
      ['Payment Reference',  state.payRef],
      ['Amount Paid',        '$' + state.totalFee + ' via ' + state.payMethod]
    ];

    document.getElementById('confirmBox').innerHTML = rows.map(function (r) {
      return '<div class="pp-confirm-row">' +
        '<span class="pp-confirm-label">' + esc(r[0]) + '</span>' +
        '<span class="pp-confirm-value">'  + esc(r[1]) + '</span>' +
        '</div>';
    }).join('');

    document.getElementById('confirmPhoneNote').textContent =
      'You will receive confirmation on +252' + state.phone + '.';
  }

  document.getElementById('bookAnotherBtn').addEventListener('click', function () {
    /* reset state (keep patient identity) */
    state.doctor      = null;
    state.symptoms    = [];
    state.bodyArea    = '';
    state.duration    = '';
    state.complaint   = '';
    state.consultType = 'text';
    state.totalFee    = 0;
    state.payMethod   = 'EVC Plus';
    state.payRef      = '';
    state.caseId      = '';

    /* reset step 2 inputs */
    document.querySelectorAll('.pp-doc-card').forEach(function (c) { c.classList.remove('is-selected'); });
    document.querySelectorAll('#ppSymptomsGrid input[type="checkbox"]').forEach(function (el) { el.checked = false; });
    document.getElementById('pp-body').value      = '';
    document.getElementById('pp-duration').value  = '';
    document.getElementById('pp-complaint').value = '';
    document.getElementById('pp-type').value      = 'text';
    document.getElementById('step2Error').textContent = '';

    /* reset step 3 inputs */
    document.getElementById('pp-pay-phone').value = '';
    document.getElementById('pp-card-num').value  = '';
    document.getElementById('pp-card-exp').value  = '';
    document.getElementById('pp-card-cvv').value  = '';
    document.getElementById('step3Error').textContent = '';
    document.getElementById('step3Btn').disabled  = false;
    document.getElementById('payProcessing').classList.add('hidden');
    document.getElementById('paySuccess').classList.add('hidden');
    document.getElementById('mobileMoneyFields').classList.remove('hidden');
    document.getElementById('cardFields').classList.add('hidden');

    /* reset radio to first option */
    var firstRadio = document.querySelector('input[name="ppPayMethod"]');
    if (firstRadio) firstRadio.checked = true;

    goToStep(2);
  });

  /* ── Init ───────────────────────────────────────────────── */
  goToStep(1);

})();
