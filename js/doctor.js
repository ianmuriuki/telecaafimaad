/* doctor.js — Doctor interface. Requires db.js loaded first. */
(function () {
  "use strict";

  DB.init();

  var PHARMACIES = [
    "Isha Pharmacy — Mogadishu",
    "Daryeel Chemist — Baidoa",
    "Al-Shifa Pharmacy — Kismayo",
  ];
  var LABS = [
    "Somali Diagnostic Centre — Mogadishu",
    "Health Point Lab — Baidoa",
  ];

  var currentCaseId = null;
  var currentView = "queue";
  var availSlots = DB.getAvailability();

  /* ── DOM refs ─────────────────────────────────────────── */
  var snavItems = document.querySelectorAll(".snav-item");
  var queueBadge = document.getElementById("queueBadge");
  var mobileBadge = document.getElementById("mobileQueueBadge");
  var caseListEl = document.getElementById("caseList");
  var emptyQueue = document.getElementById("emptyQueue");
  var queueMeta = document.getElementById("queueMeta");
  var backToQueue = document.getElementById("backToQueue");
  var intakeDisplay = document.getElementById("intakeDisplay");
  var detailCaseId = document.getElementById("detailCaseId");
  var pathwaySelect = document.getElementById("pathwaySelect");
  var pathwayFields = document.getElementById("pathwayFields");
  var diagInput = document.getElementById("diagInput");
  var clinicalNotes = document.getElementById("clinicalNotes");
  var responseError = document.getElementById("responseError");
  var submitResponseBtn = document.getElementById("submitResponseBtn");
  var myCasesList = document.getElementById("myCasesList");
  var scheduleGrid = document.getElementById("scheduleGrid");
  var mobileMenuBtn = document.getElementById("mobileMenuBtn");
  var mobileViewTitle = document.getElementById("mobileViewTitle");
  var sidebar = document.querySelector(".dr-sidebar");
  var sidebarBackdrop = document.getElementById("sidebarBackdrop");

  /* ── View switching ───────────────────────────────────── */
  function showView(viewId) {
    document.querySelectorAll(".dr-view").forEach(function (v) {
      v.classList.remove("is-active");
    });
    var t = document.getElementById("view-" + viewId);
    if (t) t.classList.add("is-active");
    snavItems.forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-view") === viewId,
      );
    });
    var titles = {
      queue: "Case Queue",
      mycases: "My Cases",
      schedule: "Schedule",
      profile: "Profile",
      casedetail: "Case Detail",
    };
    if (mobileViewTitle) mobileViewTitle.textContent = titles[viewId] || "";
    currentView = viewId;
    if (sidebar) sidebar.classList.remove("is-open");
    if (sidebarBackdrop) sidebarBackdrop.classList.remove("is-visible");
  }

  snavItems.forEach(function (btn) {
    btn.addEventListener("click", function () {
      showView(btn.getAttribute("data-view"));
    });
  });

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", function () {
      var isOpen = sidebar.classList.toggle("is-open");
      if (sidebarBackdrop) sidebarBackdrop.classList.toggle("is-visible", isOpen);
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", function () {
      sidebar.classList.remove("is-open");
      sidebarBackdrop.classList.remove("is-visible");
    });
  }

  /* ── Badge update ─────────────────────────────────────── */
  function updateBadge() {
    var n = DB.getPendingCases().length;
    if (queueBadge) queueBadge.textContent = n;
    if (mobileBadge) mobileBadge.textContent = n;
  }

  /* ── Render queue ─────────────────────────────────────── */
  function renderQueue() {
    var queue = DB.getPendingCases().slice().reverse();
    updateBadge();
    if (queueMeta)
      queueMeta.textContent =
        queue.length + " pending case" + (queue.length !== 1 ? "s" : "");
    caseListEl.innerHTML = "";

    if (queue.length === 0) {
      emptyQueue.classList.remove("hidden");
      return;
    }
    emptyQueue.classList.add("hidden");

    queue.forEach(function (c) {
      var submitted = c.submitted || formatRelativeTime(c.created_at);
      var card = document.createElement("div");
      card.className = "case-card";
      card.innerHTML =
        '<div><div class="cc-id">' +
        c.id +
        "</div></div>" +
        '<div class="cc-meta">' +
        '<span class="cc-patient">' +
        c.sex +
        ", " +
        c.age +
        " yrs — " +
        c.body_area +
        "</span>" +
        '<span class="cc-detail">' +
        (c.symptoms || []).slice(0, 3).join(", ") +
        " · " +
        (c.duration || "") +
        " · " +
        (c.district || "") +
        "</span>" +
        "</div>" +
        '<div class="cc-right">' +
        '<span class="cc-time">' +
        submitted +
        "</span>" +
        '<span class="urgency-badge urgency-' +
        (c.urgency || "low") +
        '">' +
        capitalise(c.urgency || "low") +
        "</span>" +
        "</div>";
      card.addEventListener("click", function () {
        openCase(c.id);
      });
      caseListEl.appendChild(card);
    });
  }

  function formatRelativeTime(iso) {
    if (!iso) return "";
    var diff = (Date.now() - new Date(iso).getTime()) / 60000;
    if (diff < 1) return "Just now";
    if (diff < 60) return Math.round(diff) + " min ago";
    return (
      Math.round(diff / 60) +
      " hour" +
      (Math.round(diff / 60) > 1 ? "s" : "") +
      " ago"
    );
  }

  function capitalise(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }

  /* ── Open case ────────────────────────────────────────── */
  function openCase(id) {
    var c = DB.getCase(id);
    if (!c) return;
    currentCaseId = id;
    detailCaseId.textContent = c.id;
    intakeDisplay.innerHTML = "";

    var rows = [
      ["Case ID", c.id],
      ["Sex & Age", c.sex + ", " + c.age + " years"],
      ["Body Area", c.body_area],
      ["Symptoms", (c.symptoms || []).join(", ")],
      ["Duration", c.duration],
      ["District", c.district],
      ["Patient timezone", "UTC+3 (East Africa Time — Mogadishu)"],
      ["Submitted", formatRelativeTime(c.created_at)],
      ["Complaint", c.complaint],
    ];
    rows.forEach(function (row) {
      var div = document.createElement("div");
      div.className = "intake-row";
      div.innerHTML =
        '<span class="intake-key">' +
        row[0] +
        '</span><span class="intake-val">' +
        row[1] +
        "</span>";
      intakeDisplay.appendChild(div);
    });

    diagInput.value = "";
    pathwaySelect.value = "";
    pathwayFields.innerHTML = "";
    clinicalNotes.value = "";
    responseError.textContent = "";

    if (videoCallIdle && videoCallPending) {
      if (c.video_requested) {
        videoCallIdle.style.display    = 'none';
        videoCallPending.style.display = 'block';
        if (doctorJoinLink) doctorJoinLink.href = c.video_url || '#';
      } else {
        videoCallIdle.style.display    = 'block';
        videoCallPending.style.display = 'none';
      }
    }
    showView("casedetail");
  }

  if (backToQueue)
    backToQueue.addEventListener("click", function () {
      showView("queue");
      renderQueue();
    });

  /* ── Video call handlers ──────────────────────────────── */
  var initiateVideoBtn = document.getElementById('initiateVideoBtn');
  var cancelVideoBtn   = document.getElementById('cancelVideoBtn');
  var doctorJoinLink   = document.getElementById('doctorJoinLink');
  var videoCallIdle    = document.getElementById('videoCallIdle');
  var videoCallPending = document.getElementById('videoCallPending');

  function generateRoomUrl(caseId) {
    var rand = Math.random().toString(36).slice(2, 8);
    return 'https://meet.jit.si/telecaafimaad-' + caseId.toLowerCase() + '-' + rand;
  }

  if (initiateVideoBtn) {
    initiateVideoBtn.addEventListener('click', function () {
      if (!currentCaseId) return;
      var roomUrl = generateRoomUrl(currentCaseId);
      DB.updateCase(currentCaseId, {
        video_url:       roomUrl,
        video_requested: true,
        video_status:    'pending'
      });
      DB.addDHIS2Entry({
        ts:       new Date().toISOString(),
        case_id:  currentCaseId,
        district: (DB.getCase(currentCaseId) || {}).district || 'Banadir',
        status:   'Success',
        code:     200,
        msg:      'Video call initiated — modality updated to Video'
      });
      doctorJoinLink.href = roomUrl;
      videoCallIdle.style.display    = 'none';
      videoCallPending.style.display = 'block';
    });
  }

  if (cancelVideoBtn) {
    cancelVideoBtn.addEventListener('click', function () {
      if (!currentCaseId) return;
      DB.updateCase(currentCaseId, {
        video_url:       null,
        video_requested: false,
        video_status:    null
      });
      videoCallIdle.style.display    = 'block';
      videoCallPending.style.display = 'none';
    });
  }

  /* ── Pathway fields ───────────────────────────────────── */
  function sel(arr) {
    return arr
      .map(function (o) {
        return '<option value="' + o + '">' + o + "</option>";
      })
      .join("");
  }

  pathwaySelect.addEventListener("change", function () {
    var val = pathwaySelect.value;
    pathwayFields.innerHTML = "";
    if (!val) return;
    var block = document.createElement("div");
    block.className = "pathway-fields-block";
    var label = document.createElement("div");
    label.className = "pathway-fields-label";
    label.textContent = capitalise(val) + " Details";
    block.appendChild(label);
    var inner = "";

    if (val === "prescription") {
      inner =
        '<div class="form-group"><label class="form-label">Medication name</label><input type="text" class="form-input" id="pf-med" placeholder="e.g. Paracetamol 500mg"></div>' +
        '<div class="form-group"><label class="form-label">Dosage</label><input type="text" class="form-input" id="pf-dos" placeholder="e.g. 1 tablet"></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Frequency</label><select class="form-select" id="pf-freq"><option value="">Select</option><option>Once daily</option><option>Twice daily</option><option>Three times daily</option><option>As needed</option></select></div>' +
        '<div class="form-group"><label class="form-label">Duration</label><select class="form-select" id="pf-dur"><option value="">Select</option><option>3 days</option><option>5 days</option><option>7 days</option><option>14 days</option><option>Ongoing</option></select></div>' +
        "</div>" +
        '<div class="form-group"><label class="form-label">Pharmacy</label><select class="form-select" id="pf-pharm"><option value="">Select</option>' +
        sel(PHARMACIES) +
        "</select></div>";
    } else if (val === "lab") {
      inner =
        '<div class="form-group"><label class="form-label">Test name</label><input type="text" class="form-input" id="pf-test" placeholder="e.g. Full blood count, Malaria RDT"></div>' +
        '<div class="form-group"><label class="form-label">Laboratory</label><select class="form-select" id="pf-lab"><option value="">Select</option>' +
        sel(LABS) +
        "</select></div>" +
        '<div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="pf-pri"><option>Normal</option><option>Urgent</option></select></div>';
    } else if (val === "referral") {
      inner =
        '<div class="form-group"><label class="form-label">Facility name</label><input type="text" class="form-input" id="pf-fac" placeholder="e.g. Banadir Hospital"></div>' +
        '<div class="form-group"><label class="form-label">Reason for referral</label><textarea class="form-textarea" id="pf-ref" rows="2"></textarea></div>' +
        '<div class="form-group"><label class="form-label">Urgency</label><select class="form-select" id="pf-urg"><option>Routine</option><option>Urgent</option><option>Emergency</option></select></div>';
    } else if (val === "followup") {
      inner =
        '<div class="form-group"><label class="form-label">Follow-up date</label><input type="date" class="form-input" id="pf-date"></div>' +
        '<div class="form-group"><label class="form-label">Instructions for patient</label><textarea class="form-textarea" id="pf-fnotes" rows="2"></textarea></div>';
    } else if (val === "noaction") {
      inner =
        '<div class="form-group"><label class="form-label">Reason</label><textarea class="form-textarea" id="pf-nor" rows="2" placeholder="Explain why no further action is required..."></textarea></div>';
    }

    block.insertAdjacentHTML("beforeend", inner);
    pathwayFields.appendChild(block);
  });

  /* ── Submit response ──────────────────────────────────── */
  submitResponseBtn.addEventListener("click", function () {
    responseError.textContent = "";
    if (!diagInput.value.trim()) {
      responseError.textContent = "Please enter a diagnosis.";
      return;
    }
    if (!pathwaySelect.value) {
      responseError.textContent = "Please select a pathway.";
      return;
    }

    var now = new Date().toISOString();
    var pathwayData = collectPathwayData(pathwaySelect.value);
    var capturedPathway = pathwaySelect.value;

    /* Determine modality before closing the case */
    var precloseCase = DB.getCase(currentCaseId);
    var modalityStr = (precloseCase && precloseCase.video_url) ? 'Video' : 'Text';

    /* Update case in DB */
    DB.updateCase(currentCaseId, {
      status: "closed",
      closed_at: now,
      diagnosis: diagInput.value.trim(),
      pathway: capturedPathway,
      clinical_notes: clinicalNotes.value.trim(),
      pathway_data: pathwayData,
      dhis2_status: "Pending",
      modality: modalityStr.toLowerCase()
    });

    /* Increment doctor case count */
    var docs = DB.getDoctors();
    var doc = docs.find(function (d) {
      return d.name === "Dr. Amina Hassan";
    });
    if (doc) DB.updateDoctor(doc.id, { cases: (doc.cases || 0) + 1 });

    /* Add DHIS2 push log entry as Pending */
    var caseObj = DB.getCase(currentCaseId);
    DB.addDHIS2Entry({
      ts: now,
      case_id: currentCaseId,
      district: caseObj ? caseObj.district : "Banadir",
      status: "Pending",
      code: 0,
      msg: "Push queued — processing",
    });

    /* Simulate DHIS2 push after 2.5 seconds */
    var closedId = currentCaseId;
    setTimeout(function () {
      var success = Math.random() > 0.08; /* 92% success rate */
      DB.updateCase(closedId, { dhis2_status: success ? "Pushed" : "Failed" });
      DB.updateDHIS2Entry(closedId, {
        status: success ? "Success" : "Failed",
        code: success ? 200 : 422,
        msg: success
          ? 'Tracked entity created — modality: ' + modalityStr + ' — pathway: ' + capturedPathway
          : "Option set validation error — diagnosis code not found",
      });
      if (currentView === "mycases") renderMyCases();
    }, 2500);

    currentCaseId = null;
    renderQueue();
    renderMyCases();
    showView("queue");
  });

  function collectPathwayData(pathway) {
    var data = {};
    var get = function (id) {
      var el = document.getElementById(id);
      return el ? el.value : "";
    };
    if (pathway === "prescription") {
      data = {
        medication: get("pf-med"),
        dosage: get("pf-dos"),
        frequency: get("pf-freq"),
        duration: get("pf-dur"),
        pharmacy: get("pf-pharm"),
      };
    } else if (pathway === "lab") {
      data = {
        test: get("pf-test"),
        lab: get("pf-lab"),
        priority: get("pf-pri"),
      };
    } else if (pathway === "referral") {
      data = {
        facility: get("pf-fac"),
        reason: get("pf-ref"),
        urgency: get("pf-urg"),
      };
    } else if (pathway === "followup") {
      data = { date: get("pf-date"), notes: get("pf-fnotes") };
    } else if (pathway === "noaction") {
      data = { reason: get("pf-nor") };
    }
    return data;
  }

  /* ── My Cases ─────────────────────────────────────────── */
  function renderMyCases() {
    var closed = DB.getClosedCases();
    myCasesList.innerHTML = "";
    var cls = {
      Pushed: "status-active",
      Pending: "status-pending",
      Failed: "status-failed",
    };
    closed.slice(0, 20).forEach(function (c) {
      var div = document.createElement("div");
      div.className = "closed-case-card";
      var dhis = c.dhis2_status || "Pushed";
      div.innerHTML =
        '<span class="ccc-id">' +
        c.id +
        "</span>" +
        '<div><div class="ccc-diag">' +
        (c.diagnosis || "—") +
        "</div>" +
        '<div class="ccc-detail">' +
        capitalise(c.pathway || "") +
        " · " +
        (c.closed_at || "").slice(0, 10) +
        "</div></div>" +
        '<span class="status-badge ' +
        (cls[dhis] || "status-closed") +
        '">' +
        dhis +
        "</span>";
      myCasesList.appendChild(div);
    });
  }

  /* ── Schedule ─────────────────────────────────────────── */
  function buildSchedule() {
    function utcToTz(utcHour, tz) {
      try {
        var d = new Date();
        d.setUTCHours(utcHour, 0, 0, 0);
        return d.toLocaleTimeString('en', { timeZone: tz, hour: '2-digit',
          minute: '2-digit', hour12: false });
      } catch(e) { return utcHour + ':00'; }
    }

    var tzSel = document.getElementById('tzSelect');
    if (tzSel && tzSel.options.length === 0) {
      var tzones = [
        'UTC', 'America/Toronto', 'America/New_York', 'America/Los_Angeles',
        'America/Minneapolis', 'Europe/London', 'Europe/Paris', 'Europe/Oslo',
        'Asia/Dubai', 'Africa/Nairobi', 'Africa/Mogadishu'
      ];
      var browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      tzones.forEach(function(tz) {
        var opt = document.createElement('option');
        opt.value = tz;
        opt.textContent = tz.replace('_', ' ');
        if (tz === browserTz || (browserTz.includes('Toronto') && tz === 'America/Toronto')) {
          opt.selected = true;
        }
        tzSel.appendChild(opt);
      });
      tzSel.addEventListener('change', function() {
        scheduleGrid.innerHTML = '';
        buildSchedule();
      });
    }

    var selectedTz = tzSel ? tzSel.value : 'UTC';

    var days = [];
    var now = new Date();
    var sun = new Date(now);
    sun.setDate(sun.getDate() - sun.getDay());
    var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (var d = 0; d < 7; d++) {
      var dd = new Date(sun);
      dd.setDate(sun.getDate() + d);
      days.push({
        name: dayNames[d],
        date: dd.getDate() + "/" + (dd.getMonth() + 1),
      });
    }
    var times = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

    var hdr = document.createElement("div");
    hdr.className = "schedule-header-row";
    hdr.innerHTML = '<div class="schedule-col-head">UTC</div>';
    days.forEach(function (d) {
      hdr.innerHTML +=
        '<div class="schedule-col-head">' + d.name + "<br>" + d.date + "</div>";
    });
    scheduleGrid.appendChild(hdr);

    times.forEach(function (time) {
      var row = document.createElement("div");
      row.className = "schedule-time-row";
      row.innerHTML = '<div class="schedule-time-label">' +
        '<span style="font-weight:600">' + time + '</span>' +
        '<span style="font-size:0.7rem;color:#9A9790;display:block">' +
        utcToTz(parseInt(time), selectedTz) + ' local</span>' +
        '</div>';
      days.forEach(function (d) {
        var key = d.date + "-" + time;
        var slot = document.createElement("div");
        slot.className =
          "schedule-slot" + (availSlots[key] ? " available" : "");
        slot.addEventListener("click", function () {
          availSlots[key] = !availSlots[key];
          slot.classList.toggle("available", !!availSlots[key]);
          DB.setAvailability(availSlots);
        });
        row.appendChild(slot);
      });
      scheduleGrid.appendChild(row);
    });
  }

  /* ── Init ───────────────────────────────────────────────── */
  renderQueue();
  renderMyCases();
  buildSchedule();
  showView('queue');

  window.addEventListener('storage', function (e) {
    if (e.key === 'tc_cases') {
      renderQueue();
      renderMyCases();
      if (document.getElementById('queueBadge')) {
        document.getElementById('queueBadge').textContent = DB.getPendingCases().length;
      }
    }
  });

  /* Poll every 3 s — catches new cases even if storage event was missed */
  var _lastCount = DB.getPendingCases().length;
  setInterval(function () {
    var n = DB.getPendingCases().length;
    if (n !== _lastCount) {
      _lastCount = n;
      renderQueue();
      renderMyCases();
    }
  }, 3000);

})();
