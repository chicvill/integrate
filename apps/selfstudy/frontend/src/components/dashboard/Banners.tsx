interface BannersProps {
  managementType: string;
  remainingDays: number | null;
  voucherExpiry: string;
}

export default function Banners({ managementType, remainingDays, voucherExpiry }: BannersProps) {
  return (
    <>
      {/* 자율형 관리형 전환 권유 배너 */}
      {managementType === '자율형' && (
        <div style={{
          background: '#e3f2fd',
          color: '#0d47a1',
          border: '1px solid #bbdefb',
          padding: '16px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎒 관리형 전환 안내
          </div>
          <div>
            관리자의 1:1 대면 상담 및 밀착 출결 피드백 등으로 성취도를 높일 수 있습니다. 관리자에게 문의 바랍니다.
          </div>
        </div>
      )}

      {/* 이용권 만료 사전 안내 배너 */}
      {remainingDays !== null && remainingDays <= 7 && (
        <div style={{
          background: remainingDays <= 3 ? '#ffebee' : '#fff3e0',
          color: remainingDays <= 3 ? '#c62828' : '#ef6c00',
          border: `1px solid ${remainingDays <= 3 ? '#ffcdd2' : '#ffe0b2'}`,
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <span>⚠️ 이용권 만료 사전 안내: 정기 이용권 만료가 {remainingDays}일 남았습니다. ({voucherExpiry} 만료 예정) 재등록을 서둘러 주세요!</span>
        </div>
      )}
    </>
  );
}
