// ============================================================================
// HỆ THỐNG QUẢN LÝ M_SIGMATEACHER - CORE LOGIC TOÀN DIỆN (APP.JS)
// Đầy đủ 100%: Quản lý Lớp & HS, deleteClass, renderClassesAndStudents,
//              Tự động bù điểm danh, Bộ chọn ngày đồ họa + Gợi ý nhanh,
//              Lịch dạy 2 tầng (chống lỗi JSON/String), Học phí FIFO lũy kế,
//              Rà soát trùng lặp toàn hệ thống, Xóa vĩnh viễn hồ sơ nghỉ,
//              Bóc tách đề thi KaTeX 3 phần & Chấm thi ma trận GDPT mới.
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

// ============================================================================
// 1. CÁC HÀM TIỆN ÍCH DỮ LIỆU & NGÀY THÁNG (DD-MM-YYYY)
// ============================================================================
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

function parseDateDDMMYYYY(str) {
    const clean = normalizeCloudDate(str);
    const p = clean.split('-');
    if (p.length === 3) return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
    return new Date();
}

function compareDateDDMMYYYY(d1, d2) {
    return parseDateDDMMYYYY(d1).getTime() - parseDateDDMMYYYY(d2).getTime();
}

function formatDateVN(d) { 
    return normalizeCloudDate(d) || '---'; 
}

function formatDateShortVN(d) {
    const clean = normalizeCloudDate(d);
    const p = clean.split('-');
    return p.length === 3 ? `${p[0]}/${p[1]}` : clean;
}

function getStoredAdminPin() { 
    return localStorage.getItem(ADMIN_PIN_KEY) || '123456'; 
}

function saveToStorage() { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); 
}

function loadFromStorage() { 
    const st = localStorage.getItem(STORAGE_KEY); 
    if(st) {
        try { 
            appData = JSON.parse(st); 
            if(!appData.classes) appData.classes = [];
            if(!appData.students) appData.students = [];
            if(!appData.attendance) appData.attendance = [];
            if(!appData.payments) appData.payments = [];
            if(!appData.documents) appData.documents = [];
            if(!appData.exams) appData.exams = [];
            if(!appData.examResults) appData.examResults = [];
            if(!appData.weeklyOverrides) appData.weeklyOverrides = []; 
            if(!appData.inactiveStudents) appData.inactiveStudents = [];
            if(!appData.appConfig) appData.appConfig = [];
        } catch(e) {
            console.error("Lỗi đọc storage:", e);
        }
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

function autoSaveApiUrl(val) {
    const url = (val || '').trim();
    if (url) {
        cloudApiUrl = url;
        localStorage.setItem('API_URL', url);
        updateSyncStatus('syncing', 'Đang lưu URL');
    }
}

function saveApiUrlSetting() { 
    const inputVal = document.getElementById('inputApiUrl').value.trim();
    if (!inputVal) {
        alert("Vui lòng nhập đường dẫn Google Apps Script URL!");
        return;
    }
    cloudApiUrl = inputVal;
    localStorage.setItem('API_URL', cloudApiUrl); 
    alert('Đã lưu cấu hình API thành công! Đang tải dữ liệu...'); 
    loadDataFromCloud(); 
}

async function manualSync() { 
    if(cloudApiUrl) loadDataFromCloud(); 
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
    const name = document.getElementById('inputStudentName').value;
    const cId = document.getElementById('inputStudentClassId').value;
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

// Giải mã mảng lịch học an toàn (hỗ trợ cả JSON string và Array)
function getSafeClassSchedules(c) {
    if (!c || !c.schedules) return [];
    if (Array.isArray(c.schedules)) return c.schedules;
    if (typeof c.schedules === 'string') {
        try {
            const parsed = JSON.parse(c.schedules);
            return Array.isArray(parsed) ? parsed : [];
        } catch(e) {
            return [];
        }
    }
    return [];
}

// ============================================================================
// 2. KHỞI TẠO HỆ THỐNG & ĐỒNG BỘ CLOUD (AN TOÀN OFFLINE-FIRST)
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    try {
        checkAdminSession();
        loadFromStorage();
        
        const datePicker = document.getElementById('sessionDatePicker');
        if (datePicker) datePicker.value = getTodayVNString();
        
        const joinInput = document.getElementById('inputStudentJoinDate');
        if (joinInput) joinInput.value = getTodayVNString();
        
        const apiInput = document.getElementById('inputApiUrl');
        if (apiInput) apiInput.value = cloudApiUrl || '';

        initScheduleRows();
        previewFullClassName();
        renderGlobalClassSelect();

        // Render ngay lập tức dữ liệu từ bộ nhớ máy trước (tránh trắng bảng)
        switchTab('dashboard');

        setupDirectImagePaste();
        if (window.lucide) lucide.createIcons();

        // Sau đó mới tải ngầm từ Google Apps Script
        if (cloudApiUrl) loadDataFromCloud();
    } catch (err) {
        console.error("Lỗi khởi tạo hệ thống:", err);
    }
});

async function loadDataFromCloud() {
    if(!cloudApiUrl) return; 
    updateSyncStatus('syncing', 'Đang tải...');
    try {
        const res = await fetch(cloudApiUrl); 
        const j = await res.json();
        
        if(j.Classes) {
            appData.classes = j.Classes.slice(1).map(r => ({
                id: String(r[0]||''), 
                name: String(r[1]||''), 
                fee: parseFloat(r[2])||300000, 
                schedules: (function(){ try { return typeof r[3] === 'string' ? JSON.parse(r[3] || '[]') : (r[3] || []); } catch(e) { return []; } })()
            }));
        }
        if(j.Students) appData.students = j.Students.slice(1).map(r=>({id:String(r[0]||''), classId:String(r[1]||''), code:String(r[2]||''), name:String(r[3]||''), phone:String(r[4]||''), joinDate:normalizeCloudDate(r[5]||'01-08-2026'), customFee:r[6]!==''&&r[6]!==null?parseFloat(r[6]):null, username:String(r[7]||''), password:String(r[8]||'')}));
        
        if(j.Attendance) appData.attendance = j.Attendance.slice(1).map(r => {
            const sId = String(r[0]||'');
            const cId = (r.length >= 5) ? String(r[1]||'') : (appData.students.find(s=>s.id===sId)?.classId || '');
            const d = (r.length >= 5) ? normalizeCloudDate(r[2]||'') : normalizeCloudDate(r[1]||'');
            const st = (r.length >= 5) ? String(r[3]||'') : String(r[2]||'');
            const n = (r.length >= 5) ? String(r[4]||'') : String(r[3]||'');
            return { studentId: sId, classId: cId, date: d, status: st, note: n };
        });

        if(j.Payments) appData.payments = j.Payments.slice(1).map(r=>({id:String(r[0]||''), studentId:String(r[1]||''), classId:String(r[2]||''), cycleIndex:parseInt(r[3]), amount:parseFloat(r[4])||0, status:String(r[5]||''), method:String(r[6]||''), note:String(r[7]||''), date:normalizeCloudDate(r[8]||'')}));
        if(j.Documents) appData.documents = j.Documents.slice(1).map(r=>({id:String(r[0]||''), classId:String(r[1]||''), name:String(r[2]||''), category:String(r[3]||'Chuyên đề chung'), url:String(r[4]||'')}));
        
        if(j.Exams) appData.exams = j.Exams.slice(1).map(r=>({
            id: String(r[0]||''),
            title: String(r[1]||''),
            classId: String(r[2]||''),
            duration: parseInt(r[3])||45,
            solutionUrl: String(r[4]||''),
            questions: JSON.parse(r[5]||'[]'),
            matrix: JSON.parse(r[6]||'{}'),
            status: String(r[7]||'OPEN')
        }));

        if(j.ExamResults) appData.examResults = j.ExamResults.slice(1).map(r=>({id:String(r[0]||''), examId:String(r[1]||''), studentId:String(r[2]||''), score:parseFloat(r[3]||0), details: (typeof r[4]==='string'?JSON.parse(r[4]||'{}'):(r[4]||{})), tabSwitchCount:parseInt(r[5]||0), submittedAt:String(r[6]||'')}));
        if(j.WeeklyOverrides) appData.weeklyOverrides = j.WeeklyOverrides.slice(1).map(r=>({id:String(r[0]||''), classId:String(r[1]||''), date:normalizeCloudDate(r[2]||''), type:String(r[3]||''), startTime:String(r[4]||''), endTime:String(r[5]||''), note:String(r[6]||'')}));
        
        if(j.InactiveStudents) appData.inactiveStudents = j.InactiveStudents.slice(1).map(r=>({
            id: String(r[0]||''), studentId: String(r[1]||''), studentCode: String(r[2]||''), studentName: String(r[3]||''),
            classId: String(r[4]||''), className: String(r[5]||''), phone: String(r[6]||''), joinDate: normalizeCloudDate(r[7]||''),
            leaveDate: normalizeCloudDate(r[8]||''), totalSessions: parseInt(r[9]||0), totalPaid: parseFloat(r[10]||0),
            debtAmount: parseFloat(r[11]||0), reason: String(r[12]||'')
        }));

        if(j.AppConfig) {
            appData.appConfig = j.AppConfig.slice(1).map(r=>({ key: String(r[0]||''), value: String(r[1]||'') }));
            loadBrandingToSettings();
        }

        saveToStorage(); 
        renderGlobalClassSelect(); 
        refreshCurrentTab(); 
        updateSyncStatus('success', 'Đã đồng bộ');
    } catch(e) { 
        console.warn("Không thể tải từ Cloud, tiếp tục dùng dữ liệu offline cache:", e);
        updateSyncStatus('error', 'Lỗi kết nối'); 
        renderGlobalClassSelect(); 
        refreshCurrentTab(); 
    }
}

async function saveDataToCloud() {
    saveToStorage(); 
    if(!cloudApiUrl) return; 
    updateSyncStatus('syncing', 'Đang lưu...');
    try {
        const payload = {
            Classes: [['id','name','fee','schedulesJson'], ...(appData.classes||[]).map(c=>[c.id,c.name,c.fee,JSON.stringify(c.schedules||[])])],
            Students: [['id','classId','code','name','phone','joinDate','customFee','username','password'], ...(appData.students||[]).map(s=>[s.id,s.classId,s.code,s.name,s.phone||'',normalizeCloudDate(s.joinDate)||'',s.customFee!==null?s.customFee:'',s.username||'',s.password||''])],
            Attendance: [['studentId','classId','date','status','note'], ...(appData.attendance||[]).map(a=>[a.studentId, a.classId||'', normalizeCloudDate(a.date), a.status, a.note||''])],
            Payments: [['id','studentId','classId','cycleIndex','amount','status','method','note','date'], ...(appData.payments||[]).map(p=>[p.id,p.studentId,p.classId,p.cycleIndex,p.amount,p.status,p.method,p.note||'',normalizeCloudDate(p.date)])],
            Documents: [['id','classId','name','category','url'], ...(appData.documents||[]).map(d=>[d.id,d.classId,d.name,d.category||'Chuyên đề chung',d.url])],
            Exams: [['id','title','classId','duration','solutionUrl','questionsJson','matrixJson','status'], ...(appData.exams||[]).map(e=>[e.id, e.title, e.classId, e.duration||45, e.solutionUrl||'', JSON.stringify(e.questions||[]), JSON.stringify(e.matrix||{}), e.status||'OPEN'])],
            ExamResults: [['id','examId','studentId','score','detailsJson','tabSwitchCount','submittedAt'], ...(appData.examResults||[]).map(r=>[r.id,r.examId,r.studentId,r.score,JSON.stringify(r.details||{}),r.tabSwitchCount,r.submittedAt])],
            WeeklyOverrides: [['id','classId','date','type','startTime','endTime','note'], ...(appData.weeklyOverrides||[]).map(o=>[o.id,o.classId,normalizeCloudDate(o.date),o.type,o.startTime||'',o.endTime||'',o.note||''])],
            InactiveStudents: [['id','studentId','studentCode','studentName','classId','className','phone','joinDate','leaveDate','totalSessions','totalPaid','debtAmount','reason'], ...(appData.inactiveStudents||[]).map(x=>[x.id, x.studentId, x.studentCode, x.studentName, x.classId, x.className, x.phone||'', normalizeCloudDate(x.joinDate), normalizeCloudDate(x.leaveDate), x.totalSessions, x.totalPaid, x.debtAmount, x.reason||''])],
            AppConfig: [['key','value'], ...(appData.appConfig||[]).map(c=>[c.key, c.value])]
        };
        await fetch(cloudApiUrl, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({action: 'saveAll', payload})});
        updateSyncStatus('success', 'Đã lưu');
    } catch(e) { 
        updateSyncStatus('error', 'Lỗi lưu'); 
    }
}

