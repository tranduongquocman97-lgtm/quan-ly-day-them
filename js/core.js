// ============================================================================
// MODULE CORE: HẰNG SỐ, DỮ LIỆU TOÀN CỤC & TIỆN ÍCH NGÀY THÁNG (JS/CORE.JS)
// ============================================================================

const STORAGE_KEY = 'TUTORING_MASTER_SYSTEM_V2026';
const ADMIN_PIN_KEY = 'MASTER_SYSTEM_ADMIN_PIN';
const ADMIN_AUTH_TOKEN_KEY = 'MASTER_SYSTEM_ADMIN_AUTH_TOKEN';
const STUDENT_AUTH_KEY = 'SIGMA_STUDENT_SESSION';
const ACTIVE_STUDENT_SESSION_KEY = 'ACTIVE_STUDENT_SESSION';

let cloudApiUrl = localStorage.getItem('API_URL') || "https://script.google.com/macros/s/AKfycbznfqhckK2L97z427a50oLuZ0W0nLbtdDcJROOv6S2sGQL3_OGbK0Fs7Hd8wOi_or5cXA/exec";

const AGRIBANK_BIN = "970405";
const AGRIBANK_STK = "4304205123124";
const AGRIBANK_NAME = "TRAN DUONG QUOC MAN";

let appData = { 
    classes: [], 
    students: [], 
    attendance: [], 
    payments: [], 
    documents: [], 
    exams: [], 
    examResults: [], 
    weeklyOverrides: [], 
    inactiveStudents: [], 
    appConfig: [] 
};

let currentClassId = 'ALL';
let currentTab = 'dashboard';
let tempParsedQuestions = [];
let currentWeekOffset = 0;
let teacherDeferredPrompt = null;
let selectedAttDateToChange = null;
let tempImportedStudents = [];

function getTodayVNString() {
    const v = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    return `${String(v.getDate()).padStart(2, '0')}-${String(v.getMonth() + 1).padStart(2, '0')}-${v.getFullYear()}`;
}

function normalizeCloudDate(d) {
    if (!d) return '';
    d = String(d).trim();
    if (d.includes('T')) {
        const v = new Date(new Date(d).toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
        return `${String(v.getDate()).padStart(2, '0')}-${String(v.getMonth() + 1).padStart(2, '0')}-${v.getFullYear()}`;
    }
    if (d.includes('/')) {
        const p = d.split('/');
        if (p.length === 3) return `${String(p[0]).padStart(2,'0')}-${String(p[1]).padStart(2,'0')}-${p[2]}`;
    }
    if (d.includes('-')) {
        const p = d.split('-');
        if (p.length === 3) {
            if (p[0].length === 4) return `${String(p[2]).padStart(2,'0')}-${String(p[1]).padStart(2,'0')}-${p[0]}`;
            return `${String(p[0]).padStart(2,'0')}-${String(p[1]).padStart(2,'0')}-${p[2]}`;
        }
    }
    return d;
}

function toIsoDate(ddmmyyyy) {
    if (!ddmmyyyy) return '';
    const clean = normalizeCloudDate(ddmmyyyy);
    const p = clean.split('-');
    if (p.length === 3 && p[0].length === 2 && p[2].length === 4) {
        return `${p[2]}-${p[1]}-${p[0]}`;
    }
    return '';
}

function fromIsoDate(yyyymmdd) {
    if (!yyyymmdd) return '';
    const p = String(yyyymmdd).trim().split('-');
    if (p.length === 3 && p[0].length === 4) {
        return `${p[2]}-${p[1]}-${p[0]}`;
    }
    return normalizeCloudDate(yyyymmdd);
}

function parseDateDDMMYYYY(str) {
    const clean = normalizeCloudDate(str);
    const p = clean.split('-');
    if (p.length === 3) return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
    return new Date();
}

function compareDateDDMMYYYY(d1, d2) {
    return parseDateDDMMYYYY(d1).getTime() - parseDateDDMMYYYY(d2).getTime();
}

function formatDateVN(d) { return normalizeCloudDate(d) || '---'; }
function formatDateShortVN(d) {
    const clean = normalizeCloudDate(d);
    const p = clean.split('-');
    return p.length === 3 ? `${p[0]}/${p[1]}` : clean;
}

function getStoredAdminPin() { return localStorage.getItem(ADMIN_PIN_KEY) || '123456'; }
function saveToStorage() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); }

function loadFromStorage() { 
    const st = localStorage.getItem(STORAGE_KEY); 
    if(st) {
        try { 
            const parsed = JSON.parse(st); 
            if(parsed && typeof parsed === 'object') {
                appData.classes = Array.isArray(parsed.classes) ? parsed.classes : [];
                appData.students = Array.isArray(parsed.students) ? parsed.students : [];
                appData.attendance = Array.isArray(parsed.attendance) ? parsed.attendance : [];
                appData.payments = Array.isArray(parsed.payments) ? parsed.payments : [];
                appData.documents = Array.isArray(parsed.documents) ? parsed.documents : [];
                appData.exams = Array.isArray(parsed.exams) ? parsed.exams : [];
                appData.examResults = Array.isArray(parsed.examResults) ? parsed.examResults : [];
                appData.weeklyOverrides = Array.isArray(parsed.weeklyOverrides) ? parsed.weeklyOverrides : []; 
                appData.inactiveStudents = Array.isArray(parsed.inactiveStudents) ? parsed.inactiveStudents : [];
                appData.appConfig = Array.isArray(parsed.appConfig) ? parsed.appConfig : [];
            }
        } catch(e) {}
    }
}

