import React, { useState, useEffect } from 'react';
import { Package, Plus } from 'lucide-react';

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('BEVERAGE');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/inventory/products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddProduct = async () => {
    if (!name || !price) {
      setMsg("상품명과 가격을 입력해주세요.");
      return;
    }
    try {
      const res = await fetch('/api/inventory/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          category: category,
          price: parseFloat(price),
          stock_quantity: parseInt(stock || '100')
        })
      });
      if (res.ok) {
        setMsg(`[성공] ${name} 신규 상품 등록 완료!`);
        setName('');
        setPrice('');
        setStock('');
        fetchProducts();
      }
    } catch (err) {
      setMsg("상품 등록 실패");
    }
  };

  return (
    <div>
      <div className="glass-card">
        <h2>재고 & 상품 등록 관리</h2>
        <p style={{ color: 'var(--text-muted)' }}>매장에서 판매하는 상품 목록과 실시간 재고를 관리합니다.</p>
      </div>

      {msg && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-emerald)', color: '#34d399' }}>
          {msg}
        </div>
      )}

      <div className="grid-2">
        <div className="glass-card">
          <h3>신규 상품 등록</h3>
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem' }}>상품명</label>
            <input className="input-field" placeholder="예: 바닐라 라떼" value={name} onChange={(e) => setName(e.target.value)} />

            <label style={{ display: 'block', marginBottom: '0.4rem' }}>카테고리</label>
            <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="BEVERAGE">음료 (BEVERAGE)</option>
              <option value="SNACK">디저트/스낵 (SNACK)</option>
              <option value="GOODS">기획상품 (GOODS)</option>
            </select>

            <label style={{ display: 'block', marginBottom: '0.4rem' }}>가격 (원)</label>
            <input className="input-field" type="number" placeholder="5500" value={price} onChange={(e) => setPrice(e.target.value)} />

            <label style={{ display: 'block', marginBottom: '0.4rem' }}>초기 재고 수량</label>
            <input className="input-field" type="number" placeholder="100" value={stock} onChange={(e) => setStock(e.target.value)} />

            <button onClick={handleAddProduct} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              <Plus size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              상품 등록하기
            </button>
          </div>
        </div>

        <div className="glass-card">
          <h3>등록된 상품 현황</h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {products.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: 'var(--bg-secondary)',
                  padding: '0.8rem 1rem',
                  borderRadius: '8px'
                }}
              >
                <div>
                  <strong>{p.name}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({p.category})</span>
                </div>
                <div>
                  <span style={{ color: 'var(--accent-amber)', marginRight: '1rem' }}>{p.price.toLocaleString()}원</span>
                  <span style={{ color: p.stock_quantity < 30 ? '#f43f5e' : '#34d399' }}>재고 {p.stock_quantity}개</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
