"""
MQnet System Automated Verification Script
.agents/skills/mqnet-system-navigator/scripts/verify_system.py

Runs 5 comprehensive verification stages across the codebase:
1. Python AST & Syntax Verification
2. Node.js Frontend JS Syntax Verification
3. Core Backend Module Import Integrity
4. Domain Unit Test Suite Execution
5. FastAPI TestClient API & Business Logic Simulation
"""
import ast
import os
import subprocess
import sys

# Windows UTF-8 stdout/stderr safeguard (safe for Pyrefly / static type checkers)
_reconf_out = getattr(sys.stdout, "reconfigure", None)
if callable(_reconf_out):
    try:
        _reconf_out(encoding="utf-8")
    except Exception:
        pass

_reconf_err = getattr(sys.stderr, "reconfigure", None)
if callable(_reconf_err):
    try:
        _reconf_err(encoding="utf-8")
    except Exception:
        pass

# Dynamically resolve workspace root containing 'apps' or .git
cur = os.path.abspath(os.path.dirname(__file__))
ROOT = cur
while cur and os.path.dirname(cur) != cur:
    if os.path.isdir(os.path.join(cur, "apps")):
        ROOT = cur
        break
    cur = os.path.dirname(cur)

if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

def print_header(title):
    print(f"\n{'='*60}\n>> {title}\n{'='*60}")

def verify_ast():
    print_header("Stage 1: Python AST & Syntax Check")
    checked = 0
    errors = 0
    for root, _, files in os.walk(os.path.join(ROOT, "apps", "rent2")):
        for f in files:
            if f.endswith(".py"):
                path = os.path.join(root, f)
                checked += 1
                try:
                    with open(path, "r", encoding="utf-8") as fp:
                        ast.parse(fp.read(), filename=path)
                except Exception as e:
                    print(f"  [FAIL] {path}: {e}")
                    errors += 1
    if errors == 0:
        print(f"  [PASS] All {checked} Python files parsed successfully (0 syntax errors).")
        return True
    return False

def verify_frontend_js():
    print_header("Stage 2: Frontend JS Syntax Check (node -c)")
    js_dir = os.path.join(ROOT, "apps", "rent2", "frontend", "js")
    if not os.path.isdir(js_dir):
        print("  [SKIP] Frontend JS directory not found.")
        return True
    
    js_files = [f for f in os.listdir(js_dir) if f.endswith(".js")]
    errors = 0
    for jf in js_files:
        p = os.path.join(js_dir, jf)
        res = subprocess.run(["node", "-c", p], capture_output=True, text=True)
        if res.returncode == 0:
            print(f"  [PASS] {jf}")
        else:
            print(f"  [FAIL] {jf}: {res.stderr.strip()}")
            errors += 1
    return errors == 0

def verify_modules():
    print_header("Stage 3: Core Module Import Integrity")
    modules = [
        "apps.rent2.run",
        "apps.rent2.backend.main",
        "apps.rent2.backend.api",
        "apps.rent2.backend.routers.rooms",
        "apps.rent2.backend.routers.smart",
        "apps.rent2.backend.domain.rent",
        "apps.rent2.backend.domain.parser",
        "apps.rent2.backend.domain.vat",
        "apps.rent2.backend.kernel.base",
        "apps.rent2.backend.kernel.identity",
    ]
    import importlib
    errors = 0
    for m in modules:
        try:
            importlib.import_module(m)
            print(f"  [PASS] {m}")
        except Exception as e:
            print(f"  [FAIL] {m}: {e}")
            errors += 1
    return errors == 0

def verify_unit_tests():
    print_header("Stage 4: Domain Unit Tests (test_*.py)")
    import unittest
    suite = unittest.defaultTestLoader.discover(
        start_dir=os.path.join(ROOT, "apps", "rent2", "tests"),
        pattern="test_*.py"
    )
    runner = unittest.TextTestRunner(verbosity=1)
    result = runner.run(suite)
    if result.wasSuccessful():
        print(f"  [PASS] All {result.testsRun} unit tests passed.")
        return True
    print(f"  [FAIL] Failures: {len(result.failures)}, Errors: {len(result.errors)}")
    return False

