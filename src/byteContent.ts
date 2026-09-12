export type ByteContent = {
  byteLength: number;
  content: string;
  encoding: "utf-8" | "base64";
};

function containsUnsafeControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;

    const unsafeC0 = codePoint < 0x20
      && codePoint !== 0x09
      && codePoint !== 0x0a
      && codePoint !== 0x0d;
    const unsafeDeleteOrC1 = codePoint >= 0x7f && codePoint <= 0x9f;
    if (unsafeC0 || unsafeDeleteOrC1) return true;
  }

  return false;
}

export function decodeByteContent(bytes: Uint8Array): ByteContent {
  const buffer = Buffer.from(bytes);
  const text = buffer.toString("utf8");
  const isStrictUtf8 = Buffer.from(text, "utf8").equals(buffer);

  if (isStrictUtf8 && !containsUnsafeControlCharacters(text)) {
    return {
      byteLength: buffer.byteLength,
      content: text,
      encoding: "utf-8",
    };
  }

  return {
    byteLength: buffer.byteLength,
    content: buffer.toString("base64"),
    encoding: "base64",
  };
}

export function formatByteContent(label: string, bytes: Uint8Array): string {
  const decoded = decodeByteContent(bytes);
  if (decoded.encoding === "utf-8") {
    return `${label}:\n${decoded.content}`;
  }

  return `${label} [byteLength=${decoded.byteLength}, encoding=base64]:\n${decoded.content}`;
}
