import os
import re

def main():
    root_dir = '/home/deploy/bahrawy'
    target_exts = ('.ts', '.tsx')
    changed_files = 0

    pattern = re.compile(r'(?:\s*)dark:[a-zA-Z0-9\-\/\[\]#\.]+(?:\s*)')

    for dirpath, dirnames, filenames in os.walk(root_dir):
        if 'node_modules' in dirpath or '.next' in dirpath:
            continue
        for filename in filenames:
            if filename.endswith(target_exts):
                filepath = os.path.join(dirpath, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                new_content = pattern.sub(' ', content)

                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    changed_files += 1

    print(f"Removed dark mode variants in {changed_files} files.")

if __name__ == '__main__':
    main()
