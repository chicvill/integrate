import { useState, useEffect } from 'react';
import axios from 'axios';

import { API_URL } from './config';

export default function AdminDashboard() {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Detailed Progress Viewer States
  const [selectedStudentSchedule, setSelectedStudentSchedule] = useState<any>(null);
  const [progressSubject, setProgressSubject] = useState<string>('');

  // Form fields for Attendance
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [checkInTime, setCheckInTime] = useState('09:00');
  const [checkOutTime, setCheckOutTime] = useState('18:00');
  const [isManaged, setIsManaged] = useState(false);
  const [consultChecked, setConsultChecked] = useState(false);
  const [consultNote, setConsultNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Voucher Expiry & Scheduled Times
  const [voucherExpiry, setVoucherExpiry] = useState('');
  const [editScheduledTimes, setEditScheduledTimes] = useState<Record<string, { in: string; out: string; consult?: string }>>({});

  // 3-way messaging
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API_URL}/knowledge/admin/students`);
      if (res.data.status === 'success') {
        setStudents(res.data.data);
        const managedStudents = res.data.data.filter((s: any) => s.form_data?.관리방식 === '관리형');
        if (managedStudents.length > 0 && !selectedStudent) {
          setSelectedStudent(managedStudents[0].user_id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedStudent) {
      fetchAttendanceHistory(selectedStudent);
      fetchMessages(selectedStudent);
      fetchStudentSchedule(selectedStudent);
      
      const studentObj = students.find(s => s.user_id === selectedStudent);
      if (studentObj) {
        setIsManaged(studentObj.form_data?.관리방식 === '관리형');
        setVoucherExpiry(studentObj.form_data?.이용권만료일 || '');
        setEditScheduledTimes(studentObj.form_data?.등하원예약시간 || {});
      }
    }
  }, [selectedStudent, students]);

  const [lastTagTime, setLastTagTime] = useState<number>(() => intTime());

  function intTime() {
    return Math.floor(Date.now() / 1000);
  }

  // Pre-fill fields for selected date from attendanceHistory
  useEffect(() => {
    const logForDate = attendanceHistory.find(h => h.date === date);
    if (logForDate) {
      setCheckInTime(logForDate.check_in_time || '09:00');
      setCheckOutTime(logForDate.check_out_time || '18:00');
      setConsultChecked(!!logForDate.consult_checked);
      setConsultNote(logForDate.consult_note || '');
    } else {
      setCheckInTime('09:00');
      setCheckOutTime('18:00');
      setConsultChecked(false); // 관리자 수동 선택 시에는 오체킹 방지를 위해 false로 시작
      setConsultNote('');
    }
  }, [date, attendanceHistory]);

  // Poll for latest consultation nfc tag event
  useEffect(() => {
    const pollTimer = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/knowledge/admin/latest_consult_tag`);
        if (res.data.status === 'success' && res.data.data) {
          const { session_id, timestamp } = res.data.data;
          if (session_id && timestamp > lastTagTime) {
            setLastTagTime(timestamp);
            setSelectedStudent(session_id);
            setConsultChecked(true); // 태깅 시 자동으로 상담완료 체킹
            alert(`📢 [상담실 NFC] ${session_id} 이용자가 상담실 리더기에 카드를 태그하여 자동으로 상담 화면이 연동되었습니다.`);
            fetchAttendanceHistory(session_id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);
    return () => clearInterval(pollTimer);
  }, [lastTagTime]);

  const fetchAttendanceHistory = async (studentId: string) => {
    try {
      const res = await axios.get(`${API_URL}/knowledge/attendance/${studentId}`);
      if (res.data.status === 'success') {
        setAttendanceHistory(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (studentId: string) => {
    try {
      const res = await axios.get(`${API_URL}/knowledge/messages/${studentId}`);
      if (res.data.status === 'success') {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudentSchedule = async (studentId: string) => {
    try {
      const resp = await axios.get(`${API_URL}/knowledge/student/${studentId}`);
      if (resp.data.data) {
        setSelectedStudentSchedule(resp.data.data);
        const subjects = resp.data.data.payload?.spreadsheet_data?.subjects || [];
        if (subjects.length > 0) {
          setProgressSubject(subjects[0].subject_name);
        } else {
          setProgressSubject('');
        }
      } else {
        setSelectedStudentSchedule(null);
        setProgressSubject('');
      }
    } catch (err) {
      console.error(err);
      setSelectedStudentSchedule(null);
      setProgressSubject('');
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert("이용자(학생)를 선택해 주세요.");
      return;
    }
    setLoading(true);

    // Get today's scheduled times
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date(date);
    const dayName = days[d.getDay()];
    const scheduled = editScheduledTimes[dayName];

    try {
      await axios.post(`${API_URL}/knowledge/attendance`, {
        session_id: selectedStudent,
        date: date,
        check_in_time: checkInTime || null,
        check_out_time: checkOutTime || null,
        is_managed: isManaged,
        consult_checked: consultChecked,
        consult_note: consultNote,
        scheduled_in_time: scheduled?.in || null,
        scheduled_out_time: scheduled?.out || null
      });
      alert("출석 및 상담 정보가 저장되었습니다.");
      fetchAttendanceHistory(selectedStudent);
    } catch (err) {
      console.error(err);
      alert("저장 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const handleSaveVoucherExpiry = async () => {
    const studentObj = students.find(s => s.user_id === selectedStudent);
    if (!studentObj) return;
    const updatedFormData = {
      ...studentObj.form_data,
      "이용권만료일": voucherExpiry
    };
    try {
      await axios.post(`${API_URL}/knowledge/profile`, {
        user_id: selectedStudent,
        form_data: updatedFormData
      });
      alert("이용권 만료일이 저장되었습니다.");
      fetchStudents();
    } catch (err) {
      console.error(err);
      alert("이용권 만료일 저장 실패");
    }
  };

  const handleSaveScheduledTimes = async () => {
    const studentObj = students.find(s => s.user_id === selectedStudent);
    if (!studentObj) return;
    const updatedFormData = {
      ...studentObj.form_data,
      "등하원예약시간": editScheduledTimes
    };
    try {
      await axios.post(`${API_URL}/knowledge/profile`, {
        user_id: selectedStudent,
        form_data: updatedFormData
      });
      alert("등하원 예약 시간이 저장되었습니다.");
      fetchStudents();
    } catch (err) {
      console.error(err);
      alert("등하원 예약 시간 저장 실패");
    }
  };

  const handleSendMessage = async () => {
    if (!newMsg.trim() || !selectedStudent) return;
    try {
      await axios.post(`${API_URL}/knowledge/messages`, {
        session_id: selectedStudent,
        sender_role: 'admin',
        content: newMsg.trim()
      });
      setNewMsg('');
      fetchMessages(selectedStudent);
    } catch (err) {
      console.error(err);
      alert("메시지 전송 실패");
    }
  };

  const checkIsTardy = (actualIn: string | null, scheduledIn: string | null) => {
    if (!actualIn || !scheduledIn) return false;
    const [actH, actM] = actualIn.split(':').map(Number);
    const [schH, schM] = scheduledIn.split(':').map(Number);
    const actualMins = actH * 60 + actM;
    const scheduledMins = schH * 60 + schM;
    return actualMins > (scheduledMins + 10);
  };

  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];

  // Filter students based on search query (관리형만 관리자 상담 대상)
  const filteredStudents = students
    .filter(s => s.form_data?.관리방식 === '관리형')
    .filter(s => 
      s.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.form_data?.목표 && s.form_data.목표.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  // Get current status for selected date
  const selectedDateLog = attendanceHistory.find(h => h.date === date);
  const selectedDateDayName = daysOfWeek[(new Date(date).getDay() + 6) % 7];
  const selectedDateScheduled = editScheduledTimes[selectedDateDayName];

  return (
    <div style={{ maxWidth: '1400px', margin: '40px auto', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', gap: '30px' }}>
      
      {/* 이용자(학생) 목록 사이드바 */}
      <div style={{ width: '280px', borderRight: '1px solid #eee', paddingRight: '20px', flexShrink: 0 }}>
        <h3 style={{ color: '#1976d2', marginTop: 0 }}>👥 관리 대상 이용자(학생)</h3>

        {/* NFC 시뮬레이터 */}
        <div style={{ background: '#eceff1', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', border: '1px solid #cfd8dc' }}>
          <strong style={{ color: '#37474f', display: 'block', marginBottom: '8px' }}>📟 NFC 태그 시뮬레이터</strong>
          <input
            type="text"
            placeholder="전화번호 입력..."
            id="nfc_sim_id"
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={async () => {
                const val = (document.getElementById('nfc_sim_id') as HTMLInputElement)?.value;
                if (!val) {
                  alert("전화번호를 입력해 주세요.");
                  return;
                }
                try {
                  const res = await axios.post(`${API_URL}/knowledge/attendance/nfc_tag`, {
                    session_id: val,
                    date: new Date().toISOString().split('T')[0]
                  });
                  alert(`[통합 NFC 결과]\n${res.data.message}`);
                  fetchAttendanceHistory(val);
                } catch(e) {
                  alert("통합 NFC 태깅 실패");
                }
              }}
              style={{ width: '100%', background: '#37474f', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
            >
              🔄 통합 NFC 태그 (1등원 ➡️ 2상담 ➡️ 3하원)
            </button>
            <button
              onClick={async () => {
                const val = (document.getElementById('nfc_sim_id') as HTMLInputElement)?.value;
                if (!val) {
                  alert("전화번호를 입력해 주세요.");
                  return;
                }
                try {
                  await axios.post(`${API_URL}/knowledge/attendance/consult_tag`, {
                    session_id: val,
                    date: new Date().toISOString().split('T')[0]
                  });
                } catch(e) {
                  alert("시뮬레이션 태깅 실패");
                }
              }}
              style={{ width: '100%', background: '#78909c', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
            >
              👩‍🏫 상담실 전용 단독 NFC 태그
            </button>
          </div>
        </div>
        
        {/* 내담자/이용자 검색 입력창 */}
        <input
          type="text"
          placeholder="이용자 연락처/목표 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ccc',
            marginBottom: '20px', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredStudents.map(s => (
            <button
              key={s.user_id}
              onClick={() => setSelectedStudent(s.user_id)}
              style={{
                textAlign: 'left', padding: '12px', borderRadius: '8px', border: selectedStudent === s.user_id ? '2px solid #1976d2' : '1px solid #ddd',
                background: selectedStudent === s.user_id ? '#e3f2fd' : '#fff', cursor: 'pointer',
                fontWeight: selectedStudent === s.user_id ? 'bold' : 'normal', color: '#333'
              }}
            >
              <div>👤 {s.name || '이름 없음'} ({s.user_id})</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                목표: {s.form_data?.목표 || '설정 전'}
              </div>
              <div style={{ display: 'flex', gap: '5px', marginTop: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', background: s.form_data?.관리방식 === '관리형' ? '#ffe0b2' : '#e0e0e0', color: s.form_data?.관리방식 === '관리형' ? '#e65100' : '#666', padding: '2px 6px', borderRadius: '4px' }}>
                  {s.form_data?.관리방식 || '자율형'}
                </span>
                {s.form_data?.이용권만료일 && (
                  <span style={{ fontSize: '10px', color: '#888' }}>
                    만료: {s.form_data.이용권만료일.slice(5)}
                  </span>
                )}
              </div>
            </button>
          ))}
          {filteredStudents.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>검색 결과가 없습니다.</div>
          )}
        </div>
      </div>

      {/* 우측 메인 대시보드 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '30px' }}>
        <h2 style={{ color: '#1976d2', marginTop: 0, borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
          🏫 관리 대시보드
        </h2>

        {selectedStudent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* 상단 간략 정보 및 이용권 설정 */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', background: '#f5f5f5', padding: '20px', borderRadius: '12px' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>선택된 이용자 정보</div>
                <strong style={{ fontSize: '18px', color: '#333' }}>{students.find(s => s.user_id === selectedStudent)?.name || '이름 없음'} ({selectedStudent})</strong>
                <span style={{ marginLeft: '10px', fontSize: '12px', background: isManaged ? '#ffe0b2' : '#e0e0e0', color: isManaged ? '#e65100' : '#666', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {isManaged ? '관리형 수험생' : '자율형 수험생'}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>정기 이용권 만료일 설정</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="date"
                    value={voucherExpiry}
                    onChange={e => setVoucherExpiry(e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none' }}
                  />
                  <button
                    onClick={handleSaveVoucherExpiry}
                    style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    등록
                  </button>
                </div>
              </div>
            </div>

            {/* 진도 확인 판넬 (Detailed Progress Viewer) */}
            {selectedStudentSchedule ? (
              <div style={{ background: '#f9fbe7', border: '1px solid #c5e1a5', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#33691e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📈 실시간 진도율 및 학습 과목 현황 (전략: {selectedStudentSchedule.payload.overall_strategy})</span>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    마감 예정일: {selectedStudentSchedule.payload.target_date_iso}
                  </span>
                </h3>
                
                {/* 과목 선택 탭 */}
                <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
                  {(selectedStudentSchedule.payload.spreadsheet_data?.subjects || []).map((subj: any) => (
                    <button
                      type="button"
                      key={subj.subject_name}
                      onClick={() => setProgressSubject(subj.subject_name)}
                      style={{
                        background: progressSubject === subj.subject_name ? '#33691e' : '#e0e0e0',
                        color: progressSubject === subj.subject_name ? '#fff' : '#333',
                        border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                      }}
                    >
                      {subj.subject_name}
                    </button>
                  ))}
                </div>

                {/* 선택한 과목의 진도 목록 */}
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>학습일</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>단원 정보</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>소요시간</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let flat: any[] = [];
                        selectedStudentSchedule.payload.curriculum?.forEach((w: any) => {
                          w.daily_tasks?.forEach((t: any) => {
                            flat.push(t);
                          });
                        });
                        const filtered = flat.filter(t => t.subject === progressSubject);
                        return filtered.map((task, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px 10px', color: '#666', fontWeight: 'bold' }}>{task.date}</td>
                            <td style={{ padding: '8px 10px', textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? '#aaa' : '#333' }}>
                              {task.unit_name || task.task_title}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{task.estimated_minutes}분</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: task.completed ? 'green' : 'red' }}>
                              {task.completed ? '✅ 완료' : '⏳ 진행중'}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ background: '#fcfcfc', border: '1px solid #eee', padding: '20px', borderRadius: '12px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                해당 이용자의 확정된 진도 계획표(스케줄)가 아직 생성되지 않았습니다.
              </div>
            )}

            {/* 중간 영역: 출석 입력 & 입퇴실 시간 예약 관리 */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              
              {/* 출석 등록 및 상담 일지 작성 폼 */}
              <form onSubmit={handleSaveAttendance} style={{ flex: 1, minWidth: '350px', background: '#fcfcfc', border: '1px solid #eee', padding: '25px', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '16px' }}>✏️ 출석 및 상담 기록 작성</h3>

                {/* 상담 시 확인할 실시간 출결 현황 요약 박스 */}
                {(() => {
                  const isTodayAbsent = selectedDateLog ? checkIsTardy(selectedDateLog.check_in_time, selectedDateLog.scheduled_in_time) : false;
                  const isTodaySkippedConsult = isManaged && selectedDateLog && (selectedDateLog.tag_count < 3) && (selectedDateLog.check_out_time || date !== new Date().toISOString().split('T')[0]);
                  
                  return (
                    <div style={{ background: isTodayAbsent ? '#ffeecf' : '#e8f5e9', padding: '12px 15px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', borderLeft: `4px solid ${isTodayAbsent ? '#d32f2f' : '#2e7d32'}` }}>
                      <div style={{ fontWeight: 'bold', color: isTodayAbsent ? '#b71c1c' : '#1b5e20', marginBottom: '6px' }}>📅 선택 날짜({date})의 출결 현황</div>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                          입실: <span style={{ fontWeight: 'bold', color: selectedDateLog?.check_in_time ? (isTodayAbsent ? '#d32f2f' : '#2e7d32') : '#d32f2f' }}>
                            {selectedDateLog?.check_in_time ? `${selectedDateLog.check_in_time}` : '미등원'}
                          </span>
                          {selectedDateScheduled?.in && <span style={{ fontSize: '11px', color: '#666', marginLeft: '4px' }}>(예약: {selectedDateScheduled.in})</span>}
                          {isTodayAbsent && (
                            <span style={{ marginLeft: '6px', background: '#d32f2f', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>
                              결석 처리 (지각)
                            </span>
                          )}
                        </div>
                        <div>
                          퇴실: <span style={{ fontWeight: 'bold', color: selectedDateLog?.check_out_time ? '#c62828' : '#777' }}>
                            {selectedDateLog?.check_out_time ? `${selectedDateLog.check_out_time}` : '미하원'}
                          </span>
                          {selectedDateScheduled?.out && <span style={{ fontSize: '11px', color: '#666', marginLeft: '4px' }}>(예약: {selectedDateScheduled.out})</span>}
                        </div>
                        {selectedDateLog?.consult_start_time && (
                          <div>
                            상담 시작: <span style={{ fontWeight: 'bold', color: '#33691e' }}>{selectedDateLog.consult_start_time}</span>
                          </div>
                        )}
                        {isTodaySkippedConsult && (
                          <div style={{ background: '#e65100', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', marginLeft: 'auto' }}>
                            ⚠️ 상담 미이행 경고
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#666' }}>상담/기록 날짜 선택</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} required />
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#666' }}>등원 시간 수정</label>
                      <input type="time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#666' }}>하원 시간 수정</label>
                      <input type="time" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                </div>

                {isManaged && (
                  <div style={{ borderTop: '1px solid #ddd', paddingTop: '15px', marginTop: '15px', marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#e65100', marginBottom: '12px' }}>
                      <input type="checkbox" checked={consultChecked} onChange={e => setConsultChecked(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                      👩‍🏫 5분 진도 확인 메타인지 상담 완료
                    </label>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#666' }}>상담 일지 / 특이사항</label>
                    <textarea
                      rows={3}
                      value={consultNote}
                      onChange={e => {
                        setConsultNote(e.target.value);
                        if (e.target.value.trim().length > 0) {
                          setConsultChecked(true);
                        }
                      }}
                      placeholder="오늘 학습 완성도 점검 상태 및 피드백 일지를 기록하세요."
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', background: '#1976d2', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
                >
                  {loading ? '저장 중...' : '💾 출석/상담 정보 저장'}
                </button>
              </form>

              {/* 입퇴실 약속 시간 예약 관리 */}
              <div style={{ flex: 1, minWidth: '350px', background: '#fff9f0', border: '1px solid #ffe0b2', padding: '25px', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#e65100', fontSize: '16px' }}>⏰ 요일별 입퇴실 약속 시간 예약 관리</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {daysOfWeek.map(day => {
                    const scheduled = editScheduledTimes[day] || { in: '09:00', out: '18:00', consult: '17:30' };
                    return (
                      <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'bold', width: '50px' }}>{day}요일</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>등원:</span>
                          <input
                            type="time"
                            value={scheduled.in}
                            onChange={e => setEditScheduledTimes(prev => ({
                              ...prev,
                              [day]: { ...prev[day], in: e.target.value }
                            }))}
                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>하원:</span>
                          <input
                            type="time"
                            value={scheduled.out}
                            onChange={e => setEditScheduledTimes(prev => ({
                              ...prev,
                              [day]: { ...prev[day], out: e.target.value }
                            }))}
                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                        </div>
                        {isManaged && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#e65100', fontWeight: 'bold' }}>상담:</span>
                            <input
                              type="time"
                              value={scheduled.consult || '17:30'}
                              onChange={e => setEditScheduledTimes(prev => ({
                                ...prev,
                                [day]: { ...prev[day], consult: e.target.value }
                              }))}
                              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ffcc80', background: '#fff8e1' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleSaveScheduledTimes}
                  style={{ width: '100%', background: '#e65100', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
                >
                  📅 예약 시간표 저장
                </button>
              </div>

            </div>

            {/* 하단 영역: 3자 실시간 메시지 소통 & 출석 이력 리스트 */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              
              {/* 최근 출석 이력 리스트 */}
              <div style={{ flex: 1.5, minWidth: '400px' }}>
                <h3 style={{ color: '#333', marginBottom: '15px', fontSize: '16px' }}>📅 전체 등하원 및 상담 이력</h3>
                <div style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ background: '#f5f5f5' }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>날짜</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>등원 (예약)</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>하원 (예약)</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>상담 상태</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>상담 일지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.map(h => {
                        const isAbsent = checkIsTardy(h.check_in_time, h.scheduled_in_time);
                        const isSkippedConsult = h.is_managed && (h.tag_count < 3) && (h.check_out_time || h.date !== new Date().toISOString().split('T')[0]);
                        
                        let rowBg = '#fff';
                        if (isAbsent) rowBg = '#ffeacc';
                        else if (isSkippedConsult) rowBg = '#fff3e0';

                        return (
                          <tr key={h.id} style={{ borderBottom: '1px solid #eee', background: rowBg }}>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{h.date}</td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{ color: isAbsent ? '#d32f2f' : '#4caf50', fontWeight: 'bold' }}>{h.check_in_time || '-'}</span>
                              <span style={{ fontSize: '11px', color: '#888', marginLeft: '5px' }}>({h.scheduled_in_time || '없음'})</span>
                              {isAbsent && (
                                <span style={{ marginLeft: '6px', background: '#d32f2f', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>
                                  결석 처리 (지각)
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{ color: '#f44336', fontWeight: 'bold' }}>{h.check_out_time || '-'}</span>
                              <span style={{ fontSize: '11px', color: '#888', marginLeft: '5px' }}>({h.scheduled_out_time || '없음'})</span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {h.is_managed ? (
                                isAbsent ? (
                                  <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>상담 불가(결석)</span>
                                ) : h.consult_start_time ? (
                                  <span style={{ color: 'green', fontWeight: 'bold' }}>✅ 상담 시작 ({h.consult_start_time})</span>
                                ) : isSkippedConsult ? (
                                  <span style={{ color: '#e65100', fontWeight: 'bold' }}>⚠️ 상담 미이행 경고</span>
                                ) : (
                                  <span style={{ color: 'red', fontWeight: 'bold' }}>❌ 대기중</span>
                                )
                              ) : (
                                <span style={{ color: '#999' }}>자율형</span>
                              )}
                            </td>
                            <td style={{ padding: '12px', color: '#666' }}>{h.consult_note || '-'}</td>
                          </tr>
                        );
                      })}
                      {attendanceHistory.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>출석 이력이 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3자 실시간 메시지 소통 */}
              <div style={{ flex: 1, minWidth: '350px', background: '#f1f8e9', border: '1px solid #c5e1a5', borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '400px' }}>
                <h3 style={{ margin: '15px 20px', color: '#33691e', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💬 3자 실시간 메시지 창 (특이사항 소통)
                </h3>
                <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f9fbe7' }}>
                  {messages.map(m => {
                    const isSelf = m.sender_role === 'admin';
                    let roleLabel = '이용자';
                    if (m.sender_role === 'admin') roleLabel = '관리자';
                    if (m.sender_role === 'parent') roleLabel = '학부모';

                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: isSelf ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '85%', padding: '10px 14px', borderRadius: '12px',
                          background: isSelf ? '#33691e' : '#fff',
                          color: isSelf ? '#fff' : '#333',
                          border: '1px solid #dcdde1',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                          fontSize: '13px'
                        }}>
                          <div style={{ fontSize: '10px', color: isSelf ? '#c5e1a5' : '#888', marginBottom: '4px', fontWeight: 'bold' }}>
                            {roleLabel}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <div style={{ color: '#999', textAlign: 'center', marginTop: '100px', fontSize: '13px' }}>대화 내역이 없습니다.</div>
                  )}
                </div>
                <div style={{ padding: '10px', borderTop: '1px solid #c5e1a5', background: '#fff', borderRadius: '0 0 12px 12px', display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="소통 메시지를 입력하세요..."
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', fontSize: '13px' }}
                  />
                  <button
                    onClick={handleSendMessage}
                    style={{ background: '#33691e', color: '#fff', border: 'none', padding: '0 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                  >
                    전송
                  </button>
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div style={{ color: '#999', textAlign: 'center', marginTop: '100px' }}>이용자(학생)를 선택해 주세요.</div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #ccc',
  boxSizing: 'border-box' as const,
  fontSize: '14px',
  outline: 'none'
};
