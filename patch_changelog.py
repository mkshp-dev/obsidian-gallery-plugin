import re

with open('CHANGELOG.md', 'r') as f:
    content = f.read()

new_entry = "- Polished Insert Gallery builder UX for authenticated Immich (logical groups, searchable multi-selects, live YAML preview).\n"

content = content.replace("## In-progress\n", "## In-progress\n" + new_entry)

with open('CHANGELOG.md', 'w') as f:
    f.write(content)
