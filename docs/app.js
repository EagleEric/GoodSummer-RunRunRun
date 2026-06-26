const BANK_FILES = [
  "第 1 次作业.txt",
  "第 2 次作业.txt",
  "第 3 次作业.txt",
  "第 4 次作业.txt",
  "第 5 次作业.txt",
  "第 6 次作业.txt",
  "第 7 次作业.txt",
  "第 8 次作业.txt",
  "第 9 次作业.txt",
  "期末复习 第1章.txt",
  "期末复习 第2章.txt",
  "期末复习 第3章.txt",
  "期末复习 第4章.txt",
  "期末复习 第5章.txt",
  "期末复习 第6章.txt",
  "期末复习 第7章.txt",
  "期末复习 第8章.txt",
  "期末复习 第9章.txt",
  "期末复习 第10章.txt",
  "期末复习 第11章.txt",
  "期末复习 第12章.txt",
  "期末复习 第13章.txt",
  "期末复习 第14章.txt",
];

const STARTUP_PASSWORD_HASH = "e375c7115acb58ca0ce500bc1fc17abdedae25778b4b2939c35d9080191e0396";
const STORAGE_PREFIX = "software_quiz_pages_v1";

const state = {
  authMode: "login",
  user: null,
  gatePassed: false,
  banks: [],
  mode: "practice",
  currentBank: "",
  questions: [],
  index: 0,
  done: 0,
  right: 0,
  answered: false,
};