// ============================================================================
// 3. XÁC THỰC MÃ PIN & ĐIỀU HƯỚNG GIAO DIỆN
// ============================================================================
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

    alert('Đổi mã PIN quản trị thành công! Vui lòng xác thực lại bằng mã PIN mới.');
    e.target.reset();
    checkAdminSession();
}

function renderGlobalClassSelect() {
    const sel = document.getElementById('globalClassSelect');
    if (!sel) return;
    sel.innerHTML = `<option value="ALL">🌟 TẤT CẢ CÁC LỚP</option>` + (appData.classes || []).map(c => 
        `<option value="${c.id}" ${c.id === currentClassId ? 'selected' : ''}>Lớp: ${c.name}</option>`
    ).join('');
    
    const countBadge = document.getElementById('badgeStudentCount');
    if (countBadge) countBadge.innerText = `${getFilteredStudents().length} HS`;
}

function onGlobalClassChange() {
    currentClassId = document.getElementById('globalClassSelect').value;
    const countBadge = document.getElementById('badgeStudentCount');
    if (countBadge) countBadge.innerText = `${getFilteredStudents().length} HS`;
    refreshCurrentTab();
}

function switchTab(id) {
    currentTab = id;
    document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => { 
        b.classList.remove('bg-indigo-800','text-white','shadow'); 
        b.classList.add('text-slate-300'); 
    });
    const t = document.getElementById(`tab-${id}`); 
    if(t) t.classList.remove('hidden');
    const ab = document.getElementById(`tab-btn-${id}`); 
    if(ab) { 
        ab.classList.add('bg-indigo-800','text-white','shadow'); 
        ab.classList.remove('text-slate-300'); 
    }
    refreshCurrentTab();
}

function refreshCurrentTab() {
    if(currentTab === 'dashboard') renderDashboard();
    if(currentTab === 'classes') renderClassesAndStudents();
    if(currentTab === 'inactive-students') renderInactiveStudents();
    if(currentTab === 'schedule') renderScheduleTab();
    if(currentTab === 'attendance-session') loadSessionAttendance();
    if(currentTab === 'attendance-matrix') renderAttendanceMatrix();
    if(currentTab === 'tuition') renderTuitionTable();
    if(currentTab === 'history') renderPaymentHistory();
    if(currentTab === 'qbank') renderQBankTab();
    if(currentTab === 'analytics') renderAnalyticsReport();
    if(currentTab === 'documents') renderDocumentsTab();
    if(window.lucide) lucide.createIcons();
}

// ============================================================================
// 4. QUẢN LÝ LỚP & HỌC SINH (renderClassesAndStudents & deleteClass)
// ============================================================================
function renderClassesAndStudents() {
    // 1. Hiển thị danh sách các lớp đang có ở cột bên trái
    const classContainer = document.getElementById('classListContainer');
    if (classContainer) {
        classContainer.innerHTML = (appData.classes || []).map(c => `
            <div class="p-2.5 rounded-xl border flex justify-between items-center bg-slate-50 text-xs">
                <span class="font-bold text-slate-800">${c.name} (${(c.fee || 300000).toLocaleString()}đ)</span>
                <div class="flex items-center space-x-1">
                    <button onclick="openEditClassModal('${c.id}')" class="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-lg" title="Sửa tên lớp & lịch học cố định">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="deleteClass('${c.id}')" class="text-rose-500 hover:bg-rose-100 p-1.5 rounded-lg" title="Xóa lớp">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
        `).join('') || '<div class="text-xs text-slate-400 italic">Chưa có lớp nào</div>';
    }

    // 2. Hiển thị bảng danh sách học sinh ở bảng bên phải
    const stds = getFilteredStudents();
    const tableBody = document.getElementById('studentTableBody');
    if (!tableBody) return;

    if (!stds || stds.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 italic">Không có học sinh nào trong danh sách.</td></tr>`;
        return;
    }

    tableBody.innerHTML = stds.map(s => {
        try {
            const c = (appData.classes || []).find(x => x.id === s.classId);
            const className = c ? c.name : 'Chưa phân lớp';
            const fee = getEffectiveStudentFee(s, c);
            const feeText = fee === 0 ? 'Miễn phí' : fee.toLocaleString() + 'đ';
            const feeClass = fee === 0 ? 'text-blue-600' : 'text-emerald-600';

            return `
                <tr>
                    <td class="p-2.5 sm:p-3"><span class="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px]">${className}</span></td>
                    <td class="p-2.5 sm:p-3 font-mono font-bold">${s.code || '---'}</td>
                    <td class="p-2.5 sm:p-3 font-bold">${s.name || '---'}</td>
                    <td class="p-2.5 sm:p-3 font-mono text-indigo-600 font-bold">${s.username || '---'}</td>
                    <td class="p-2.5 sm:p-3 font-mono">${formatDateVN(s.joinDate)}</td>
                    <td class="p-2.5 sm:p-3 font-bold ${feeClass}">${feeText}</td>
                    <td class="p-2.5 sm:p-3 text-center space-x-1">
                        <button onclick="impersonateStudent('${s.id}')" class="text-teal-600 hover:bg-teal-50 p-1.5 rounded-lg transition" title="Xem Cổng Học Sinh (Giả lập em ${s.name})">
                            <i data-lucide="eye" class="w-3.5 h-3.5 inline"></i>
                        </button>
                        <button onclick="openEditStudentModal('${s.id}')" class="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition" title="Sửa / Chuyển lớp">
                            <i data-lucide="pencil" class="w-3.5 h-3.5 inline"></i>
                        </button>
                        <button onclick="openLeaveStudentModal('${s.id}')" class="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition" title="Báo nghỉ học & Chốt nợ">
                            <i data-lucide="user-minus" class="w-3.5 h-3.5 inline"></i>
                        </button>
                    </td>
                </tr>
            `;
        } catch (err) {
            console.error("Lỗi dòng học sinh:", s, err);
            return '';
        }
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function deleteClass(id) { 
    const c = (appData.classes || []).find(x => x.id === id);
    const className = c ? c.name : 'này';

    if (confirm(`Thầy có chắc chắn muốn XÓA lớp "${className}" không?\nToàn bộ học sinh thuộc lớp này cũng sẽ bị xóa khỏi danh sách.`)) { 
        appData.classes = (appData.classes || []).filter(x => x.id !== id); 
        appData.students = (appData.students || []).filter(x => x.classId !== id); 
        saveDataToCloud(); 
        renderGlobalClassSelect(); 
        refreshCurrentTab(); 
        alert(`Đã xóa lớp "${className}" thành công!`);
    } 
}

function previewFullClassName() {
    const grade = document.getElementById('inputClassGrade').value;
    const subName = document.getElementById('inputClassSubName').value.trim().toUpperCase();
    const fullName = (grade === 'Khac') ? subName : (grade + subName);
    const prevEl = document.getElementById('previewClassNameText');
    if (prevEl) prevEl.innerText = fullName || '---';
}

function handleAddClass(e) {
    e.preventDefault();
    const grade = document.getElementById('inputClassGrade').value;
    const subName = document.getElementById('inputClassSubName').value.trim().toUpperCase();
    const fullName = (grade === 'Khac') ? subName : (grade + subName);
    
    if (!subName) { alert("Vui lòng nhập tên nhóm/lớp (VD: N1, N2)!"); return; }

    const isExisted = (appData.classes || []).some(c => c.name.toUpperCase() === fullName);
    if (isExisted) { alert(`Lớp ${fullName} đã tồn tại trong danh sách!`); return; }

    const fee = parseFloat(document.getElementById('inputClassFee').value) || 300000;
    const schs = []; 
    document.querySelectorAll('#scheduleRowsContainer > div').forEach(r => {
        schs.push({ 
            day: r.querySelector('.sch-day').value, 
            startTime: r.querySelector('.sch-start').value, 
            endTime: r.querySelector('.sch-end').value 
        });
    });

    appData.classes.push({ 
        id: 'c_' + Date.now(), 
        name: fullName, 
        fee: fee, 
        schedules: schs 
    });

    saveDataToCloud(); 
    document.getElementById('formAddClass').reset(); 
    document.getElementById('inputClassFee').value = '300000';
    initScheduleRows(); 
    previewFullClassName();
    renderGlobalClassSelect(); 
    refreshCurrentTab();
    alert(`Đã thêm lớp ${fullName} thành công!`);
}

function getClassBadgeTheme(className, isExtra = false) {
    if (isExtra) {
        return {
            cardBg: 'border-l-4 border-l-amber-500 border-amber-200 bg-amber-50/40 text-amber-950',
            timeBadge: 'bg-amber-600 text-white font-black shadow-sm',
            dot: 'bg-amber-500'
        };
    }

    const clean = String(className || '').toUpperCase().trim();
    let grade = '10';
    if (clean.startsWith('11')) grade = '11';
    else if (clean.startsWith('12')) grade = '12';

    let cardBg = 'border-l-4 border-l-emerald-600 border-emerald-200 bg-emerald-50/30 text-emerald-950';
    if (grade === '11') {
        cardBg = 'border-l-4 border-l-sky-600 border-sky-200 bg-sky-50/30 text-sky-950';
    } else if (grade === '12') {
        cardBg = 'border-l-4 border-l-indigo-600 border-indigo-200 bg-indigo-50/30 text-indigo-950';
    }

    let timeBadge = 'bg-slate-700 text-white font-black shadow-sm';
    let dot = 'bg-slate-600';

    if (clean.includes('N1') || clean.endsWith('1')) {
        timeBadge = 'bg-blue-600 text-white font-black shadow-sm';
        dot = 'bg-blue-600';
    } else if (clean.includes('N2') || clean.endsWith('2')) {
        timeBadge = 'bg-amber-600 text-white font-black shadow-sm';
        dot = 'bg-amber-600';
    } else if (clean.includes('N3') || clean.endsWith('3')) {
        timeBadge = 'bg-purple-600 text-white font-black shadow-sm';
        dot = 'bg-purple-600';
    } else if (clean.includes('N4') || clean.endsWith('4')) {
        timeBadge = 'bg-rose-600 text-white font-black shadow-sm';
        dot = 'bg-rose-600';
    } else if (clean.includes('N5') || clean.endsWith('5')) {
        timeBadge = 'bg-emerald-600 text-white font-black shadow-sm';
        dot = 'bg-emerald-600';
    }

    return { cardBg, timeBadge, dot };
}

function generateNextStudentCode(classId) {
    const targetClass = (appData.classes || []).find(c => c.id === classId);
    if (!targetClass) return 'HS001';

    const gradeMatch = targetClass.name.match(/^(\d+)/);
    const gradePrefix = gradeMatch ? gradeMatch[1] : targetClass.name.substring(0, 2).toUpperCase();

    const sameGradeClassIds = (appData.classes || [])
        .filter(c => c.name.startsWith(gradePrefix))
        .map(c => c.id);

    const activeStudentsInGrade = (appData.students || []).filter(s => sameGradeClassIds.includes(s.classId));
    const inactiveStudentsInGrade = (appData.inactiveStudents || []).filter(s => sameGradeClassIds.includes(s.classId));
    const allStudentsInGrade = [...activeStudentsInGrade, ...inactiveStudentsInGrade];

    let maxSeq = 0;
    const codeRegex = new RegExp(`^${gradePrefix}(\\d{3,})$`);

    allStudentsInGrade.forEach(s => {
        if (s.code) {
            const match = String(s.code).trim().match(codeRegex);
            if (match) {
                const seq = parseInt(match[1], 10);
                if (seq > maxSeq) maxSeq = seq;
            }
        }
    });

    const nextSeq = maxSeq + 1;
    return `${gradePrefix}${String(nextSeq).padStart(3, '0')}`;
}

async function backupDatabaseNow() {
    if (!cloudApiUrl) { alert('Chưa cấu hình API URL!'); return; }
    if (!confirm('Tạo một bản sao lưu toàn bộ Google Sheets sang Google Drive ngay bây giờ?')) return;
    updateSyncStatus('syncing', 'Đang sao lưu...');
    try {
        const res = await fetch(cloudApiUrl, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: 'backupNow' })
        });
        const result = await res.json();
        alert(result.message || 'Đã tạo bản sao lưu dữ liệu!');
        updateSyncStatus('success', 'Đã sao lưu');
    } catch(err) {
        alert('Đã gửi yêu cầu sao lưu sang Google Drive!');
        updateSyncStatus('success', 'Đã kích hoạt');
    }
}

