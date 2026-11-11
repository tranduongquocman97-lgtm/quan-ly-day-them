// ============================================================================
// MODULE STUDENTS: QUẢN LÝ LỚP, HỌC SINH, EXCEL, TRÙNG LẶP & CHUYỂN LỚP (JS/STUDENTS.JS)
// ============================================================================

function filterStudentTable(keyword) {
    const term = (keyword || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#studentTableBody tr');
    rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        if (!term || text.includes(term)) {
            r.classList.remove('hidden');
        } else {
            r.classList.add('hidden');
        }
    });
}

function renderClassesAndStudents() {
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
            return '';
        }
    }).join('');

    const searchVal = document.getElementById('searchStudentInput')?.value;
    if (searchVal) filterStudentTable(searchVal);

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
    const grade = document.getElementById('inputClassGrade')?.value || '10';
    const subName = (document.getElementById('inputClassSubName')?.value || '').trim().toUpperCase();
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
    if (grade === '11') cardBg = 'border-l-4 border-l-sky-600 border-sky-200 bg-sky-50/30 text-sky-950';
    else if (grade === '12') cardBg = 'border-l-4 border-l-indigo-600 border-indigo-200 bg-indigo-50/30 text-indigo-950';

    let timeBadge = 'bg-slate-700 text-white font-black shadow-sm';
    let dot = 'bg-slate-600';

    if (clean.includes('N1') || clean.endsWith('1')) { timeBadge = 'bg-blue-600 text-white font-black shadow-sm'; dot = 'bg-blue-600'; }
    else if (clean.includes('N2') || clean.endsWith('2')) { timeBadge = 'bg-amber-600 text-white font-black shadow-sm'; dot = 'bg-amber-600'; }
    else if (clean.includes('N3') || clean.endsWith('3')) { timeBadge = 'bg-purple-600 text-white font-black shadow-sm'; dot = 'bg-purple-600'; }
    else if (clean.includes('N4') || clean.endsWith('4')) { timeBadge = 'bg-rose-600 text-white font-black shadow-sm'; dot = 'bg-rose-600'; }
    else if (clean.includes('N5') || clean.endsWith('5')) { timeBadge = 'bg-emerald-600 text-white font-black shadow-sm'; dot = 'bg-emerald-600'; }

    return { cardBg, timeBadge, dot };
}

function generateNextStudentCode(classId) {
    const targetClass = (appData.classes || []).find(c => c.id === classId);
    if (!targetClass) return 'HS001';

    const gradeMatch = targetClass.name.match(/^(\d+)/);
    const gradePrefix = gradeMatch ? gradeMatch[1] : targetClass.name.substring(0, 2).toUpperCase();

    const sameGradeClassIds = (appData.classes || []).filter(c => c.name.startsWith(gradePrefix)).map(c => c.id);
    const allStudentsInGrade = [
        ...(appData.students || []).filter(s => sameGradeClassIds.includes(s.classId)), 
        ...(appData.inactiveStudents || []).filter(s => sameGradeClassIds.includes(s.classId))
    ];

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

    return `${gradePrefix}${String(maxSeq + 1).padStart(3, '0')}`;
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
    const joinInput = document.getElementById('inputStudentJoinDate');
    if (joinInput && !joinInput.value) joinInput.value = toIsoDate(getTodayVNString());
    document.getElementById('modalAddStudent')?.classList.remove('hidden');
}

function closeAddStudentModal() { document.getElementById('modalAddStudent')?.classList.add('hidden'); }

function onStudentClassModalChange() {
    const s = document.getElementById('inputStudentClassId');
    const c = document.getElementById('inputStudentCode');
    if(s && c) c.value = generateNextStudentCode(s.value);
    previewGeneratedUsername();
}

