const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/agent_registry.json'), 'utf8'));

// Replace unescaped double quotes inside JSON string values with single quotes
function repairJSON(str) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\') { result += ch; escaped = true; continue; }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        // Check if this closes the string legitimately
        const rest = str.slice(i + 1).trimStart();
        if (rest[0] === ',' || rest[0] === '}' || rest[0] === ']' || rest[0] === ':' || rest.length === 0) {
          inString = false;
          result += ch;
        } else {
          // Unescaped quote mid-string — replace with single quote
          result += "'";
        }
      }
    } else {
      result += ch;
    }
  }
  return result;
}

async function run(agentName, userContext) {
  const config = registry.agents[agentName];
  if (!config) throw new Error(`Unknown agent: ${agentName}`);

  const promptPath = path.join(__dirname, '..', config.prompt_file);
  const systemPrompt = fs.readFileSync(promptPath, 'utf8');

  const response = await client.messages.create({
    model: config.model,
    max_tokens: config.max_tokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: JSON.stringify(userContext, null, 2) }]
  });

  const text = response.content[0]?.text || '';

  // Extract JSON from response (may be wrapped in markdown code fences)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    let raw = jsonMatch[1].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    try {
      return JSON.parse(raw);
    } catch (e) {
      try {
        return JSON.parse(repairJSON(raw));
      } catch (e2) {
        console.error(`[${agentName}] Failed to parse JSON response:`, e2.message);
        console.error('Raw response:', text.slice(0, 500));
        throw e2;
      }
    }
  }

  throw new Error(`[${agentName}] Response did not contain valid JSON`);
}

module.exports = { run };
