with open('apps/rent/frontend/js/state.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if "import { CANONICAL_ROOMS_DATA }" not in content:
    content = content.replace(
        "import { apiGetRooms, apiGetExpenses, apiGetBranches, apiGetTenantHistories } from './api.js?v=2.0';",
        "import { apiGetRooms, apiGetExpenses, apiGetBranches, apiGetTenantHistories } from './api.js?v=2.0';\nimport { CANONICAL_ROOMS_DATA } from './seed_data.js?v=2.0';"
    )

# 2. Replace generateDefaultSeedRooms
start_marker = "export function generateDefaultSeedRooms() {"
end_marker = "export function loadLocalFallback() {"

start_pos = content.find(start_marker)
end_pos = content.find(end_marker)

if start_pos != -1 and end_pos != -1:
    new_fn = """export function generateDefaultSeedRooms() {
  return JSON.parse(JSON.stringify(CANONICAL_ROOMS_DATA));
}

"""
    content = content[:start_pos] + new_fn + content[end_pos:]
    with open('apps/rent/frontend/js/state.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully refactored state.js")
else:
    print(f"Markers not found: start={start_pos}, end={end_pos}")
