export class Plugin {}
export class PluginSettingTab {}
export class Setting {
  setName() { return this; }
  setDesc() { return this; }
  addToggle() { return this; }
  addText() { return this; }
}
export function parseYaml(yaml: string) {
  if (!yaml) return null;

  // Pre-process and normalize tabs/NBSP
  let normalized = yaml.replace(/\u00A0/g, ' ');
  normalized = normalized.replace(/\t/g, '  ');

  const lines = normalized.split('\n')
    .map(line => {
      const match = line.match(/^(\s*)(.*)$/);
      const indent = match ? match[1].length : 0;
      const content = match ? match[2].trim() : '';
      return { indent, content };
    })
    .filter(l => l.content && !l.content.startsWith('#'));

  if (lines.length === 0) return null;

  let index = 0;

  function parseValue(val: string): any {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
    if (!isNaN(Number(val)) && val !== '') return Number(val);
    return val;
  }

  function parseBlock(baseIndent: number): any {
    if (index >= lines.length) return null;

    // Check if the current block is an array (starts with '-')
    const isArray = lines[index].content.startsWith('-');

    if (isArray) {
      const arr: any[] = [];
      while (index < lines.length && lines[index].indent === baseIndent && lines[index].content.startsWith('-')) {
        const line = lines[index];
        const contentWithoutDash = line.content.slice(1).trim();

        if (contentWithoutDash === '') {
          // List item with nested content on subsequent lines
          index++;
          if (index < lines.length && lines[index].indent > baseIndent) {
            arr.push(parseBlock(lines[index].indent));
          } else {
            arr.push(null);
          }
        } else if (/^\w+\s*:[^\/]/.test(contentWithoutDash)) {
          // List item is an inline key-value pair of an object
          const obj: any = {};
          const firstKeyMatch = contentWithoutDash.match(/^(\w+)\s*:\s*(.*)$/);
          if (firstKeyMatch) {
            const key = firstKeyMatch[1];
            const valStr = firstKeyMatch[2].trim();
            if (valStr === '') {
              index++;
              if (index < lines.length && lines[index].indent > baseIndent) {
                obj[key] = parseBlock(lines[index].indent);
              }
            } else {
              obj[key] = parseValue(valStr);
              index++;
            }
          } else {
            index++;
          }

          // Parse other keys belonging to this object (they must have greater indent than baseIndent)
          while (index < lines.length && lines[index].indent > baseIndent && !lines[index].content.startsWith('-')) {
            const subLine = lines[index];
            const subMatch = subLine.content.match(/^(\w+)\s*:\s*(.*)$/);
            if (subMatch) {
              const k = subMatch[1];
              const vStr = subMatch[2].trim();
              if (vStr === '') {
                index++;
                if (index < lines.length && lines[index].indent > subLine.indent) {
                  obj[k] = parseBlock(lines[index].indent);
                }
              } else {
                obj[k] = parseValue(vStr);
                index++;
              }
            } else {
              index++;
            }
          }
          arr.push(obj);
        } else {
          // Simple scalar list item
          arr.push(parseValue(contentWithoutDash));
          index++;
        }
      }
      return arr;
    } else {
      // It's a map (object)
      const obj: any = {};
      while (index < lines.length && lines[index].indent === baseIndent) {
        const line = lines[index];
        const match = line.content.match(/^(\w+)\s*:\s*(.*)$/);
        if (!match) {
          index++;
          continue;
        }

        const key = match[1];
        const valStr = match[2].trim();

        if (valStr === '') {
          index++;
          if (index < lines.length && lines[index].indent > baseIndent) {
            obj[key] = parseBlock(lines[index].indent);
          } else {
            obj[key] = null;
          }
        } else {
          obj[key] = parseValue(valStr);
          index++;
        }
      }
      return obj;
    }
  }

  return parseBlock(lines[0].indent);
}
export function stringifyYaml(obj: any) {
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n');
}

export async function requestUrl(request: any) {
  const url = typeof request === 'string' ? request : request.url;
  const options = typeof request === 'string' ? {} : request;
  
  // Use global fetch
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body
  });
  
  // Extract headers
  const headers: Record<string, string> = {};
  if (response.headers && typeof response.headers.forEach === 'function') {
    response.headers.forEach((val: string, key: string) => {
      headers[key] = val;
    });
  } else if (response.headers) {
    for (const [key, val] of Object.entries(response.headers)) {
      headers[key] = String(val);
    }
  }
  
  return {
    status: response.status,
    headers: headers,
    text: async () => response.text(),
    json: async () => response.json(),
    arrayBuffer: async () => response.arrayBuffer()
  };
}
