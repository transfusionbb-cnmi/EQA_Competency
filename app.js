const API_URL = window.API_URL;
let currentUser = null;
let currentPage = "dashboard";
let pendingSubmit = null;

const mockCases = [
  { caseId: "JE14", program: "J/JE1", year: "2026", round: "B", month: "June", status: "OPEN", title: "Dry Challenge - JE-14" },
  { caseId: "DAT-A", program: "DAT", year: "2026", round: "A", month: "February", status: "ANSWER_RELEASED", title: "Direct Antiglobulin Testing - A" }
];

const sampleQuestionsJE14 = [
  {
    questionNo: "1",
    questionText: "What is the most appropriate interpretation of the patient's results?",
    choices: [
      { code: "315", text: "The patient is an A1 blood type and has detectable anti-A1 antibodies." },
      { code: "316", text: "The patient is an A1 blood type and has detectable warm autoantibodies." },
      { code: "317", text: "The patient is a non-A1 blood type and has naturally-occurring anti-A1 antibodies." },
      { code: "318", text: "The patient converted to a group O blood type and has naturally-occurring anti-A1 antibodies." }
    ]
  },
  {
    questionNo: "2",
    questionText: "Which of the following is the most likely source of the detected antibodies?",
    choices: [
      { code: "319", text: "Naturally-occurring anti-A1 antibodies of recipient origin" },
      { code: "320", text: "Passive administration from intravenous immune globulin received six months prior" },
      { code: "321", text: "Passive administration from transfusion of out-of-group blood products" },
      { code: "322", text: "Passenger lymphocyte syndrome (PLS) from the minor ABO-incompatible lung transplant" }
    ]
  },
  {
    questionNo: "3",
    questionText: "Based on the case study findings, which RBCs should be crossmatched and issued to the patient?",
    choices: [
      { code: "323", text: "Group O, Rh-negative RBCs" },
      { code: "324", text: "Group O, Rh-positive RBCs" },
      { code: "325", text: "Group A, Rh-negative RBCs" },
      { code: "326", text: "Group A, Rh-positive RBCs" }
    ]
  },
  {
    questionNo: "4",
    questionText: "The clinical team considered various potential causes of hemolytic anemia and initiated first-line treatment for suspected PLS. Which cells are responsible for causing PLS?",
    choices: [
      { code: "327", text: "Donor B lymphocytes" },
      { code: "328", text: "Donor T lymphocytes" },
      { code: "329", text: "Recipient B lymphocytes" },
      { code: "330", text: "Recipient T lymphocytes" }
    ]
  }
];

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  showLogin();
});

function bindEvents() {
  document.querySelectorAll(".login-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".login-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("loginPanel").classList.toggle("hidden", btn.dataset.tab !== "loginPanel");
      document.getElementById("registerPanel").classList.toggle("hidden", btn.dataset.tab !== "registerPanel");
    });
  });

  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("registerBtn").addEventListener("click", registerFirstTime);
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("toggleSidebar").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentPage = btn.dataset.page;
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("sidebar").classList.remove("open");
      renderPage();
    });
  });

  document.getElementById("modalCancel").addEventListener("click", closeModal);
  document.getElementById("modalConfirm").addEventListener("click", () => {
    if (pendingSubmit) pendingSubmit();
    closeModal();
  });
}

function validMahidolEmail(email) {
  return String(email || "").trim().toLowerCase().endsWith("@mahidol.ac.th");
}

async function api(action, payload = {}) {
  if (!API_URL || API_URL.includes("PASTE_APPS_SCRIPT")) {
    if (action === "register") return { ok:true, user:{ email:payload.email, empCode:payload.empCode, fullName:payload.fullName, role:"staff" } };
    if (action === "loginWithPassword") return { ok:true, user:{ email:payload.email, empCode:"demo", fullName:"Demo User", role:"staff" } };
    return { ok:true };
  }
  const res = await fetch(API_URL, { method:"POST", body: JSON.stringify({ action, ...payload }) });
  return await res.json();
}

async function registerFirstTime() {
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const fullName = document.getElementById("regFullName").value.trim();
  const empCode = document.getElementById("regEmpCode").value.trim();
  const password = document.getElementById("regPassword").value;
  const password2 = document.getElementById("regPassword2").value;

  if (!validMahidolEmail(email)) return showInfoModal("อีเมลไม่ถูกต้อง", "ใช้ได้เฉพาะอีเมลที่ลงท้ายด้วย @mahidol.ac.th", false);
  if (!fullName || !empCode) return showInfoModal("ข้อมูลไม่ครบ", "กรุณากรอกชื่อ-สกุล และรหัสพนักงาน", false);
  if (password.length < 6) return showInfoModal("รหัสผ่านสั้นเกินไป", "รหัสผ่านควรมีอย่างน้อย 6 ตัวอักษร", false);
  if (password !== password2) return showInfoModal("รหัสผ่านไม่ตรงกัน", "กรุณาตรวจสอบรหัสผ่านอีกครั้ง", false);

  const result = await api("register", { email, fullName, empCode, password });
  if (!result.ok) return showInfoModal("สมัครไม่สำเร็จ", result.message || "เกิดข้อผิดพลาด", false);
  setLoggedIn(result.user);
}

