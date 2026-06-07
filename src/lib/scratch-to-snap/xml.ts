// Tiny XML builder used for Snap! project output.
// Snap! is whitespace-tolerant but we still indent for readability.

export type XmlAttrs = Record<string, string | number | boolean | undefined>;

export class XmlNode {
  tag: string;
  attrs: XmlAttrs;
  children: (XmlNode | string)[] = [];

  constructor(tag: string, attrs: XmlAttrs = {}, children: (XmlNode | string)[] = []) {
    this.tag = tag;
    this.attrs = attrs;
    this.children = children;
  }

  add(child: XmlNode | string): XmlNode {
    this.children.push(child);
    return this;
  }

  toString(indent = 0): string {
    const pad = "  ".repeat(indent);
    const attrStr = Object.entries(this.attrs)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
      .join("");

    if (this.children.length === 0) {
      return `${pad}<${this.tag}${attrStr}/>`;
    }

    // Inline if single text child and short
    if (this.children.length === 1 && typeof this.children[0] === "string") {
      return `${pad}<${this.tag}${attrStr}>${escapeText(this.children[0] as string)}</${this.tag}>`;
    }

    const inner = this.children
      .map((c) =>
        typeof c === "string"
          ? `${"  ".repeat(indent + 1)}${escapeText(c)}`
          : c.toString(indent + 1),
      )
      .join("\n");
    return `${pad}<${this.tag}${attrStr}>\n${inner}\n${pad}</${this.tag}>`;
  }
}

export function el(tag: string, attrs: XmlAttrs = {}, ...children: (XmlNode | string)[]): XmlNode {
  return new XmlNode(tag, attrs, children);
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
