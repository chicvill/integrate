import json
import os

ROOMS_CONFIG = {
    101: {"name": "배종봉", "id_number": "701127-1520023", "phone": "010-5424-5780", "lease_type": "월세", "pay_timing": "후불", "deposit": 2000000, "rent": 150000, "maintenance": 100000, "move_in": "2025-06-04", "expiry": "2026-12-10", "pay_status": {10: True}},
    201: {"name": "정민준", "id_number": "921013-1025438", "phone": "010-5578-5358", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2022-03-19", "expiry": "2027-03-18", "pay_status": {10: False}},
    202: {"name": "안동기", "id_number": "701110-1814911", "phone": "010-9429-4688", "lease_type": "월세", "pay_timing": "후불", "deposit": 3000000, "rent": 290000, "maintenance": 150000, "move_in": "2015-04-10", "expiry": "2027-04-10", "pay_status": {10: True}},
    203: {"name": "이광훈", "id_number": "580115-1268113", "phone": "010-8417-7858", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2024-08-01", "expiry": "2027-07-31", "pay_status": {10: False}},
    204: {"name": "주예란", "id_number": "770925-2169514", "phone": "010-8982-8146", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 250000, "maintenance": 150000, "move_in": "2021-06-05", "expiry": "2027-06-04", "pay_status": {10: True}},
    205: {"name": "서재민", "id_number": "980706-1122013", "phone": "010-4947-8994", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 250000, "maintenance": 150000, "move_in": "2024-01-27", "expiry": "2027-01-26", "pay_status": {10: False}},
    301: {"name": "성민병원", "id_number": "124233-0000347", "phone": "010-9938-6293", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 390000, "maintenance": 50000, "move_in": "2022-03-28", "expiry": "2027-03-27", "pay_status": {8: False, 9: False, 10: False}}, # 미납 3
    302: {"name": "김지영", "id_number": "690120-2150013", "phone": "010-2668-9764", "lease_type": "전세", "pay_timing": "후불", "deposit": 40000000, "rent": 0, "maintenance": 150000, "move_in": "2019-03-21", "expiry": "2027-03-20", "pay_status": {10: False}}, # 전세
    303: {"name": "김진수", "id_number": "960617-1479024", "phone": "010-9169-0757", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2025-09-12", "expiry": "2027-09-11", "pay_status": {10: True}},
    304: {"name": "공실", "id_number": "", "phone": "", "lease_type": "월세", "pay_timing": "후불", "deposit": 0, "rent": 0, "maintenance": 0, "move_in": "", "expiry": "", "pay_status": {}}, # 공실 1
    305: {"name": "박성용", "id_number": "810412-1098765", "phone": "010-3344-5505", "lease_type": "월세", "pay_timing": "후불", "deposit": 3000000, "rent": 290000, "maintenance": 150000, "move_in": "2023-04-13", "expiry": "2027-04-12", "pay_status": {10: False}},
    401: {"name": "임성진", "id_number": "910908-1123456", "phone": "010-7788-9901", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2022-04-09", "expiry": "2027-04-08", "pay_status": {10: False}},
    402: {"name": "윤태식", "id_number": "650228-1987654", "phone": "010-1122-3344", "lease_type": "월세", "pay_timing": "후불", "deposit": 3000000, "rent": 290000, "maintenance": 150000, "move_in": "2021-03-01", "expiry": "2027-02-28", "pay_status": {9: False, 10: False}}, # 미납 2
    403: {"name": "정수빈", "id_number": "951218-2012345", "phone": "010-4455-6677", "lease_type": "월세", "pay_timing": "선납", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2024-12-19", "expiry": "2026-12-18", "pay_status": {10: True}}, # 선납
    404: {"name": "이종진", "id_number": "880608-1543210", "phone": "010-4808-9078", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2026-06-08", "expiry": "2027-06-07", "pay_status": {10: True}},
    405: {"name": "박서현", "id_number": "011015-4012345", "phone": "010-9988-7766", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2026-10-15", "expiry": "2027-10-14", "pay_status": {10: True}}, # 신규 입주
    501: {"name": "최원석", "id_number": "871020-1345678", "phone": "010-2233-4455", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2024-10-21", "expiry": "2026-10-20", "pay_status": {10: True}}, # 만기 3일 전
    502: {"name": "강현우", "id_number": "931115-1876543", "phone": "010-6677-8899", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2024-11-16", "expiry": "2026-11-15", "pay_status": {10: False}}, # 만기 1개월 전
    503: {"name": "공실", "id_number": "", "phone": "", "lease_type": "월세", "pay_timing": "후불", "deposit": 0, "rent": 0, "maintenance": 0, "move_in": "", "expiry": "", "pay_status": {}}, # 공실 2
    504: {"name": "송민규", "id_number": "940331-1567890", "phone": "010-3322-1144", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2023-04-01", "expiry": "2027-03-31", "pay_status": {10: True}},
    505: {"name": "김정현", "id_number": "970629-1981044", "phone": "010-9810-0443", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2026-06-29", "expiry": "2027-06-28", "pay_status": {10: False}},
    601: {"name": "오세진", "id_number": "891230-1456789", "phone": "010-5544-3322", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 350000, "maintenance": 90000, "move_in": "2023-12-31", "expiry": "2026-12-30", "pay_status": {10: False}}, # 만기 3개월 전
    602: {"name": "유동현", "id_number": "920602-1234987", "phone": "010-7766-5544", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 250000, "maintenance": 150000, "move_in": "2022-06-03", "expiry": "2027-06-02", "pay_status": {10: True}},
    603: {"name": "장진우", "id_number": "960726-1890123", "phone": "010-8899-0011", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 250000, "maintenance": 150000, "move_in": "2024-07-27", "expiry": "2027-07-26", "pay_status": {10: False}},
    604: {"name": "조현아", "id_number": "940415-2678901", "phone": "010-4433-2211", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2023-04-16", "expiry": "2027-04-15", "pay_status": {10: True}},
    605: {"name": "한상철", "id_number": "750526-1122334", "phone": "010-1234-5678", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 100000, "move_in": "2022-05-27", "expiry": "2027-05-26", "pay_status": {8: False, 9: False, 10: False}}, # 미납 3
    701: {"name": "권도윤", "id_number": "900815-1345678", "phone": "010-6655-4433", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 290000, "maintenance": 150000, "move_in": "2025-08-16", "expiry": "2027-08-15", "pay_status": {10: True}},
    702: {"name": "배은지", "id_number": "950404-2456789", "phone": "010-3322-9988", "lease_type": "월세", "pay_timing": "후불", "deposit": 6000000, "rent": 290000, "maintenance": 250000, "move_in": "2024-04-05", "expiry": "2027-04-04", "pay_status": {10: True}},
    703: {"name": "황태훈", "id_number": "980122-1789012", "phone": "010-6789-0123", "lease_type": "월세", "pay_timing": "후불", "deposit": 5000000, "rent": 250000, "maintenance": 150000, "move_in": "2025-01-23", "expiry": "2027-01-22", "pay_status": {10: False}}
}

EXPENSES_CONFIG = [
    {
        "id": "exp-2026-10-01",
        "branch_id": "main",
        "date": "2026-10-05",
        "item": "승강기 정기 안전점검비",
        "amount": 150000,
        "note": "현대엘리베이터 10월분 정기점검 완료",
        "receipt_type": "세금계산서",
        "receipt_info": "현대엘리베이터(주) 105-81-12345"
    },
    {
        "id": "exp-2026-10-02",
        "branch_id": "main",
        "date": "2026-10-10",
        "item": "공용 계단 청소 및 방역소독",
        "amount": 200000,
        "note": "클린하우스 10월 정기 청소 및 해충 방역",
        "receipt_type": "간이영수증",
        "receipt_info": "클린하우스 종합관리"
    },
    {
        "id": "exp-2026-10-03",
        "branch_id": "main",
        "date": "2026-10-15",
        "item": "공용 전기요금 (승강기/복도조명)",
        "amount": 184500,
        "note": "한국전력공사 9월 사용분 고지서 자동납부",
        "receipt_type": "지로영수증",
        "receipt_info": "한전 고객번호 02-1234-5678"
    },
    {
        "id": "exp-2026-10-04",
        "branch_id": "main",
        "date": "2026-10-17",
        "item": "건물 종합 화재보험료",
        "amount": 85000,
        "note": "삼성화재 다세대/원룸 화재보험 10월분",
        "receipt_type": "카드영수증",
        "receipt_info": "삼성화재해상보험(주)"
    }
]

HISTORIES_CONFIG = [
    {
        "id": "hist-304-kim",
        "branch_id": "main",
        "room_number": 304,
        "name": "김영호",
        "id_number": "850314-1******",
        "phone": "010-3344-9988",
        "lease_type": "월세",
        "pay_timing": "후불",
        "deposit": 5000000,
        "rent": 290000,
        "maintenance": 150000,
        "clean_fee": 80000,
        "move_in": "2024-09-01",
        "expiry": "2026-08-31",
        "move_out": "2026-08-31",
        "retention_until": "2027-08-31",
        "metadata_json": {"reason": "만기 퇴실 (보증금 500만 전액 정산 반환 완료)"}
    },
    {
        "id": "hist-503-jang",
        "branch_id": "main",
        "room_number": 503,
        "name": "장지아",
        "id_number": "910722-2******",
        "phone": "010-8864-2674",
        "lease_type": "월세",
        "pay_timing": "후불",
        "deposit": 5000000,
        "rent": 290000,
        "maintenance": 150000,
        "clean_fee": 80000,
        "move_in": "2024-03-01",
        "expiry": "2026-07-31",
        "move_out": "2026-07-31",
        "retention_until": "2027-07-31",
        "metadata_json": {"reason": "타 지역 이직으로 인한 조기 퇴실 (정산 완료)"}
    },
    {
        "id": "hist-405-jung",
        "branch_id": "main",
        "room_number": 405,
        "name": "정다윤",
        "id_number": "931120-2******",
        "phone": "010-5678-9012",
        "lease_type": "월세",
        "pay_timing": "후불",
        "deposit": 5000000,
        "rent": 250000,
        "maintenance": 150000,
        "clean_fee": 80000,
        "move_in": "2024-01-01",
        "expiry": "2025-12-31",
        "move_out": "2025-12-31",
        "retention_until": "2026-12-31",
        "metadata_json": {"reason": "만기 이사 (아카이빙 완료)"}
    },
    {
        "id": "hist-703-hwang",
        "branch_id": "main",
        "room_number": 703,
        "name": "황태훈(구)",
        "id_number": "790514-1******",
        "phone": "010-6789-0123",
        "lease_type": "월세",
        "pay_timing": "후불",
        "deposit": 5000000,
        "rent": 250000,
        "maintenance": 150000,
        "clean_fee": 80000,
        "move_in": "2024-01-01",
        "expiry": "2025-12-31",
        "move_out": "2025-12-31",
        "retention_until": "2026-12-31",
        "metadata_json": {"reason": "결혼으로 인한 분가"}
    }
]

def generate_rooms_data():
    rooms = {}
    for rnum, cfg in ROOMS_CONFIG.items():
        is_vacant = (cfg["name"] == "공실" or not cfg["name"])
        payments = {}
        
        if not is_vacant:
            # Generate rolling 12 months (2025-11 to 2026-12)
            for y, m in [(2025, 11), (2025, 12)] + [(2026, i) for i in range(1, 13)]:
                p_key = f"{y}-{m}"
                
                # Check status
                if y == 2026 and m in cfg["pay_status"]:
                    is_paid = cfg["pay_status"][m]
                elif y < 2026 or (y == 2026 and m < 10):
                    is_paid = True
                else: # future
                    is_paid = False
                    
                pay_date = f"{y}-{str(m).zfill(2)}-05" if is_paid else ""
                r_amount = 0 if cfg["lease_type"] == "전세" else cfg["rent"]
                m_amount = cfg["maintenance"]
                
                pay_obj = {
                    "month": m,
                    "year": y,
                    "paid": is_paid,
                    "paid_date": pay_date,
                    "rent_amount": r_amount,
                    "maintenance_amount": m_amount,
                    "note": "정상 입금" if is_paid else ("" if (y == 2026 and m > 10) else "미납"),
                    "tenant_name": cfg["name"],
                    "is_previous_tenant": False
                }
                payments[str(m)] = pay_obj
                payments[p_key] = pay_obj
        
        rooms[str(rnum)] = {
            "room_number": rnum,
            "branch_id": "main",
            "name": cfg["name"],
            "id_number": cfg["id_number"],
            "phone": cfg["phone"],
            "lease_type": cfg["lease_type"],
            "pay_timing": cfg["pay_timing"],
            "deposit": cfg["deposit"],
            "rent": cfg["rent"],
            "maintenance": cfg["maintenance"],
            "clean_fee": 0 if is_vacant else 80000,
            "move_in": cfg["move_in"],
            "expiry": cfg["expiry"],
            "auto_renewed": False,
            "move_out": "",
            "payments": payments
        }
    return rooms

full_rooms = generate_rooms_data()

# 1. Update apps/rent/backend/seed_data.json
backend_json_path = "apps/rent/backend/seed_data.json"
backup_payload = {
    "version": "3.0",
    "system": "MQnet Rent SaaS Edition",
    "backup_type": "FULL_SYSTEM_BACKUP",
    "exported_at": "2026-10-18T00:00:00",
    "exported_at_formatted": "2026-10-18 00:00:00",
    "branch_id": "main",
    "branch_name": "시크빌 (29개실)",
    "rooms_count": len(full_rooms),
    "expenses_count": len(EXPENSES_CONFIG),
    "tenant_histories_count": len(HISTORIES_CONFIG),
    "data": {
        "rooms": full_rooms,
        "expenses": EXPENSES_CONFIG,
        "tenantHistories": HISTORIES_CONFIG
    }
}

with open(backend_json_path, "w", encoding="utf-8") as f:
    json.dump(backup_payload, f, ensure_ascii=False, indent=2)
print(f"✅ Successfully wrote {backend_json_path}")

# 2. Update apps/rent/frontend/js/seed_data.js
frontend_js_path = "apps/rent/frontend/js/seed_data.js"
js_content = f"""/**
 * apps/rent/frontend/js/seed_data.js
 * 29개실 표준 공인 장부 시드 데이터 (현장 실데이터 완비)
 */
export const CANONICAL_ROOMS_DATA = {json.dumps(full_rooms, ensure_ascii=False, indent=2)};

export const DEFAULT_EXPENSES = {json.dumps(EXPENSES_CONFIG, ensure_ascii=False, indent=2)};

export const DEFAULT_TENANT_HISTORIES = {json.dumps(HISTORIES_CONFIG, ensure_ascii=False, indent=2)};
"""
with open(frontend_js_path, "w", encoding="utf-8") as f:
    f.write(js_content)
print("Successfully wrote seed_data.js")
