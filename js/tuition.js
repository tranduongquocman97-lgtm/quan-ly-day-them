// ============================================================================
// MODULE TUITION: KẾ TOÁN FIFO LŨY KẾ, THU TIỀN 2 TRẠNG THÁI & VIETQR (JS/TUITION.JS)
// ============================================================================

function calculateStudentTuitionLedger(s) {
    const targetClass = (appData.classes || []).find(c => c.id === s.classId);
    const effFee = getEffectiveStudentFee(s, targetClass);
    const allDates = getClassSessionDates(s.classId);
    const totalTaught = allDates.length;
    
    const maxCycleIndex = Math.max(3, Math.floor((totalTaught - 1) / 8));
    const activeCycleIndex = Math.max(0, Math.floor((totalTaught - 1) / 8));

    const skipCount = allDates.filter(d => compareDateDDMMYYYY(d, s.joinDate) < 0).length;
    const joinCycle = Math.floor(skipCount / 8);

    let carriedSurplus = 0;
    let totalDebtToPay = 0;
    let cyclesInfo = [];

    for (let i = 0; i <= maxCycleIndex; i++) {
        // CHỈ LẤY CÁC BẢN GHI ĐÃ THỰC THU (PAID) - TUYỆT ĐỐI KHÔNG CỘNG BẢN GHI KHÁC
        const cyclePayments = (appData.payments || []).filter(p => 
            p.studentId === s.id && 
            p.classId === s.classId && 
            p.cycleIndex === i && 
            p.status === 'PAID'
        );
        const paidAmount = cyclePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        
        // Kiểm tra miễn giảm
        const isExempt = (effFee === 0) || (appData.payments || []).some(p => p.studentId === s.id && p.classId === s.classId && p.cycleIndex === i && p.status === 'EXEMPT');

        let baseFee = effFee;
        let isNotJoined = (i < joinCycle);

        if (isExempt) {
            baseFee = 0;
        } else if (isNotJoined) {
            baseFee = 0;
        } else if (s.transferInfo && s.transferInfo.newCycleIndex === i && s.transferInfo.targetClassId === s.classId) {
            // NẾU LÀ KỲ CHUYỂN LỚP: HỌC PHÍ = SỐ BUỔI LỚP MỚI + NỢ CŨ MANG SANG
            baseFee = s.transferInfo.totalTransferFee;
        } else if (i === joinCycle && skipCount > 0) {
            const actualSess = 8 - (skipCount % 8);
            baseFee = Math.round((effFee / 8) * actualSess);
        }

        let available = carriedSurplus + paidAmount;
        let deductedFromPrev = Math.min(baseFee, carriedSurplus);
        let cycleStatus = 'FUTURE';
        let cycleDebt = 0;
        let surplus = 0;

        if (isNotJoined) {
            cycleStatus = 'NOT_JOINED';
            carriedSurplus = 0;
        } else if (isExempt) {
            cycleStatus = 'EXEMPT';
            carriedSurplus = available;
        } else {
            if (available >= baseFee) {
                surplus = available - baseFee;
                carriedSurplus = surplus;
                cycleStatus = surplus > 0 ? 'PAID_SURPLUS' : 'PAID_EXACT';
            } else {
                cycleDebt = baseFee - available;
                carriedSurplus = 0;
                if (i <= activeCycleIndex) {
                    cycleStatus = 'OWE';
                    totalDebtToPay += cycleDebt;
                } else {
                    cycleStatus = 'FUTURE';
                }
            }
        }

        cyclesInfo.push({
            cycleIndex: i,
            baseFee: baseFee,
            paidAmount: paidAmount,
            deductedFromPrev: deductedFromPrev,
            cycleDebt: cycleDebt,
            surplus: surplus,
            status: cycleStatus,
            payments: cyclePayments
        });
    }

    return {
        cycles: cyclesInfo,
        totalDebt: totalDebtToPay,
        remainingSurplus: carriedSurplus,
        activeCycleIndex: Math.min(activeCycleIndex, cyclesInfo.length - 1)
    };
}

