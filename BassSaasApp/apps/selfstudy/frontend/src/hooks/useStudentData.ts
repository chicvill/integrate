import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

export function useStudentData(sessionId: string) {
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Attendance and Management states
  const [attendance, setAttendance] = useState<any[]>([]);
  const [managementType, setManagementType] = useState<string>('자율형');
  const [scheduledTimes, setScheduledTimes] = useState<any>({});
  const [voucherExpiry, setVoucherExpiry] = useState<string>('');

  const fetchSchedule = useCallback(async () => {
    try {
      const resp = await axios.get(`${API_URL}/knowledge/student/${sessionId}`);
      if (resp.data.data) {
        setSchedule(resp.data.data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [sessionId]);

  const fetchAttendance = useCallback(async () => {
    try {
      const resp = await axios.get(`${API_URL}/knowledge/attendance/${sessionId}`);
      if (resp.data.status === 'success') {
        setAttendance(resp.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [sessionId]);

  const fetchProfile = useCallback(async () => {
    try {
      const resp = await axios.get(`${API_URL}/knowledge/profile/${sessionId}`);
      if (resp.data.data) {
        setManagementType(resp.data.data['관리방식'] || '자율형');
        setScheduledTimes(resp.data.data['등하원예약시간'] || {});
        setVoucherExpiry(resp.data.data['이용권만료일'] || '');
      }
    } catch (err) {
      console.error(err);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchSchedule();
      fetchAttendance();
      fetchProfile();
    }
  }, [sessionId, fetchSchedule, fetchAttendance, fetchProfile]);

  const getRemainingVoucherDays = useCallback(() => {
    if (!voucherExpiry) return null;
    const expiry = new Date(voucherExpiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [voucherExpiry]);

  return {
    schedule,
    setSchedule,
    loading,
    attendance,
    managementType,
    scheduledTimes,
    voucherExpiry,
    fetchSchedule,
    fetchAttendance,
    getRemainingVoucherDays
  };
}
