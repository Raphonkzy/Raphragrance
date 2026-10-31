import json

with open("fixtures/golden.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for item in data:
    item["imageUrl"] = None

with open("fixtures/golden.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Updated golden.json with null imageUrl")
