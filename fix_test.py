import re

with open('tests/unit/GalleryBuilderModal.test.ts', 'r') as f:
    content = f.read()

content = content.replace("expect(yaml).toContain('filenameFilter: \"*.png\"');", "expect(yaml).toContain('filenameFilter: *.png');")
content = content.replace("expect(yaml).toContain('filenameFilter: \"*.jpg\"');", "expect(yaml).toContain('filenameFilter: *.jpg');")

with open('tests/unit/GalleryBuilderModal.test.ts', 'w') as f:
    f.write(content)
