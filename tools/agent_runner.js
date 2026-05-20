const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/agent_registry.json'), 'utf8'));

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
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      // Fallback: strip unescaped control characters and retry
      const cleaned = jsonMatch[1].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      try {
        return JSON.parse(cleaned);
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
