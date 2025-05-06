import os
from pathlib import Path

# === CONFIGURATION ===
project_root = Path(__file__).resolve().parent.parent  # you're in src/, go one level up
exclude_dirs = {"node_modules", "dist", "assets", ".git", ".vscode", "__pycache__"}
exclude_files = {"package-lock.json"}

output_file = project_root / "full_codebase_dump.md"
allowed_suffixes = {".js", ".jsx", ".ts", ".tsx", ".css", ".json", ".html", ".md", ".py"}

# === FORMATTER ===
def format_file(file_path: Path):
    suffix = file_path.suffix.lstrip(".")
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        content = f"Error reading file: {e}"
    return f"\n---\n### `{file_path.relative_to(project_root)}`\n```{suffix}\n{content}\n```\n"

# === FILE COLLECTOR ===
def collect_files(root: Path):
    files = []
    for path in root.rglob("*"):
        if (
            path.is_file() and
            path.suffix in allowed_suffixes and
            not any(part in exclude_dirs for part in path.parts) and
            path.name not in exclude_files
        ):
            files.append(path)
    return sorted(files)

# === MAIN ===
if __name__ == "__main__":
    print("🔍 Scanning project files...")
    all_files = collect_files(project_root)
    print(f"📄 Found {len(all_files)} files.")

    print(f"✍️ Writing to {output_file.name}...")
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("# 📦 Full Codebase Dump\n")
        for file in all_files:
            f.write(format_file(file))
    
    print("✅ Full markdown dump complete!")
