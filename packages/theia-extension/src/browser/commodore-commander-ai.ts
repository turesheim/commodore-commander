import {
  BasePromptFragment,
  LanguageModelRequirement,
  ToolProvider,
  ToolRequest
} from '@theia/ai-core';
import {
  AbstractStreamParsingChatAgent,
  ChatAgent,
  ChatSessionContext,
  SystemMessageDescription
} from '@theia/ai-chat';
import { AIChatContribution } from '@theia/ai-chat-ui/lib/browser/ai-chat-ui-contribution';
import {
  FrontendApplication,
  FrontendApplicationContribution
} from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';

import {
  BUNDLED_DOCUMENTS,
  bundledDocumentationAssetUrl
} from './commodore-commander-bundled-docs';

const COMMODORE_ASSISTANT_ID = 'Commodore';
const COMMODORE_DOCUMENTATION_SEARCH_TOOL_ID =
  'commodoreCommanderDocumentationSearch';

const COMMODORE_ASSISTANT_PROMPT: BasePromptFragment = {
  id: 'commodore-commander-chat-agent-system-prompt',
  template: `You are the Commodore Commander assistant for an IDE focused on Commodore 8-bit development.

Use bundled product documentation before answering questions about Commodore Commander features, build configuration, the VICE debugger, Kick Assembler workflows, native editor file formats, SIDScore, and bundled tooling.

When relevant, cite document labels and paths from the retrieved documentation. If the documentation does not contain the answer, say what is known and what remains uncertain.

Attached chat context:
{{contextSummary}}

You may call this documentation search tool for additional focused retrieval:
~{commodoreCommanderDocumentationSearch}`
};

interface DocumentationChunk {
  readonly documentPath: string;
  readonly documentLabel: string;
  readonly heading: string;
  readonly text: string;
  readonly searchText: string;
}

interface DocumentationSearchResult {
  readonly documentPath: string;
  readonly documentLabel: string;
  readonly heading: string;
  readonly excerpt: string;
  readonly score: number;
}

interface DocumentationSearchArguments {
  readonly query: string;
  readonly maxResults?: number;
}

@injectable()
export class CommodoreCommanderDocumentationRagService {
  protected chunksPromise: Promise<DocumentationChunk[]> | undefined;

  async search(
    query: string,
    maxResults = 5
  ): Promise<DocumentationSearchResult[]> {
    const terms = tokenize(query);
    if (terms.length === 0) {
      return [];
    }

    const chunks = await this.getChunks();
    return chunks
      .map(chunk => ({
        chunk,
        score: scoreChunk(chunk, query, terms)
      }))
      .filter(match => match.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, Math.min(maxResults, 8)))
      .map(match => ({
        documentPath: match.chunk.documentPath,
        documentLabel: match.chunk.documentLabel,
        heading: match.chunk.heading,
        excerpt: createExcerpt(match.chunk.text, terms),
        score: match.score
      }));
  }

  protected getChunks(): Promise<DocumentationChunk[]> {
    if (!this.chunksPromise) {
      this.chunksPromise = this.loadChunks();
    }
    return this.chunksPromise;
  }

  protected async loadChunks(): Promise<DocumentationChunk[]> {
    const chunks: DocumentationChunk[] = [];

    for (const document of BUNDLED_DOCUMENTS) {
      if (!/\.md$/iu.test(document.path)) {
        continue;
      }

      const response = await fetch(bundledDocumentationAssetUrl(document.path), {
        cache: 'no-cache'
      });
      if (!response.ok) {
        continue;
      }

      const markdown = await response.text();
      chunks.push(...chunkMarkdownDocument(
        document.path,
        document.label,
        markdown
      ));
    }

    return chunks;
  }
}

@injectable()
export class CommodoreCommanderDocumentationSearchTool
  implements ToolProvider {
  @inject(CommodoreCommanderDocumentationRagService)
  protected readonly ragService!: CommodoreCommanderDocumentationRagService;

  getTool(): ToolRequest {
    return {
      id: COMMODORE_DOCUMENTATION_SEARCH_TOOL_ID,
      name: COMMODORE_DOCUMENTATION_SEARCH_TOOL_ID,
      providerName: 'Commodore Commander',
      description:
        'Searches the bundled Commodore Commander documentation and returns ' +
        'short excerpts with source document labels and paths.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The product documentation question or search query.'
          },
          maxResults: {
            type: 'integer',
            description: 'Maximum number of excerpts to return. Defaults to 5.'
          }
        },
        required: ['query']
      },
      handler: async argString => {
        const args = parseSearchArguments(argString);
        const results = await this.ragService.search(
          args.query,
          args.maxResults
        );
        return formatDocumentationSearchResults(results);
      }
    };
  }
}

@injectable()
export class CommodoreCommanderChatViewContribution
  implements FrontendApplicationContribution {
  @inject(AIChatContribution)
  protected readonly aiChatContribution!: AIChatContribution;

  async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
    await this.aiChatContribution.openView();
  }
}

