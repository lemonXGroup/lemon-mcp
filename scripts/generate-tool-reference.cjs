const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { registerTools } = require('../build/tools.js');
const { registerResources } = require('../build/resources.js');
const root = path.resolve(__dirname, '..');
const schemaPath = path.join(root, 'docs/reference/tools.schema.json');
const markdownPath = path.join(root, 'docs/reference/tools.md');
const previous = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const args = process.argv.slice(2);
const dateIndex = args.indexOf('--date');
const checkedAt = dateIndex >= 0 ? args[dateIndex + 1] : previous.checkedAt;
assert.match(checkedAt || '', /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
const tools = [];
let resourceCount = 0;
registerTools({ registerTool(name, options) {
  tools.push({ name, description: options.description || '', inputSchema: z.toJSONSchema(z.object(options.inputSchema || {})) });
} });
registerResources({ registerResource() { resourceCount += 1; } });
const snapshot = { schemaVersion: 1, checkedAt, scope: 'current-public-mcp', toolCount: tools.length, resourceCount, tools };
const rows = tools.map(tool => {
  const fields = Object.keys(tool.inputSchema.properties || {}).map(name =>
    name + ((tool.inputSchema.required || []).includes(name) ? '' : '?')).join(', ');
  const description = tool.description.replace(/\s+/g, ' ').replaceAll('|', '\\|');
  return '| ' + String.fromCharCode(96) + tool.name + String.fromCharCode(96) + ' | ' + fields + ' | ' + description + ' |';
});
const oldMarkdown = fs.readFileSync(markdownPath, 'utf8');
const footer = oldMarkdown.slice(oldMarkdown.indexOf('## Resources'));
assert.ok(footer.startsWith('## Resources'));
const markdown = '# Current MCP tools\n\n'
  + '[Manual](../README.md) · [AI guide](../AI_GUIDE.md) · [Full input schemas](tools.schema.json) · [Compatibility](compatibility.md)\n\n'
  + 'Generated from the current public tool registration and Zod schemas on ' + checkedAt + '. This snapshot registers **' + tools.length + ' tools** and **' + resourceCount + ' resources**. These are the public interfaces; check device capabilities and compatibility before generating newer rules.\n\n'
  + '| Tool | Input fields | Description |\n| --- | --- | --- |\n' + rows.join('\n') + '\n\n' + footer;
if (args.includes('--check')) {
  assert.deepEqual(previous, snapshot, 'Tool schema is stale; run npm run docs:generate');
  assert.equal(oldMarkdown, markdown, 'Tool reference is stale; run npm run docs:generate');
  console.log('Tool reference matches ' + tools.length + ' registered tools and ' + resourceCount + ' resources.');
} else {
  fs.writeFileSync(schemaPath, JSON.stringify(snapshot, null, 2) + '\n');
  fs.writeFileSync(markdownPath, markdown);
  console.log('Generated tool reference for ' + tools.length + ' tools and ' + resourceCount + ' resources.');
}
