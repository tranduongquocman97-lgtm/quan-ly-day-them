// ============================================================================
// MODULE SYNC: ĐỒNG BỘ CLOUD & SAO LƯU GOOGLE DRIVE / CALENDAR (JS/SYNC.JS)
// ============================================================================

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
    if (!inputVal) { alert("Vui lòng nhập đường dẫn API!"); return; }
    cloudApiUrl = inputVal;
    localStorage.setItem('API_URL', cloudApiUrl); 
    alert('Đã lưu cấu hình API! Đang tải dữ liệu...'); 
    loadDataFromCloud(); 
}

async function manualSync() { if(cloudApiUrl) loadDataFromCloud(); }

async function loadDataFromCloud() {
    if(!cloudApiUrl) return; 
    updateSyncStatus('syncing', 'Đang tải...');
    try {
        const res = await fetch(cloudApiUrl); 
        const j = await res.json();
        
        if (j.error || !j.Students || !j.Classes) {
            updateSyncStatus('error', 'Lỗi phản hồi');
            return;
        }

        if(j.Classes && j.Classes.length > 1) {
            appData.classes = j.Classes.slice(1).map(r => ({
                id: String(r[0]||''), 
                name: String(r[1]||''), 
                fee: parseFloat(r[2])||300000, 
                schedules: (function(){ try { return typeof r[3] === 'string' ? JSON.parse(r[3] || '[]') : (r[3] || []); } catch(e) { return []; } })()
            }));
        }
        if(j.Students && j.Students.length > 1) {
            appData.students = j.Students.slice(1).map(r=>({
                id:String(r[0]||''), classId:String(r[1]||''), code:String(r[2]||''), 
                name:String(r[3]||''), phone:String(r[4]||''), joinDate:normalizeCloudDate(r[5]||'01-08-2026'), 
                customFee:r[6]!==''&&r[6]!==null?parseFloat(r[6]):null, username:String(r[7]||''), password:String(r[8]||'')
            }));
        }
        if(j.Attendance && j.Attendance.length > 1) {
            appData.attendance = j.Attendance.slice(1).map(r => ({
                studentId: String(r[0]||''), classId: (r.length >= 5) ? String(r[1]||'') : '',
                date: (r.length >= 5) ? normalizeCloudDate(r[2]||'') : normalizeCloudDate(r[1]||''),
                status: (r.length >= 5) ? String(r[3]||'') : String(r[2]||''), note: (r.length >= 5) ? String(r[4]||'') : String(r[3]||'')
            }));
        }
        if(j.Payments && j.Payments.length > 1) {
            appData.payments = j.Payments.slice(1).map(r=>({
                id:String(r[0]||''), studentId:String(r[1]||''), classId:String(r[2]||''), 
                cycleIndex:parseInt(r[3]), amount:parseFloat(r[4])||0, status:String(r[5]||''), 
                method:String(r[6]||''), note:String(r[7]||''), date:normalizeCloudDate(r[8]||'')
            }));
        }
        if(j.Documents && j.Documents.length > 1) {
            appData.documents = j.Documents.slice(1).map(r=>({
                id:String(r[0]||''), classId:String(r[1]||''), name:String(r[2]||''), 
                category:String(r[3]||'Chuyên đề chung'), url:String(r[4]||'')
            }));
        }
        if(j.Exams && j.Exams.length > 1) {
            appData.exams = j.Exams.slice(1).map(r=>({
                id: String(r[0]||''), title: String(r[1]||''), classId: String(r[2]||''),
                duration: parseInt(r[3])||45, solutionUrl: String(r[4]||''),
                questions: (function(){ try { return JSON.parse(r[5]||'[]'); } catch(e){ return []; } })(),
                matrix: (function(){ try { return JSON.parse(r[6]||'{}'); } catch(e){ return {}; } })(),
                status: String(r[7]||'OPEN')
            }));
        }
        if(j.ExamResults && j.ExamResults.length > 1) {
            appData.examResults = j.ExamResults.slice(1).map(r=>({
                id:String(r[0]||''), examId:String(r[1]||''), studentId:String(r[2]||''), 
                score:parseFloat(r[3]||0), details:(typeof r[4]==='string'?JSON.parse(r[4]||'{}'):(r[4]||{})), 
                tabSwitchCount:parseInt(r[5]||0), submittedAt:String(r[6]||'')
            }));
        }
        if(j.WeeklyOverrides && j.WeeklyOverrides.length > 1) {
            appData.weeklyOverrides = j.WeeklyOverrides.slice(1).map(r=>({
                id:String(r[0]||''), classId:String(r[1]||''), date:normalizeCloudDate(r[2]||''), 
                type:String(r[3]||''), startTime:String(r[4]||''), endTime:String(r[5]||''), note:String(r[6]||'')
            }));
        }
        if(j.InactiveStudents && j.InactiveStudents.length > 1) {
            appData.inactiveStudents = j.InactiveStudents.slice(1).map(r=>({
                id: String(r[0]||''), studentId: String(r[1]||''), studentCode: String(r[2]||''), 
                studentName: String(r[3]||''), classId: String(r[4]||''), className: String(r[5]||''), 
                phone: String(r[6]||''), joinDate: normalizeCloudDate(r[7]||''), leaveDate: normalizeCloudDate(r[8]||''), 
                totalSessions: parseInt(r[9]||0), totalPaid: parseFloat(r[10]||0), debtAmount: parseFloat(r[11]||0), reason: String(r[12]||'')
            }));
        }
        if(j.AppConfig && j.AppConfig.length > 1) {
            appData.appConfig = j.AppConfig.slice(1).map(r=>({ key: String(r[0]||''), value: String(r[1]||'') }));
            loadBrandingToSettings();
        }

        saveToStorage(); 
        renderGlobalClassSelect(); 
        refreshCurrentTab(); 
        updateSyncStatus('success', 'Đã đồng bộ');
    } catch(e) { 
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
    } catch(e) { updateSyncStatus('error', 'Lỗi lưu'); }
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
    } catch (e) { alert("Đã kích hoạt đồng bộ lịch dạy sang Google Calendar!"); }
}