function autoBackfillAttendanceForNewStudent(studentId, classId, joinDateStr) {
    if (!joinDateStr) return 0;
    const classDates = getClassSessionDates(classId);
    let backfilledCount = 0;

    classDates.forEach(sessionDate => {
        if (compareDateDDMMYYYY(sessionDate, joinDateStr) >= 0) {
            const existed = (appData.attendance || []).some(a => a.studentId === studentId && normalizeCloudDate(a.date) === sessionDate);
            if (!existed) {
                appData.attendance.push({
                    studentId: studentId,
                    classId: classId,
                    date: sessionDate,
                    status: 'PRESENT',
                    note: 'Tự động bổ sung khi thêm HS'
                });
                backfilledCount++;
            }
        }
    });

    return backfilledCount;
}

function handleAddStudent(e) {
    e.preventDefault();
    const cId = document.getElementById('inputStudentClassId').value;
    const c = (appData.classes || []).find(x => x.id === cId);
    const name = document.getElementById('inputStudentName').value.trim();
    const phone = document.getElementById('inputStudentPhone').value.trim();
    
    const rawJoin = document.getElementById('inputStudentJoinDate').value;
    const joinDate = fromIsoDate(rawJoin) || getTodayVNString();

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

    const backfilled = autoBackfillAttendanceForNewStudent(newStudentId, cId, joinDate);

    saveDataToCloud();
    closeAddStudentModal();
    refreshCurrentTab();

    let msg = `Đã thêm học sinh ${name}!\nTài khoản: ${username}\nMật khẩu: ${defaultPassword}`;
    if (backfilled > 0) msg += `\n\n⚡ Hệ thống đã tự động bù điểm danh "${backfilled} buổi học" diễn ra sau ngày vào học cho em!`;
    alert(msg);
}

