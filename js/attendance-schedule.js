// ============================================================================
// MODULE ATTENDANCE & SCHEDULE: ĐIỂM DANH, SỔ 8 BUỔI & LỊCH 2 TẦNG (JS/ATTENDANCE-SCHEDULE.JS)
// ============================================================================

function onSessionDateChanged(isoDateValue) {
    loadSessionAttendance();
}

function renderQuickDateSuggestions() {
    const container = document.getElementById('quickAttendanceDateSuggestions');
    if (!container) return;

    const todayStr = getTodayVNString();
    let html = `
        <button type="button" onclick="setAttendanceDateQuick('${todayStr}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1.5 rounded-xl border border-indigo-200 text-[11px] transition">
            Hôm nay
        </button>
    `;

    const pastDates = getClassSessionDates(currentClassId);
    if (pastDates.length > 0) {
        const lastDate = pastDates[pastDates.length - 1];
        if (lastDate !== todayStr) {
            html += `
                <button type="button" onclick="setAttendanceDateQuick('${lastDate}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1.5 rounded-xl border border-slate-200 text-[11px] transition">
                    Gần nhất (${formatDateShortVN(lastDate)})
                </button>
            `;
        }
    }
    container.innerHTML = html;
}

function setAttendanceDateQuick(ddmmyyyy) {
    const input = document.getElementById('sessionDatePicker');
    if (input) {
        input.value = toIsoDate(ddmmyyyy);
        loadSessionAttendance();
    }
}

function loadSessionAttendance() {
    renderQuickDateSuggestions();
    const input = document.getElementById('sessionDatePicker');
    if (!input) return;

    const d = fromIsoDate(input.value) || getTodayVNString();
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
    const input = document.getElementById('sessionDatePicker');
    const d = fromIsoDate(input ? input.value : '') || getTodayVNString();
    if(!d) { alert("Vui lòng chọn ngày điểm danh hợp lệ!"); return; }

    document.querySelectorAll('.att-status').forEach(el => {
        const sId = el.getAttribute('data-student-id');
        const cId = el.getAttribute('data-class-id');
        const status = el.value;
        const note = document.querySelector(`.att-note[data-student-id="${sId}"]`)?.value || '';
        
        appData.attendance = (appData.attendance || []).filter(a => !(a.studentId === sId && normalizeCloudDate(a.date) === d));
        appData.attendance.push({ studentId: sId, classId: cId, date: d, status: status, note: note });
    });
    saveDataToCloud(); 
    alert('Đã lưu điểm danh thành công!'); 
    refreshCurrentTab();
}

function deleteSessionAttendanceDay() {
    const input = document.getElementById('sessionDatePicker');
    const d = fromIsoDate(input ? input.value : '') || getTodayVNString();
    if (!d) return;

    const count = (appData.attendance || []).filter(a => (currentClassId === 'ALL' || a.classId === currentClassId) && normalizeCloudDate(a.date) === d).length;
    if (count === 0) { alert(`Ngày ${d} chưa có dữ liệu điểm danh!`); return; }

    if (confirm(`Bạn có chắc muốn XÓA TOÀN BỘ dữ liệu ngày ${d}?`)) {
        appData.attendance = (appData.attendance || []).filter(a => !( (currentClassId === 'ALL' || a.classId === currentClassId) && normalizeCloudDate(a.date) === d ));
        saveDataToCloud();
        loadSessionAttendance();
        refreshCurrentTab();
        alert(`Đã xóa điểm danh ngày ${d}!`);
    }
}

function openEditAttendanceDateModal(dateStr) {
    selectedAttDateToChange = normalizeCloudDate(dateStr);
    const currEl = document.getElementById('editCurrentAttDateText');
    if (currEl) currEl.value = selectedAttDateToChange;
    const inputEl = document.getElementById('editNewAttDateInput');
    if (inputEl) inputEl.value = toIsoDate(selectedAttDateToChange);
    document.getElementById('modalEditAttendanceDate')?.classList.remove('hidden');
}

