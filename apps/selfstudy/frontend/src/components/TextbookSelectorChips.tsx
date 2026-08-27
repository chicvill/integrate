interface TextbookSelectorChipsProps {
  recommendedTextbooks: any[];
  selectedTextbookTitle: string;
  onSelectTextbook: (tb: any) => void;
}

export default function TextbookSelectorChips({
  recommendedTextbooks,
  selectedTextbookTitle,
  onSelectTextbook
}: TextbookSelectorChipsProps) {
  if (recommendedTextbooks.length === 0) return null;

  return (
    <div style={{ marginBottom: '20px', background: '#e8f5e9', padding: '15px', borderRadius: '10px', border: '1px solid #c8e6c9' }}>
      <strong style={{ fontSize: '14px', color: '#2e7d32' }}>📖 AI 추천 대표 교재 & 목차 원클릭 자동 설정:</strong>
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
        {recommendedTextbooks.map((tb, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectTextbook(tb)}
            style={{
              background: selectedTextbookTitle === tb.title ? '#2e7d32' : '#fff',
              color: selectedTextbookTitle === tb.title ? '#fff' : '#2e7d32',
              border: '1px solid #2e7d32',
              padding: '8px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            📘 {tb.title} ({tb.total_pages || 120}p)
          </button>
        ))}
      </div>
    </div>
  );
}
