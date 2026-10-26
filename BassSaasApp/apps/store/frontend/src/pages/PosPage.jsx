import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, CreditCard } from 'lucide-react';

export default function PosPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/inventory/products')
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error(err));
  }, []);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setMsg("장바구니가 비어 있습니다.");
      return;
    }
    try {
      const payload = {
        payment_method: paymentMethod,
        items: cart.map((c) => ({ product_name: c.name, quantity: c.quantity, price: c.price }))
      };
      const res = await fetch('/api/orders/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`[성공] 결제 완료! 주문번호: ${data.order_number} (${totalAmount.toLocaleString()}원)`);
        setCart([]);
      } else {
        setMsg(`[오류] 결제 처리 실패`);
      }
    } catch (err) {
      setMsg("주문 전송 중 오류 발생");
    }
  };

  return (
    <div>
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>카운터 POS 주문 결제</h2>
          <p style={{ color: 'var(--text-muted)' }}>상품을 터치하여 장바구니에 담고 결제를 진행하세요.</p>
        </div>
      </div>

      {msg && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-amber)', color: '#fbbf24' }}>
          {msg}
        </div>
      )}

      <div className="grid-2">
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem' }}>상품 목록</h3>
          <div className="grid-products">
            {products.map((p) => (
              <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{p.name}</div>
                <div style={{ color: 'var(--accent-amber)', fontWeight: '600', marginTop: '4px' }}>
                  {p.price.toLocaleString()}원
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  재고: {p.stock_quantity}개
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart /> 장바구니
          </h3>
          <div style={{ margin: '1rem 0', minHeight: '180px' }}>
            {cart.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '3rem' }}>
                선택된 상품이 없습니다.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '0.6rem 0'
                  }}
                >
                  <div>
                    <strong>{item.name}</strong> x {item.quantity}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span>{(item.price * item.quantity).toLocaleString()}원</span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '2px dashed var(--border-color)', paddingTop: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold' }}>
              <span>총 결제금액</span>
              <span style={{ color: 'var(--accent-amber)' }}>{totalAmount.toLocaleString()}원</span>
            </div>
          </div>

          <button onClick={handleCheckout} className="btn-primary" style={{ width: '100%' }}>
            <CreditCard size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            결제 완료 (영수증 출력)
          </button>
        </div>
      </div>
    </div>
  );
}
