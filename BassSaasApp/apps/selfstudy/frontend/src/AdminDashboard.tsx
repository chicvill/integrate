import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

import { API_URL } from './config';
import RiskStudentBanner from './components/RiskStudentBanner';
import ThreeWayChat from './components/ThreeWayChat';

interface AdminDashboardProps {
  onLogout?: () => void;
  onOpenParentView?: (userId: string) => void;
}

export default function AdminDashboard({ onLogout, onOpenParentView }: AdminDashboardProps = {}) {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [currentIp, setCurrentIp] = useState('');
  const [currentQr, setCurrentQr] = useState('');
  
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
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
  const [adminSelectedDayTab, setAdminSelectedDayTab] = useState<string>('월');
  const TIME_OPTIONS_24H = useMemo(() => {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 10) {
        options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    options.push('24:00');
    return options;
  }, []);
  const [adminWorkingTime, setAdminWorkingTime] = useState<{ in: string; out: string; consult: string }>({
    in: '09:00', out: '18:00', consult: '17:30'
  });

  const handleAdminSelectTab = (day: string) => {
    setAdminSelectedDayTab(day);
    if (editScheduledTimes[day]) {
      setAdminWorkingTime({
        in: editScheduledTimes[day].in || '09:00',
        out: editScheduledTimes[day].out || '18:00',
        consult: editScheduledTimes[day].consult || '17:30'
      });
    }
    // If day is not configured yet, carry over current adminWorkingTime!
  };

  const handleAdminWorkingTimeChange = (type: 'in' | 'out' | 'consult', val: string) => {
    const updated = {
      ...adminWorkingTime,
      [type]: val
    };
    setAdminWorkingTime(updated);
    if (editScheduledTimes[adminSelectedDayTab]) {
      setEditScheduledTimes(prev => ({
        ...prev,
        [adminSelectedDayTab]: updated
      }));
    }
  };

  const handleAdminConfirmDayTime = (day: string) => {
    setEditScheduledTimes(prev => ({
      ...prev,
      [day]: { ...adminWorkingTime }
    }));
  };

  const handleAdminDeleteDayTime = (day: string) => {
    setEditScheduledTimes(prev => {
      const updated = { ...prev };
      delete updated[day];
      return updated;
    });
  };

  // Admin Real-time Emergency Alerts State
  const [adminAlerts, setAdminAlerts] = useState<{ late_students: any[]; recent_messages: any[] }>({
    late_students: [],
    recent_messages: []
  });

  useEffect(() => {
    fetchStudents();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const ipRes = await axios.get(`${API_URL}/api/settings/wifi-ip`);
      setCurrentIp(ipRes.data.ip);
      const qrRes = await axios.get(`${API_URL}/api/settings/qr-code`);
      setCurrentQr(qrRes.data.qr_code);
    } catch (e) {
      console.error(e);
    }
  };

  const registerCurrentIp = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/settings/wifi-ip`);
      setCurrentIp(res.data.ip);
      alert('현재 관리자의 접속 IP가 매장 공식 Wi-Fi IP로 등록되었습니다.');
    } catch (e) {
      alert('IP 등록에 실패했습니다.');
    }
  };

  const regenerateQr = async () => {
    if (!window.confirm('기존 QR 코드가 무효화됩니다. 새로 생성하시겠습니까?')) return;
    try {
      const res = await axios.post(`${API_URL}/api/settings/qr-code`);
      setCurrentQr(res.data.qr_code);
      alert('새로운 출석 갱신용 QR 코드가 발급되었습니다.');
    } catch (e) {
      alert('QR 생성에 실패했습니다.');
    }
  };

  // Poll real-time admin alerts every 3 seconds
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await axios.get(`${API_URL}/knowledge/admin/alerts`);
        if (res.data.status === 'success' && res.data.data) {
          setAdminAlerts(res.data.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAlerts();
    const alertInterval = setInterval(fetchAlerts, 3000);
    return () => clearInterval(alertInterval);
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
    <div style={{ maxWidth: '1400px', margin: '40px auto', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 🚨 AI 위험군 수험생 감지 뱃지 */}
      <RiskStudentBanner onSelectStudent={setSelectedStudent} />

      <div style={{ display: 'flex', gap: '30px' }}>
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
              <div style={{ display: 'flex', gap: '5px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', background: s.form_data?.관리방식 === '관리형' ? '#ffe0b2' : '#e0e0e0', color: s.form_data?.관리방식 === '관리형' ? '#e65100' : '#666', padding: '2px 6px', borderRadius: '4px' }}>
                  {s.form_data?.관리방식 || '자율형'}
                </span>
                {adminAlerts.late_students.some(l => l.user_id === s.user_id) && (
                  <span style={{ fontSize: '10px', background: '#f44336', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
                    🚨 지각 (10분+)
                  </span>
                )}
                {adminAlerts.recent_messages.some(m => m.user_id === s.user_id) && (
                  <span style={{ fontSize: '10px', background: '#ff9800', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    💬 메시지
                  </span>
                )}
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
        <h2 style={{ color: '#1976d2', marginTop: 0, borderBottom: '2px solid #eee', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🏫 관리 대시보드</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowSettings(true)}
                style={{
                  background: '#f5f5f5', color: '#333', border: '1px solid #ccc',
                  padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                ⚙️ 매장 환경설정 (출입 인증)
              </button>
              <button
                onClick={onLogout}
                style={{
                  background: '#fff0f0',
                  color: '#d32f2f',
                  border: '1px solid #ffcdd2',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🚪 로그아웃
              </button>
            </div>
        </h2>

        {/* 🚨 실시간 긴급 경고 센터 (Emergency Alert Center) */}
        {(adminAlerts.late_students.length > 0 || adminAlerts.recent_messages.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
            {/* 1. 미등원 10분 이상 지각 긴급 경고 */}
            {adminAlerts.late_students.map(late => (
              <div
                key={`late-${late.user_id}`}
                style={{
                  background: '#ffebee',
                  border: '2px solid #ef5350',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '15px',
                  boxShadow: '0 3px 10px rgba(239, 83, 80, 0.15)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '22px' }}>🚨</span>
                  <div>
                    <div style={{ color: '#c62828', fontWeight: 'bold', fontSize: '15px' }}>
                      [미등원 긴급 지각 경고] {late.name} ({late.user_id})
                    </div>
                    <div style={{ color: '#b71c1c', fontSize: '13px', marginTop: '3px' }}>
                      당일 약속 등원 시간(<strong>{late.scheduled_in}</strong>)보다 <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{late.minutes_late}분 경과</span>되었으나 아직 등원하지 않았습니다!
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(late.user_id)}
                  style={{
                    background: '#c62828',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  👉 학생 선택 & 메시지 확인
                </button>
              </div>
            ))}

            {/* 2. 신규 학생/학부모 메시지 알림 */}
            {adminAlerts.recent_messages.map(msg => (
              <div
                key={`msg-${msg.user_id}-${msg.created_at}`}
                style={{
                  background: '#fff3e0',
                  border: '1px solid #ffb74d',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '15px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>💬</span>
                  <div>
                    <div style={{ color: '#e65100', fontWeight: 'bold', fontSize: '14px' }}>
                      [신규 메시지] {msg.name} ({msg.sender_role === 'parent' ? '학부모' : '학생'})
                    </div>
                    <div style={{ color: '#bf360c', fontSize: '13px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '500px' }}>
                      "{msg.content}"
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(msg.user_id)}
                  style={{
                    background: '#e65100',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  💬 소통방 바로가기
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedStudent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* 상단 간략 정보 및 이용권 설정 */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', background: '#f5f5f5', padding: '20px', borderRadius: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>선택된 이용자 정보</div>
                <strong style={{ fontSize: '18px', color: '#333' }}>{students.find(s => s.user_id === selectedStudent)?.name || '이름 없음'} ({selectedStudent})</strong>
                <span style={{ marginLeft: '10px', fontSize: '12px', background: isManaged ? '#ffe0b2' : '#e0e0e0', color: isManaged ? '#e65100' : '#666', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {isManaged ? '관리형 수험생' : '자율형 수험생'}
                </span>
                <div style={{ marginTop: '10px' }}>
                  <button
                    onClick={() => onOpenParentView ? onOpenParentView(selectedStudent) : window.open(`/?parent_code=P-${selectedStudent}`, '_blank')}
                    style={{
                      background: '#ff9800',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(255,152,0,0.3)'
                    }}
                  >
                    👥 상담 중인 학생의 학부모 참관 화면 확인 ➡️
                  </button>
                </div>
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
              <div style={{ flex: 1, minWidth: '350px', background: '#fff9f0', border: '1px solid #ffe0b2', padding: isScheduleExpanded ? '25px' : '16px 25px', borderRadius: '12px', transition: 'all 0.3s ease' }}>
                <div
                  onClick={() => setIsScheduleExpanded(!isScheduleExpanded)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <h3 style={{ margin: 0, color: '#e65100', fontSize: '16px', fontWeight: 'bold' }}>⏰ 요일별 입퇴실 약속 시간 예약 관리</h3>
                  <span style={{ fontSize: '13px', color: '#e65100', fontWeight: 'bold', background: '#ffe0b2', padding: '4px 10px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isScheduleExpanded ? '▲ 접기' : '▼ 펼치기'}
                  </span>
                </div>

                {isScheduleExpanded && (
                  <div style={{ marginTop: '20px' }}>
                    {/* 요일 선택 탭 바 (설정된 요일 주황색 표시) */}
                    <div style={{ display: 'flex', borderBottom: '2px solid #ffe0b2', gap: '4px', marginBottom: '15px', flexWrap: 'wrap' }}>
                      {daysOfWeek.map(day => {
                        const isSelected = adminSelectedDayTab === day;
                        const isConfigured = !!editScheduledTimes[day];
                        const t = isSelected ? adminWorkingTime : editScheduledTimes[day];
                        let hours = 0;
                        if (t && t.in && t.out) {
                          let [inH, inM] = t.in.split(':').map(Number);
                          let [outH, outM] = t.out.split(':').map(Number);
                          if (!isNaN(inH) && !isNaN(inM) && !isNaN(outH) && !isNaN(outM)) {
                            if (inH >= 18 && outH === 12) outH = 24;
                            let inMins = inH * 60 + inM;
                            let outMins = outH * 60 + outM;
                            if (inMins !== outMins) {
                              if (outMins < inMins) outMins += 24 * 60;
                              hours = Math.round(((outMins - inMins) / 60) * 10) / 10;
                            }
                          }
                        }

                        return (
                          <button
                            type="button"
                            key={day}
                            onClick={() => handleAdminSelectTab(day)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px 8px 0 0',
                              border: isSelected ? '2px solid #e65100' : (isConfigured ? '2px solid #ff9800' : '1px solid #ccc'),
                              borderBottom: isSelected ? '2px solid #fff' : '1px solid #ccc',
                              background: isConfigured ? (isSelected ? '#e65100' : '#ff9800') : (isSelected ? '#fff3e0' : '#fff'),
                              color: isConfigured ? '#fff' : (isSelected ? '#e65100' : '#444'),
                              fontWeight: 'bold',
                              fontSize: '13px',
                              cursor: 'pointer',
                              marginBottom: '-2px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {day}({(isConfigured || isSelected) ? `${hours}시간` : '미설정'})
                          </button>
                        );
                      })}
                    </div>

                    {/* 선택된 요일 약속시간 단일 편집 영역 (입력창 + 확인 + 삭제 한 라인) */}
                    {(() => {
                      const day = adminSelectedDayTab;
                      return (
                        <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #ffe0b2', marginBottom: '15px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: '#fafafa', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '12px', color: '#555', fontWeight: 'bold', whiteSpace: 'nowrap' }}>등원:</label>
                              <select
                                value={adminWorkingTime.in}
                                onChange={e => handleAdminWorkingTimeChange('in', e.target.value)}
                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', background: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                {TIME_OPTIONS_24H.filter(t => t !== '24:00').map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '12px', color: '#555', fontWeight: 'bold', whiteSpace: 'nowrap' }}>하원:</label>
                              <select
                                value={adminWorkingTime.out}
                                onChange={e => handleAdminWorkingTimeChange('out', e.target.value)}
                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', background: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                {TIME_OPTIONS_24H.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>

                            {isManaged && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <label style={{ fontSize: '12px', color: '#e65100', fontWeight: 'bold', whiteSpace: 'nowrap' }}>상담:</label>
                                <select
                                  value={adminWorkingTime.consult || '17:30'}
                                  onChange={e => handleAdminWorkingTimeChange('consult', e.target.value)}
                                  style={{ padding: '6px', borderRadius: '6px', border: '1px solid #ffcc80', background: '#fff8e1', outline: 'none', fontWeight: 'bold', color: '#e65100', cursor: 'pointer' }}
                                >
                                  {TIME_OPTIONS_24H.filter(t => t !== '24:00').map(t => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* 동일 라인 확인 & 삭제 버튼 */}
                            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                              <button
                                type="button"
                                onClick={() => handleAdminConfirmDayTime(day)}
                                style={{
                                  background: '#ff9800',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '6px 14px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '12px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                ✅ 확인
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminDeleteDayTime(day)}
                                style={{
                                  background: '#fff',
                                  color: '#d32f2f',
                                  border: '1px solid #ef9a9a',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '12px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                🗑️ 삭제
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <button
                      onClick={handleSaveScheduledTimes}
                      style={{ width: '100%', background: '#e65100', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
                    >
                      📅 예약 시간표 저장
                    </button>
                  </div>
                )}
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
              <ThreeWayChat sessionId={selectedStudent} currentUserRole="admin" height="400px" />

            </div>
          </div>
        ) : (
          <div style={{ color: '#999', textAlign: 'center', marginTop: '100px' }}>
            이용자(학생)를 선택해 주세요.
          </div>
        )}
      </div>
    </div>

    {/* 환경설정 모달 */}
    {showSettings && (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '500px', maxWidth: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <h2 style={{ marginTop: 0, color: '#333' }}>⚙️ 매장 환경설정</h2>
          
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>1. Wi-Fi IP 기반 출석 인증</h4>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
              현재 등록된 매장 공식 IP: <strong>{currentIp || '미등록'}</strong>
            </p>
            <button onClick={registerCurrentIp} style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              현재 접속 중인 기기의 IP를 매장 IP로 등록
            </button>
            <p style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
              * 매장의 Wi-Fi에 연결된 상태에서 이 버튼을 눌러주세요. 학생들이 해당 Wi-Fi에 접속 시 1주일 미방문 차단이 자동으로 해제됩니다.
            </p>
          </div>

          <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#e65100' }}>2. 고정형 QR 코드 기반 출석 인증</h4>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
              Wi-Fi를 사용하지 않는 학생을 위해 매장 입구에 부착할 고정형 QR 코드입니다.
            </p>
            {currentQr ? (
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${currentQr}`} alt="QR Code" style={{ border: '5px solid #fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />
                <div style={{ marginTop: '5px', fontSize: '11px', color: '#666' }}>{currentQr}</div>
              </div>
            ) : (
              <div style={{ color: '#999', fontSize: '13px', marginBottom: '10px' }}>생성된 QR 코드가 없습니다.</div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={regenerateQr} style={{ flex: 1, background: '#e65100', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                새 QR 코드 발급(갱신)
              </button>
              {currentQr && (
                <button onClick={() => {
                  const printWindow = window.open('', '', 'width=600,height=600');
                  if (printWindow) {
                    printWindow.document.write(`<html><body style="text-align:center; padding-top: 50px;"><h2>스터디카페 출석 갱신 QR</h2><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${currentQr}" /><p>셀프스터디 앱에서 이 QR 코드를 스캔하세요.</p></body></html>`);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
                  }
                }} style={{ flex: 1, background: '#4caf50', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  🖨️ 인쇄하기
                </button>
              )}
            </div>
          </div>

          <button onClick={() => setShowSettings(false)} style={{ width: '100%', padding: '10px', background: '#ccc', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            닫기
          </button>
        </div>
      </div>
    )}
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