async function autoGenerateAccountsForOldStudents() {
    if (!appData.students || appData.students.length === 0) { alert("Danh sách học sinh đang trống!"); return; }
    let updatedCount = 0;
    appData.students.forEach(s => {
        if (!s.username || s.username.trim() === '' || s.username === '---') {
            const c = (appData.classes || []).find(x => x.id === s.classId);
            s.username = generateUsername(s.name, c ? c.name : '');
            if (!s.password || s.password.trim() === '') s.password = (s.phone && s.phone.trim() !== '') ? s.phone.trim() : '123456';
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
    document.getElementById('editStudentJoinDate').value = toIsoDate(s.joinDate || getTodayVNString());
    document.getElementById('editStudentCustomFee').value = s.customFee !== null ? s.customFee : '';

    const transferArea = document.getElementById('transferSettingsArea');
    if (transferArea) transferArea.classList.add('hidden');

    document.getElementById('modalEditStudent')?.classList.remove('hidden');
}

function closeEditStudentModal() { document.getElementById('modalEditStudent')?.classList.add('hidden'); }

function onEditClassChange() {
    const studentId = document.getElementById('editStudentId').value;
    const origClassId = document.getElementById('editOriginalClassId').value;
    const newClassId = document.getElementById('editStudentClassId').value;
    const transferArea = document.getElementById('transferSettingsArea');
    
    if (newClassId !== origClassId) {
        if (transferArea) transferArea.classList.remove('hidden');
        const transferDateInput = document.getElementById('editTransferActualDate');
        if (transferDateInput) transferDateInput.value = toIsoDate(getTodayVNString());
        document.getElementById('editStudentCode').value = generateNextStudentCode(newClassId);
        recalculateRetroactiveTransfer();
    } else {
        if (transferArea) transferArea.classList.add('hidden');
    }
}

function recalculateRetroactiveTransfer() {
    const studentId = document.getElementById('editStudentId').value;
    const origClassId = document.getElementById('editOriginalClassId').value;
    const newClassId = document.getElementById('editStudentClassId').value;
    const transferDate = fromIsoDate(document.getElementById('editTransferActualDate')?.value) || getTodayVNString();

    const tf = calculateTransferTuition(studentId, origClassId, newClassId, transferDate);
    const previewEl = document.getElementById('transferCalculationPreview');
    if (!tf || !previewEl) return;

    previewEl.innerHTML = `
        <div>• <b>Lớp cũ (${tf.oldClassName}):</b> Đã học ${tf.attendedInOld} buổi trước ngày ${transferDate}.</div>
        <div>• <b>Công nợ chốt lớp cũ mang sang:</b> <span class="font-bold ${tf.oldDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}">${tf.oldDebt.toLocaleString()} đ</span></div>
        <div>• <b>Lớp mới (${tf.newClassName}):</b> Tính ${tf.combinedNewSessions} buổi (gồm ${tf.retroSessions} buổi học từ ngày ${transferDate} đến nay + ${tf.remainingInNewCycle} buổi sắp tới).</div>
        <div class="border-t border-amber-200 pt-1 text-indigo-950 font-bold">➔ Học phí cần thu kỳ này ở lớp mới: <span class="text-rose-600 font-black">${tf.totalTransferFee.toLocaleString()} đ</span></div>
    `;

    document.getElementById('formEditStudent').dataset.transferCalc = JSON.stringify(tf);
}

function calculateTransferTuition(studentId, oldClassId, newClassId, transferDateStr) {
    if (!oldClassId || !newClassId || oldClassId === newClassId) return null;

    const oldClass = (appData.classes || []).find(c => c.id === oldClassId);
    const newClass = (appData.classes || []).find(c => c.id === newClassId);
    if (!oldClass || !newClass) return null;

    const attendedInOld = (appData.attendance || []).filter(a => 
        a.studentId === studentId && 
        a.classId === oldClassId && 
        compareDateDDMMYYYY(normalizeCloudDate(a.date), transferDateStr) < 0 && 
        (a.status === 'PRESENT' || a.status === 'LATE')
    ).length;

    const oldFeePerSession = (oldClass.fee || 300000) / 8;
    const oldTotalCost = Math.round(attendedInOld * oldFeePerSession);

    const totalPaidInOld = (appData.payments || []).filter(p => 
        p.studentId === studentId && 
        p.classId === oldClassId && 
        p.status === 'PAID'
    ).reduce((sum, p) => sum + p.amount, 0);

    const oldDebt = oldTotalCost - totalPaidInOld;

    const newClassSessions = getClassSessionDates(newClassId);
    const newTotalSess = newClassSessions.length;
    const newActiveCycle = Math.max(0, Math.floor((newTotalSess - 1) / 8));
    
    const retroSessions = newClassSessions.filter(d => 
        compareDateDDMMYYYY(d, transferDateStr) >= 0 && 
        compareDateDDMMYYYY(d, getTodayVNString()) <= 0
    ).length;

    const remainingInNewCycle = Math.max(0, 8 - (newTotalSess % 8));
    const combinedNewSessions = retroSessions + remainingInNewCycle;

    const newFeePerSession = (newClass.fee || 300000) / 8;
    const newTuitionPortion = Math.round(combinedNewSessions * newFeePerSession);
    const totalTransferFee = Math.max(0, newTuitionPortion + oldDebt);

    return {
        attendedInOld,
        oldDebt,
        retroSessions,
        remainingInNewCycle,
        combinedNewSessions,
        totalTransferFee,
        oldClassName: oldClass.name,
        newClassName: newClass.name,
        targetClassId: newClassId,
        newCycleIndex: newActiveCycle,
        transferDate: transferDateStr
    };
}

function handleSaveEditStudent(e) {
    e.preventDefault();
    const id = document.getElementById('editStudentId').value;
    const s = (appData.students || []).find(x => x.id === id);
    if (!s) return;

    const oldClassId = s.classId;
    const newClassId = document.getElementById('editStudentClassId').value;

    s.code = document.getElementById('editStudentCode').value.trim();
    s.name = document.getElementById('editStudentName').value.trim();
    s.phone = document.getElementById('editStudentPhone').value.trim();
    
    const custFee = document.getElementById('editStudentCustomFee').value;
    s.customFee = custFee !== '' ? parseFloat(custFee) : null;

    const transferCalcStr = document.getElementById('formEditStudent').dataset.transferCalc;
    if (transferCalcStr && oldClassId !== newClassId) {
        try {
            const tf = JSON.parse(transferCalcStr);
            s.classId = newClassId;
            s.joinDate = tf.transferDate;
            s.transferInfo = tf;

            autoBackfillAttendanceForNewStudent(s.id, newClassId, tf.transferDate);
            delete document.getElementById('formEditStudent').dataset.transferCalc;
        } catch(err) {
            console.error("Lỗi áp dụng chuyển lớp:", err);
        }
    } else {
        const rawJoin = document.getElementById('editStudentJoinDate').value;
        s.joinDate = fromIsoDate(rawJoin) || s.joinDate;
    }

    const c = (appData.classes || []).find(x => x.id === s.classId);
    s.username = generateUsername(s.name, c ? c.name : '');

    saveDataToCloud();
    closeEditStudentModal();
    refreshCurrentTab();
    alert('Đã cập nhật thông tin học sinh và khóa sổ chuyển nhóm thành công!');
}

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
    document.getElementById('leaveDateInput').value = toIsoDate(getTodayVNString());
    document.getElementById('leaveTotalSessionsText').innerText = `${attendedCount} buổi`;
    document.getElementById('leaveTotalPaidText').innerText = `${paidTotal.toLocaleString()} đ`;
    document.getElementById('leaveDebtInput').value = debt;
    document.getElementById('leaveReasonInput').value = '';

    document.getElementById('modalLeaveStudent')?.classList.remove('hidden');
}

function closeLeaveModal() { document.getElementById('modalLeaveStudent')?.classList.add('hidden'); }

function handleConfirmStudentLeave(e) {
    e.preventDefault();
    const id = document.getElementById('leaveStudentId').value;
    const s = (appData.students || []).find(x => x.id === id);
    if(!s) return;
    const c = (appData.classes || []).find(x => x.id === s.classId);

    const rawLeave = document.getElementById('leaveDateInput').value;
    const leaveDate = fromIsoDate(rawLeave) || getTodayVNString();
    const debt = parseFloat(document.getElementById('leaveDebtInput').value) || 0;
    const reason = document.getElementById('leaveReasonInput').value.trim();

    const attendedCount = (appData.attendance || []).filter(a => a.studentId === s.id && (a.status === 'PRESENT' || a.status === 'LATE')).length;
    const paidTotal = (appData.payments || []).filter(p => p.studentId === s.id && p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

    if(!appData.inactiveStudents) appData.inactiveStudents = [];
    appData.inactiveStudents.push({
        id: 'inact_' + Date.now(), studentId: s.id, studentCode: s.code, studentName: s.name,
        classId: s.classId, className: c ? c.name : '---', phone: s.phone || '',
        joinDate: normalizeCloudDate(s.joinDate) || '', leaveDate: leaveDate,
        totalSessions: attendedCount, totalPaid: paidTotal, debtAmount: debt, reason: reason
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
        id: inact.studentId, classId: inact.classId, code: inact.studentCode, name: inact.studentName,
        phone: inact.phone, joinDate: getTodayVNString(), customFee: null,
        username: generateUsername(inact.studentName, inact.className), password: inact.phone || '123456'
    });

    appData.inactiveStudents = (appData.inactiveStudents || []).filter(x => x.id !== inactiveId);
    saveDataToCloud();
    refreshCurrentTab();
    alert(`Đã khôi phục ${inact.studentName} thành công!`);
}

function deletePermanentlyInactiveStudent(inactiveId) {
    const inact = (appData.inactiveStudents || []).find(x => x.id === inactiveId);
    if (!inact) return;

    if (confirm(`Thầy có chắc chắn muốn XÓA HẲN hồ sơ của em "${inact.studentName}" không?`)) {
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
                <button onclick="deletePermanentlyInactiveStudent('${x.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 px-2 py-1 rounded-lg font-bold text-xs transition">Xóa</button>
            </td>
        </tr>
    `).join('');
}

function findDuplicateGroups() {
    const students = appData.students || [];
    const groups = {};

    const normalizeName = (name) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');

    students.forEach(s => {
        const keyName = normalizeName(s.name);
        if (!keyName) return;
        if (!groups[keyName]) groups[keyName] = [];
        groups[keyName].push(s);
    });

    const duplicateList = [];
    for (const key in groups) {
        if (groups[key].length > 1) {
            duplicateList.push({ matchedBy: 'Họ và tên', keyName: groups[key][0].name, items: groups[key] });
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
                ${duplicates.map((group, gIdx) => `
                    <div class="border rounded-2xl overflow-hidden shadow-xs border-amber-200 bg-white">
                        <div class="p-3 bg-slate-50 border-b flex justify-between items-center font-bold">
                            <span class="text-indigo-950 font-black">Nhóm ${gIdx + 1}: ${group.keyName}</span>
                            <span class="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">${group.items.length} bản ghi</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs whitespace-nowrap">
                                <thead>
                                    <tr class="bg-slate-100/60 font-bold border-b text-slate-600">
                                        <th class="p-2.5">Lớp</th><th class="p-2.5">Mã HS</th><th class="p-2.5">SĐT</th><th class="p-2.5">Ngày Vào</th>
                                        <th class="p-2.5 text-center">Số Buổi Đã Học</th><th class="p-2.5">Tổng Đã Nộp</th><th class="p-2.5 text-center">Thao Tác</th>
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
                                                <td class="p-2.5 text-center">
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
                `).join('')}
            </div>
        `;
    }

    document.getElementById('modalDuplicateAudit')?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeDuplicateAuditModal() { document.getElementById('modalDuplicateAudit')?.classList.add('hidden'); }

async function resolveDuplicateDelete(studentId, name, className) {
    if (!confirm(`Thầy có chắc chắn muốn XÓA học sinh "${name}" khỏi lớp "${className}" không?`)) return;

    appData.students = (appData.students || []).filter(s => s.id !== studentId);
    appData.attendance = (appData.attendance || []).filter(a => a.studentId !== studentId);
    appData.payments = (appData.payments || []).filter(p => p.studentId !== studentId);

    await saveDataToCloud();
    refreshCurrentTab();
    openDuplicateAuditModal();
    alert(`Đã xóa thành công học sinh ${name} khỏi lớp ${className}!`);
}

function exportStudentsToExcel() {
    const stds = getFilteredStudents();
    if (stds.length === 0) { alert("Danh sách học sinh đang trống!"); return; }

    const currentClassName = currentClassId === 'ALL' ? 'Tat_Ca_Cac_Lop' : getClassName(currentClassId);
    const dataForExport = stds.map((s, idx) => {
        const c = (appData.classes || []).find(x => x.id === s.classId);
        const fee = getEffectiveStudentFee(s, c);
        return {
            "STT": idx + 1, "Lớp": c ? c.name : "", "Mã HS": s.code, "Họ và tên": s.name,
            "Số điện thoại": s.phone || "", "Ngày vào học": formatDateVN(s.joinDate),
            "Học phí": fee === 0 ? "Miễn phí" : fee, "Tài khoản": s.username || "", "Mật khẩu": s.password || ""
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    worksheet['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 12 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachHocSinh");
    XLSX.writeFile(workbook, `DanhSachHS_${currentClassName}_${getTodayVNString()}.xlsx`);
}

function openImportExcelModal() {
    const sel = document.getElementById('importTargetClassSelect');
    if (sel) {
        sel.innerHTML = (appData.classes || []).map(c => `<option value="${c.id}" ${c.id === (currentClassId === 'ALL' ? appData.classes[0]?.id : currentClassId) ? 'selected' : ''}>${c.name}</option>`).join('');
    }
    document.getElementById('excelFileInput').value = '';
    document.getElementById('excelPreviewSection')?.classList.add('hidden');
    document.getElementById('btnConfirmImportExcel')?.classList.add('hidden');
    tempImportedStudents = [];
    document.getElementById('modalImportExcel')?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeImportExcelModal() { 
    document.getElementById('modalImportExcel')?.classList.add('hidden'); 
    tempImportedStudents = []; 
}

function downloadSampleExcel() {
    const sampleData = [
        { "Họ và tên": "Nguyễn Văn An", "Số điện thoại": "0987654321", "Ngày vào học (DD-MM-YYYY)": "01-10-2026", "Học phí riêng": "" },
        { "Họ và tên": "Trần Thị Bé", "Số điện thoại": "0912345678", "Ngày vào học (DD-MM-YYYY)": "05-10-2026", "Học phí riêng": 0 }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 25 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_HS");
    XLSX.writeFile(wb, "Mau_Nhap_Hoc_Sinh.xlsx");
}

function handleExcelFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        if (rawRows.length === 0) { alert("Tệp Excel không chứa dữ liệu!"); return; }

        const targetClassId = document.getElementById('importTargetClassSelect').value;
        const targetClass = (appData.classes || []).find(c => c.id === targetClassId);
        tempImportedStudents = [];

        rawRows.forEach((row) => {
            const name = (row["Họ và tên"] || row["Họ tên"] || row["Tên"] || "").trim();
            if (!name) return;

            const phone = String(row["Số điện thoại"] || row["SĐT"] || row["Điện thoại"] || "").trim();
            let joinDate = normalizeCloudDate(row["Ngày vào học (DD-MM-YYYY)"] || row["Ngày vào học"] || row["Ngày vào"] || getTodayVNString());
            const custFeeRaw = row["Học phí riêng"] !== undefined ? row["Học phí riêng"] : null;
            const customFee = (custFeeRaw !== null && custFeeRaw !== "") ? parseFloat(custFeeRaw) : null;
            const code = generateNextStudentCode(targetClassId);

            tempImportedStudents.push({
                name, phone, joinDate, customFee, code,
                username: generateUsername(name, targetClass ? targetClass.name : ''),
                password: phone || '123456'
            });
        });

        if (tempImportedStudents.length === 0) { alert("Không tìm thấy dòng dữ liệu hợp lệ!"); return; }

        document.getElementById('excelPreviewCountText').innerText = tempImportedStudents.length;
        document.getElementById('excelPreviewTableBody').innerHTML = tempImportedStudents.map((s, idx) => `
            <tr>
                <td class="p-2 font-mono">${idx + 1}</td>
                <td class="p-2 font-bold">${s.name}</td>
                <td class="p-2 font-mono">${s.phone || '---'}</td>
                <td class="p-2 font-mono">${s.joinDate}</td>
                <td class="p-2 font-mono text-indigo-700 font-bold">${s.code}</td>
            </tr>
        `).join('');

        document.getElementById('excelPreviewSection')?.classList.remove('hidden');
        document.getElementById('btnConfirmImportExcel')?.classList.remove('hidden');
    };
    reader.readAsArrayBuffer(file);
}

async function confirmImportExcelToSystem() {
    if (tempImportedStudents.length === 0) return;
    const targetClassId = document.getElementById('importTargetClassSelect').value;
    const targetClass = (appData.classes || []).find(c => c.id === targetClassId);
    let totalBackfilled = 0;

    tempImportedStudents.forEach(item => {
        const newStudentId = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        appData.students.push({
            id: newStudentId, classId: targetClassId, code: item.code, name: item.name,
            phone: item.phone, joinDate: item.joinDate, customFee: item.customFee, username: item.username, password: item.password
        });
        totalBackfilled += autoBackfillAttendanceForNewStudent(newStudentId, targetClassId, item.joinDate);
    });

    await saveDataToCloud();
    closeImportExcelModal();
    refreshCurrentTab();
    alert(`✅ Đã nhập thành công ${tempImportedStudents.length} học sinh vào lớp ${targetClass ? targetClass.name : ''}!`);
}

function impersonateStudent(studentId) {
    const s = (appData.students || []).find(x => x.id === studentId);
    if (!s) { alert("Không tìm thấy thông tin học sinh!"); return; }
    localStorage.setItem(STUDENT_AUTH_KEY, JSON.stringify({ id: s.id }));
    localStorage.setItem(ACTIVE_STUDENT_SESSION_KEY, s.id);
    window.open(`hocsinh.html?impersonate=${s.id}`, '_blank');
}