def verify_api_simulation():
    print_header("Stage 5: FastAPI TestClient & Domain Simulation")
    try:
        from fastapi.testclient import TestClient
        from apps.rent2.backend.main import create_app
        from apps.rent2.backend.domain import bootstrap
        from apps.rent2.backend.domain.rent import Building, num
        from apps.rent2.backend.kernel.identity import User

        app = create_app(db_path=":memory:")
        bootstrap()

        admin = User.by_username("admin")
        if not admin:
            admin = User.create("admin", "1212", role="superadmin", status="APPROVED")
        else:
            admin.status = "APPROVED"
            admin.save("test")

        token = admin.token()
        headers = {"Authorization": f"Bearer {token}"}
        client = TestClient(app)

        # 1. Status & Rooms
        r_stat = client.get("/api/status", headers=headers)
        assert r_stat.status_code == 200, f"Status code {r_stat.status_code}"
        r_rooms = client.get("/api/rooms", headers=headers)
        assert r_rooms.status_code == 200, f"Rooms code {r_rooms.status_code}"
        print(f"  [PASS] Endpoints /api/status (200), /api/rooms (200 - {len(r_rooms.json())} units)")

        # 2. Smart Paste & FIFO Auto-collection
        b = Building.require("main")
        u = b.unit(201)
        u.update({
            "name": "홍길동",
            "deposit": 10000000,
            "rent": 450000,
            "maintenance": 50000,
            "pay_timing": "후불",
            "move_in": "2026-01-01",
            "expiry": "2027-01-01"
        })
        paste_payload = {
            "text": "[신한체크승인] 11/15 11:20 201호 홍길동 500,000원 입금 잔액 12,000,000원",
            "branch_id": "main",
            "auto_apply": True
        }
        r_paste = client.post("/api/smart/paste-payment", json=paste_payload, headers=headers)
        assert r_paste.status_code == 200, f"Paste payment failed: {r_paste.text}"
        res_data = r_paste.json()
        assert res_data.get("success") is True, f"Paste success is false: {res_data}"
        print(f"  [PASS] Smart paste & FIFO 수납 처리 완료 (반영 건수: {res_data.get('applied_count')}건)")

        # 3. Duplicate payment protection test (same month again)
        r_dup = client.post("/api/smart/paste-payment", json=paste_payload, headers=headers)
        dup_data = r_dup.json()
        assert dup_data.get("success") is False, "Duplicate payment should be blocked!"
        print(f"  [PASS] Duplicate payment detection verified (차단 사유: {dup_data.get('message')[:30]}...)")

        return True
    except Exception as e:
        print(f"  [FAIL] API simulation error: {e}")
        return False

def main():
    stages = [
        ("Python AST Syntax", verify_ast),
        ("Frontend JS Syntax", verify_frontend_js),
        ("Module Integrity", verify_modules),
        ("Unit Tests", verify_unit_tests),
        ("FastAPI Simulation", verify_api_simulation),
    ]

    results = []
    for name, fn in stages:
        ok = fn()
        results.append((name, ok))

    print_header("FINAL VERIFICATION SUMMARY")
    all_pass = True
    for name, ok in results:
        status = "PASSED [OK]" if ok else "FAILED [X]"
        if not ok:
            all_pass = False
        print(f"  * {name:<25}: {status}")

    print("\n" + ("="*60))
    if all_pass:
        print(">>> ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY! <<<")
        print("="*60 + "\n")
        sys.exit(0)
    else:
        print(">>> SOME VERIFICATION CHECKS FAILED! PLEASE REVIEW LOGS. <<<")
        print("="*60 + "\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