const els = {
  authPanel: document.querySelector("#authPanel"),
  workspace: document.querySelector("#workspace"),
  authForm: document.querySelector("#authForm"),
  gatePanel: document.querySelector("#gatePanel"),
  mainPanel: document.querySelector("#mainPanel"),
  gateForm: document.querySelector("#gateForm"),
  gatePassword: document.querySelector("#gatePassword"),
  gateMessage: document.querySelector("#gateMessage"),
  authSubmit: document.querySelector("#authSubmit"),
  authMessage: document.querySelector("#authMessage"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  userLabel: document.querySelector("#userLabel"),
  logoutBtn: document.querySelector("#logoutBtn"),
  bankSelect: document.querySelector("#bankSelect"),
  startBtn: document.querySelector("#startBtn"),
  emptyState: document.querySelector("#emptyState"),
  questionCard: document.querySelector("#questionCard"),
  typeBadge: document.querySelector("#typeBadge"),
  questionCounter: document.querySelector("#questionCounter"),
  questionText: document.querySelector("#questionText"),
  optionsBox: document.querySelector("#optionsBox"),
  essayAnswer: document.querySelector("#essayAnswer"),
  submitBtn: document.querySelector("#submitBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  resultBox: document.querySelector("#resultBox"),
  statTotal: document.querySelector("#statTotal"),
  statDone: document.querySelector("#statDone"),
  statRight: document.querySelector("#statRight"),
  progressBar: document.querySelector("#progressBar"),
  wrongTotal: document.querySelector("#wrongTotal"),
  clearWrongBtn: document.querySelector("#clearWrongBtn"),
};

function storageKey(name) {
  return `${STORAGE_PREFIX}:${name}`;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(key))) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(storageKey(key), JSON.stringify(value));
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(username, password) {
  return sha256(`${username.trim().toLowerCase()}::${password}`);
}

function users() {
  return readJson("users", {});
}

function saveUsers(nextUsers) {
  writeJson("users", nextUsers);
}

function wrongKey() {
  return state.user ? `wrong:${state.user.username}` : "wrong:guest";
}

function wrongStore() {
  return readJson(wrongKey(), {});
}

function saveWrongStore(store) {
  writeJson(wrongKey(), store);
}

function bankWrongItems(bankId = "") {
  const store = wrongStore();
  return Object.values(store).filter((item) => !bankId || item.bankId === bankId);
}

function upsertWrong(question, userAnswer, correctAnswer) {
  const store = wrongStore();
  const key = `${state.currentBank}::${question.id}`;
  store[key] = {
    ...question,
    bankId: state.currentBank,
    bankName: currentBank()?.name || state.currentBank,
    wrongCount: (store[key]?.wrongCount || 0) + 1,
    lastAnswer: userAnswer,
    correctAnswer,
    updatedAt: new Date().toISOString(),
  };
  saveWrongStore(store);
  updateWrongTotal();
}

function removeWrong(question) {
  const store = wrongStore();
  delete store[`${state.currentBank}::${question.id}`];
  saveWrongStore(store);
  updateWrongTotal();
}

function clearCurrentBankWrong() {
  if (!state.currentBank) return;
  const store = wrongStore();
  for (const key of Object.keys(store)) {
    if (store[key].bankId === state.currentBank) {
      delete store[key];
    }
  }
  saveWrongStore(store);
  updateWrongTotal();
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
  els.authSubmit.textContent = mode === "login" ? "登录" : "注册";
  els.authMessage.textContent = "";
}

function showWorkspace(user, gatePassed = false) {
  state.user = user;
  state.gatePassed = Boolean(gatePassed);
  els.userLabel.textContent = user ? `已登录：${user.username}` : "";
  els.authPanel.classList.toggle("hidden", Boolean(user));
  els.workspace.classList.toggle("hidden", !user);
  els.gatePanel.classList.toggle("hidden", !user || state.gatePassed);
  els.mainPanel.classList.toggle("hidden", !user || !state.gatePassed);
  if (user && !state.gatePassed) {
    setTimeout(() => els.gatePassword.focus(), 0);
  }
}

async function loadBanks() {
  const banks = [];
  for (const filename of BANK_FILES) {
    const response = await fetch(`banks/${encodeURIComponent(filename)}`);
    if (!response.ok) continue;
    const text = await response.text();
    const bank = parseQuestionBank(filename, text);
    banks.push(bank);
  }
  state.banks = banks;
  els.bankSelect.innerHTML = "";
  for (const bank of state.banks) {
    const option = document.createElement("option");
    option.value = bank.id;
    option.textContent = `${bank.name}（${bank.count}题）`;
    els.bankSelect.appendChild(option);
  }
  if (state.banks.length) {
    state.currentBank = state.banks[0].id;
    els.bankSelect.value = state.currentBank;
  }
  updateWrongTotal();
}

function currentBank() {
  return state.banks.find((bank) => bank.id === state.currentBank);
}

function startSession() {
  state.currentBank = els.bankSelect.value;
  state.index = 0;
  state.done = 0;
  state.right = 0;
  state.answered = false;
  els.resultBox.classList.add("hidden");

  if (state.mode === "wrong") {
    state.questions = bankWrongItems(state.currentBank).map((item) => ({
      ...item,
      answer: item.answer || item.correctAnswer || "",
    }));
  } else {
    const bank = currentBank();
    state.questions = bank ? bank.questions : [];
  }

  updateStats();
  updateWrongTotal();
  if (!state.questions.length) {
    els.questionCard.classList.add("hidden");
    els.emptyState.classList.remove("hidden");
    els.emptyState.querySelector("h2").textContent = state.mode === "wrong" ? "这个题库暂无错题" : "这个题库暂无题目";
    els.emptyState.querySelector("p").textContent = state.mode === "wrong" ? "答错的题会自动进入这里。" : "请检查题库 TXT 是否已经上传。";
    return;
  }
  els.emptyState.classList.add("hidden");
  els.questionCard.classList.remove("hidden");
  renderQuestion();
}

function renderQuestion() {
  state.answered = false;
  const q = state.questions[state.index];
  els.typeBadge.textContent = q.typeLabel || "题目";
  els.questionCounter.textContent = `${state.index + 1} / ${state.questions.length}`;
  els.questionText.textContent = q.question;
  els.optionsBox.innerHTML = "";
  els.essayAnswer.value = "";
  els.essayAnswer.classList.toggle("hidden", !["essay", "blank"].includes(q.type));
  els.essayAnswer.placeholder = q.type === "blank" ? "输入填空题答案。" : "问答题可先写自己的答案，再提交对照参考答案。";
  els.submitBtn.classList.remove("hidden");
  els.nextBtn.classList.add("hidden");
  els.resultBox.className = "result hidden";
  els.resultBox.innerHTML = "";

  if (["essay", "blank"].includes(q.type)) {
    return;
  }

  const inputType = q.type === "multi" ? "checkbox" : "radio";
  for (const [key, text] of Object.entries(q.options || {})) {
    const label = document.createElement("label");
    label.className = "option";
    label.innerHTML = `
      <input type="${inputType}" name="answer" value="${escapeHtml(key)}" />
      <span><strong>${escapeHtml(key)}.</strong> ${escapeHtml(text)}</span>
    `;
    els.optionsBox.appendChild(label);
  }
}

function getSelectedAnswer() {
  const q = state.questions[state.index];
  if (["essay", "blank"].includes(q.type)) {
    return els.essayAnswer.value.trim();
  }
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map((input) => input.value);
  return checked.sort().join("");
}

function submitAnswer() {
  if (state.answered) return;
  const q = state.questions[state.index];
  const answer = getSelectedAnswer();
  if (!answer && q.type !== "essay") {
    showResult("wrong", "先填写或选择一个答案。");
    return;
  }

  const correctAnswer = normalizeAnswer(q.answer || q.correctAnswer || "");
  const userAnswer = normalizeAnswer(answer);
  const isEssay = q.type === "essay";
  const isCorrect = Boolean(userAnswer && userAnswer === correctAnswer && !isEssay);

  state.answered = true;
  state.done += 1;
  if (isCorrect) {
    state.right += 1;
    removeWrong(q);
  } else {
    upsertWrong(q, userAnswer, correctAnswer);
  }
  updateStats();

  const status = isCorrect ? "correct" : "wrong";
  const title = isCorrect ? "回答正确" : isEssay ? "参考答案" : "回答错误";
  const userAnswerLine = isEssay ? "" : `<div>你的答案：<strong>${escapeHtml(answer || "未作答")}</strong></div>`;
  const correctLine = isEssay ? "" : `<div>正确答案：<strong>${escapeHtml(correctAnswer || "暂无")}</strong></div>`;
  const essayMessage = isEssay ? "<div>问答题请对照参考答案自查，默认加入错题集。</div>" : "";
  const answerText = q.answer ? `<pre>${escapeHtml(q.answer)}</pre>` : "";
  showResult(status, `<strong>${title}</strong>${userAnswerLine}${correctLine}${essayMessage}${answerText}`);
  els.submitBtn.classList.add("hidden");
  els.nextBtn.classList.remove("hidden");
}

function showResult(kind, html) {
  els.resultBox.className = `result ${kind}`;
  els.resultBox.innerHTML = html;
  els.resultBox.classList.remove("hidden");
}

function nextQuestion() {
  if (state.index + 1 >= state.questions.length) {
    els.questionCard.classList.add("hidden");
    els.emptyState.classList.remove("hidden");
    els.emptyState.querySelector("h2").textContent = "本轮完成";
    els.emptyState.querySelector("p").textContent = `已答 ${state.done} 题，正确 ${state.right} 题。`;
    updateWrongTotal();
    return;
  }
  state.index += 1;
  renderQuestion();
}

function updateStats() {
  els.statTotal.textContent = String(state.questions.length);
  els.statDone.textContent = String(state.done);
  els.statRight.textContent = String(state.right);
  const percent = state.questions.length ? Math.round((state.done / state.questions.length) * 100) : 0;
  els.progressBar.style.width = `${percent}%`;
}

function updateWrongTotal() {
  els.wrongTotal.textContent = String(bankWrongItems(state.currentBank).length);
}

function normalizeAnswer(answer) {
  const text = String(answer).trim().toUpperCase().replace(/[，、\s]/g, "");
  if (["对", "正确", "TRUE", "T", "√", "YES", "Y"].includes(text)) return "对";
  if (["错", "错误", "FALSE", "F", "×", "X", "NO", "N"].includes(text)) return "错";
  const letters = text.match(/[A-Z]/g);
  if (letters) return Array.from(new Set(letters)).sort().join("");
  return text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function splitAnswerMarker(text) {
  const match = text.match(/^答案[:：]?\s*$/m);
  if (!match || match.index === undefined) return [text, ""];
  return [text.slice(0, match.index), text.slice(match.index + match[0].length)];
}

function splitSections(text) {
  const sections = [];
  const pattern = /^\s*(?:#{1,6}\s*)?(?:@)?([一二三四五六七八九十]+[、.．\s-]*.+)$/gm;
  const matches = Array.from(text.matchAll(pattern));
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const next = matches[i + 1];
    sections.push({
      title: match[1].trim(),
      content: text.slice((match.index || 0) + match[0].length, next ? next.index : text.length),
    });
  }
  return sections;
}

function parseAnswerBlock(answerText) {
  const answers = { choice: {}, judge: {}, blank: {}, essay: {} };
  for (const section of splitSections(answerText)) {
    if (section.title.includes("选择")) Object.assign(answers.choice, parseChoiceAnswers(section.content));
    if (section.title.includes("判断")) Object.assign(answers.judge, parseJudgeAnswers(section.content));
    if (section.title.includes("填空")) Object.assign(answers.blank, parseBlankAnswers(section.content));
    if (section.title.includes("问答") || section.title.includes("简答")) Object.assign(answers.essay, parseEssayAnswers(section.content));
  }
  return answers;
}

function parseChoiceAnswers(content) {
  const answers = {};
  const unnumbered = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\d+)\s*[.．、:：]?\s*(.+)$/);
    if (match) {
      answers[match[1]] = normalizeAnswer(match[2]);
      continue;
    }
    const normalized = normalizeAnswer(line);
    if (/^[A-D]+$/.test(normalized)) unnumbered.push(normalized);
  }
  if (!Object.keys(answers).length) {
    unnumbered.forEach((answer, index) => {
      answers[String(index + 1)] = answer;
    });
  }
  return answers;
}

