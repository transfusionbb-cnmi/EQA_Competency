const SHEETS = {
  USERS: "Users",
  CASES: "Cases_2026",
  QUESTIONS: "Questions_2026",
  RESPONSES: "Responses_2026",
  ANSWER_KEYS: "AnswerKeys_2026",
  REFLECTIONS: "Reflections_2026",
  REVIEWS: "Reviews_2026",
  ATTACHMENTS: "Attachments_2026",
  AUDIT: "Audit_Log_2026"
};

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: "Blood Bank EQA Learning System 2026 API" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || "{}");
    const action = req.action;

    if (action === "setup") return json_(setupSheets());
    if (action === "register") return json_(register_(req));
    if (action === "loginWithPassword") return json_(loginWithPassword_(req));
    if (action === "login") return json_(login_(req));
    if (action === "listCases") return json_(listCases_());
    if (action === "getCase") return json_(getCase_(req.caseId));
    if (action === "saveDraft") return json_(saveResponse_(req, "DRAFT"));
    if (action === "submitFinal") return json_(saveResponse_(req, "SUBMITTED"));
    if (action === "publishAnswerKey") return json_(publishAnswerKey_(req));
    if (action === "saveReflection") return json_(saveReflection_(req));
    if (action === "qmReview") return json_(qmReview_(req));
    if (action === "physicianAcknowledge") return json_(physicianAcknowledge_(req));

    return json_({ ok: false, message: "Unknown action: " + action });
  } catch (err) {
    return json_({ ok: false, message: err.message, stack: err.stack });
  }
}

function setupSheets() {
  const ss = SpreadsheetApp.getActive();

  createSheet_(ss, SHEETS.USERS, [
    "EmpCode", "FullName", "Email", "Role", "Active", "PasswordSalt", "PasswordHash", "CreatedAt", "UpdatedAt"
  ]);

  createSheet_(ss, SHEETS.CASES, [
    "CaseId", "Program", "Year", "Round", "Month", "Title", "CaseStudy", "Status",
    "OpenDate", "CloseDate", "CreatedBy", "CreatedAt", "UpdatedAt"
  ]);

  createSheet_(ss, SHEETS.QUESTIONS, [
    "CaseId", "QuestionNo", "QuestionText", "ChoiceCode", "ChoiceText", "CreatedAt"
  ]);

  createSheet_(ss, SHEETS.RESPONSES, [
    "ResponseId", "CaseId", "EmpCode", "FullName", "Status", "AnswersJson",
    "DraftSavedAt", "SubmittedAt", "Locked", "Score", "Percent", "WrongQuestionsJson", "UpdatedAt"
  ]);

  createSheet_(ss, SHEETS.ANSWER_KEYS, [
    "CaseId", "QuestionNo", "CorrectChoiceCode", "Explanation", "Published", "PublishedBy", "PublishedAt"
  ]);

  createSheet_(ss, SHEETS.REFLECTIONS, [
    "ReflectionId", "CaseId", "EmpCode", "QuestionNo", "UserAnswer", "CorrectAnswer",
    "CauseText", "PreventionText", "Status", "SubmittedAt", "UpdatedAt"
  ]);

  createSheet_(ss, SHEETS.REVIEWS, [
    "ReviewId", "CaseId", "ReviewerEmpCode", "ReviewerName", "Role",
    "Status", "Comment", "ReviewedAt"
  ]);

  createSheet_(ss, SHEETS.ATTACHMENTS, [
    "AttachmentId", "CaseId", "FileName", "FileType", "DriveFileId", "DriveUrl",
    "UploadedBy", "UploadedAt"
  ]);

  createSheet_(ss, SHEETS.AUDIT, [
    "Timestamp", "EmpCode", "FullName", "Role", "Action", "CaseId", "DetailJson"
  ]);

  seedDemoData_();

  return { ok: true, message: "Setup completed" };
}

function createSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#c4e6ff");
    sh.setFrozenRows(1);
  }
}

function seedDemoData_() {
  const ss = SpreadsheetApp.getActive();
  const cases = ss.getSheetByName(SHEETS.CASES);
  if (cases.getLastRow() <= 1) {
    cases.appendRow([
      "JE14", "J/JE1", "2026", "B", "June", "Dry Challenge - JE-14",
      "Paste full case study here", "OPEN", "", "", "admin", new Date(), new Date()
    ]);
  }

  const users = ss.getSheetByName(SHEETS.USERS);
  if (users.getLastRow() <= 1) {
    addSeedUser_(users, "admin", "Admin", "admin@mahidol.ac.th", "admin", "123456");
    addSeedUser_(users, "qm", "Quality Manager", "qm@mahidol.ac.th", "qm", "123456");
    addSeedUser_(users, "md", "Physician", "md@mahidol.ac.th", "physician", "123456");
  }
}


function addSeedUser_(sh, empCode, fullName, email, role, password) {
  const salt = Utilities.getUuid();
  const hash = hashPassword_(password, salt);
  sh.appendRow([empCode, fullName, email, role, true, salt, hash, new Date(), new Date()]);
}

