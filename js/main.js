// ============================================================================
// MODULE MAIN: DASHBOARD, ĐIỀU HƯỚNG TAB, TRỢ LÝ GIÁO VIÊN & TÀI LIỆU (JS/MAIN.JS)
// ============================================================================

function renderDashboard() {
    try {
        const stds = getFilteredStudents();
        const totalEl = document.getElementById('dashTotalStudents');
        if (totalEl) totalEl.innerText = stds.length;

        const todayStr = getTodayVNString();
        const daysMap = ['Chủ Nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
        const dayOfWeek = daysMap[new Date().getDay()];
        const todayDateEl = document.getElementById('dashTodayDateStr');
        if (todayDateEl) todayDateEl.innerText = `${dayOfWeek}, ${todayStr}`;

        // 1. Ca dạy hôm nay
        let todayLessons = [];
        const classes = (appData.classes || []).filter(c => currentClassId === 'ALL' || c.id === currentClassId);
        
        classes.forEach(c => {
            const ov = (appData.weeklyOverrides || []).find(o => o.classId === c.id && o.date === todayStr);
            if (!ov || ov.type !== 'CANCEL') {
                const schs = getSafeClassSchedules(c);
                schs.filter(sc => sc && sc.day === dayOfWeek).forEach(sc => {
                    const classSessions = getClassSessionDates(c.id);
                    const totalSess = classSessions.length;
                    const curCycle = Math.floor(totalSess / 8) + 1;
                    const sessInCycle = (totalSess % 8) + 1;
                    todayLessons.push({ class: c, schedule: sc, totalSess, curCycle, sessInCycle });
                });
            }
        });

        todayLessons.sort((a, b) => (a.schedule.startTime || '').localeCompare(b.schedule.startTime || ''));
        const lessonCountEl = document.getElementById('dashTodayLessonsCount');
        if (lessonCountEl) lessonCountEl.innerText = `${todayLessons.length} Ca`;

        const lessonContainer = document.getElementById('dashTodayLessonsContainer');
        if (lessonContainer) {
            if (todayLessons.length === 0) {
                lessonContainer.innerHTML = `<div class="col-span-3 p-4 bg-slate-50 border rounded-xl text-center text-xs text-slate-400 italic">Hôm nay không có ca dạy nào theo lịch.</div>`;
            } else {
                lessonContainer.innerHTML = todayLessons.map(l => `
                    <div class="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="font-black text-sm text-indigo-900">${l.class.name}</span>
                            <span class="text-xs font-mono font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-md border">${l.schedule.startTime} - ${l.schedule.endTime}</span>
                        </div>
                        <div class="text-xs font-semibold text-slate-600">Tiến độ: <b class="text-indigo-700">Buổi ${l.sessInCycle}/8 (Kỳ ${l.curCycle})</b></div>
                        <button onclick="currentClassId='${l.class.id}';renderGlobalClassSelect();switchTab('attendance-session')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-xl transition shadow">Điểm Danh Ngay</button>
                    </div>
                `).join('');
            }
        }

        // 2. Chờ thu học phí
        let totalDueCount = 0, dueListHtml = '', paidCount = 0;
        stds.forEach(s => {
            try {
                const ledger = calculateStudentTuitionLedger(s);
                const curCycleInfo = ledger.cycles[ledger.activeCycleIndex] || {};

                if (ledger.totalDebt === 0) {
                    paidCount++;
                } else {
                    totalDueCount++;
                    const debtAmount = curCycleInfo.cycleDebt > 0 ? curCycleInfo.cycleDebt : ledger.totalDebt;
                    dueListHtml += `
                        <div class="p-2.5 sm:p-3 bg-slate-50 border rounded-xl flex justify-between items-center text-xs">
                            <div>
                                <b class="text-slate-800">${s.name}</b> <span class="text-slate-400">(${getClassName(s.classId)})</span>
                                <div class="text-[11px] text-rose-600 font-bold">Kỳ ${ledger.activeCycleIndex + 1}: Còn nợ ${debtAmount.toLocaleString()}đ</div>
                            </div>
                            <button onclick="openPayModal('${s.id}', ${ledger.activeCycleIndex})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg shadow text-xs transition">Thu</button>
                        </div>
                    `;
                }
            } catch(e) {}
        });

        const dueBadge = document.getElementById('dashDueCountBadge');
        if (dueBadge) dueBadge.innerText = `${totalDueCount} HS`;
        const dueContainer = document.getElementById('dashDueListContainer');
        if (dueContainer) {
            dueContainer.innerHTML = dueListHtml || `<div class="p-4 text-center text-emerald-600 font-bold text-xs bg-emerald-50 rounded-xl">Tất cả học sinh đã hoàn thành học phí!</div>`;
        }
        
        const rate = stds.length > 0 ? Math.round((paidCount / stds.length) * 100) : 0;
        const rateEl = document.getElementById('dashTuitionRate');
        if (rateEl) rateEl.innerText = `${rate}%`;

        // 3. Điểm trung bình
        const results = appData.examResults || [];
        const avgScoreEl = document.getElementById('dashAvgScore');
        if (avgScoreEl) {
            if (results.length > 0) {
                const sum = results.reduce((acc, r) => acc + (parseFloat(r.score) || 0), 0);
                avgScoreEl.innerText = (sum / results.length).toFixed(1);
            } else {
                avgScoreEl.innerText = '--';
            }
        }

        // 4. Radar gian lận
        renderExamRadar();
    } catch (err) {
        console.error("Lỗi renderDashboard:", err);
    }
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
    try {
        if(currentTab === 'dashboard') renderDashboard();
        else if(currentTab === 'classes') renderClassesAndStudents();
        else if(currentTab === 'inactive-students') renderInactiveStudents();
        else if(currentTab === 'schedule') renderScheduleTab();
        else if(currentTab === 'attendance-session') loadSessionAttendance();
        else if(currentTab === 'attendance-matrix') renderAttendanceMatrix();
        else if(currentTab === 'tuition') renderTuitionTable();
        else if(currentTab === 'history') renderPaymentHistory();
        else if(currentTab === 'qbank') renderQBankTab();
        else if(currentTab === 'analytics') renderAnalyticsReport();
        else if(currentTab === 'documents') renderDocumentsTab();
        if(window.lucide) lucide.createIcons();
    } catch(err) {
        console.error("Lỗi chuyển tab:", err);
    }
}

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

function triggerTeacherPWAInstall() {
    if (teacherDeferredPrompt) {
        teacherDeferredPrompt.prompt();
        teacherDeferredPrompt.userChoice.then(() => { teacherDeferredPrompt = null; });
    } else {
        alert("Hướng dẫn cài đặt App:\n• Trên iPhone/iPad: Bấm nút Chia sẻ (Share 📤) ➔ Chọn 'Thêm vào Màn hình chính'.\n• Trên Android/PC: Bấm menu 3 chấm ở góc trên trình duyệt ➔ Chọn 'Cài đặt ứng dụng'.");
    }
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.update();
    }).catch(err => console.log('SW Fail', err));
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    teacherDeferredPrompt = e;
});

window.addEventListener('DOMContentLoaded', () => {
    try {
        checkAdminSession();
        loadFromStorage();
        
        const datePicker = document.getElementById('sessionDatePicker');
        if (datePicker) datePicker.value = toIsoDate(getTodayVNString());
        
        const joinInput = document.getElementById('inputStudentJoinDate');
        if (joinInput) joinInput.value = toIsoDate(getTodayVNString());
        
        const apiInput = document.getElementById('inputApiUrl');
        if (apiInput) apiInput.value = cloudApiUrl || '';

        initScheduleRows();
        previewFullClassName();
        renderGlobalClassSelect();

        switchTab('dashboard');

        setupDirectImagePaste();
        if (window.lucide) lucide.createIcons();

        if (cloudApiUrl) loadDataFromCloud();
    } catch (err) {
        console.error("Lỗi khởi tạo:", err);
    }
});