function parseJudgeAnswers(content) {
  const answers = {};
  const pattern = /(\d+)\s*[.．、:：]?\s*(对|错|正确|错误|√|×|TRUE|FALSE|T|F|YES|NO|Y|N)/gi;
  for (const match of content.matchAll(pattern)) {
    answers[match[1]] = normalizeAnswer(match[2]);
  }
  if (Object.keys(answers).length) return answers;

  const unnumbered = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const normalized = normalizeAnswer(rawLine);
    if (["对", "错"].includes(normalized)) unnumbered.push(normalized);
  }
  return Object.fromEntries(unnumbered.map((answer, index) => [String(index + 1), answer]));
}

function parseBlankAnswers(content) {
  const answers = {};
  const unnumbered = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\d+)\s*[.．、:：]?\s*(.+)$/);
    if (match) {
      answers[match[1]] = match[2].trim();
    } else {
      unnumbered.push(line);
    }
  }
  if (!Object.keys(answers).length) {
    unnumbered.forEach((answer, index) => {
      answers[String(index + 1)] = answer;
    });
  }
  return answers;
}

function parseEssayAnswers(content) {
  const answers = {};
  let current = null;
  let lines = [];
  const fallback = [];

  function flush() {
    if (current) answers[current] = lines.join("\n").trim();
    current = null;
    lines = [];
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (current) lines.push("");
      continue;
    }
    const chineseHeading = line.match(/^第([一二三四五六七八九十\d]+)题\s*$/);
    const numericHeading = rawLine.match(/^(\d+)\s*[.．、]\s*\S+/);
    if (chineseHeading) {
      flush();
      current = String(chineseQuestionNumber(chineseHeading[1]));
      continue;
    }
    if (numericHeading && !/^\s/.test(rawLine)) {
      flush();
      current = numericHeading[1];
      continue;
    }
    const cleanLine = line.replace(/^答[:：]?/, "").trim();
    if (current) {
      lines.push(cleanLine);
    } else {
      fallback.push(cleanLine);
    }
  }
  flush();
  if (!Object.keys(answers).length && fallback.length) answers["1"] = fallback.join("\n").trim();
  return answers;
}

