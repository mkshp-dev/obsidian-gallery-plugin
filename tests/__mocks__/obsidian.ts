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
  const lines = yaml.split('\n');
  const result: any = {};
  for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      if (line.trim().startsWith('-')) {
         if (!result.urls) result.urls = [];
         result.urls.push(line.replace('-', '').trim());
         continue;
      }
      const match = line.match(/^(\w+)\s*:\s*(.+)$/);
      if (match) {
          let val: any = match[2].trim();
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          else if (!isNaN(Number(val))) val = Number(val);
          result[match[1]] = val;
      } else if (line.trim().startsWith('path:') || line.trim().startsWith('urls:')) {
          if (line.trim().startsWith('path:')) result.path = '';
      }
  }
  return Object.keys(result).length > 0 ? result : null;
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
