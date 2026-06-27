import sys

def process():
    lines = open('tests/setup.ts').readlines()
    for i, line in enumerate(lines):
        if "jest.mock('obsidian', () => ({" in line:
            lines.insert(i+1, "  EditorSuggest: class MockEditorSuggest { constructor() {} },\n")
            lines.insert(i+2, "  PopoverSuggest: class MockPopoverSuggest { constructor() {} },\n")
            break

    with open('tests/setup.ts', 'w') as f:
        f.writelines(lines)

if __name__ == '__main__':
    process()