function chineseQuestionNumber(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const values = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (text === "十") return 10;
  if (text.startsWith("十")) return 10 + (values[text.slice(1, 2)] || 0);
  if (text.includes("十")) {
    const [left, right] = text.split("十");
    return (values[left] || 1) * 10 + (values[right] || 0);
  }
  return values[text] || 0;
}

function parseNumberedQuestions(sectionText) {
  const questions = [];
  const starts = Array.from(sectionText.matchAll(/^(\d+)\s*[.．、]\s*/gm));
  for (let i = 0; i < starts.length; i += 1) {
    const match = starts[i];
    const next = starts[i + 1];
    questions.push({
      number: match[1],
      body: sectionText.slice((match.index || 0) + match[0].length, next ? next.index : sectionText.length).trim(),
    });
  }
  return questions;
}

function splitOptions(text) {
  const options = {};
  const matches = Array.from(text.matchAll(/([A-D])\s*[.．、]\s*/g));
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const next = matches[i + 1];
    options[match[1]] = text.slice((match.index || 0) + match[0].length, next ? next.index : text.length).trim();
  }
  return options;
}

function parseQuestionBank(filename, text) {
  const [body, answerText] = splitAnswerMarker(text.replace(/^\uFEFF/, ""));
  const answerSections = parseAnswerBlock(answerText);
  const questions = [];
  for (const section of splitSections(body)) {
    if (section.title.includes("选择")) {
      for (const item of parseNumberedQuestions(section.content)) {
        const options = splitOptions(item.body);
        const questionText = item.body.split(/\s+A\s*[.．、]\s*/)[0].trim();
        const isMulti = questionText.includes("多选");
        questions.push({
          id: `choice-${item.number}`,
          number: item.number,
          type: isMulti ? "multi" : "single",
          typeLabel: isMulti ? "多选题" : "选择题",
          question: questionText.replace("多选：", "").trim(),
          options,
          answer: answerSections.choice[item.number] || "",
        });
      }
    } else if (section.title.includes("判断")) {
      for (const item of parseNumberedQuestions(section.content)) {
        questions.push({
          id: `judge-${item.number}`,
          number: item.number,
          type: "judge",
          typeLabel: "判断题",
          question: item.body.trim(),
          options: { 对: "对", 错: "错" },
          answer: answerSections.judge[item.number] || "",
        });
      }
    } else if (section.title.includes("填空")) {
      for (const item of parseNumberedQuestions(section.content)) {
        questions.push({
          id: `blank-${item.number}`,
          number: item.number,
          type: "blank",
          typeLabel: "填空题",
          question: item.body.trim(),
          options: {},
          answer: answerSections.blank[item.number] || "",
        });
      }
    } else if (section.title.includes("问答") || section.title.includes("简答")) {
      for (const item of parseNumberedQuestions(section.content)) {
        questions.push({
          id: `essay-${item.number}`,
          number: item.number,
          type: "essay",
          typeLabel: "问答题",
          question: item.body.trim(),
          options: {},
          answer: answerSections.essay[item.number] || "",
        });
      }
    }
  }
  const name = filename.replace(/\.txt$/i, "");
  return {
    id: name.replace(/\s+/g, "_"),
    name,
    count: questions.length,
    questions,
  };
}

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
  });
});

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.authMessage.textContent = "";
  const username = els.username.value.trim();
  const password = els.password.value;
  if (username.length < 2 || password.length < 4) {
    els.authMessage.textContent = "用户名至少 2 位，密码至少 4 位。";
    return;
  }
  const nextUsers = users();
  const passwordHash = await hashPassword(username, password);
  if (state.authMode === "register") {
    if (nextUsers[username]) {
      els.authMessage.textContent = "用户名已存在。";
      return;
    }
    nextUsers[username] = { username, passwordHash, createdAt: new Date().toISOString() };
    saveUsers(nextUsers);
  } else if (!nextUsers[username] || nextUsers[username].passwordHash !== passwordHash) {
    els.authMessage.textContent = "用户名或密码错误。";
    return;
  }
  sessionStorage.removeItem(storageKey("gatePassed"));
  sessionStorage.setItem(storageKey("currentUser"), username);
  showWorkspace({ username }, false);
});