function login_(req) {
  const empCode = String(req.empCode || "").trim();
  const fullName = String(req.fullName || "").trim();
  if (!empCode) return { ok: false, message: "Missing EmpCode" };

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEETS.USERS);
  const data = sh.getDataRange().getValues();
  const h = headerMap_(data[0]);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][h.EmpCode]) === empCode) {
      if (String(data[i][h.Active]).toLowerCase() !== "true") return { ok: false, message: "User inactive" };
      return {
        ok: true,
        user: {
          empCode,
          fullName: data[i][h.FullName],
          role: data[i][h.Role]
        }
      };
    }
  }

  const role = "staff";
  sh.appendRow([empCode, fullName || empCode, role, true, new Date(), new Date()]);
  return { ok: true, user: { empCode, fullName: fullName || empCode, role } };
}


function register_(req) {
  const email = String(req.email || "").trim().toLowerCase();
  const empCode = String(req.empCode || "").trim();
  const fullName = String(req.fullName || "").trim();
  const password = String(req.password || "");
  if (!email.endsWith("@mahidol.ac.th")) return { ok:false, message:"ใช้ได้เฉพาะอีเมล @mahidol.ac.th" };
  if (!empCode || !fullName) return { ok:false, message:"กรุณากรอกชื่อและรหัสพนักงาน" };
  if (password.length < 6) return { ok:false, message:"รหัสผ่านควรมีอย่างน้อย 6 ตัวอักษร" };
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.USERS);
  const data = sh.getDataRange().getValues();
  const h = headerMap_(data[0]);
  for (let i=1;i<data.length;i++) {
    if (String(data[i][h.Email]).toLowerCase() === email) return { ok:false, message:"อีเมลนี้มีผู้ใช้งานแล้ว" };
  }
  const salt = Utilities.getUuid();
  const hash = hashPassword_(password, salt);
  const role = "staff";
  sh.appendRow([empCode, fullName, email, role, true, salt, hash, new Date(), new Date()]);
  audit_({ empCode, fullName, email, role }, "REGISTER", "", {});
  return { ok:true, user:{ empCode, fullName, email, role } };
}

function loginWithPassword_(req) {
  const email = String(req.email || "").trim().toLowerCase();
  const password = String(req.password || "");
  if (!email.endsWith("@mahidol.ac.th")) return { ok:false, message:"ใช้ได้เฉพาะอีเมล @mahidol.ac.th" };
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.USERS);
  const data = sh.getDataRange().getValues();
  const h = headerMap_(data[0]);
  for (let i=1;i<data.length;i++) {
    if (String(data[i][h.Email]).toLowerCase() !== email) continue;
    if (String(data[i][h.Active]).toLowerCase() !== "true") return { ok:false, message:"ผู้ใช้นี้ถูกปิดการใช้งาน" };
    if (hashPassword_(password, String(data[i][h.PasswordSalt] || "")) !== String(data[i][h.PasswordHash] || "")) return { ok:false, message:"อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    const user = { empCode:data[i][h.EmpCode], fullName:data[i][h.FullName], email:data[i][h.Email], role:data[i][h.Role] };
    audit_(user, "LOGIN", "", {});
    return { ok:true, user };
  }
  return { ok:false, message:"ไม่พบผู้ใช้งาน กรุณาตั้งรหัสครั้งแรกก่อน" };
}

function hashPassword_(password, salt) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + "::" + password, Utilities.Charset.UTF_8);
  return raw.map(b => { const v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? "0" + v : v; }).join("");
}

function listCases_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CASES);
  return { ok: true, cases: rowsAsObjects_(sh) };
}

function getCase_(caseId) {
  const cases = rowsAsObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.CASES));
  const questions = rowsAsObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.QUESTIONS));
  const found = cases.find(c => String(c.CaseId) === String(caseId));
  if (!found) return { ok: false, message: "Case not found" };

  const qMap = {};
  questions.filter(q => String(q.CaseId) === String(caseId)).forEach(q => {
    if (!qMap[q.QuestionNo]) qMap[q.QuestionNo] = {
      questionNo: q.QuestionNo,
      questionText: q.QuestionText,
      choices: []
    };
    qMap[q.QuestionNo].choices.push({
      code: q.ChoiceCode,
      text: q.ChoiceText
    });
  });

  return { ok: true, case: found, questions: Object.values(qMap) };
}

