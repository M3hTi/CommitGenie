import { ConfigService } from './configService';
import { ChangeAnalysis, CommitType } from '../types';

interface AIResponse {
  description: string;
  type?: CommitType;
  scope?: string;
}

export class AIService {
  /**
   * Check if AI is enabled and configured
   */
  static isEnabled(): boolean {
    const config = ConfigService.getConfig();
    return config.ai?.enabled === true && !!config.ai?.apiKey;
  }

  /**
   * Generate an AI-enhanced description for the commit
   */
  static async generateDescription(
    analysis: ChangeAnalysis,
    diff: string
  ): Promise<AIResponse | null> {
    const config = ConfigService.getConfig();
    const aiConfig = config.ai;

    if (!aiConfig?.enabled || !aiConfig?.apiKey) {
      return null;
    }

    const provider = aiConfig.provider || 'openai';
    const model = aiConfig.model || this.getDefaultModel(provider);

    // Truncate diff to avoid token limits
    const truncatedDiff = diff.length > 3000 ? diff.substring(0, 3000) + '\n...(truncated)' : diff;

    const prompt = this.buildPrompt(analysis, truncatedDiff);

    try {
      if (provider === 'openai') {
        return await this.callOpenAI(aiConfig.apiKey, model, prompt);
      } else if (provider === 'anthropic') {
        return await this.callAnthropic(aiConfig.apiKey, model, prompt);
      } else if (provider === 'google') {
        return await this.callGoogle(aiConfig.apiKey, model, prompt);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`\n⚠ AI Error: ${errorMsg}`);
      throw error; // Re-throw so caller can handle it
    }

    return null;
  }

  /**
   * Build the prompt for the AI
   */
  private static buildPrompt(analysis: ChangeAnalysis, diff: string): string {
    const filesChanged = [
      ...analysis.fileChanges.added.map(f => `+ ${f} (added)`),
      ...analysis.fileChanges.modified.map(f => `~ ${f} (modified)`),
      ...analysis.fileChanges.deleted.map(f => `- ${f} (deleted)`),
      ...analysis.fileChanges.renamed.map(f => `→ ${f} (renamed)`),
    ].join('\n');

    return `You are a helpful assistant that generates concise, professional git commit messages following the Conventional Commits specification.

Given the following git diff and file changes, generate a commit message description (NOT the full message, just the description after the type: prefix).

FILE CHANGES:
${filesChanged}

DETECTED COMMIT TYPE: ${analysis.commitType}
${analysis.scope ? `DETECTED SCOPE: ${analysis.scope}` : ''}
${analysis.isBreakingChange ? 'THIS IS A BREAKING CHANGE' : ''}

GIT DIFF:
${diff}

RULES:
1. Write a clear, concise description (max 50 characters ideal, 72 max)
2. Use lowercase and imperative mood (e.g., "add", "fix", "update", not "added", "fixes", "updated")
3. Don't end with a period
4. Focus on WHAT changed and WHY, not HOW
5. Be specific but brief

Respond with ONLY the description text, nothing else. No quotes, no type prefix, just the description.`;
  }

  /**
   * Call OpenAI API
   */
  private static async callOpenAI(apiKey: string, model: string, prompt: string): Promise<AIResponse | null> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (content) {
      return { description: content.toLowerCase() };
    }

    return null;
  }

  /**
   * Call Anthropic API
   */
  private static async callAnthropic(apiKey: string, model: string, prompt: string): Promise<AIResponse | null> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 100,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const content = data.content?.find(c => c.type === 'text')?.text?.trim();
    if (content) {
      return { description: content.toLowerCase() };
    }

    return null;
  }

  /**
   * Call Google AI Studio (Gemini) API
   */
  private static async callGoogle(apiKey: string, model: string, prompt: string): Promise<AIResponse | null> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 100,
            temperature: 0.3,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content: {
          parts: Array<{ text: string }>;
        };
      }>;
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (content) {
      return { description: content.toLowerCase() };
    }

    return null;
  }

  /**
   * Get default model for provider
   */
  private static getDefaultModel(provider: string): string {
    switch (provider) {
      case 'openai':
        return 'gpt-4o-mini';
      case 'anthropic':
        return 'claude-3-haiku-20240307';
      case 'google':
        return 'gemini-1.5-flash';
      default:
        return 'gpt-4o-mini';
    }
  }
}