function renderTuitionTable() {
    const stds = getFilteredStudents();
    const tb = document.getElementById('tuitionTableBody');
    if(!tb) return;
    if(stds.length === 0) { tb.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Trống</td></tr>`; return; }

    tb.innerHTML = stds.map(s => {
        try {
            const ledger = calculateStudentTuitionLedger(s);
            let cells = '';

            for(let i = 0; i < 4; i++) {
                const cInfo = (ledger.cycles && ledger.cycles[i]) ? ledger.cycles[i] : { status: 'FUTURE', baseFee: 0, paidAmount: 0, cycleDebt: 0, surplus: 0 };
                let stC = 'bg-slate-50 text-slate-400', txt = 'Chưa đến';

                if (cInfo.status === 'EXEMPT') {
                    stC = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
                    txt = 'Miễn phí';
                } else if (cInfo.status === 'NOT_JOINED') {
                    txt = 'Chưa vào học';
                } else if (cInfo.status === 'PAID_SURPLUS') {
                    stC = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-xs';
                    txt = `Đã nộp (Dư ${(cInfo.surplus || 0).toLocaleString()}đ)`;
                } else if (cInfo.status === 'PAID_EXACT') {
                    stC = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
                    txt = `Đã nộp đủ`;
                } else if (cInfo.status === 'OWE') {
                    stC = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
                    txt = cInfo.paidAmount > 0 ? `Còn nợ: ${(cInfo.cycleDebt || 0).toLocaleString()}đ` : `Cần thu: ${(cInfo.cycleDebt || 0).toLocaleString()}đ`;
                }

                cells += `<td class="p-2 border-r text-center cursor-pointer" onclick="openPayModal('${s.id}', ${i})" title="Bấm để thu học phí hoặc xem QR"><div class="p-1.5 sm:p-2 rounded-xl border text-[11px] ${stC}">${txt}</div></td>`;
            }

            return `<tr><td class="p-2.5 sm:p-3 sticky-col-1 border-r text-[10px] font-bold">${getClassName(s.classId)}</td><td class="p-2.5 sm:p-3 sticky-col-2 border-r font-bold">${s.name}</td>${cells}</tr>`;
        } catch(err) {
            return `<tr><td class="p-2.5 border-r">${getClassName(s.classId)}</td><td class="p-2.5 border-r">${s.name}</td><td colspan="4" class="p-2.5 text-center text-slate-400 italic">Lỗi hiển thị</td></tr>`;
        }
    }).join('');
}

function openPayModal(sId, cIdx) {
    const s = (appData.students || []).find(x => x.id === sId);
    if (!s) return;

    const ledger = calculateStudentTuitionLedger(s);
    const cInfo = (ledger.cycles && ledger.cycles[cIdx]) ? ledger.cycles[cIdx] : { baseFee: 300000, cycleDebt: 300000, paidAmount: 0, deductedFromPrev: 0, status: 'OWE' };
    
    const paidPayment = (cInfo.payments || []).find(p => p.status === 'PAID');

    const formNew = document.getElementById('formPayTuitionNew');
    const secManager = document.getElementById('sectionPaidPaymentManager');
    const modalTitle = document.getElementById('payModalTitle');

    if (paidPayment) {
        if (modalTitle) {
            modalTitle.innerText = "Quản Lý Phiếu Thu (Đã Nộp)";
            modalTitle.className = "font-bold text-sm text-indigo-700";
        }
        formNew?.classList.add('hidden');
        secManager?.classList.remove('hidden');

        document.getElementById('editPaymentId').value = paidPayment.id;
        const studentTextEl = document.getElementById('paidPaymentStudentText');
        if (studentTextEl) studentTextEl.innerText = `${s.name} (${s.code}) - Kỳ ${cIdx + 1} (${getClassName(s.classId)})`;
        document.getElementById('editPaidAmount').value = paidPayment.amount;
        document.getElementById('editPaidDate').value = toIsoDate(paidPayment.date);
        document.getElementById('editPaidMethod').value = paidPayment.method || 'Chuyển khoản';

        const targetSelect = document.getElementById('selectTransferPaymentTarget');
        if (targetSelect) {
            const otherStudents = (appData.students || []).filter(st => st.classId === s.classId && st.id !== s.id);
            targetSelect.innerHTML = otherStudents.map(st => `<option value="${st.id}">${st.name} (${st.code})</option>`).join('');
        }

    } else {
        if (modalTitle) {
            modalTitle.innerText = "Thu Học Phí";
            modalTitle.className = "font-bold text-sm text-emerald-700";
        }
        formNew?.classList.remove('hidden');
        secManager?.classList.add('hidden');

        document.getElementById('payStudentId').value = sId;
        document.getElementById('payCycleIndex').value = cIdx;
        document.getElementById('payStudentInfo').value = `${s.name} - Kỳ ${cIdx + 1} (${getClassName(s.classId)})`;
        
        const suggestedAmount = cInfo.cycleDebt > 0 ? cInfo.cycleDebt : cInfo.baseFee;
        document.getElementById('payAmount').value = suggestedAmount;
        document.getElementById('payDate').value = toIsoDate(getTodayVNString());
        document.getElementById('payMethod').value = 'Chuyển khoản';
        
        const noteEl = document.getElementById('payNoteSuggestion');
        if (noteEl) {
            if (s.transferInfo && s.transferInfo.newCycleIndex === cIdx) {
                noteEl.innerText = `* Đã bao gồm ${s.transferInfo.oldDebt.toLocaleString()}đ nợ cũ từ ${s.transferInfo.oldClassName}.`;
            } else if (cInfo.deductedFromPrev > 0) {
                noteEl.innerText = `* Đã tự động cấn trừ ${cInfo.deductedFromPrev.toLocaleString()}đ từ số dư kỳ trước.`;
            } else {
                noteEl.innerText = '';
            }
        }
    }

    document.getElementById('modalPayTuition')?.classList.remove('hidden');
}

function closePayModal() { 
    document.getElementById('modalPayTuition')?.classList.add('hidden'); 
}

function handleSavePayment(e) {
    e.preventDefault();
    const sId = document.getElementById('payStudentId').value;
    const cIdx = parseInt(document.getElementById('payCycleIndex').value);
    const amt = parseFloat(document.getElementById('payAmount').value) || 0;
    const rawPayDate = document.getElementById('payDate').value;
    const d = fromIsoDate(rawPayDate) || getTodayVNString();
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
    alert('Đã cập nhật thu học phí thành công!');
}

function handleUpdatePaidPayment() {
    const pId = document.getElementById('editPaymentId').value;
    const p = (appData.payments || []).find(x => x.id === pId);
    if (!p) return;

    p.amount = parseFloat(document.getElementById('editPaidAmount').value) || 0;
    p.date = fromIsoDate(document.getElementById('editPaidDate').value) || getTodayVNString();
    p.method = document.getElementById('editPaidMethod').value;

    saveDataToCloud();
    closePayModal();
    refreshCurrentTab();
    alert('Đã cập nhật thông tin phiếu thu thành công!');
}

function handleCancelPayment() {
    const pId = document.getElementById('editPaymentId').value;
    const p = (appData.payments || []).find(x => x.id === pId);
    if (!p) return;

    if (confirm(`Thầy có chắc chắn muốn HỦY phiếu thu ${p.amount.toLocaleString()}đ này không?\nÔ học phí kỳ này sẽ chuyển về màu đỏ (Chưa nộp) ngay lập tức.`)) {
        appData.payments = (appData.payments || []).filter(x => x.id !== pId);
        saveDataToCloud();
        closePayModal();
        refreshCurrentTab();
        alert('Đã hủy phiếu thu thành công! Hệ thống đã tính lại công nợ.');
    }
}

function handleTransferPaymentToAnotherStudent() {
    const pId = document.getElementById('editPaymentId').value;
    const targetStudentId = document.getElementById('selectTransferPaymentTarget')?.value;
    const p = (appData.payments || []).find(x => x.id === pId);
    const targetStudent = (appData.students || []).find(x => x.id === targetStudentId);

    if (!p || !targetStudent) {
        alert("Vui lòng chọn học sinh nhận khoản tiền!");
        return;
    }

    if (confirm(`Chuyển phiếu thu ${p.amount.toLocaleString()}đ này sang cho em "${targetStudent.name}"?`)) {
        p.studentId = targetStudent.id;
        saveDataToCloud();
        closePayModal();
        refreshCurrentTab();
        alert(`Đã chuyển khoản tiền sang học sinh ${targetStudent.name} thành công!`);
    }
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
    document.getElementById('modalAdminQR')?.classList.remove('hidden');
}

function closeAdminQRModal() { 
    document.getElementById('modalAdminQR')?.classList.add('hidden'); 
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