function saveResponse_(req, status) {
  const caseId = String(req.caseId || "").trim();
  const empCode = String(req.empCode || "").trim();
  const fullName = String(req.fullName || "").trim();
  const answers = req.answers || {};

  if (!caseId || !empCode) return { ok: false, message: "Missing caseId or empCode" };

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEETS.RESPONSES);
  const data = sh.getDataRange().getValues();
  const h = headerMap_(data[0]);

  for (let i = 1; i < data.length; i++) {
    const same = String(data[i][h.CaseId]) === caseId && String(data[i][h.EmpCode]) === empCode;
    if (!same) continue;

    const locked = String(data[i][h.Locked]).toLowerCase() === "true";
    if (locked) return { ok: false, message: "This response is already submitted and locked." };

    sh.getRange(i + 1, h.Status + 1).setValue(status);
    sh.getRange(i + 1, h.AnswersJson + 1).setValue(JSON.stringify(answers));
    sh.getRange(i + 1, h.DraftSavedAt + 1).setValue(status === "DRAFT" ? new Date() : data[i][h.DraftSavedAt]);
    sh.getRange(i + 1, h.SubmittedAt + 1).setValue(status === "SUBMITTED" ? new Date() : "");
    sh.getRange(i + 1, h.Locked + 1).setValue(status === "SUBMITTED");
    sh.getRange(i + 1, h.UpdatedAt + 1).setValue(new Date());

    audit_(req, status === "SUBMITTED" ? "SUBMIT_FINAL" : "SAVE_DRAFT", caseId, { answers });
    return { ok: true, message: status === "SUBMITTED" ? "Submitted and locked" : "Draft saved" };
  }

  sh.appendRow([
    Utilities.getUuid(), caseId, empCode, fullName, status, JSON.stringify(answers),
    status === "DRAFT" ? new Date() : "", status === "SUBMITTED" ? new Date() : "",
    status === "SUBMITTED", "", "", "", new Date()
  ]);

  audit_(req, status === "SUBMITTED" ? "SUBMIT_FINAL" : "SAVE_DRAFT", caseId, { answers });
  return { ok: true, message: status === "SUBMITTED" ? "Submitted and locked" : "Draft saved" };
}

function publishAnswerKey_(req) {
  const caseId = req.caseId;
  const keys = req.keys || [];
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.ANSWER_KEYS);

  keys.forEach(k => {
    sh.appendRow([caseId, k.questionNo, k.correctChoiceCode, k.explanation || "", true, req.empCode || "", new Date()]);
  });

  calculateScores_(caseId);
  audit_(req, "PUBLISH_ANSWER_KEY", caseId, { keysCount: keys.length });
  return { ok: true, message: "Answer key published and scores calculated" };
}

function calculateScores_(caseId) {
  const ss = SpreadsheetApp.getActive();
  const keyRows = rowsAsObjects_(ss.getSheetByName(SHEETS.ANSWER_KEYS)).filter(r => String(r.CaseId) === String(caseId));
  const keyMap = {};
  keyRows.forEach(r => keyMap[String(r.QuestionNo)] = String(r.CorrectChoiceCode));

  const sh = ss.getSheetByName(SHEETS.RESPONSES);
  const data = sh.getDataRange().getValues();
  const h = headerMap_(data[0]);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][h.CaseId]) !== String(caseId)) continue;
    if (String(data[i][h.Status]) !== "SUBMITTED") continue;

    const answers = JSON.parse(data[i][h.AnswersJson] || "{}");
    let correct = 0;
    const wrong = [];

    Object.keys(keyMap).forEach(qNo => {
      if (String(answers[qNo]) === String(keyMap[qNo])) correct++;
      else wrong.push(qNo);
    });

    const total = Object.keys(keyMap).length || 0;
    const percent = total ? Math.round((correct / total) * 10000) / 100 : "";

    sh.getRange(i + 1, h.Score + 1).setValue(correct + "/" + total);
    sh.getRange(i + 1, h.Percent + 1).setValue(percent);
    sh.getRange(i + 1, h.WrongQuestionsJson + 1).setValue(JSON.stringify(wrong));
    sh.getRange(i + 1, h.UpdatedAt + 1).setValue(new Date());
  }
}

function saveReflection_(req) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.REFLECTIONS);
  const items = req.items || [];

  items.forEach(item => {
    sh.appendRow([
      Utilities.getUuid(), req.caseId, req.empCode, item.questionNo, item.userAnswer, item.correctAnswer,
      item.causeText, item.preventionText, "SUBMITTED", new Date(), new Date()
    ]);
  });

  audit_(req, "SAVE_REFLECTION", req.caseId, { count: items.length });
  return { ok: true, message: "Reflection saved" };
}

function qmReview_(req) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.REVIEWS);
  sh.appendRow([
    Utilities.getUuid(), req.caseId, req.empCode, req.fullName, "qm",
    req.status || "APPROVED", req.comment || "", new Date()
  ]);
  audit_(req, "QM_REVIEW", req.caseId, { status: req.status, comment: req.comment });
  return { ok: true, message: "QM review saved" };
}

function physicianAcknowledge_(req) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.REVIEWS);
  sh.appendRow([
    Utilities.getUuid(), req.caseId, req.empCode, req.fullName, "physician",
    "ACKNOWLEDGED", req.comment || "", new Date()
  ]);
  audit_(req, "PHYSICIAN_ACKNOWLEDGE", req.caseId, { comment: req.comment });
  return { ok: true, message: "Physician acknowledged" };
}

function audit_(req, action, caseId, detail) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.AUDIT);
  sh.appendRow([
    new Date(), req.empCode || "", req.fullName || "", req.email || "", req.role || "",
    action, caseId || "", JSON.stringify(detail || {})
  ]);
}

function rowsAsObjects_(sh) {
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function headerMap_(headers) {
  const map = {};
  headers.forEach((h, i) => map[h] = i);
  return map;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
