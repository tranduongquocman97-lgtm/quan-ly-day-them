// ============================================================================
// MODULE QBANK & ANALYTICS: NGÂN HÀNG ĐỀ THI, RADAR GIAN LẬN & PHỔ ĐIỂM (JS/QBANK.JS)
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
    let content = ed ? ed.innerHTML : '';
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

    content = content.replace(/(\[(?:P1|P2|P3|PHẦN\s*[123IV]+)\]|PHẦN\s+[123IV]+[\s:.-])/gi, '\n$1\n');
    content = content.replace(/(Câu\s+\d+[\s:.-])/gi, '\n$1');

    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    tempParsedQuestions = [];
    let currentPart = 1;
    let currentQ = null;

    lines.forEach(line => {
        if(/(?:\[(?:P1|PHẦN\s*1|PHẦN\s*I)\]|^PHẦN\s*(?:1|I)[\s:.-])/i.test(line)) { currentPart = 1; return; }
        if(/(?:\[(?:P2|PHẦN\s*2|PHẦN\s*II)\]|^PHẦN\s*(?:2|II)[\s:.-])/i.test(line)) { currentPart = 2; return; }
        if(/(?:\[(?:P3|PHẦN\s*3|PHẦN\s*III)\]|^PHẦN\s*(?:3|III)[\s:.-])/i.test(line)) { currentPart = 3; return; }

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
        try {
            renderMathInElement(prev, { delimiters: [{left: '$', right: '$', display: false}], throwOnError: false });
        } catch(e) {}
    }
}

async function saveDirectExamToCloud() {
    if(currentClassId === 'ALL') { alert("Vui lòng chọn 1 lớp cụ thể ở menu trên cùng!"); return; }
    const title = document.getElementById('directExamTitle').value.trim();
    const duration = parseInt(document.getElementById('directExamDuration').value) || 45;

    if(!title) { alert("Vui lòng nhập tên đề thi!"); return; }
    if(tempParsedQuestions.length === 0) { alert("Vui lòng bấm '1. Bóc Tách' trước!"); return; }

    appData.exams.push({
        id: 'ex_' + Date.now(), title: title, classId: currentClassId, duration: duration,
        questions: tempParsedQuestions, solutionUrl: document.getElementById('directExamSolutionUrl').value.trim(), status: 'OPEN'
    });

    await saveDataToCloud();
    alert("Đã lưu và giao đề thi thành công!");
    document.getElementById('directExamTitle').value = '';
    document.getElementById('directEditorArea').innerHTML = '';
    tempParsedQuestions = [];
    refreshCurrentTab();
}

function toggleExamStatus(examId) {
    const ex = (appData.exams || []).find(e => e.id === examId);
    if (!ex) return;
    ex.status = ex.status === 'CLOSED' ? 'OPEN' : 'CLOSED';
    saveDataToCloud();
    renderQBankTab();
}

function renderQBankTab() {
    const container = document.getElementById('examListContainer');
    if (!container) return;
    const list = currentClassId === 'ALL' ? (appData.exams || []) : (appData.exams || []).filter(e => e.classId === currentClassId);
    container.innerHTML = list.length === 0 ? '<div class="text-xs text-slate-400 italic">Trống</div>' : list.map(e => `
        <div class="p-2.5 bg-slate-50 border rounded-xl flex justify-between items-center text-xs">
            <div>
                <b>${e.title}</b> (${getClassName(e.classId)})<br>
                <span class="text-[10px] text-indigo-600 font-bold">${e.questions ? e.questions.length : 0} câu • ${e.duration}p</span>
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1 ${e.status==='CLOSED'?'bg-rose-100 text-rose-700':'bg-emerald-100 text-emerald-700'}">
                    ${e.status==='CLOSED'?'Đã Đóng':'Đang Mở'}
                </span>
            </div>
            <div class="flex items-center space-x-1">
                <button onclick="toggleExamStatus('${e.id}')" class="text-xs px-2 py-1 rounded-lg border font-bold ${e.status==='CLOSED'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-amber-50 text-amber-700 border-amber-200'}">
                    ${e.status==='CLOSED'?'Mở':'Khóa'}
                </button>
                <button onclick="appData.exams=appData.exams.filter(x=>x.id!=='${e.id}');saveDataToCloud();refreshCurrentTab();" class="text-rose-500 hover:bg-rose-100 p-1 rounded">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
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

function renderExamRadar() {
    const radarContainer = document.getElementById('dashExamRadarContainer');
    if (!radarContainer) return;

    const results = (appData.examResults || []).filter(r => {
        if (currentClassId === 'ALL') return true;
        const s = (appData.students || []).find(st => st.id === r.studentId);
        return s && s.classId === currentClassId;
    });

    if (results.length === 0) {
        radarContainer.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl">Chưa có bài thi nào được nộp.</div>`;
        return;
    }

    const suspicious = results.filter(r => (parseInt(r.tabSwitchCount) || 0) > 0);
    suspicious.sort((a, b) => (b.tabSwitchCount || 0) - (a.tabSwitchCount || 0));

    let html = '';
    if (suspicious.length === 0) {
        html = `
            <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600 shrink-0"></i>
                <span>Tất cả bài thi đều an toàn, không phát hiện hành vi rời màn hình!</span>
            </div>
        `;
    } else {
        html = suspicious.slice(0, 5).map(r => {
            const s = (appData.students || []).find(st => st.id === r.studentId) || { name: 'Đã xóa', code: '---' };
            const ex = (appData.exams || []).find(e => e.id === r.examId) || { title: 'Đề thi' };
            return `
                <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex justify-between items-center text-xs">
                    <div>
                        <b class="text-rose-950">${s.name}</b> <span class="text-slate-500">(${s.code})</span>
                        <div class="text-[11px] text-rose-700">${ex.title} • Điểm: <b>${r.score}</b></div>
                    </div>
                    <span class="bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded text-[10px]">
                        Rời ${r.tabSwitchCount} lần
                    </span>
                </div>
            `;
        }).join('');
    }

    radarContainer.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}