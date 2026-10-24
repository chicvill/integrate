import subprocess
import os

root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
seed_dest = os.path.join(root, "apps", "rent2", "backend", "seed_data.json")
csv_dest = os.path.join(root, "apps", "rent2", "backend", "chicvill_2025.csv")

try:
    out_seed = subprocess.check_output(["git", "show", "ffdedf8:apps/rent/backend/seed_data.json"], cwd=root)
    with open(seed_dest, "wb") as f:
        f.write(out_seed)
    print("seed_data.json restored to", seed_dest, "size:", len(out_seed))
except Exception as e:
    print("seed_data.json restore error:", e)

try:
    out_csv = subprocess.check_output(["git", "show", "f5dad93:apps/rent/backend/chicvill_2025.csv"], cwd=root)
    with open(csv_dest, "wb") as f:
        f.write(out_csv)
    print("chicvill_2025.csv restored to", csv_dest, "size:", len(out_csv))
except Exception as e:
    print("chicvill_2025.csv restore error:", e)