function populateClassSelectModal() {
    ['inputStudentClassId', 'editStudentClassId', 'inputDocClassId'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = (appData.classes || []).map(c => 
            `<option value="${c.id}" ${c.id === (currentClassId === 'ALL' ? appData.classes[0]?.id : currentClassId) ? 'selected' : ''}>${c.name}</option>`
        ).join('');
    });
}

function openAddStudentModal() {
    populateClassSelectModal();
    onStudentClassModalChange();
    document.getElementById('modalAddStudent').classList.remove('hidden');
}

function closeAddStudentModal() { 
    document.getElementById('modalAddStudent').classList.add('hidden'); 
}

function onStudentClassModalChange() {
    const s = document.getElementById('inputStudentClassId');
    const c = document.getElementById('inputStudentCode');
    if(s && c) c.value = generateNextStudentCode(s.value);
    previewGeneratedUsername();
}

function handleAddStudent(e) {
    e.preventDefault();
    const cId = document.getElementById('inputStudentClassId').value;
    const c = (appData.classes || []).find(x => x.id === cId);
    const name = document.getElementById('inputStudentName').value.trim();
    const phone = document.getElementById('inputStudentPhone').value.trim();
    const joinDate = normalizeCloudDate(document.getElementById('inputStudentJoinDate').value.trim());

    // KIỂM TRA TRÙNG LẶP TOÀN HỆ THỐNG
    const cleanName = name.toLowerCase().replace(/\s+/g, ' ');
    const duplicates = (appData.students || []).filter(s => s.name.toLowerCase().replace(/\s+/g, ' ') === cleanName);

    if (duplicates.length > 0) {
        const dupInfo = duplicates.map(d => {
            const dClass = (appData.classes || []).find(cls => cls.id === d.classId);
            return `• Lớp ${dClass ? dClass.name : '---'} (Mã: ${d.code}, SĐT: ${d.phone || 'chưa có'})`;
        }).join('\n');

        const confirmMsg = `⚠️ CẢNH BÁO TRÙNG TÊN!\n\nHệ thống phát hiện học sinh "${name}" đã có trong hệ thống:\n${dupInfo}\n\nThầy có chắc chắn đây là 2 học sinh KHÁC NHAU và muốn tiếp tục thêm vào lớp ${c ? c.name : ''}?`;
        if (!confirm(confirmMsg)) return;
    }

    const newStudentId = 's_' + Date.now();
    const username = generateUsername(name, c ? c.name : '');
    const defaultPassword = phone || '123456';

    appData.students.push({
        id: newStudentId,
        classId: cId,
        code: document.getElementById('inputStudentCode').value.trim(),
        name: name,
        phone: phone,
        joinDate: joinDate,
        customFee: null,
        username: username,
        password: defaultPassword
    });

    // TỰ ĐỘNG BÙ ĐIỂM DANH CHO CÁC BUỔI SAU NGÀY VÀO HỌC
    const backfilled = autoBackfillAttendanceForNewStudent(newStudentId, cId, joinDate);

    saveDataToCloud();
    closeAddStudentModal();
    refreshCurrentTab();

    let msg = `Đã thêm học sinh ${name}!\nTài khoản: ${username}\nMật khẩu: ${defaultPassword}`;
    if (backfilled > 0) {
        msg += `\n\n⚡ Hệ thống đã tự động bù điểm danh "${backfilled} buổi học" diễn ra sau ngày vào học cho em!`;
    }
    alert(msg);
}

async function autoGenerateAccountsForOldStudents() {
    if (!appData.students || appData.students.length === 0) { alert("Danh sách học sinh đang trống!"); return; }
    let updatedCount = 0;
    appData.students.forEach(s => {
        if (!s.username || s.username.trim() === '' || s.username === '---') {
            const c = (appData.classes || []).find(x => x.id === s.classId);
            const newUsername = generateUsername(s.name, c ? c.name : '');
            s.username = newUsername;
            if (!s.password || s.password.trim() === '') {
                s.password = (s.phone && s.phone.trim() !== '') ? s.phone.trim() : '123456';
            }
            updatedCount++;
        }
    });
    if (updatedCount === 0) { alert("Tất cả học sinh đều đã có tài khoản!"); return; }
    if (confirm(`Tìm thấy ${updatedCount} học sinh chưa có tài khoản. Tạo tự động và lưu lên Google Sheets?`)) {
        await saveDataToCloud();
        refreshCurrentTab();
        alert(`✅ Đã tạo tài khoản cho ${updatedCount} học sinh thành công!`);
    }
}

function openEditStudentModal(id) {
    const s = (appData.students || []).find(x => x.id === id);
    if(!s) return;
    populateClassSelectModal();

    document.getElementById('editStudentId').value = s.id;
    document.getElementById('editOriginalClassId').value = s.classId;
    document.getElementById('editStudentClassId').value = s.classId;
    document.getElementById('editStudentCode').value = s.code;
    document.getElementById('editStudentName').value = s.name;
    document.getElementById('editStudentUsername').value = s.username || '';
    document.getElementById('editStudentPhone').value = s.phone || '';
    document.getElementById('editStudentJoinDate').value = normalizeCloudDate(s.joinDate) || getTodayVNString();
    document.getElementById('editStudentCustomFee').value = s.customFee !== null ? s.customFee : '';

    document.getElementById('modalEditStudent').classList.remove('hidden');
}

function closeEditStudentModal() { 
    document.getElementById('modalEditStudent').classList.add('hidden'); 
}

function onEditClassChange() {
    const studentId = document.getElementById('editStudentId').value;
    const origClassId = document.getElementById('editOriginalClassId').value;
    const newClassId = document.getElementById('editStudentClassId').value;
    
    if (newClassId !== origClassId) {
        document.getElementById('editStudentJoinDate').value = getTodayVNString();
        document.getElementById('editStudentCode').value = generateNextStudentCode(newClassId);

        const transferInfo = calculateTransferTuition(studentId, origClassId, newClassId);
        if (transferInfo && transferInfo.attendedInOldCycle > 0) {
            const msg = `Phát hiện học sinh đã học ${transferInfo.attendedInOldCycle} buổi tại ${transferInfo.oldClassName}.\n` +
                        `Lớp mới ${transferInfo.newClassName} còn ${transferInfo.remainingInNewCycle} buổi nữa là hết kỳ.\n\n` +
                        `Thầy có muốn CỘNG DỒN LIÊN TỤC (${transferInfo.attendedInOldCycle}b cũ + ${transferInfo.remainingInNewCycle}b mới = ${transferInfo.totalCombinedSessions} buổi)?\n` +
                        `Tổng học phí đề xuất kỳ này: ${transferInfo.totalTransferFee.toLocaleString()} đ`;
            if (confirm(msg)) {
                document.getElementById('formEditStudent').dataset.transferCalc = JSON.stringify(transferInfo);
            }
        }
    }
}

function handleSaveEditStudent(e) {
    e.preventDefault();
    const id = document.getElementById('editStudentId').value;
    const s = (appData.students || []).find(x => x.id === id);
    if (!s) return;

    const oldClassId = s.classId;
    const newClassId = document.getElementById('editStudentClassId').value;

    s.classId = newClassId;
    s.code = document.getElementById('editStudentCode').value.trim();
    s.name = document.getElementById('editStudentName').value.trim();
    s.phone = document.getElementById('editStudentPhone').value.trim();
    s.joinDate = normalizeCloudDate(document.getElementById('editStudentJoinDate').value.trim());
    
    const c = (appData.classes || []).find(x => x.id === s.classId);
    s.username = generateUsername(s.name, c ? c.name : '');

    const custFee = document.getElementById('editStudentCustomFee').value;
    s.customFee = custFee !== '' ? parseFloat(custFee) : null;

    const transferCalcStr = document.getElementById('formEditStudent').dataset.transferCalc;
    if (transferCalcStr && oldClassId !== newClassId) {
        try {
            const tf = JSON.parse(transferCalcStr);
            appData.payments = (appData.payments || []).filter(p => !(p.studentId === s.id && p.classId === oldClassId && p.cycleIndex === tf.oldCycleIndex));
            appData.payments.push({
                id: 'p_' + Date.now() + '_old',
                studentId: s.id,
                classId: oldClassId,
                cycleIndex: tf.oldCycleIndex,
                amount: 0,
                status: 'EXEMPT',
                method: 'Gộp sang lớp mới',
                note: `Đã gộp ${tf.attendedInOldCycle} buổi sang lớp ${tf.newClassName}`,
                date: getTodayVNString()
            });

            appData.payments = (appData.payments || []).filter(p => !(p.studentId === s.id && p.classId === newClassId && p.cycleIndex === tf.newCycleIndex));
            appData.payments.push({
                id: 'p_' + Date.now() + '_new',
                studentId: s.id,
                classId: newClassId,
                cycleIndex: tf.newCycleIndex,
                amount: tf.totalTransferFee,
                status: 'PENDING',
                method: 'Chờ thu',
                note: `Cộng dồn liên tục: ${tf.attendedInOldCycle}b lớp cũ (${tf.oldClassName}) + ${tf.remainingInNewCycle}b lớp mới = ${tf.totalCombinedSessions} buổi`,
                date: getTodayVNString()
            });
            delete document.getElementById('formEditStudent').dataset.transferCalc;
        } catch(err){}
    }

    saveDataToCloud();
    closeEditStudentModal();
    refreshCurrentTab();
    alert(`Đã cập nhật thông tin học sinh!`);
}

function calculateTransferTuition(studentId, oldClassId, newClassId) {
    if (!oldClassId || !newClassId || oldClassId === newClassId) return null;

    const oldClass = (appData.classes || []).find(c => c.id === oldClassId);
    const newClass = (appData.classes || []).find(c => c.id === newClassId);
    if (!oldClass || !newClass) return null;

    const oldClassSessions = getClassSessionDates(oldClassId);
    const oldTotalSess = oldClassSessions.length;
    const oldActiveCycle = Math.max(0, Math.floor((oldTotalSess - 1) / 8));
    const oldCycleDates = oldClassSessions.slice(oldActiveCycle * 8, (oldActiveCycle + 1) * 8);

    const attendedInOldCycle = (appData.attendance || []).filter(a => 
        a.studentId === studentId && 
        a.classId === oldClassId && 
        oldCycleDates.includes(normalizeCloudDate(a.date)) &&
        (a.status === 'PRESENT' || a.status === 'LATE')
    ).length;

    const newClassSessions = getClassSessionDates(newClassId);
    const newTotalSess = newClassSessions.length;
    const newActiveCycle = Math.max(0, Math.floor((newTotalSess - 1) / 8));
    const sessTaughtInNewCycle = newTotalSess % 8;
    const remainingInNewCycle = 8 - sessTaughtInNewCycle;

    const totalCombinedSessions = attendedInOldCycle + remainingInNewCycle;
    const feePerSession = newClass.fee / 8;
    const totalTransferFee = Math.round(feePerSession * totalCombinedSessions);

    return {
        attendedInOldCycle,
        oldCycleIndex: oldActiveCycle,
        remainingInNewCycle,
        newCycleIndex: newActiveCycle,
        totalCombinedSessions,
        totalTransferFee,
        oldClassName: oldClass.name,
        newClassName: newClass.name
    };
}