function closeEditAttendanceDateModal() {
    document.getElementById('modalEditAttendanceDate')?.classList.add('hidden');
    selectedAttDateToChange = null;
}

function handleApplyChangeAttendanceDate() {
    const rawNew = document.getElementById('editNewAttDateInput')?.value;
    const newDate = fromIsoDate(rawNew);
    if (!newDate) { alert("Vui lòng chọn ngày mới hợp lệ!"); return; }
    if (newDate === selectedAttDateToChange) { alert("Ngày mới trùng với ngày hiện tại!"); return; }

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
    alert(`Đã chuyển đổi thành công sang ngày ${newDate}!`);
}

function handleDeleteEntireAttendanceDay() {
    if (!selectedAttDateToChange) return;
    if (confirm(`Xác nhận xóa TOÀN BỘ buổi học ngày ${selectedAttDateToChange}?`)) {
        appData.attendance = (appData.attendance || []).filter(a => !( (currentClassId === 'ALL' || a.classId === currentClassId) && normalizeCloudDate(a.date) === selectedAttDateToChange ));
        saveDataToCloud();
        closeEditAttendanceDateModal();
        refreshCurrentTab();
        alert(`Đã xóa buổi học thành công!`);
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
                    <span class="text-indigo-900">${chunkDates.length}/8 buổi (Bấm xem/sửa)</span>
                </div>
                <div class="cycle-body p-2 sm:p-3 overflow-x-auto bg-white">
                    <table class="w-full text-left text-xs whitespace-nowrap">
                        <thead>
                            <tr class="bg-slate-100 font-bold">
                                <th class="p-2 border-r sticky-col-1 bg-slate-100">Mã HS</th>
                                <th class="p-2 border-r sticky-col-2 bg-slate-100">Học Sinh</th>
                                ${chunkDates.map((d, idx)=>`
                                    <th class="p-2 text-center border-r cursor-pointer hover:bg-amber-100 transition group" onclick="openEditAttendanceDateModal('${d}')" title="Bấm để đổi ngày">
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

function getStartOfWeek(date, offsetWeeks = 0) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    return new Date(d.getFullYear(), d.getMonth(), diff + (offsetWeeks * 7));
}

function changeWeekOffset(delta) { currentWeekOffset += delta; renderScheduleTab(); }
function resetWeekOffset() { currentWeekOffset = 0; renderScheduleTab(); }

function renderScheduleTab() {
    try {
        const monday = getStartOfWeek(new Date(), currentWeekOffset);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        
        const formatD = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        const labelEl = document.getElementById('currentWeekRangeLabel');
        if (labelEl) labelEl.innerText = `Tuần: ${formatD(monday)} ➔ ${formatD(sunday)}`;
        
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
                        classId: c.id, className: c.name, startTime: sc.startTime || '17:30',
                        endTime: sc.endTime || '19:00', originalDate: curDateStr, isExtra: false
                    });
                });
            });

            const extras = (appData.weeklyOverrides || []).filter(o => o.date === curDateStr && o.type === 'EXTRA');
            extras.forEach(ex => {
                const c = (appData.classes || []).find(x => x.id === ex.classId);
                lessons.push({
                    classId: ex.classId, className: c ? c.name : 'Lớp', startTime: ex.startTime || '18:00',
                    endTime: ex.endTime || '19:30', originalDate: curDateStr, isExtra: true, overrideData: ex
                });
            });

            lessons.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            html += `
                <div class="rounded-2xl border transition-all duration-200 flex flex-col min-h-[175px] ${isToday ? 'border-indigo-400 bg-indigo-50/30 ring-2 ring-indigo-300 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'}">
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
    document.getElementById('overrideNewDate').value = toIsoDate(date);
    document.getElementById('overrideNewStart').value = st;
    document.getElementById('overrideNewEnd').value = et;
    toggleOverrideInputs();
    document.getElementById('modalOverrideLesson')?.classList.remove('hidden');
}

function closeOverrideModal() { document.getElementById('modalOverrideLesson')?.classList.add('hidden'); }

function toggleOverrideInputs() {
    const type = document.getElementById('overrideType')?.value;
    const resFields = document.getElementById('rescheduleFields');
    if (!resFields) return;
    if (type === 'RESCHEDULE') resFields.classList.remove('hidden');
    else resFields.classList.add('hidden');
}

async function handleSaveOverride(e) {
    e.preventDefault();
    const cId = document.getElementById('overrideClassId').value;
    const origDate = document.getElementById('overrideOriginalDate').value;
    const type = document.getElementById('overrideType').value;
    
    const rawNewDate = document.getElementById('overrideNewDate').value;
    const newDate = fromIsoDate(rawNewDate) || origDate;
    const newSt = document.getElementById('overrideNewStart').value;
    const newEt = document.getElementById('overrideNewEnd').value;
    const note = document.getElementById('overrideNote').value.trim();
    const c = (appData.classes || []).find(x => x.id === cId);

    if (!appData.weeklyOverrides) appData.weeklyOverrides = [];
    appData.weeklyOverrides = appData.weeklyOverrides.filter(o => !(o.classId === cId && o.date === origDate));

    appData.weeklyOverrides.push({
        id: 'ov_' + Date.now(), classId: cId, className: c ? c.name : 'Lớp',
        date: origDate, type: type, newDate: newDate, startTime: newSt, endTime: newEt, note: note
    });

    saveDataToCloud();
    closeOverrideModal();
    renderScheduleTab();
    alert("Đã điều chỉnh lịch tuần này thành công!");
}

function openExtraLessonModal() {
    const sel = document.getElementById('extraLessonClassId');
    if (sel) {
        sel.innerHTML = (appData.classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    const dateEl = document.getElementById('extraLessonDate');
    if (dateEl) dateEl.value = toIsoDate(getTodayVNString());
    document.getElementById('modalExtraLesson')?.classList.remove('hidden');
}

function closeExtraModal() { document.getElementById('modalExtraLesson')?.classList.add('hidden'); }

async function handleSaveExtraLesson(e) {
    e.preventDefault();
    const cId = document.getElementById('extraLessonClassId').value;
    const rawDate = document.getElementById('extraLessonDate').value;
    const d = fromIsoDate(rawDate) || getTodayVNString();
    const st = document.getElementById('extraLessonStart').value;
    const et = document.getElementById('extraLessonEnd').value;
    const note = document.getElementById('extraLessonNote').value.trim();
    const c = (appData.classes || []).find(x => x.id === cId);

    if (!appData.weeklyOverrides) appData.weeklyOverrides = [];
    appData.weeklyOverrides.push({
        id: 'ov_' + Date.now(), classId: cId, className: c ? c.name : 'Lớp',
        date: d, type: 'EXTRA', startTime: st, endTime: et, note: note
    });

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

function openEditClassModal(classId) {
    const c = (appData.classes || []).find(x => x.id === classId);
    if (!c) return;

    document.getElementById('editClassId').value = c.id;
    document.getElementById('editClassNameInput').value = c.name;
    document.getElementById('editClassFeeInput').value = c.fee || 300000;

    const container = document.getElementById('editScheduleRowsContainer');
    if (container) {
        container.innerHTML = '';
        const schs = getSafeClassSchedules(c);
        if (schs.length === 0) addEditScheduleRow('Thứ 2', '17:30', '19:00');
        else schs.forEach(sc => addEditScheduleRow(sc.day, sc.startTime, sc.endTime));
    }

    document.getElementById('modalEditClassSchedule')?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeEditClassModal() { document.getElementById('modalEditClassSchedule')?.classList.add('hidden'); }

function addEditScheduleRow(d = 'Thứ 2', s = '17:30', e = '19:00') {
    const container = document.getElementById('editScheduleRowsContainer');
    if (!container) return;
    const r = document.createElement('div');
    r.className = 'flex items-center space-x-1.5 bg-white p-2 rounded-xl border';
    r.innerHTML = `
        <select class="edit-sch-day text-xs p-1.5 border rounded-lg font-bold outline-none">
            <option value="Thứ 2" ${d==='Thứ 2'?'selected':''}>T2</option>
            <option value="Thứ 3" ${d==='Thứ 3'?'selected':''}>T3</option>
            <option value="Thứ 4" ${d==='Thứ 4'?'selected':''}>T4</option>
            <option value="Thứ 5" ${d==='Thứ 5'?'selected':''}>T5</option>
            <option value="Thứ 6" ${d==='Thứ 6'?'selected':''}>T6</option>
            <option value="Thứ 7" ${d==='Thứ 7'?'selected':''}>T7</option>
            <option value="Chủ Nhật" ${d==='Chủ Nhật'?'selected':''}>CN</option>
        </select>
        <input type="time" class="edit-sch-start text-xs p-1 border rounded-lg font-bold" value="${s}">
        <input type="time" class="edit-sch-end text-xs p-1 border rounded-lg font-bold" value="${e}">
        <button type="button" onclick="this.parentElement.remove()" class="text-rose-500 p-1"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
    `;
    container.appendChild(r);
    if (window.lucide) lucide.createIcons();
}

function handleSaveEditClass(e) {
    e.preventDefault();
    const classId = document.getElementById('editClassId').value;
    const c = (appData.classes || []).find(x => x.id === classId);
    if (!c) return;

    c.name = document.getElementById('editClassNameInput').value.trim().toUpperCase();
    c.fee = parseFloat(document.getElementById('editClassFeeInput').value) || 300000;

    const newSchedules = [];
    document.querySelectorAll('#editScheduleRowsContainer > div').forEach(r => {
        newSchedules.push({
            day: r.querySelector('.edit-sch-day').value,
            startTime: r.querySelector('.edit-sch-start').value,
            endTime: r.querySelector('.edit-sch-end').value
        });
    });
    c.schedules = newSchedules;

    saveDataToCloud();
    closeEditClassModal();
    renderGlobalClassSelect();
    refreshCurrentTab();
    alert(`Đã lưu thay đổi cho lớp ${c.name}!`);
}

function initScheduleRows() {
    const c = document.getElementById('scheduleRowsContainer');
    if (!c) return;
    c.innerHTML = '';
    addScheduleRow('Thứ 3', '17:30', '19:00');
    addScheduleRow('Thứ 6', '17:30', '19:00');
}

function addScheduleRow(d = 'Thứ 2', s = '17:30', e = '19:00') {
    const c = document.getElementById('scheduleRowsContainer');
    if (!c) return;
    const r = document.createElement('div');
    r.className = 'flex items-center space-x-1.5 bg-white p-2 rounded-xl border';
    r.innerHTML = `
        <select class="sch-day text-xs p-1.5 border rounded-lg font-bold outline-none">
            <option value="Thứ 2" ${d==='Thứ 2'?'selected':''}>T2</option>
            <option value="Thứ 3" ${d==='Thứ 3'?'selected':''}>T3</option>
            <option value="Thứ 4" ${d==='Thứ 4'?'selected':''}>T4</option>
            <option value="Thứ 5" ${d==='Thứ 5'?'selected':''}>T5</option>
            <option value="Thứ 6" ${d==='Thứ 6'?'selected':''}>T6</option>
            <option value="Thứ 7" ${d==='Thứ 7'?'selected':''}>T7</option>
            <option value="Chủ Nhật" ${d==='Chủ Nhật'?'selected':''}>CN</option>
        </select>
        <input type="time" class="sch-start text-xs p-1 border rounded-lg font-bold" value="${s}">
        <input type="time" class="sch-end text-xs p-1 border rounded-lg font-bold" value="${e}">
        <button type="button" onclick="this.parentElement.remove()" class="text-rose-500 p-1"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
    `;
    c.appendChild(r);
    if (window.lucide) lucide.createIcons();
}