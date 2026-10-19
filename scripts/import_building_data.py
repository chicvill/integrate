"""
scripts/import_building_data.py
[MQnet SaaS 범용 모듈]
어떤 건물(지점)이든 CSV 파일로부터 호실 임차 정보를 일괄 초기화/적재하는 범용 임대차 관리 모듈.

사용 예시:
  python scripts/import_building_data.py --name "선호빌" --file "data.csv"
  python scripts/import_building_data.py --name "신비주택" --file "data.csv" --branch-id "branch_01"
"""
import argparse
import csv
import json
import os
import re
import sqlite3
import sys
import uuid
from datetime import datetime

def get_db_path(custom_path=None):
    if custom_path:
        return custom_path
    if os.name == 'nt':
        return 'apps/rent/backend/rent.db'
    if os.path.exists('/app/data/rent.db'):
        return '/app/data/rent.db'
    return 'data/rent.db'


def parse_csv_file(file_path):
    """CSV 파일을 읽어 표준 딕셔너리 리스트로 변환 (다양한 인코딩 및 유연한 헤더 매핑 지원)"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CSV 파일을 찾을 수 없습니다: {file_path}")

    # 인코딩 자동 감지 (utf-8-sig, utf-8, cp949)
    rows = []
    encodings = ['utf-8-sig', 'utf-8', 'cp949', 'euc-kr']
    content = None
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                content = f.read()
                break
        except Exception:
            continue

    if content is None:
        raise ValueError("파일 인코딩을 인식할 수 없습니다 (UTF-8 또는 CP949 필요).")

    reader = csv.reader(content.splitlines())
    header = None
    col_idx = {}

    for row in reader:
        if not row or all(not c.strip() for c in row):
            continue
        if header is None:
            header = [c.strip() for c in row]
            for idx, h in enumerate(header):
                h_clean = re.sub(r'\s+', '', h)
                if any(k in h_clean for k in ['호실', '호수', 'room', '방번호']):
                    col_idx['room_num'] = idx
                elif any(k in h_clean for k in ['세입자', '임차인', '이름', '성명', 'tenant', 'name']):
                    col_idx['name'] = idx
                elif any(k in h_clean for k in ['보증금', 'deposit']):
                    col_idx['deposit'] = idx
                elif any(k in h_clean for k in ['월세', '임대료', '임차료', 'rent']):
                    col_idx['rent'] = idx
                elif any(k in h_clean for k in ['관리비', 'maintenance']):
                    col_idx['maintenance'] = idx
                elif any(k in h_clean for k in ['입주일', '계약일', '전입일', 'move_in']):
                    col_idx['move_in'] = idx
                elif any(k in h_clean for k in ['만기일', '퇴실일', 'expiry']):
                    col_idx['expiry'] = idx
                elif any(k in h_clean for k in ['납부방식', '선후불', 'timing']):
                    col_idx['pay_timing'] = idx
                elif any(k in h_clean for k in ['연락처', '전화번호', '핸드폰', 'phone']):
                    col_idx['phone'] = idx
                elif any(k in h_clean for k in ['비고', '특이사항', 'note']):
                    col_idx['note'] = idx
            continue

        if 'room_num' not in col_idx:
            continue

        raw_num = row[col_idx['room_num']].strip() if len(row) > col_idx['room_num'] else ''
        num_match = re.search(r'\d+', raw_num)
        if not num_match:
            continue
        r_num = int(num_match.group(0))

        def get_val(key, default=''):
            idx = col_idx.get(key)
            if idx is not None and len(row) > idx:
                return row[idx].strip()
            return default

        def get_int(key, default=0):
            val_str = get_val(key, '0')
            digits = re.sub(r'[^\d]', '', val_str)
            return int(digits) if digits else default

        pay_t = get_val('pay_timing', '후불')
        if '선' in pay_t:
            pay_t = '선불'
        else:
            pay_t = '후불'

        rows.append({
            'room_number': r_num,
            'name': get_val('name', ''),
            'deposit': get_int('deposit', 0),
            'rent': get_int('rent', 0),
            'maintenance': get_int('maintenance', 0),
            'move_in': get_val('move_in', datetime.now().strftime('%Y-%m-%d')),
            'expiry': get_val('expiry', ''),
            'pay_timing': pay_t,
            'phone': get_val('phone', ''),
            'note': get_val('note', '')
        })

    return rows


def setup_building_data(building_name: str, csv_path: str, branch_id: str = "main", db_path: str | None = None):
    """
    범용 건물 셋업 함수:
    1. 건물 정보(지점명, 메타데이터)를 생성하거나 보존
    2. 해당 건물의 임차 정보(호실 계약 및 수납 장부)만 깨끗이 초기화
    3. CSV 호실 데이터 및 당해 연도 1~12월 수납 장부를 자동 구축
    """
    real_db_path = get_db_path(db_path)
    print(f"[DB] 대상 경로: {real_db_path}")
    print(f"[건물] 건물명: [{building_name}] (지점코드: {branch_id})")

    rooms = parse_csv_file(csv_path)
    if not rooms:
        print("[오류] CSV 파일에서 유효한 호실 데이터를 찾을 수 없습니다.")
        return False

    db_dir = os.path.dirname(real_db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(real_db_path)
    c = conn.cursor()

    # 테이블이 없으면 자동 생성 (신규 환경에서도 즉시 동작)
    c.execute("""
        CREATE TABLE IF NOT EXISTS rent_branches (
            id VARCHAR(36) PRIMARY KEY,
            branch_id VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            contact_phone VARCHAR(30),
            address VARCHAR(200),
            fee_plan VARCHAR(50) DEFAULT 'SaaS 독립형',
            monthly_fee INTEGER DEFAULT 150000,
            billing_status VARCHAR(30) DEFAULT 'PAID',
            billing_due_day INTEGER DEFAULT 25,
            last_paid_at VARCHAR(30),
            is_active BOOLEAN DEFAULT 1,
            metadata_json JSON DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS rent_rooms (
            id VARCHAR(36) PRIMARY KEY,
            branch_id VARCHAR(50) NOT NULL,
            room_number INTEGER NOT NULL,
            name VARCHAR(100) DEFAULT '',
            id_number VARCHAR(50) DEFAULT '',
            phone VARCHAR(50) DEFAULT '',
            lease_type VARCHAR(20) DEFAULT '월세',
            pay_timing VARCHAR(20) DEFAULT '후불',
            deposit INTEGER DEFAULT 0,
            rent INTEGER DEFAULT 0,
            maintenance INTEGER DEFAULT 0,
            clean_fee INTEGER DEFAULT 80000,
            move_in VARCHAR(30) DEFAULT '',
            expiry VARCHAR(30) DEFAULT '',
            move_out VARCHAR(30) DEFAULT '',
            metadata_json JSON DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS rent_payments (
            id VARCHAR(36) PRIMARY KEY,
            branch_id VARCHAR(50) NOT NULL,
            room_number INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            paid BOOLEAN DEFAULT 0,
            paid_date VARCHAR(30) DEFAULT '',
            rent_amount INTEGER DEFAULT 0,
            maintenance_amount INTEGER DEFAULT 0,
            note VARCHAR(200) DEFAULT '',
            tenant_name VARCHAR(100) DEFAULT '',
            tenant_id_number VARCHAR(50) DEFAULT '',
            is_previous_tenant BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 1. 지점(건물) 존재 여부 확인 및 보존/등록
    c.execute("SELECT branch_id, name FROM rent_branches WHERE branch_id=?", (branch_id,))
    existing_b = c.fetchone()

    if not existing_b:
        print(f"[생성] 신규 건물 [{building_name}] 등록 중...")
        c.execute("""
            INSERT INTO rent_branches (id, branch_id, name, contact_phone, address, fee_plan, monthly_fee, billing_status, billing_due_day, is_active)
            VALUES (?, ?, ?, '010-0000-0000', '', 'SaaS 독립형', 150000, 'PAID', 25, 1)
        """, (str(uuid.uuid4()), branch_id, building_name))
    else:
        print(f"[보존] 기존 건물 정보 보존 및 이름 동기화: [{building_name}]")
        c.execute("UPDATE rent_branches SET name=? WHERE branch_id=?", (building_name, branch_id))

    # 2. 임차 정보(호실 및 수납 데이터)만 깨끗이 초기화
    print(f"[초기화] [{building_name}] 기존 임차/수납 데이터 초기화 중...")
    c.execute("DELETE FROM rent_rooms WHERE branch_id=?", (branch_id,))
    c.execute("DELETE FROM rent_payments WHERE branch_id=?", (branch_id,))

    # 3. CSV 데이터로부터 호실 및 12개월 장부 일괄 생성
    print(f"[적재] 총 {len(rooms)}개 호실 임대차 대장 적재 시작...")
    current_year = datetime.now().year

    for r in rooms:
        r_id = str(uuid.uuid4())
        meta = json.dumps({"note": r['note'], "phone": r['phone']})
        c.execute("""
            INSERT INTO rent_rooms (
                id, branch_id, room_number, name, id_number, phone, lease_type,
                pay_timing, deposit, rent, maintenance, clean_fee, move_in, expiry, move_out, metadata_json
            ) VALUES (?, ?, ?, ?, '', ?, '월세', ?, ?, ?, ?, 80000, ?, ?, '', ?)
        """, (
            r_id, branch_id, r['room_number'], r['name'], r['phone'],
            r['pay_timing'], r['deposit'], r['rent'], r['maintenance'],
            r['move_in'], r['expiry'], meta
        ))

        for m in range(1, 13):
            p_id = str(uuid.uuid4())
            c.execute("""
                INSERT INTO rent_payments (
                    id, branch_id, room_number, year, month, paid, paid_date,
                    rent_amount, maintenance_amount, note, tenant_name, tenant_id_number, is_previous_tenant
                ) VALUES (?, ?, ?, ?, ?, 0, '', ?, ?, '', ?, '', 0)
            """, (p_id, branch_id, r['room_number'], current_year, m, r['rent'], r['maintenance'], r['name']))

    conn.commit()

    total_rooms = c.execute("SELECT COUNT(*) FROM rent_rooms WHERE branch_id=?", (branch_id,)).fetchone()[0]
    final_bname = c.execute("SELECT name FROM rent_branches WHERE branch_id=?", (branch_id,)).fetchone()[0]
    conn.close()

    print("==================================================")
    print(f"[완료] 건물 [{final_bname}] 데이터 셋업 완료!")
    print(f"[통계] 등록된 호실: 총 {total_rooms}개실")
    print("==================================================")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MQnet SaaS 범용 건물 데이터 적재 모듈")
    parser.add_argument("--name", "-n", required=True, help="등록/갱신할 건물명 (예: 선호빌, 신비주택)")
    parser.add_argument("--file", "-f", required=True, help="호실 임대차 대장 CSV 파일 경로")
    parser.add_argument("--branch-id", "-b", default="main", help="지점 고유 코드 (기본: main)")
    parser.add_argument("--db", default=None, help="SQLite DB 파일 경로 (선택)")

    args = parser.parse_args()
    setup_building_data(
        building_name=args.name,
        csv_path=args.file,
        branch_id=args.branch_id,
        db_path=args.db
    )