// ============================================================================
// 5. HỒ SƠ NGHỈ HỌC, CHỐT NỢ & XÓA VĨNH VIỄN
// ============================================================================
function openLeaveStudentModal(id) {
    const s = (appData.students || []).find(x => x.id === id);
    if(!s) return;
    const c = (appData.classes || []).find(x => x.id === s.classId);

    const attendedCount = (appData.attendance || []).filter(a => a.studentId === s.id && (a.status === 'PRESENT' || a.status === 'LATE')).length;
    const paidTotal = (appData.payments || []).filter(p => p.studentId === s.id && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

    const effFee = getEffectiveStudentFee(s, c);
    const feePerSession = effFee > 0 ? (effFee / 8) : 0;
    const requiredTuition = Math.round(feePerSession * attendedCount);
    const debt = Math.max(0, requiredTuition - paidTotal);

    document.getElementById('leaveStudentId').value = s.id;
    document.getElementById('leaveStudentInfo').value = `${s.name} (${s.code}) - Lớp ${c ? c.name : ''}`;
    document.getElementById('leaveDateInput').value = getTodayVNString();
    document.getElementById('leaveTotalSessionsText').innerText = `${attendedCount} buổi`;
    document.getElementById('leaveTotalPaidText').innerText = `${paidTotal.toLocaleString()} đ`;
    document.getElementById('leaveDebtInput').value = debt;
    document.getElementById('leaveReasonInput').value = '';

    document.getElementById('modalLeaveStudent').classList.remove('hidden');
}

function closeLeaveModal() { 
    document.getElementById('modalLeaveStudent').classList.add('hidden'); 
}

function handleConfirmStudentLeave(e) {
    e.preventDefault();
    const id = document.getElementById('leaveStudentId').value;
    const s = (appData.students || []).find(x => x.id === id);
    if(!s) return;
    const c = (appData.classes || []).find(x => x.id === s.classId);

    const leaveDate = normalizeCloudDate(document.getElementById('leaveDateInput').value.trim());
    const debt = parseFloat(document.getElementById('leaveDebtInput').value) || 0;
    const reason = document.getElementById('leaveReasonInput').value.trim();

    const attendedCount = (appData.attendance || []).filter(a => a.studentId === s.id && (a.status === 'PRESENT' || a.status === 'LATE')).length;
    const paidTotal = (appData.payments || []).filter(p => p.studentId === s.id && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

    if(!appData.inactiveStudents) appData.inactiveStudents = [];
    appData.inactiveStudents.push({
        id: 'inact_' + Date.now(),
        studentId: s.id,
        studentCode: s.code,
        studentName: s.name,
        classId: s.classId,
        className: c ? c.name : '---',
        phone: s.phone || '',
        joinDate: normalizeCloudDate(s.joinDate) || '',
        leaveDate: leaveDate,
        totalSessions: attendedCount,
        totalPaid: paidTotal,
        debtAmount: debt,
        reason: reason
    });

    appData.students = (appData.students || []).filter(x => x.id !== id);

    saveDataToCloud();
    closeLeaveModal();
    refreshCurrentTab();
    alert(`Đã chuyển hồ sơ của ${s.name} vào Sổ Nghỉ Học!`);
}

function restoreInactiveStudent(inactiveId) {
    const inact = (appData.inactiveStudents || []).find(x => x.id === inactiveId);
    if(!inact) return;
    if(!confirm(`Khôi phục học sinh ${inact.studentName} trở lại lớp?`)) return;

    appData.students.push({
        id: inact.studentId,
        classId: inact.classId,
        code: inact.studentCode,
        name: inact.studentName,
        phone: inact.phone,
        joinDate: getTodayVNString(),
        customFee: null,
        username: generateUsername(inact.studentName, inact.className),
        password: inact.phone || '123456'
    });

    appData.inactiveStudents = (appData.inactiveStudents || []).filter(x => x.id !== inactiveId);
    saveDataToCloud();
    refreshCurrentTab();
    alert(`Đã khôi phục ${inact.studentName} thành công!`);
}

function deletePermanentlyInactiveStudent(inactiveId) {
    const inact = (appData.inactiveStudents || []).find(x => x.id === inactiveId);
    if (!inact) return;

    if (confirm(`Thầy có chắc chắn muốn XÓA HẲN hồ sơ của em "${inact.studentName}" (${inact.studentCode}) không?\nSau khi xóa, hồ sơ này sẽ không thể khôi phục lại được.`)) {
        appData.inactiveStudents = (appData.inactiveStudents || []).filter(x => x.id !== inactiveId);
        saveDataToCloud();
        renderInactiveStudents();
        alert(`Đã xóa vĩnh viễn hồ sơ của em ${inact.studentName}!`);
    }
}

function renderInactiveStudents() {
    const tbody = document.getElementById('inactiveStudentsTableBody');
    const list = appData.inactiveStudents || [];
    const countBadge = document.getElementById('inactiveStudentsCountBadge');
    if (countBadge) countBadge.innerText = `${list.length} Hồ Sơ`;

    if(!tbody) return;
    if(list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-400 italic">Chưa có học sinh nào nghỉ học.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(x => `
        <tr>
            <td class="p-2.5 sm:p-3 font-bold">${x.className}</td>
            <td class="p-2.5 sm:p-3 font-mono">${x.studentCode}</td>
            <td class="p-2.5 sm:p-3 font-bold">${x.studentName}</td>
            <td class="p-2.5 sm:p-3">${x.phone || '---'}</td>
            <td class="p-2.5 sm:p-3 font-mono text-rose-600">${formatDateVN(x.leaveDate)}</td>
            <td class="p-2.5 sm:p-3 text-center">${x.totalSessions} buổi</td>
            <td class="p-2.5 sm:p-3 font-bold text-emerald-600">${(x.totalPaid || 0).toLocaleString()}đ</td>
            <td class="p-2.5 sm:p-3 font-black ${x.debtAmount>0?'text-rose-600 bg-rose-50':'text-slate-400'}">${x.debtAmount>0?x.debtAmount.toLocaleString()+'đ':'Hết nợ'}</td>
            <td class="p-2.5 sm:p-3 text-slate-600 italic">${x.reason}</td>
            <td class="p-2.5 sm:p-3 text-center space-x-1.5">
                <button onclick="restoreInactiveStudent('${x.id}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg font-bold text-xs transition">Khôi Phục</button>
                <button onclick="deletePermanentlyInactiveStudent('${x.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 px-2 py-1 rounded-lg font-bold text-xs transition" title="Xóa vĩnh viễn hồ sơ này khỏi hệ thống">Xóa</button>
            </td>
        </tr>
    `).join('');
}

// ============================================================================
// 6. RÀ SOÁT TRÙNG LẶP HỌC SINH TOÀN HỆ THỐNG
// ============================================================================
function findDuplicateGroups() {
    const students = appData.students || [];
    const groups = {};

    const normalizeName = (name) => {
        return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    };

    students.forEach(s => {
        const keyName = normalizeName(s.name);
        if (!keyName) return;
        if (!groups[keyName]) groups[keyName] = [];
        groups[keyName].push(s);
    });

    const duplicateList = [];
    for (const key in groups) {
        if (groups[key].length > 1) {
            duplicateList.push({
                matchedBy: 'Họ và tên',
                keyName: groups[key][0].name,
                items: groups[key]
            });
        }
    }

    return duplicateList;
}

function openDuplicateAuditModal() {
    const duplicates = findDuplicateGroups();
    const container = document.getElementById('duplicateAuditContentArea');
    if (!container) return;

    if (duplicates.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
                    <i data-lucide="check-check" class="w-6 h-6"></i>
                </div>
                <h4 class="font-bold text-sm text-emerald-900">Dữ liệu học sinh rất sạch!</h4>
                <p class="text-xs text-emerald-700">Hệ thống đã quét qua tất cả các lớp và không phát hiện trường hợp trùng lặp họ tên nào.</p>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-bold flex justify-between items-center">
                <span>Phát hiện <b>${duplicates.length}</b> nhóm học sinh có nguy cơ trùng lặp:</span>
                <span class="text-[11px] text-amber-700">Kiểm tra số buổi & số tiền để giữ đúng học sinh</span>
            </div>
            <div class="space-y-4">
                ${duplicates.map((group, gIdx) => {
                    return `
                        <div class="border rounded-2xl overflow-hidden shadow-xs border-amber-200 bg-white">
                            <div class="p-3 bg-slate-50 border-b flex justify-between items-center font-bold">
                                <span class="text-indigo-950 font-black">Nhóm ${gIdx + 1}: ${group.keyName}</span>
                                <span class="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">${group.items.length} bản ghi</span>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-left text-xs whitespace-nowrap">
                                    <thead>
                                        <tr class="bg-slate-100/60 font-bold border-b text-slate-600">
                                            <th class="p-2.5">Lớp</th>
                                            <th class="p-2.5">Mã HS</th>
                                            <th class="p-2.5">SĐT</th>
                                            <th class="p-2.5">Ngày Vào</th>
                                            <th class="p-2.5 text-center">Số Buổi Đã Học</th>
                                            <th class="p-2.5">Tổng Đã Nộp</th>
                                            <th class="p-2.5 text-center">Thao Tác Xử Lý</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y">
                                        ${group.items.map(s => {
                                            const c = (appData.classes || []).find(x => x.id === s.classId);
                                            const attendedCount = (appData.attendance || []).filter(a => a.studentId === s.id && (a.status === 'PRESENT' || a.status === 'LATE')).length;
                                            const totalPaid = (appData.payments || []).filter(p => p.studentId === s.id && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

                                            return `
                                                <tr>
                                                    <td class="p-2.5 font-bold"><span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-bold">${c ? c.name : '---'}</span></td>
                                                    <td class="p-2.5 font-mono font-bold">${s.code}</td>
                                                    <td class="p-2.5 font-mono">${s.phone || '---'}</td>
                                                    <td class="p-2.5 font-mono">${formatDateVN(s.joinDate)}</td>
                                                    <td class="p-2.5 text-center font-bold text-indigo-700">${attendedCount} buổi</td>
                                                    <td class="p-2.5 font-bold text-emerald-600">${totalPaid.toLocaleString()}đ</td>
                                                    <td class="p-2.5 text-center space-x-1.5">
                                                        <button onclick="resolveDuplicateDelete('${s.id}', '${s.name}', '${c ? c.name : ''}')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg font-bold transition">
                                                            Xóa Dòng Này
                                                        </button>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    document.getElementById('modalDuplicateAudit').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeDuplicateAuditModal() {
    document.getElementById('modalDuplicateAudit').classList.add('hidden');
}

async function resolveDuplicateDelete(studentId, name, className) {
    if (!confirm(`Thầy có chắc chắn muốn XÓA học sinh "${name}" khỏi lớp "${className}" không?\n(Chỉ xóa dòng này, các dòng học sinh khác vẫn được giữ nguyên)`)) return;

    appData.students = (appData.students || []).filter(s => s.id !== studentId);
    appData.attendance = (appData.attendance || []).filter(a => a.studentId !== studentId);
    appData.payments = (appData.payments || []).filter(p => p.studentId !== studentId);

    await saveDataToCloud();
    refreshCurrentTab();
    openDuplicateAuditModal();
    alert(`Đã xóa thành công học sinh ${name} khỏi lớp ${className}!`);
}

// ============================================================================
// 7. BỘ CHỌN NGÀY & GỢI Ý ĐIỂM DANH THÔNG MINH
// ============================================================================
function onNativeDatePicked(isoDateStr) {
    if (!isoDateStr) return;
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
        const ddmmyyyy = `${parts[2]}-${parts[1]}-${parts[0]}`;
        const input = document.getElementById('sessionDatePicker');
        if (input) {
            input.value = ddmmyyyy;
            loadSessionAttendance();
        }
    }
}

function renderQuickDateSuggestions() {
    const container = document.getElementById('quickAttendanceDateSuggestions');
    if (!container) return;

    const todayStr = getTodayVNString();
    let html = `
        <button type="button" 
                onclick="setAttendanceDateQuick('${todayStr}')" 
                class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 sm:px-2.5 py-1.5 rounded-xl border border-indigo-200 text-[11px] transition">
            Hôm nay
        </button>
    `;

    const pastDates = getClassSessionDates(currentClassId);
    if (pastDates.length > 0) {
        const lastDate = pastDates[pastDates.length - 1];
        if (lastDate !== todayStr) {
            html += `
                <button type="button" 
                        onclick="setAttendanceDateQuick('${lastDate}')" 
                        class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1.5 rounded-xl border border-slate-200 text-[11px] transition">
                    Gần nhất (${formatDateShortVN(lastDate)})
                </button>
            `;
        }
    }

    container.innerHTML = html;
}

function setAttendanceDateQuick(dateStr) {
    const input = document.getElementById('sessionDatePicker');
    if (input) {
        input.value = dateStr;
        loadSessionAttendance();
    }
}

function loadSessionAttendance() {
    renderQuickDateSuggestions();
    const d = normalizeCloudDate(document.getElementById('sessionDatePicker').value.trim());
    const stds = getFilteredStudents();
    const tbody = document.getElementById('sessionAttendanceBody');
    if (!tbody) return;
    
    tbody.innerHTML = stds.length === 0 ? `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">Trống</td></tr>` : stds.map(s => {
        if(s.joinDate && compareDateDDMMYYYY(d, s.joinDate) < 0) {
            return `<tr class="opacity-50"><td class="p-2.5 sm:p-3">${getClassName(s.classId)}</td><td class="p-2.5 sm:p-3 font-mono">${s.code}</td><td class="p-2.5 sm:p-3">${s.name}</td><td colspan="2" class="p-2.5 sm:p-3 italic">Chưa vào học</td></tr>`;
        }
        const r = (appData.attendance || []).find(a => a.studentId === s.id && normalizeCloudDate(a.date) === d) || {status:'PRESENT', note:''};
        return `<tr><td class="p-2.5 sm:p-3 font-bold">${getClassName(s.classId)}</td><td class="p-2.5 sm:p-3 font-mono">${s.code}</td><td class="p-2.5 sm:p-3 font-bold">${s.name}</td><td class="p-2.5 sm:p-3"><select data-student-id="${s.id}" data-class-id="${s.classId}" class="att-status p-1.5 border rounded-lg text-xs font-bold w-full"><option value="PRESENT" ${r.status==='PRESENT'?'selected':''}>🟢 Có mặt</option><option value="ABSENT_PERM" ${r.status==='ABSENT_PERM'?'selected':''}>🟡 Phép</option><option value="ABSENT_NO_PERM" ${r.status==='ABSENT_NO_PERM'?'selected':''}>🔴 KP</option><option value="LATE" ${r.status==='LATE'?'selected':''}>🔵 Trễ</option></select></td><td class="p-2.5 sm:p-3"><input type="text" data-student-id="${s.id}" value="${r.note||''}" class="att-note w-full p-1.5 border rounded-lg text-xs" placeholder="Ghi chú..."></td></tr>`;
    }).join('');
}

function saveSessionAttendance() {
    const d = normalizeCloudDate(document.getElementById('sessionDatePicker').value.trim());
    if(!d) { alert("Vui lòng nhập ngày điểm danh hợp lệ (DD-MM-YYYY)!"); return; }

    document.querySelectorAll('.att-status').forEach(el => {
        const sId = el.getAttribute('data-student-id');
        const cId = el.getAttribute('data-class-id');
        const status = el.value;
        const note = document.querySelector(`.att-note[data-student-id="${sId}"]`).value;
        
        appData.attendance = (appData.attendance || []).filter(a => !(a.studentId === sId && normalizeCloudDate(a.date) === d));
        appData.attendance.push({ studentId: sId, classId: cId, date: d, status: status, note: note });
    });
    saveDataToCloud(); 
    alert('Đã lưu điểm danh thành công!'); 
    refreshCurrentTab();
}

function deleteSessionAttendanceDay() {
    const d = normalizeCloudDate(document.getElementById('sessionDatePicker').value.trim());
    if (!d) return;

    const count = (appData.attendance || []).filter(a => (currentClassId === 'ALL' || a.classId === currentClassId) && normalizeCloudDate(a.date) === d).length;
    if (count === 0) {
        alert(`Ngày ${d} chưa có dữ liệu điểm danh nào để xóa!`);
        return;
    }

    if (confirm(`Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu điểm danh ngày ${d} của lớp này không?`)) {
        appData.attendance = (appData.attendance || []).filter(a => !( (currentClassId === 'ALL' || a.classId === currentClassId) && normalizeCloudDate(a.date) === d ));
        saveDataToCloud();
        loadSessionAttendance();
        refreshCurrentTab();
        alert(`Đã xóa sạch dữ liệu điểm danh ngày ${d}!`);
    }
}

function openEditAttendanceDateModal(dateStr) {
    selectedAttDateToChange = normalizeCloudDate(dateStr);
    document.getElementById('editCurrentAttDateText').value = selectedAttDateToChange;
    document.getElementById('editNewAttDateInput').value = selectedAttDateToChange;
    document.getElementById('modalEditAttendanceDate').classList.remove('hidden');
}

function closeEditAttendanceDateModal() {
    document.getElementById('modalEditAttendanceDate').classList.add('hidden');
    selectedAttDateToChange = null;
}

function handleApplyChangeAttendanceDate() {
    const newDate = normalizeCloudDate(document.getElementById('editNewAttDateInput').value.trim());
    if (!newDate) { alert("Vui lòng nhập ngày mới hợp lệ (DD-MM-YYYY)!"); return; }
    if (newDate === selectedAttDateToChange) { alert("Ngày mới trùng với ngày hiện tại!"); return; }

    const existed = (appData.attendance || []).some(a => (currentClassId === 'ALL' || a.classId === currentClassId) && normalizeCloudDate(a.date) === newDate);
    if (existed) {
        if (!confirm(`Ngày ${newDate} đã có dữ liệu điểm danh từ trước. Bạn có chắc muốn gộp ngày ${selectedAttDateToChange} vào ngày này không?`)) {
            return;
        }
    }

    let modifiedCount = 0;
    (appData.attendance || []).forEach(a => {
        if ((currentClassId === 'ALL' || a.classId === currentClassId) && normalizeCloudDate(a.date) === selectedAttDateToChange) {
            a.date = newDate;
            modifiedCount++;
        }
    });

    saveDataToCloud();
    closeEditAttendanceDateModal();
    refreshCurrentTab();
    alert(`Đã chuyển đổi thành công ${modifiedCount} lượt điểm danh từ ngày ${selectedAttDateToChange} sang ngày ${newDate}!`);
}

function handleDeleteEntireAttendanceDay() {
    if (!selectedAttDateToChange) return;
    if (confirm(`Xác nhận xóa TOÀN BỘ buổi học ngày ${selectedAttDateToChange} khỏi sổ lưu trữ của lớp?`)) {
        appData.attendance = (appData.attendance || []).filter(a => !( (currentClassId === 'ALL' || a.classId === currentClassId) && normalizeCloudDate(a.date) === selectedAttDateToChange ));
        saveDataToCloud();
        closeEditAttendanceDateModal();
        refreshCurrentTab();
        alert(`Đã xóa buổi học ngày ${selectedAttDateToChange} thành công!`);
    }
}

function expandAllCycles(isOpen) {
    document.querySelectorAll('#attendanceCycleAccordionContainer > div').forEach(c => {
        const body = c.querySelector('.cycle-body');
        if (body) {
            if (isOpen) body.classList.remove('hidden');
            else body.classList.add('hidden');
        }
    });
}

function renderAttendanceMatrix() {
    const stds = getFilteredStudents();
    const container = document.getElementById('attendanceCycleAccordionContainer');
    if (!container) return;

    const allDates = getClassSessionDates(currentClassId);
    if (allDates.length === 0 || stds.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400 italic text-xs">Chưa có dữ liệu buổi học.</div>`;
        return;
    }

    const chunks = [];
    for (let i = 0; i < allDates.length; i += 8) chunks.push(allDates.slice(i, i + 8));

    let html = '';
    chunks.forEach((chunkDates, cIdx) => {
        const cycleNum = cIdx + 1;
        const isCurrentCycle = (cIdx === chunks.length - 1);
        html += `
            <div class="border rounded-2xl overflow-hidden shadow-sm ${isCurrentCycle ? 'border-indigo-300' : 'border-slate-200'}">
                <div class="p-3.5 sm:p-4 bg-slate-50 font-bold text-xs flex justify-between items-center cursor-pointer select-none" onclick="this.nextElementSibling.classList.toggle('hidden')">
                    <span>KỲ ${cycleNum}: ${formatDateVN(chunkDates[0])} ➔ ${formatDateVN(chunkDates[chunkDates.length - 1])}</span>
                    <span class="text-indigo-900">${chunkDates.length}/8 buổi (Bấm để đóng/mở • Chạm ngày để sửa)</span>
                </div>
                <div class="cycle-body p-2 sm:p-3 overflow-x-auto bg-white">
                    <table class="w-full text-left text-xs whitespace-nowrap">
                        <thead>
                            <tr class="bg-slate-100 font-bold">
                                <th class="p-2 border-r sticky-col-1 bg-slate-100">Mã HS</th>
                                <th class="p-2 border-r sticky-col-2 bg-slate-100">Học Sinh</th>
                                ${chunkDates.map((d, idx)=>`
                                    <th class="p-2 text-center border-r cursor-pointer hover:bg-amber-100 transition group" onclick="openEditAttendanceDateModal('${d}')" title="Bấm để đổi ngày hoặc xóa buổi nhầm">
                                        <span class="text-indigo-950 font-black">B${idx+1}</span>
                                        <div class="text-[9px] font-normal text-slate-500 group-hover:text-amber-800 underline">${formatDateShortVN(d)} ✏️</div>
                                    </th>
                                `).join('')}
                                <th class="p-2 text-center">Chuyên Cần</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stds.map(s => {
                                let present = 0;
                                const cells = chunkDates.map(d => {
                                    const r = (appData.attendance || []).find(a => a.studentId === s.id && normalizeCloudDate(a.date) === d);
                                    let icon = '-';
                                    if (s.joinDate && compareDateDDMMYYYY(d, s.joinDate) < 0) icon = '⚪';
                                    else if (r && (r.status === 'PRESENT' || r.status === 'LATE')) { icon = '✓'; present++; }
                                    else if (r && r.status.includes('ABSENT')) icon = 'P';
                                    return `<td class="p-2 text-center border-r font-bold">${icon}</td>`;
                                }).join('');
                                return `<tr><td class="p-2 font-mono border-r sticky-col-1 bg-white">${s.code}</td><td class="p-2 font-bold border-r sticky-col-2 bg-white">${s.name}</td>${cells}<td class="p-2 text-center font-bold">${present}/${chunkDates.length}</td></tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================================================
// 8. HỌC PHÍ THEO KỲ & NHẬT KÝ THU TIỀN
// ============================================================================
function renderTuitionTable() {
    const stds = getFilteredStudents();
    const tb = document.getElementById('tuitionTableBody');
    if(!tb) return;
    if(stds.length === 0) { tb.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Trống</td></tr>`; return; }

    tb.innerHTML = stds.map(s => {
        const ledger = calculateStudentTuitionLedger(s);
        let cells = '';

        for(let i = 0; i < 4; i++) {
            const cInfo = ledger.cycles[i];
            let stC = 'bg-slate-50 text-slate-400', txt = 'Chưa đến';

            if (cInfo.status === 'EXEMPT') {
                stC = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
                txt = 'Miễn phí';
            } else if (cInfo.status === 'NOT_JOINED') {
                txt = 'Chưa vào học';
            } else if (cInfo.status === 'PAID_SURPLUS') {
                stC = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-xs';
                txt = `Đã nộp (Dư ${cInfo.surplus.toLocaleString()}đ)`;
            } else if (cInfo.status === 'PAID_EXACT') {
                stC = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
                txt = `Đã nộp đủ`;
            } else if (cInfo.status === 'OWE') {
                stC = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
                txt = cInfo.paidAmount > 0 ? `Còn nợ: ${cInfo.cycleDebt.toLocaleString()}đ` : `Cần thu: ${cInfo.cycleDebt.toLocaleString()}đ`;
            }

            cells += `<td class="p-2 border-r text-center cursor-pointer" onclick="openPayModal('${s.id}', ${i})" title="Bấm để thu học phí hoặc xem QR"><div class="p-1.5 sm:p-2 rounded-xl border text-[11px] ${stC}">${txt}</div></td>`;
        }

        return `<tr><td class="p-2.5 sm:p-3 sticky-col-1 border-r text-[10px] font-bold">${getClassName(s.classId)}</td><td class="p-2.5 sm:p-3 sticky-col-2 border-r font-bold">${s.name}</td>${cells}</tr>`;
    }).join('');
}

function openPayModal(sId, cIdx) {
    const s = (appData.students || []).find(x => x.id === sId);
    if (!s) return;

    const ledger = calculateStudentTuitionLedger(s);
    const cInfo = ledger.cycles[cIdx];
    const p = (cInfo.payments && cInfo.payments.length > 0) ? cInfo.payments[0] : null;

    document.getElementById('payStudentId').value = sId;
    document.getElementById('payCycleIndex').value = cIdx;
    document.getElementById('payStudentInfo').value = `${s.name} - Kỳ ${cIdx + 1} (${getClassName(s.classId)})`;
    
    let suggestedAmount = cInfo.cycleDebt > 0 ? cInfo.cycleDebt : cInfo.baseFee;
    if (cInfo.status === 'PAID_EXACT' || cInfo.status === 'PAID_SURPLUS') {
        suggestedAmount = cInfo.paidAmount;
    }

    document.getElementById('payAmount').value = suggestedAmount;
    document.getElementById('payDate').value = (p && p.date) ? formatDateVN(p.date) : getTodayVNString();
    document.getElementById('payMethod').value = p && p.method ? p.method : 'Chuyển khoản';
    
    const noteEl = document.getElementById('payNoteSuggestion');
    if (noteEl) {
        if (cInfo.deductedFromPrev > 0) {
            noteEl.innerText = `* Đã tự động cấn trừ ${cInfo.deductedFromPrev.toLocaleString()}đ từ số dư kỳ trước.`;
        } else {
            noteEl.innerText = '';
        }
    }

    document.getElementById('modalPayTuition').classList.remove('hidden');
}

function closePayModal() { 
    document.getElementById('modalPayTuition').classList.add('hidden'); 
}

function showAdminVietQR() {
    const sId = document.getElementById('payStudentId').value;
    const cIdx = parseInt(document.getElementById('payCycleIndex').value);
    const amt = parseFloat(document.getElementById('payAmount').value) || 0;
    const s = (appData.students || []).find(x => x.id === sId);
    const c = (appData.classes || []).find(x => x.id === s.classId);

    const className = (c ? c.name : 'LOP').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const rawUsername = (s.username || s.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const desc = `HP ${className} ${rawUsername} K${cIdx + 1}`;

    const qrUrl = `https://img.vietqr.io/image/${AGRIBANK_BIN}-${AGRIBANK_STK}-compact2.png?amount=${amt}&addInfo=${encodeURIComponent(desc)}&accountName=${encodeURIComponent(AGRIBANK_NAME)}`;

    document.getElementById('adminQrImage').src = qrUrl;
    document.getElementById('adminQrAmountText').innerText = amt.toLocaleString() + ' đ';
    document.getElementById('adminQrContentText').innerText = desc;
    document.getElementById('modalAdminQR').classList.remove('hidden');
}

function closeAdminQRModal() { 
    document.getElementById('modalAdminQR').classList.add('hidden'); 
}

function handleSavePayment(e) {
    e.preventDefault();
    const sId = document.getElementById('payStudentId').value;
    const cIdx = parseInt(document.getElementById('payCycleIndex').value);
    const amt = parseFloat(document.getElementById('payAmount').value) || 0;
    const d = normalizeCloudDate(document.getElementById('payDate').value.trim());
    const m = document.getElementById('payMethod').value;
    const s = (appData.students || []).find(x => x.id === sId);

    appData.payments = (appData.payments || []).filter(p => !(p.studentId === sId && p.classId === s.classId && p.cycleIndex === cIdx));
    appData.payments.push({
        id: 'p_' + Date.now(),
        studentId: sId,
        classId: s.classId,
        cycleIndex: cIdx,
        amount: amt,
        status: 'PAID',
        method: m,
        note: '',
        date: d
    });

    saveDataToCloud();
    closePayModal();
    refreshCurrentTab();
    alert('Đã cập nhật thu học phí!');
}

function renderPaymentHistory() {
    const pays = getFilteredPayments().sort((a,b)=>compareDateDDMMYYYY(b.date, a.date));
    const revEl = document.getElementById('textTotalClassRevenue');
    if (revEl) revEl.innerText = 'Doanh thu: ' + pays.reduce((s,p)=>s+p.amount,0).toLocaleString() + ' đ';
    
    const tbody = document.getElementById('paymentHistoryBody');
    if (!tbody) return;
    
    tbody.innerHTML = pays.length===0 ? `<tr><td colspan="7" class="p-4 text-center text-slate-400 italic">Trống</td></tr>` : pays.map(p => {
        const s = (appData.students || []).find(x => x.id === p.studentId) || {name: 'Đã xóa'};
        return `<tr><td class="p-2.5 sm:p-3">${getClassName(p.classId)}</td><td class="p-2.5 sm:p-3 font-mono">${formatDateVN(p.date)}</td><td class="p-2.5 sm:p-3 font-bold">${s.name}</td><td class="p-2.5 sm:p-3">Kỳ ${p.cycleIndex+1}</td><td class="p-2.5 sm:p-3 font-bold text-emerald-600">${p.amount.toLocaleString()}đ</td><td class="p-2.5 sm:p-3 text-slate-700">${p.method}</td><td class="p-2.5 sm:p-3 text-center"><button onclick="appData.payments=appData.payments.filter(x=>x.id!=='${p.id}');saveDataToCloud();refreshCurrentTab();" class="text-rose-500 hover:bg-rose-50 p-1.5 rounded"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></td></tr>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

// ============================================================================
// 9. LỊCH DẠY 2 TẦNG (CỐ ĐỊNH & TUẦN NÀY - BẢO VỆ CHỐNG LỖI STRING)
// ============================================================================
function getStartOfWeek(date, offsetWeeks = 0) {
    const d = new Date(date);
    const day = d.getDay(); // 0: CN, 1: T2,...
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    return new Date(d.getFullYear(), d.getMonth(), diff + (offsetWeeks * 7));
}

function changeWeekOffset(delta) { 
    currentWeekOffset += delta; 
    renderScheduleTab(); 
}

function resetWeekOffset() { 
    currentWeekOffset = 0; 
    renderScheduleTab(); 
}

function renderScheduleTab() {
    try {
        const monday = getStartOfWeek(new Date(), currentWeekOffset);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        
        const formatD = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        const labelEl = document.getElementById('currentWeekRangeLabel');
        if (labelEl) {
            labelEl.innerText = `Tuần: ${formatD(monday)} ➔ ${formatD(sunday)}`;
        }
        
        renderFixedSchedule();
        renderWeeklyOperational(monday);
    } catch (err) {
        console.error("Lỗi renderScheduleTab:", err);
    }
}

function renderFixedSchedule() {
    const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const container = document.getElementById('weekScheduleCardsContainer');
    if (!container) return;

    try {
        const classes = (appData.classes || []).filter(c => currentClassId === 'ALL' || c.id === currentClassId);

        container.innerHTML = daysOfWeek.map(day => {
            const ss = [];
            classes.forEach(c => {
                const schs = getSafeClassSchedules(c);
                schs.filter(sc => sc && sc.day === day).forEach(sc => {
                    ss.push({ cName: c.name, st: sc.startTime || '17:30', en: sc.endTime || '19:00' });
                });
            });

            ss.sort((a, b) => (a.st || '').localeCompare(b.st || ''));

            return `
                <div class="p-3.5 rounded-2xl border bg-slate-50/70 border-slate-200 space-y-2">
                    <div class="font-black text-xs text-slate-800 border-b pb-1.5 flex justify-between items-center">
                        <span>${day}</span>
                        <span class="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px]">${ss.length} ca</span>
                    </div>
                    <div class="space-y-1.5">
                        ${ss.length === 0 ? '<div class="text-[11px] text-slate-400 italic text-center py-2">Trống</div>' : ss.map(s => {
                            const theme = getClassBadgeTheme(s.cName, false);
                            return `
                                <div class="p-2 rounded-xl border bg-white ${theme.cardBg} text-xs flex justify-between items-center shadow-xs">
                                    <div class="flex items-center space-x-1.5">
                                        <span class="w-2 h-2 rounded-full ${theme.dot}"></span>
                                        <b class="text-slate-800">${s.cName}</b>
                                    </div>
                                    <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${theme.timeBadge}">${s.st} - ${s.en}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Lỗi renderFixedSchedule:", err);
    }
}

function renderWeeklyOperational(mondayDate) {
    const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const container = document.getElementById('weeklyOperationalGrid');
    if (!container) return;

    try {
        let html = '';
        const todayStr = getTodayVNString();
        const classes = (appData.classes || []).filter(c => currentClassId === 'ALL' || c.id === currentClassId);

        for (let i = 0; i < 7; i++) {
            const curDate = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + i);
            const curDateStr = `${String(curDate.getDate()).padStart(2,'0')}-${String(curDate.getMonth()+1).padStart(2,'0')}-${curDate.getFullYear()}`;
            const dayName = daysOfWeek[i];
            const isToday = (curDateStr === todayStr);

            let lessons = [];
            classes.forEach(c => {
                const schs = getSafeClassSchedules(c);
                schs.filter(sc => sc && sc.day === dayName).forEach(sc => {
                    lessons.push({
                        classId: c.id,
                        className: c.name,
                        startTime: sc.startTime || '17:30',
                        endTime: sc.endTime || '19:00',
                        originalDate: curDateStr,
                        isExtra: false
                    });
                });
            });

            const extras = (appData.weeklyOverrides || []).filter(o => o.date === curDateStr && o.type === 'EXTRA');
            extras.forEach(ex => {
                const c = (appData.classes || []).find(x => x.id === ex.classId);
                lessons.push({
                    classId: ex.classId,
                    className: c ? c.name : 'Lớp',
                    startTime: ex.startTime || '18:00',
                    endTime: ex.endTime || '19:30',
                    originalDate: curDateStr,
                    isExtra: true,
                    overrideData: ex
                });
            });

            lessons.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            html += `
                <div class="rounded-2xl border transition-all duration-200 flex flex-col min-h-[175px] ${
                    isToday 
                    ? 'border-indigo-400 bg-indigo-50/30 ring-2 ring-indigo-300 shadow-md' 
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                }">
                    <div class="p-2.5 border-b flex justify-between items-center ${isToday ? 'bg-indigo-600 text-white rounded-t-xl' : 'bg-slate-50/80 text-slate-700 rounded-t-2xl'}">
                        <div class="flex items-center space-x-1.5">
                            <span class="font-black text-xs">${dayName}</span>
                            ${isToday ? '<span class="text-[9px] bg-amber-400 text-indigo-950 font-black px-1.5 py-0.5 rounded-full uppercase">Hôm nay</span>' : ''}
                        </div>
                        <span class="text-[10px] font-mono font-bold ${isToday ? 'text-indigo-100' : 'text-slate-400'}">${formatDateShortVN(curDateStr)}</span>
                    </div>

                    <div class="p-2 flex-1 space-y-2">
                        ${lessons.length === 0 ? `
                            <div class="h-full flex flex-col items-center justify-center py-6 text-slate-300 italic text-[11px]">
                                <span>Không có ca</span>
                            </div>
                        ` : lessons.map(l => {
                            const ov = (appData.weeklyOverrides || []).find(o => o.classId === l.classId && o.date === curDateStr);
                            
                            if (ov && ov.type === 'CANCEL') {
                                return `
                                    <div class="p-2 rounded-xl border border-rose-200 bg-rose-50/70 text-rose-800 text-xs line-through opacity-75 flex justify-between items-center">
                                        <span class="font-bold">${l.className} (${l.startTime})</span>
                                        <span class="text-[9px] font-black bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded">NGHỈ</span>
                                    </div>
                                `;
                            }

                            if (ov && ov.type === 'RESCHEDULE') {
                                return `
                                    <div class="p-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex justify-between items-center shadow-xs">
                                        <div>
                                            <b class="text-amber-950">${l.className}</b>
                                            <div class="text-[10px] text-amber-700 font-bold">Dời ➔ ${ov.newDate ? formatDateShortVN(ov.newDate) : ''} (${ov.startTime})</div>
                                        </div>
                                        <button onclick="openOverrideModal('${l.classId}','${l.className}','${curDateStr}','${l.startTime}','${l.endTime}')" class="text-amber-700 hover:bg-amber-100 p-1 rounded-md"><i data-lucide="edit-3" class="w-3 h-3"></i></button>
                                    </div>
                                `;
                            }

                            const theme = getClassBadgeTheme(l.className, l.isExtra);

                            return `
                                <div class="p-2.5 rounded-xl border shadow-xs transition-transform hover:-translate-y-0.5 ${theme.cardBg} text-xs flex flex-col justify-between space-y-1.5 relative group">
                                    <div class="flex justify-between items-center">
                                        <div class="flex items-center space-x-1.5">
                                            <span class="w-2 h-2 rounded-full ${theme.dot}"></span>
                                            <b class="font-black tracking-tight text-slate-900">${l.className}</b>
                                        </div>
                                        ${l.isExtra ? `
                                            <button onclick="removeExtraLesson('${l.overrideData.id}')" class="text-amber-700 hover:text-rose-600 p-0.5"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                                        ` : `
                                            <button onclick="openOverrideModal('${l.classId}','${l.className}','${curDateStr}','${l.startTime}','${l.endTime}')" class="opacity-0 group-hover:opacity-100 transition p-1 bg-white border rounded shadow-xs text-indigo-700 hover:bg-indigo-50" title="Chỉnh sửa ca này"><i data-lucide="settings-2" class="w-3.5 h-3.5"></i></button>
                                        `}
                                    </div>
                                    <div class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold w-fit ${theme.timeBadge}">
                                        <i data-lucide="clock" class="w-2.5 h-2.5"></i>
                                        <span>${l.startTime} - ${l.endTime}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Lỗi renderWeeklyOperational:", err);
    }
}

function openOverrideModal(cId, cName, date, st, et) {
    document.getElementById('overrideClassId').value = cId;
    document.getElementById('overrideOriginalDate').value = date;
    document.getElementById('overrideClassInfo').value = `${cName} (${formatDateVN(date)} | ${st} - ${et})`;
    document.getElementById('overrideNewDate').value = date;
    document.getElementById('overrideNewStart').value = st;
    document.getElementById('overrideNewEnd').value = et;
    toggleOverrideInputs();
    document.getElementById('modalOverrideLesson').classList.remove('hidden');
}

function closeOverrideModal() { 
    document.getElementById('modalOverrideLesson').classList.add('hidden'); 
}

function toggleOverrideInputs() {
    const type = document.getElementById('overrideType').value;
    const resFields = document.getElementById('rescheduleFields');
    if (type === 'RESCHEDULE') resFields.classList.remove('hidden');
    else resFields.classList.add('hidden');
}

async function handleSaveOverride(e) {
    e.preventDefault();
    const cId = document.getElementById('overrideClassId').value;
    const origDate = document.getElementById('overrideOriginalDate').value;
    const type = document.getElementById('overrideType').value;
    const newDate = normalizeCloudDate(document.getElementById('overrideNewDate').value.trim());
    const newSt = document.getElementById('overrideNewStart').value;
    const newEt = document.getElementById('overrideNewEnd').value;
    const note = document.getElementById('overrideNote').value.trim();
    const c = (appData.classes || []).find(x => x.id === cId);

    if (!appData.weeklyOverrides) appData.weeklyOverrides = [];
    appData.weeklyOverrides = appData.weeklyOverrides.filter(o => !(o.classId === cId && o.date === origDate));

    const overrideItem = {
        id: 'ov_' + Date.now(),
        classId: cId,
        className: c ? c.name : 'Lớp',
        date: origDate,
        type: type,
        newDate: newDate,
        startTime: newSt,
        endTime: newEt,
        note: note
    };
    appData.weeklyOverrides.push(overrideItem);

    saveDataToCloud();
    closeOverrideModal();
    renderScheduleTab();
    alert("Đã điều chỉnh lịch tuần này thành công!");
}

function openExtraLessonModal() {
    const sel = document.getElementById('extraLessonClassId');
    sel.innerHTML = (appData.classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('extraLessonDate').value = getTodayVNString();
    document.getElementById('modalExtraLesson').classList.remove('hidden');
}

function closeExtraModal() { 
    document.getElementById('modalExtraLesson').classList.add('hidden'); 
}

async function handleSaveExtraLesson(e) {
    e.preventDefault();
    const cId = document.getElementById('extraLessonClassId').value;
    const d = normalizeCloudDate(document.getElementById('extraLessonDate').value.trim());
    const st = document.getElementById('extraLessonStart').value;
    const et = document.getElementById('extraLessonEnd').value;
    const note = document.getElementById('extraLessonNote').value.trim();
    const c = (appData.classes || []).find(x => x.id === cId);

    const extraItem = {
        id: 'ov_' + Date.now(),
        classId: cId,
        className: c ? c.name : 'Lớp',
        date: d,
        type: 'EXTRA',
        startTime: st,
        endTime: et,
        note: note
    };

    if (!appData.weeklyOverrides) appData.weeklyOverrides = [];
    appData.weeklyOverrides.push(extraItem);

    saveDataToCloud();
    closeExtraModal();
    renderScheduleTab();
    alert("Đã thêm ca dạy tăng cường thành công!");
}

function removeExtraLesson(id) {
    if (confirm("Xóa ca tăng cường này?")) {
        appData.weeklyOverrides = (appData.weeklyOverrides || []).filter(o => o.id !== id);
        saveDataToCloud();
        renderScheduleTab();
    }
}

// ============================================================================
// 10. NGÂN HÀNG ĐỀ THI & BÓC TÁCH SOẠN THẢO
// ============================================================================
function setupDirectImagePaste() {
    const ed = document.getElementById('directEditorArea');
    if(!ed) return;
    ed.addEventListener('paste', function(e) {
        const items = (e.clipboardData || window.clipboardData).items;
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = function (event) {
                    document.execCommand('insertHTML', false, `<br><img src="${event.target.result}" alt="Ảnh câu hỏi" /><br>`);
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    });
}

function parseAdminExamDirect() {
    const ed = document.getElementById('directEditorArea');
    let content = ed.innerHTML;
    if(!content.trim()) { alert("Khung soạn thảo đang trống!"); return; }

    content = content.replace(/<div><br><\/div>/gi, '\n')
                     .replace(/<div>/gi, '\n')
                     .replace(/<\/div>/gi, '')
                     .replace(/<p>/gi, '\n')
                     .replace(/<\/p>/gi, '')
                     .replace(/<br\s*[\/]?>/gi, '\n')
                     .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$')
                     .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')
                     .replace(/\$\$/g, '$');

    content = content.replace(/(\[(?:P1\vert{}P2\vert{}P3\vert{}PHẦN\s*[123IV]+)\]|PHẦN\s+[123IV]+[\s:.-])/gi, '\n$1\n');
    content = content.replace(/(Câu\s+\d+[\s:.-])/gi, '\n$1');

    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    tempParsedQuestions = [];
    let currentPart = 1;
    let currentQ = null;

    lines.forEach(line => {
        if(/(?:\[(?:P1\vert{}PHẦN\s*1\vert{}PHẦN\s*I)\]|^PHẦN\s*(?:1|I)[\s:.-])/i.test(line)) { currentPart = 1; return; }
        if(/(?:\[(?:P2\vert{}PHẦN\s*2\vert{}PHẦN\s*II)\]|^PHẦN\s*(?:2|II)[\s:.-])/i.test(line)) { currentPart = 2; return; }
        if(/(?:\[(?:P3\vert{}PHẦN\s*3\vert{}PHẦN\s*III)\]|^PHẦN\s*(?:3|III)[\s:.-])/i.test(line)) { currentPart = 3; return; }

        const qHeaderMatch = line.match(/^Câu\s+(\d+)[\s:.-]+([\s\S]*)$/i);
        if(qHeaderMatch) {
            if(currentQ) finalizeAdminQuestion(currentQ);
            currentQ = { rawIndex: qHeaderMatch[1], part: currentPart, prompt: qHeaderMatch[2] || '', lines: [] };
            return;
        }
        if(currentQ) currentQ.lines.push(line);
    });
    if(currentQ) finalizeAdminQuestion(currentQ);

    const badge = document.getElementById('previewCountBadge');
    if (badge) badge.innerText = `${tempParsedQuestions.length} câu`;
    renderAdminPreview();
}

function finalizeAdminQuestion(q) {
    const fullBody = q.lines.join(' ');
    const fullText = (q.prompt + ' ' + fullBody).trim();

    const hasABCD = /(?:\*?[A-D]\s*[\.:\)])/g.test(fullText);
    const hasSmallABCD = /(?:\*?[a-d]\s*[\.:\)])/g.test(fullText);
    const hasAnswerKeyword = /(?:Đáp án|ĐA|KQ)[\s:.-]+/i.test(fullText);

    if (q.part === 1 && !hasABCD && hasSmallABCD) q.part = 2;
    if (q.part === 1 && !hasABCD && hasAnswerKeyword) q.part = 3;

    if (q.part === 1) {
        const splitFirstOpt = fullText.split(/(?=\*?[A-D]\s*[\.:\)])/);
        const prompt = splitFirstOpt[0].replace(/^Câu\s+\d+[\s:.-]*/i, '').trim();
        const options = [];
        let correct = '';
        const optRegex = /(\*?)([A-D])\s*[\.:\)]\s*([\s\S]*?)(?=(?:\*?[A-D]\s*[\.:\)])|$)/g;
        let m;
        const optString = fullText.substring(prompt.length);
        while ((m = optRegex.exec(optString)) !== null) {
            options.push({ letter: m[2].toUpperCase(), content: m[3].trim() });
            if (m[1] === '*') correct = m[2].toUpperCase();
        }
        tempParsedQuestions.push({ id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2,4), part: 1, prompt, options, correct });
    } else if (q.part === 2) {
        const splitFirstOpt = fullText.split(/(?=\*?[a-d]\s*[\.:\)])/);
        const prompt = splitFirstOpt[0].replace(/^Câu\s+\d+[\s:.-]*/i, '').trim();
        const statements = [];
        const stRegex = /(\*?)([a-d])\s*[\.:\)]\s*([\s\S]*?)(?=(?:\*?[a-d]\s*[\.:\)])|$)/gi;
        let m;
        const stString = fullText.substring(prompt.length);
        while ((m = stRegex.exec(stString)) !== null) {
            statements.push({ letter: m[2].toLowerCase(), content: m[3].trim(), correct: m[1] === '*' ? 'Đ' : 'S' });
        }
        tempParsedQuestions.push({ id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2,4), part: 2, prompt, statements });
    } else if (q.part === 3) {
        let correct = '';
        const ansMatch = fullText.match(/(?:Đáp án|ĐA|KQ)[\s:.-]+([^\n]+)/i);
        if (ansMatch) correct = ansMatch[1].trim();
        const prompt = fullText.replace(/(?:Đáp án|ĐA|KQ)[\s:.-]+[^\n]+/gi, '').replace(/^Câu\s+\d+[\s:.-]*/i, '').trim();
        tempParsedQuestions.push({ id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2,4), part: 3, prompt, correct });
    }
}

function renderAdminPreview() {
    let html = '';
    tempParsedQuestions.forEach((q, idx) => {
        html += `
            <div class="p-3 bg-slate-50 border rounded-xl space-y-1.5">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-indigo-700">Câu ${idx + 1}</span>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Phần ${q.part}</span>
                </div>
                <div class="text-xs">${q.prompt}</div>
            </div>
        `;
    });
    const prev = document.getElementById('adminExamPreviewContainer');
    if (!prev) return;
    prev.innerHTML = html;
    if (window.renderMathInElement) {
        renderMathInElement(prev, { delimiters: [{left: '$', right: '$', display: false}], throwOnError: false });
    }
}

async function saveDirectExamToCloud() {
    if(currentClassId === 'ALL') { alert("Vui lòng chọn 1 lớp cụ thể ở menu trên cùng!"); return; }
    const title = document.getElementById('directExamTitle').value.trim();
    const duration = parseInt(document.getElementById('directExamDuration').value) || 45;

    if(!title) { alert("Vui lòng nhập tên đề thi!"); return; }
    if(tempParsedQuestions.length === 0) { alert("Vui lòng bấm '1. Bóc Tách' trước!"); return; }

    const newExam = {
        id: 'ex_' + Date.now(),
        title: title,
        classId: currentClassId,
        duration: duration,
        questions: tempParsedQuestions,
        solutionUrl: document.getElementById('directExamSolutionUrl').value.trim(),
        status: 'OPEN'
    };

    appData.exams.push(newExam);
    await saveDataToCloud();
    alert("Đã lưu và giao đề thi thành công!");
    
    document.getElementById('directExamTitle').value = '';
    document.getElementById('directEditorArea').innerHTML = '';
    tempParsedQuestions = [];
    refreshCurrentTab();
}

function renderQBankTab() {
    const container = document.getElementById('examListContainer');
    if (!container) return;
    const list = currentClassId === 'ALL' ? (appData.exams || []) : (appData.exams || []).filter(e => e.classId === currentClassId);
    container.innerHTML = list.length === 0 ? '<div class="text-xs text-slate-400 italic">Trống</div>' : list.map(e => `
        <div class="p-2.5 bg-slate-50 border rounded-xl flex justify-between items-center text-xs">
            <div><b>${e.title}</b> (${getClassName(e.classId)})<br><span class="text-[10px] text-indigo-600 font-bold">${e.questions ? e.questions.length : 0} câu • ${e.duration}p</span></div>
            <button onclick="appData.exams=appData.exams.filter(x=>x.id!=='${e.id}');saveDataToCloud();refreshCurrentTab();" class="text-rose-500 hover:bg-rose-100 p-1 rounded"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
    `).join('');
    if(window.lucide) lucide.createIcons();
}

function isAnswerMathEqual(ans1, ans2) {
    if (!ans1 || !ans2) return false;
    const s1 = String(ans1).trim().replace(',', '.').toLowerCase();
    const s2 = String(ans2).trim().replace(',', '.').toLowerCase();
    if (s1 === s2) return true;
    try {
        const evalFraction = (str) => {
            if (str.includes('/')) {
                const parts = str.split('/');
                if (parts.length === 2) return parseFloat(parts[0]) / parseFloat(parts[1]);
            }
            return parseFloat(str);
        };
        const n1 = evalFraction(s1);
        const n2 = evalFraction(s2);
        if (!isNaN(n1) && !isNaN(n2) && Math.abs(n1 - n2) < 0.0001) return true;
    } catch(e) {}
    return false;
}

function renderAnalyticsReport() {
    const sel = document.getElementById('analyticsExamSelect');
    const container = document.getElementById('analyticsContent');
    if(!sel || !container) return;

    const exams = (appData.exams || []).filter(e => currentClassId === 'ALL' || e.classId === currentClassId);
    sel.innerHTML = exams.map(e => `<option value="${e.id}">${e.title} (${getClassName(e.classId)})</option>`).join('');

    const exId = sel.value;
    if(!exId) { container.innerHTML = `<div class="text-xs text-slate-400 italic text-center py-4">Chưa có đề thi nào.</div>`; return; }

    const results = (appData.examResults || []).filter(r => r.examId === exId);
    if(results.length === 0) { container.innerHTML = `<div class="p-4 bg-slate-50 border rounded-xl text-center text-xs text-slate-500">Chưa có bài nộp nào cho đề này.</div>`; return; }

    const scores = results.map(r => r.score);
    const avg = scores.reduce((a,b)=>a+b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);

    let html = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div class="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center"><span class="text-[10px] text-indigo-700 font-bold block">ĐIỂM TRUNG BÌNH</span><span class="text-2xl font-black text-indigo-900">${avg.toFixed(1)}</span></div>
            <div class="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center"><span class="text-[10px] text-emerald-700 font-bold block">CAO NHẤT</span><span class="text-2xl font-black text-emerald-900">${max.toFixed(1)}</span></div>
            <div class="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center"><span class="text-[10px] text-amber-700 font-bold block">THẤP NHẤT</span><span class="text-2xl font-black text-amber-900">${min.toFixed(1)}</span></div>
            <div class="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center"><span class="text-[10px] text-blue-700 font-bold block">TỔNG BÀI NỘP</span><span class="text-2xl font-black text-blue-900">${results.length}</span></div>
        </div>
        <div class="overflow-x-auto border rounded-xl">
            <table class="w-full text-left text-xs whitespace-nowrap">
                <thead><tr class="bg-slate-100 font-bold border-b"><th class="p-2.5">Thí Sinh</th><th class="p-2.5 text-center">Điểm Số</th><th class="p-2.5 text-center">Rời Màn Hình</th><th class="p-2.5 text-center">Thời Gian Nộp</th></tr></thead>
                <tbody class="divide-y">
    `;

    results.sort((a,b)=>b.score - a.score).forEach(r => {
        const s = (appData.students || []).find(st => st.id === r.studentId) || {name: 'HS đã xóa', code: '---'};
        html += `
            <tr>
                <td class="p-2.5 font-bold">${s.name} <span class="text-slate-400">(${s.code})</span></td>
                <td class="p-2.5 text-center font-black text-indigo-600">${r.score.toFixed(1)}</td>
                <td class="p-2.5 text-center font-bold ${r.tabSwitchCount>0?'text-rose-600 bg-rose-50':'text-emerald-600'}">${r.tabSwitchCount>0?`Vi phạm ${r.tabSwitchCount} lần`:'✓ An toàn'}</td>
                <td class="p-2.5 text-center font-mono text-slate-500">${r.submittedAt ? formatDateVN(r.submittedAt) : '---'}</td>
            </tr>
        `;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// ============================================================================
// 11. KHO TÀI LIỆU
// ============================================================================
function renderDocumentsTab() {
    populateClassSelectModal();
    const docs = currentClassId === 'ALL' ? (appData.documents || []) : (appData.documents || []).filter(d => d.classId === currentClassId);
    const container = document.getElementById('adminGroupedDocsContainer');
    if(!container) return;

    if(docs.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400 italic text-xs">Chưa có tài liệu nào cho lớp này.</div>`;
        return;
    }

    const groups = {};
    docs.forEach(d => {
        const cat = d.category || 'Chuyên đề chung';
        if(!groups[cat]) groups[cat] = [];
        groups[cat].push(d);
    });

    container.innerHTML = Object.keys(groups).map((catName) => `
        <div class="border rounded-2xl overflow-hidden shadow-sm">
            <div class="p-3 bg-slate-50 border-b flex justify-between items-center font-bold text-xs text-indigo-950">
                <span class="flex items-center space-x-2"><i data-lucide="folder" class="w-4 h-4 text-indigo-600"></i><span>${catName}</span></span>
                <span class="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[10px]">${groups[catName].length} file</span>
            </div>
            <div class="p-2 space-y-1.5 bg-white divide-y">
                ${groups[catName].map(f => `
                    <div class="p-2 flex justify-between items-center text-xs">
                        <div>
                            <a href="${f.url}" target="_blank" class="font-bold text-indigo-600 hover:underline">📄 ${f.name}</a>
                            <span class="text-[10px] text-slate-400 ml-1">(${getClassName(f.classId)})</span>
                        </div>
                        <button onclick="appData.documents=appData.documents.filter(x=>x.id!=='${f.id}');saveDataToCloud();refreshCurrentTab();" class="text-rose-500 hover:bg-rose-50 p-1.5 rounded"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    if(window.lucide) lucide.createIcons();
}

function handleAddDocumentLink(e) {
    e.preventDefault();
    const classId = document.getElementById('inputDocClassId').value;
    const cat = document.getElementById('inputDocCategory').value.trim() || 'Chuyên đề chung';
    const name = document.getElementById('inputDocName').value.trim();
    const url = document.getElementById('inputDocUrl').value.trim();
    appData.documents.push({ id: 'd_' + Date.now(), classId, category: cat, name, url });
    saveDataToCloud();
    e.target.reset();
    refreshCurrentTab();
    alert('Đã lưu tài liệu vào chuyên đề thành công!');
}

function previewAppLogo(url) {
    const prev = document.getElementById('cfgLogoPreview');
    if(url && prev) prev.src = url;
}

function loadBrandingToSettings() {
    const cfgs = appData.appConfig || [];
    const getVal = (k, df) => { const f = cfgs.find(x => x.key === k); return f ? f.value : df; };
    
    const nameEl = document.getElementById('cfgAppName');
    if (nameEl) nameEl.value = getVal('student_app_name', 'SigmaMath - Thầy Mẫn');
    const shortEl = document.getElementById('cfgAppShortName');
    if (shortEl) shortEl.value = getVal('student_app_short_name', 'M-SigmaMath');
    const sloganEl = document.getElementById('cfgAppSlogan');
    if (sloganEl) sloganEl.value = getVal('student_app_slogan', 'Hệ thống học tập, chuyên cần & khảo thí Toán Thầy Mẫn');
    const logo = getVal('student_app_logo', 'logo-student.png');
    const logoEl = document.getElementById('cfgAppLogo');
    if (logoEl) logoEl.value = logo;
    previewAppLogo(logo);
}

async function handleSaveAppBranding(e) {
    e.preventDefault();
    const name = document.getElementById('cfgAppName').value.trim();
    const shortName = document.getElementById('cfgAppShortName').value.trim();
    const slogan = document.getElementById('cfgAppSlogan').value.trim();
    const logo = document.getElementById('cfgAppLogo').value.trim();

    appData.appConfig = [
        { key: 'student_app_name', value: name },
        { key: 'student_app_short_name', value: shortName },
        { key: 'student_app_slogan', value: slogan },
        { key: 'student_app_logo', value: logo }
    ];

    await saveDataToCloud();
    alert('Đã cập nhật Tên và Logo App!');
}

// ============================================================================
// 12. TRỢ LÝ GIÁO VIÊN & ĐỒNG BỘ GOOGLE CALENDAR
// ============================================================================
function toggleTeacherAssistant() {
    const win = document.getElementById('assistantChatWindow');
    if (!win) return;
    win.classList.toggle('hidden');
    if (!win.classList.contains('hidden')) {
        const inp = document.getElementById('assistantInput');
        if (inp) inp.focus();
    }
}

function handleSendAssistantMessage(e) {
    e.preventDefault();
    const inp = document.getElementById('assistantInput');
    const text = (inp.value || '').trim();
    if (!text) return;

    const list = document.getElementById('assistantMessagesList');
    list.innerHTML += `
        <div class="flex items-start justify-end space-x-2">
            <div class="p-3 bg-indigo-600 text-white rounded-2xl rounded-tr-none shadow-sm leading-relaxed max-w-[80%]">
                ${text}
            </div>
        </div>
    `;
    inp.value = '';

    let reply = "Em đã ghi nhận thông tin. Thầy cần tra cứu điểm danh, thu học phí hay xuất báo cáo lớp nào ạ?";
    const lower = text.toLowerCase();
    if (lower.includes('hôm nay') || lower.includes('ca dạy') || lower.includes('lịch')) {
        const todayLessons = document.getElementById('dashTodayLessonsCount')?.innerText || '0 Ca';
        reply = `Hôm nay Thầy có <b>${todayLessons}</b> dạy. Thầy có thể xem chi tiết ngay tại thẻ Lịch Học ở trên Dashboard.`;
    } else if (lower.includes('nợ') || lower.includes('học phí')) {
        const dueCount = document.getElementById('dashDueCountBadge')?.innerText || '0 HS';
        reply = `Hiện tại lớp có <b>${dueCount}</b> đang chờ thu học phí kỳ hiện tại.`;
    }

    setTimeout(() => {
        list.innerHTML += `
            <div class="flex items-start space-x-2">
                <div class="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">AI</div>
                <div class="p-3 bg-white border border-slate-200 rounded-2xl rounded-tl-none shadow-sm leading-relaxed text-slate-700 max-w-[85%]">
                    ${reply}
                </div>
            </div>
        `;
        list.scrollTop = list.scrollHeight;
    }, 400);
    list.scrollTop = list.scrollHeight;
}

async function syncScheduleToGoogleCalendar() {
    if (!cloudApiUrl) { alert("Vui lòng cấu hình API Web App trước!"); return; }

    const schedules = [];
    (appData.classes || []).forEach(c => {
        const schs = getSafeClassSchedules(c);
        schs.forEach(sc => {
            schedules.push({ className: c.name, day: sc.day, startTime: sc.startTime, endTime: sc.endTime });
        });
    });

    if (schedules.length === 0) { alert("Chưa có ca học nào được thiết lập."); return; }
    if (!confirm(`Đồng bộ ${schedules.length} ca dạy sang Google Calendar của thầy cho 4 tuần tới?`)) return;

    try {
        const res = await fetch(cloudApiUrl, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: 'syncToGoogleCalendar', schedules: schedules })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert(`Đã đồng bộ thành công! Đã tạo ${result.count} sự kiện trên Google Calendar của thầy.`);
        } else {
            alert("Đã gửi yêu cầu đồng bộ sang Google Calendar.");
        }
    } catch (e) { 
        alert("Đã kích hoạt đồng bộ lịch dạy sang Google Calendar!"); 
    }
}

function copyStudentLink() {
    const url = window.location.href.split('?')[0].split('index.html')[0].replace(/\/$/, "") + `/hocsinh.html`;
    navigator.clipboard.writeText(url).then(()=>alert('Đã copy link Cổng Học Sinh!')).catch(()=>alert(url));
}

function copyExamLink() {
    const url = window.location.href.split('?')[0].split('index.html')[0].replace(/\/$/, "") + `/exam.html`;
    navigator.clipboard.writeText(url).then(()=>alert('Đã copy link Cổng Khảo Thí!')).catch(()=>alert(url));
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('hidden');
}

function toggleMobileSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('hidden');
}