async function login() {
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  if (!validMahidolEmail(email)) return showInfoModal("อีเมลไม่ถูกต้อง", "ใช้ได้เฉพาะอีเมลที่ลงท้ายด้วย @mahidol.ac.th", false);
  if (!password) return showInfoModal("กรุณากรอกรหัสผ่าน", "ต้องกรอกรหัสผ่านก่อนเข้าสู่ระบบ", false);

  const result = await api("loginWithPassword", { email, password });
  if (!result.ok) return showInfoModal("เข้าสู่ระบบไม่สำเร็จ", result.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง", false);
  setLoggedIn(result.user);
}

function setLoggedIn(user) {
  currentUser = user;
  document.getElementById("currentUserName").textContent = user.fullName;
  document.getElementById("currentUserRole").textContent = `${user.role} | ${user.email}`;
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  renderPage();
}

function showLogin() {
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}


function renderPage() {
  const titleMap = {
    dashboard: "Dashboard",
    cases: "Cases 2026",
    myAnswers: "My Answers",
    reflection: "Reflection",
    qmReview: "QM Review",
    physicianAck: "Physician Acknowledge",
    reports: "Reports",
    admin: "Admin"
  };

  document.getElementById("pageTitle").textContent = titleMap[currentPage] || "Dashboard";

  const renderer = {
    dashboard: renderDashboard,
    cases: renderCases,
    myAnswers: renderMyAnswers,
    reflection: renderReflection,
    qmReview: renderQMReview,
    physicianAck: renderPhysicianAck,
    reports: renderReports,
    admin: renderAdmin
  }[currentPage];

  renderer();
}

function renderDashboard() {
  const html = `
    <div class="grid">
      <div class="stat"><span>Cases 2026</span><strong>25</strong><small>ตามแผน EQA ปี 2026</small></div>
      <div class="stat"><span>Open</span><strong>1</strong><small>กำลังเปิดให้ตอบ</small></div>
      <div class="stat"><span>Answer Released</span><strong>1</strong><small>รอ Reflection</small></div>
      <div class="stat"><span>Completed</span><strong>0</strong><small>แพทย์รับทราบแล้ว</small></div>
    </div>

    <div class="card">
      <h3>Workflow</h3>
      <p class="muted">Admin สร้าง Case → Staff ทำข้อสอบ → Admin ลงเฉลย → Staff Reflection → QM Review → Physician Acknowledge</p>
    </div>

    <div class="card">
      <h3>Cases ล่าสุด</h3>
      ${caseTable(mockCases)}
    </div>
  `;
  setContent(html);
}

function renderCases() {
  setContent(`
    <div class="card">
      <h3>รายการ Case ปี 2026</h3>
      <p class="muted">เลือก Case เพื่อทำข้อสอบ หรือดูสถานะ</p>
      ${caseTable(mockCases, true)}
    </div>
  `);
}

function caseTable(cases, withAction=false) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Program</th>
            <th>Round</th>
            <th>Month</th>
            <th>Status</th>
            ${withAction ? "<th>Action</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${cases.map(c => `
            <tr>
              <td><strong>${c.caseId}</strong><br><small>${c.title}</small></td>
              <td>${c.program}</td>
              <td>${c.round}</td>
              <td>${c.month}</td>
              <td><span class="badge ${statusClass(c.status)}">${c.status}</span></td>
              ${withAction ? `<td><button class="primary-btn" onclick="openCase('${c.caseId}')">เปิด Case</button></td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function openCase(caseId) {
  if (caseId !== "JE14") {
    showInfoModal("ยังไม่ได้ใส่ข้อสอบ", "Case นี้เป็นตัวอย่างโครงสร้าง ยังไม่ได้เพิ่มคำถามจริง", false);
    return;
  }

  setContent(`
    <div class="card">
      <h3>Dry Challenge - JE-14</h3>
      <p class="muted">สถานะ: เปิดให้ตอบ | กด Save Draft ได้ แต่เมื่อ Submit Final Answer แล้วจะล็อกคำตอบทันที</p>
      <div class="question">
        <h4>Case Study</h4>
        <p>A 45-year-old male with interstitial lung disease was admitted for double lung transplant. His pre-operative hemoglobin was 10.2 g/dL...</p>
        <p class="muted">หมายเหตุ: หน้านี้เป็นตัวอย่าง ระบบจริงสามารถแสดง Case Study เต็มตามไฟล์ที่ Admin ใส่</p>
      </div>

      <form id="answerForm">
        ${sampleQuestionsJE14.map(q => questionHtml(q)).join("")}
      </form>

      <div class="no-print" style="display:flex; gap:12px; flex-wrap:wrap; margin-top:18px;">
        <button class="secondary-btn" onclick="saveDraft('JE14')">Save Draft</button>
        <button class="danger-btn" onclick="confirmSubmit('JE14')">Submit Final Answer</button>
      </div>
    </div>
  `);
}

function questionHtml(q) {
  return `
    <div class="question">
      <h4>ข้อ ${q.questionNo}. ${q.questionText}</h4>
      ${q.choices.map(ch => `
        <label class="choice">
          <input type="radio" name="q_${q.questionNo}" value="${ch.code}" />
          <strong>${ch.code}</strong> ${ch.text}
        </label>
      `).join("")}
    </div>
  `;
}

function saveDraft(caseId) {
  showInfoModal("บันทึก Draft แล้ว", "ระบบบันทึกคำตอบฉบับร่างแล้ว สามารถกลับมาแก้ไขได้จนกว่าจะกด Submit Final Answer", false);
}

function confirmSubmit(caseId) {
  showConfirmModal(
    "ยืนยันการส่งคำตอบสุดท้าย",
    "หลังจากกด “ยืนยันส่งคำตอบ” แล้ว ระบบจะล็อกคำตอบทันที และไม่สามารถแก้ไขได้\n\nกรุณาตรวจสอบคำตอบให้ครบถ้วนก่อนส่ง",
    () => {
      showInfoModal("ส่งคำตอบแล้ว", "ระบบล็อกคำตอบเรียบร้อยแล้ว ไม่สามารถแก้ไขคำตอบได้", false);
    }
  );
}

function renderMyAnswers() {
  setContent(`
    <div class="card">
      <h3>My Answers</h3>
      <p class="muted">แสดงคำตอบของเจ้าหน้าที่ที่เข้าสู่ระบบ</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Case</th><th>Status</th><th>Submitted At</th><th>Score</th><th>Action</th></tr></thead>
          <tbody>
            <tr>
              <td>JE14</td>
              <td><span class="badge submitted">SUBMITTED</span></td>
              <td>-</td>
              <td>รอเฉลย</td>
              <td><button class="secondary-btn" onclick="printPersonalReport()">Print Report</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function renderReflection() {
  setContent(`
    <div class="card">
      <h3>Reflection</h3>
      <p class="muted">หลัง Admin Publish เฉลย ระบบจะแสดงเฉพาะข้อที่ตอบผิด เพื่อให้เขียนวิเคราะห์และแนวทางป้องกัน</p>
      <div class="question">
        <h4>ตัวอย่าง: ข้อ 2</h4>
        <p>คุณตอบ: 319</p>
        <p>เฉลย CAP: 322</p>
        <label>สาเหตุที่ตอบผิด
          <textarea placeholder="อธิบายว่าเข้าใจผิดตรงไหน"></textarea>
        </label>
        <label>แนวทางป้องกัน
          <textarea placeholder="จะป้องกันไม่ให้เกิดซ้ำอย่างไร"></textarea>
        </label>
        <button class="primary-btn">บันทึก Reflection</button>
      </div>
    </div>
  `);
}

function renderQMReview() {
  setContent(`
    <div class="card">
      <h3>QM Review</h3>
      <p class="muted">สำหรับ QM ตรวจ Reflection และสรุป Gap ของเจ้าหน้าที่</p>
      <button class="ok-btn">Approve Review</button>
      <button class="secondary-btn">Need More Detail</button>
    </div>
  `);
}

function renderPhysicianAck() {
  setContent(`
    <div class="card">
      <h3>Physician Acknowledge</h3>
      <p class="muted">แพทย์รับทราบผล EQA และหลักฐานการเรียนรู้</p>
      <div class="stat">
        <span>Pending Acknowledge</span>
        <strong>1</strong>
        <small>JE14</small>
      </div>
      <br>
      <button class="primary-btn" onclick="acknowledgeCase()">รับทราบ JE14</button>
    </div>
  `);
}

function acknowledgeCase() {
  showInfoModal("บันทึกการรับทราบแล้ว", "ระบบบันทึกชื่อผู้รับทราบ วันเวลา และ Audit Trail เรียบร้อย", false);
}

function renderReports() {
  setContent(`
    <div class="card">
      <h3>Reports</h3>
      <p class="muted">ใช้ตอน Management Review / ISO / HA / CAP Inspection</p>
      <button class="primary-btn" onclick="printAnnualReport()">Print Annual EQA Report</button>
      <button class="secondary-btn" onclick="printPersonalReport()">Print Personal Report</button>
    </div>
  `);
}

function renderAdmin() {
  setContent(`
    <div class="card">
      <h3>Admin</h3>
      <p class="muted">เพิ่ม Case, คำถาม, เฉลย และไฟล์หลักฐาน</p>

      <div class="form-grid">
        <label>Case ID <input value="JE14" /></label>
        <label>Program <input value="J/JE1" /></label>
        <label>Year <input value="2026" /></label>
        <label>Round <input value="B" /></label>
        <label>Month <input value="June" /></label>
        <label>Status
          <select>
            <option>OPEN</option>
            <option>CLOSED</option>
            <option>ANSWER_RELEASED</option>
            <option>COMPLETED</option>
          </select>
        </label>
      </div>

      <label>Case Study
        <textarea placeholder="วาง Case Study ตรงนี้"></textarea>
      </label>

      <h4>Evidence Attachment</h4>
      <p class="muted">ระบบจริงจะอัปโหลดเข้า Google Drive แล้วบันทึก Link ในชีท Attachments_2026</p>
      <input type="file" multiple />

      <br><br>
      <button class="primary-btn">บันทึก Case</button>
    </div>
  `);
}

function printPersonalReport() {
  setContent(`
    <div class="report-a4">
      <h2>Personal EQA Learning Report 2026</h2>
      <p><strong>Name:</strong> ${currentUser.fullName}</p>
      <p><strong>Employee Code:</strong> ${currentUser.empCode}</p>
      <p><strong>Case:</strong> JE14 / J/JE1 / Round B</p>
      <hr>
      <h3>Answer Summary</h3>
      <table>
        <thead><tr><th>Question</th><th>Answer</th><th>CAP Answer</th><th>Result</th><th>Reflection</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>-</td><td>Pending</td><td>Pending</td><td>-</td></tr>
          <tr><td>2</td><td>-</td><td>Pending</td><td>Pending</td><td>-</td></tr>
        </tbody>
      </table>
      <hr>
      <p><strong>QM Review:</strong> Pending</p>
      <p><strong>Physician Acknowledge:</strong> Pending</p>
    </div>
    <div class="no-print" style="text-align:center; margin:18px;">
      <button class="primary-btn" onclick="window.print()">Print / Save PDF</button>
      <button class="secondary-btn" onclick="renderPage()">กลับ</button>
    </div>
  `);
}

function printAnnualReport() {
  setContent(`
    <div class="report-a4">
      <h2>Annual EQA Report 2026</h2>
      <p><strong>Unit:</strong> Blood Bank</p>
      <p><strong>Year:</strong> 2026</p>
      <hr>
      ${caseTable(mockCases)}
      <h3>Summary</h3>
      <p>จำนวน Case ตามแผน: 25</p>
      <p>Completed: 0</p>
      <p>Pending Reflection/QM/Physician: 1</p>
    </div>
    <div class="no-print" style="text-align:center; margin:18px;">
      <button class="primary-btn" onclick="window.print()">Print / Save PDF</button>
      <button class="secondary-btn" onclick="renderPage()">กลับ</button>
    </div>
  `);
}

function statusClass(status) {
  if (status === "OPEN") return "open";
  if (status === "COMPLETED") return "completed";
  if (status === "SUBMITTED") return "submitted";
  return "closed";
}

function setContent(html) {
  document.getElementById("contentPage").innerHTML = html;
}

function showConfirmModal(title, message, onConfirm) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalMessage").innerText = message;
  document.getElementById("modalCancel").classList.remove("hidden");
  document.getElementById("modalConfirm").textContent = "ยืนยันส่งคำตอบ";
  document.getElementById("modalBackdrop").classList.remove("hidden");
  pendingSubmit = onConfirm;
}

function showInfoModal(title, message, showCancel=false) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalMessage").innerText = message;
  document.getElementById("modalCancel").classList.toggle("hidden", !showCancel);
  document.getElementById("modalConfirm").textContent = "ตกลง";
  document.getElementById("modalBackdrop").classList.remove("hidden");
  pendingSubmit = null;
}

function closeModal() {
  document.getElementById("modalBackdrop").classList.add("hidden");
  pendingSubmit = null;
}