els.logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(storageKey("currentUser"));
  sessionStorage.removeItem(storageKey("gatePassed"));
  showWorkspace(null, false);
});

els.gateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.gateMessage.textContent = "";
  const provided = await sha256(els.gatePassword.value);
  if (provided !== STARTUP_PASSWORD_HASH) {
    els.gateMessage.textContent = "启动口令错误。";
    return;
  }
  els.gatePassword.value = "";
  sessionStorage.setItem(storageKey("gatePassed"), "1");
  showWorkspace(state.user, true);
  await loadBanks();
});

els.bankSelect.addEventListener("change", () => {
  state.currentBank = els.bankSelect.value;
  updateWrongTotal();
});

els.startBtn.addEventListener("click", startSession);
els.submitBtn.addEventListener("click", submitAnswer);
els.nextBtn.addEventListener("click", nextQuestion);
els.clearWrongBtn.addEventListener("click", () => {
  clearCurrentBankWrong();
  if (state.mode === "wrong") startSession();
});

(async function init() {
  const username = sessionStorage.getItem(storageKey("currentUser"));
  const knownUsers = users();
  if (username && knownUsers[username]) {
    const gatePassed = sessionStorage.getItem(storageKey("gatePassed")) === "1";
    showWorkspace({ username }, gatePassed);
    if (gatePassed) await loadBanks();
  } else {
    showWorkspace(null, false);
  }
})();
