const TEXT_FILE_EXTENSIONS = new Set([
  ".conf",
  ".config",
  ".css",
  ".csv",
  ".json",
  ".jsonc",
  ".js",
  ".log",
  ".md",
  ".properties",
  ".toml",
  ".ts",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

export function isTextFilePath(path: string): boolean {
  const normalizedPath = path.split(/[?#]/, 1)[0].toLowerCase();
  const lastDot = normalizedPath.lastIndexOf(".");
  return lastDot >= 0 && TEXT_FILE_EXTENSIONS.has(normalizedPath.slice(lastDot));
}

export function formatTextFileContent(label: string, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return `${label}:\n`;

  try {
    const parsed = JSON.parse(trimmed);
    return `${label}:\n${JSON.stringify(parsed, null, 2)}`;
  } catch {
    return `${label}:\n${text}`;
  }
}