function updateSyncStatus(type, msg) { 
    const textEl = document.getElementById('syncText'); 
    if(textEl) textEl.innerText = msg; 
    const dotEl = document.getElementById('syncDot'); 
    if(dotEl) {
        dotEl.className = 'w-2 h-2 rounded-full shrink-0 ' + 
            (type === 'syncing' ? 'bg-amber-400 animate-ping' : type === 'success' ? 'bg-emerald-400' : 'bg-rose-400');
    }
}

function checkAdminSession() {
    const currentPin = getStoredAdminPin();
    const savedToken = localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);
    const lockScreen = document.getElementById('adminPinLockScreen');
    if (!lockScreen) return;

    if (savedToken === btoa('AUTHENTICATED_' + currentPin)) {
        lockScreen.classList.add('hidden');
    } else {
        lockScreen.classList.remove('hidden');
        setTimeout(() => {
            const inp = document.getElementById('inputAdminPin');
            if (inp) { inp.value = ''; inp.focus(); }
        }, 150);
    }
}

function handleVerifyAdminPin(e) {
    e.preventDefault();
    const inputPin = document.getElementById('inputAdminPin').value.trim();
    const errEl = document.getElementById('adminPinError');
    const correctPin = getStoredAdminPin();

    if (inputPin === correctPin) {
        localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, btoa('AUTHENTICATED_' + correctPin));
        document.getElementById('adminPinLockScreen').classList.add('hidden');
        errEl.classList.add('hidden');
        document.getElementById('inputAdminPin').value = '';
    } else {
        errEl.innerText = 'Mã PIN không chính xác!';
        errEl.classList.remove('hidden');
        document.getElementById('inputAdminPin').value = '';
        document.getElementById('inputAdminPin').focus();
    }
}

function lockAdminNow() {
    localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
    checkAdminSession();
}

function togglePinView() {
    const inp = document.getElementById('inputAdminPin');
    const ico = document.getElementById('eyeIconAdminPin');
    if (inp.type === 'password') { inp.type = 'text'; ico.setAttribute('data-lucide', 'eye-off'); }
    else { inp.type = 'password'; ico.setAttribute('data-lucide', 'eye'); }
    if (window.lucide) lucide.createIcons();
}

function handleChangeAdminPin(e) {
    e.preventDefault();
    const oldPin = document.getElementById('inputOldAdminPin').value.trim();
    const newPin = document.getElementById('inputNewAdminPin').value.trim();
    const confirmPin = document.getElementById('inputConfirmAdminPin').value.trim();

    if (oldPin !== getStoredAdminPin()) { alert('Mã PIN hiện tại không chính xác!'); return; }
    if (newPin !== confirmPin) { alert('Xác nhận mã PIN mới không khớp!'); return; }

    localStorage.setItem(ADMIN_PIN_KEY, newPin);
    localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);

    alert('Đổi mã PIN thành công! Vui lòng mở khóa lại.');
    e.target.reset();
    checkAdminSession();
}

function generateUsername(fullName, className) {
    if(!fullName) return '';
    let str = fullName.toLowerCase();
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    str = str.replace(/[đĐ]/g, 'd');
    str = str.replace(/[^a-z0-9]/g, '');
    const cName = (className || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${str}.${cName}`;
}

function previewGeneratedUsername() {
    const name = document.getElementById('inputStudentName')?.value || '';
    const cId = document.getElementById('inputStudentClassId')?.value || '';
    const c = (appData.classes || []).find(x => x.id === cId);
    const u = generateUsername(name, c ? c.name : '');
    const prevEl = document.getElementById('previewUsername');
    if (prevEl) prevEl.innerText = u || '---';
}

function getEffectiveStudentFee(student, classObj) {
    if (!student) return 300000;
    if (student.customFee !== null && student.customFee !== undefined && student.customFee !== '') {
        return parseFloat(student.customFee);
    }
    return (classObj && classObj.fee !== undefined) ? parseFloat(classObj.fee) : 300000;
}

function getFilteredStudents() { 
    if (!appData.students) return [];
    return currentClassId === 'ALL' ? appData.students : appData.students.filter(s => s.classId === currentClassId); 
}

function getFilteredPayments() { 
    if (!appData.payments) return [];
    return currentClassId === 'ALL' ? appData.payments : appData.payments.filter(p => p.classId === currentClassId); 
}

function getClassName(id) { 
    const c = (appData.classes || []).find(x => x.id === id); 
    return c ? c.name : '---'; 
}

function getClassSessionDates(classId) {
    let dates = [];
    if (!classId || classId === 'ALL') {
        dates = [...new Set((appData.attendance || []).map(a => normalizeCloudDate(a.date)))];
    } else {
        dates = [...new Set((appData.attendance || []).filter(a => a.classId === classId).map(a => normalizeCloudDate(a.date)))];
    }
    return dates.filter(Boolean).sort((a, b) => compareDateDDMMYYYY(a, b));
}

function getSafeClassSchedules(c) {
    if (!c || !c.schedules) return [];
    if (Array.isArray(c.schedules)) return c.schedules;
    if (typeof c.schedules === 'string') {
        try {
            const parsed = JSON.parse(c.schedules);
            return Array.isArray(parsed) ? parsed : [];
        } catch(e) { return []; }
    }
    return [];
}