@injectable()
export class CommodoreCommanderChatAgent
  extends AbstractStreamParsingChatAgent
  implements ChatAgent {
  @inject(CommodoreCommanderDocumentationRagService)
  protected readonly ragService!: CommodoreCommanderDocumentationRagService;

  readonly id = COMMODORE_ASSISTANT_ID;
  readonly name = COMMODORE_ASSISTANT_ID;
  override readonly description =
    'Answers Commodore Commander and Commodore 8-bit development questions ' +
    'using bundled product documentation as retrieval context.';
  override readonly tags = ['Commodore Commander', 'RAG'];
  override readonly prompts = [{
    id: COMMODORE_ASSISTANT_PROMPT.id,
    defaultVariant: COMMODORE_ASSISTANT_PROMPT
  }];
  override readonly functions = [COMMODORE_DOCUMENTATION_SEARCH_TOOL_ID];
  override readonly languageModelRequirements: LanguageModelRequirement[] = [
    {
      purpose: 'chat',
      identifier: 'default/universal'
    }
  ];
  protected readonly defaultLanguageModelPurpose = 'chat';
  protected override readonly systemPromptId = COMMODORE_ASSISTANT_PROMPT.id;

  protected override async getSystemMessageDescription(
    context: ChatSessionContext
  ): Promise<SystemMessageDescription | undefined> {
    const systemMessage = await super.getSystemMessageDescription(context);
    const query = context.request?.request.text;
    if (!systemMessage || !query) {
      return systemMessage;
    }

    const results = await this.ragService.search(query, 4);
    const ragContext = formatDocumentationSearchResults(results);

    return {
      ...systemMessage,
      text: `${systemMessage.text}

Retrieved Commodore Commander documentation context:
${ragContext}`
    };
  }
}

function chunkMarkdownDocument(
  documentPath: string,
  documentLabel: string,
  markdown: string
): DocumentationChunk[] {
  const chunks: DocumentationChunk[] = [];
  const lines = markdown.replace(/\r\n?/gu, '\n').split('\n');
  let heading = documentLabel;
  let buffer: string[] = [];

  const flush = (): void => {
    const text = normalizeMarkdownText(buffer.join('\n'));
    buffer = [];
    if (!text) {
      return;
    }

    for (const part of splitLongText(text, 1800)) {
      chunks.push({
        documentPath,
        documentLabel,
        heading,
        text: part,
        searchText: `${documentLabel} ${heading} ${part}`.toLowerCase()
      });
    }
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,4})\s+(.+)$/u.exec(line);
    if (headingMatch) {
      flush();
      heading = normalizeMarkdownText(headingMatch[2]);
      continue;
    }

    buffer.push(line);
  }

  flush();
  return chunks;
}

function splitLongText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const paragraphs = text.split(/\n{2,}/u);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (`${current}\n\n${paragraph}`.trim().length > maxLength && current) {
      chunks.push(current.trim());
      current = '';
    }
    current = `${current}\n\n${paragraph}`.trim();
  }

  if (current) {
    chunks.push(current.trim());
  }
  return chunks;
}

function normalizeMarkdownText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/gu, match => match.replace(/```/gu, ''))
    .replace(/!\[([^\]]*)\]\([^)]+\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/[`*_>#-]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/[ \t]{2,}/gu, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const stopWords = new Set([
    'about',
    'after',
    'also',
    'and',
    'are',
    'can',
    'for',
    'from',
    'how',
    'into',
    'the',
    'this',
    'with',
    'what',
    'when',
    'where',
    'why'
  ]);

  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9.+#-]*/gu) ?? [];
  return Array.from(new Set(
    matches.filter(term => term.length > 1 && !stopWords.has(term))
  ));
}

function scoreChunk(
  chunk: DocumentationChunk,
  query: string,
  terms: string[]
): number {
  const phrase = query.trim().toLowerCase();
  let score = chunk.searchText.includes(phrase) ? 8 : 0;

  for (const term of terms) {
    score += countOccurrences(chunk.documentLabel.toLowerCase(), term) * 4;
    score += countOccurrences(chunk.heading.toLowerCase(), term) * 3;
    score += countOccurrences(chunk.searchText, term);
  }

  return score;
}

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let index = text.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}

function createExcerpt(text: string, terms: string[]): string {
  const lowerText = text.toLowerCase();
  const firstMatch = terms
    .map(term => lowerText.indexOf(term))
    .filter(index => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;

  const start = Math.max(0, firstMatch - 220);
  const end = Math.min(text.length, start + 900);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';

  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

function parseSearchArguments(argString: string): DocumentationSearchArguments {
  try {
    const parsed = JSON.parse(argString) as Partial<DocumentationSearchArguments>;
    if (typeof parsed.query === 'string') {
      return {
        query: parsed.query,
        maxResults: typeof parsed.maxResults === 'number'
          ? parsed.maxResults
          : undefined
      };
    }
  } catch {
    // Fall back to treating the raw argument as the query.
  }

  return { query: argString };
}

function formatDocumentationSearchResults(
  results: readonly DocumentationSearchResult[]
): string {
  if (results.length === 0) {
    return 'No matching bundled documentation excerpts were found.';
  }

  return results.map((result, index) =>
    `${index + 1}. ${result.documentLabel} (${result.documentPath})` +
    ` - ${result.heading}\n${result.excerpt}`
  ).join('\n\n');
}
