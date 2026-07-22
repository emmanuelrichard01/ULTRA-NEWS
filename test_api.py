import requests
import json

r = requests.get('http://localhost:8000/api/v1/stories')
data = r.json()
stories_with_framing = [s for s in data.get('items', []) if len(s.get('framing_preview', [])) > 1]

print(f"Total Stories: {len(data.get('items', []))}")
print(f"Stories with multiple framing previews: {len(stories_with_framing)}")

if stories_with_framing:
    print(json.dumps(stories_with_framing[0]['framing_preview'], indent=2))
