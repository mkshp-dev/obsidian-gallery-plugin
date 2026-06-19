import os
import re

def replace_console_in_file(filepath):
    if filepath.endswith("Logger.ts"):
        return

    with open(filepath, 'r') as f:
        content = f.read()

    has_console = 'console.' in content
    if not has_console:
        return

    content = content.replace('console.log(', 'Logger.debug(')
    content = content.replace('console.error(', 'Logger.error(')
    content = content.replace('console.warn(', 'Logger.warn(')
    content = content.replace('console.debug(', 'Logger.debug(')

    # Remove potentially wrong existing Logger imports from previous run
    content = re.sub(r"import \{ Logger \} from '.*Logger';\n?", "", content)

    # Calculate correct relative path
    rel_path = os.path.relpath('src/utils/Logger.ts', os.path.dirname(filepath))
    if not rel_path.startswith('.'):
        rel_path = './' + rel_path
    if rel_path.endswith('.ts'):
        rel_path = rel_path[:-3]

    import_line = f"import {{ Logger }} from '{rel_path}';\n"
    content = import_line + content

    with open(filepath, 'w') as f:
        f.write(content)

def main():
    src_dir = 'src'
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.ts'):
                replace_console_in_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
