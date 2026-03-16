export interface LlmsTxtParsed {
  title: string;
  description: string;
  sections: LlmsTxtSection[];
  urls: string[];
}

export interface LlmsTxtSection {
  heading: string;
  content: string;
  urls: string[];
  keywords: string[];
}

/**
 * Extract all URLs from text content.
 * Matches [text](url) markdown links and bare https:// URLs.
 */
function extractUrls(text: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // Match markdown links: [text](url)
  const mdLinkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdLinkRe.exec(text)) !== null) {
    const url = match[2].trim();
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  // Match bare https:// URLs (not already captured inside markdown links)
  const bareUrlRe = /(?<!\]\()https?:\/\/[^\s)>\]]+/g;
  while ((match = bareUrlRe.exec(text)) !== null) {
    const url = match[0].trim();
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

/**
 * Extract keywords from text content for schema inference.
 * Splits on whitespace and punctuation, lowercases, deduplicates.
 */
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/[\s,.:;!?()[\]{}"'`\-_/\\|#@&*+=<>~^]+/);
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const word of words) {
    const trimmed = word.trim();
    if (trimmed.length > 1 && !seen.has(trimmed)) {
      seen.add(trimmed);
      keywords.push(trimmed);
    }
  }
  return keywords;
}

/**
 * Parse an llms.txt file into a structured representation.
 *
 * The llms.txt format is markdown-like:
 *   # heading       -> title
 *   > blockquote    -> description
 *   ## heading      -> section start
 *   content lines   -> section content (with URL and keyword extraction)
 */
export function parseLlmsTxt(content: string): LlmsTxtParsed {
  const lines = content.split('\n');

  let title = '';
  let description = '';
  const sections: LlmsTxtSection[] = [];
  const allUrls: string[] = [];
  const seenUrls = new Set<string>();

  let currentSection: LlmsTxtSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // # Title (h1)
    if (/^#\s+/.test(trimmed) && !/^##/.test(trimmed)) {
      title = trimmed.replace(/^#\s+/, '').trim();
      continue;
    }

    // > Description (blockquote)
    if (/^>\s+/.test(trimmed) && !description) {
      description = trimmed.replace(/^>\s+/, '').trim();
      continue;
    }

    // ## Section heading
    if (/^##\s+/.test(trimmed)) {
      // Save the previous section
      if (currentSection) {
        currentSection.content = currentSection.content.trim();
        currentSection.urls = extractUrls(currentSection.content);
        currentSection.keywords = extractKeywords(currentSection.heading + ' ' + currentSection.content);
        sections.push(currentSection);

        for (const url of currentSection.urls) {
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            allUrls.push(url);
          }
        }
      }

      currentSection = {
        heading: trimmed.replace(/^##\s+/, '').trim(),
        content: '',
        urls: [],
        keywords: [],
      };
      continue;
    }

    // Content lines go into the current section
    if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  // Finalize last section
  if (currentSection) {
    currentSection.content = currentSection.content.trim();
    currentSection.urls = extractUrls(currentSection.content);
    currentSection.keywords = extractKeywords(currentSection.heading + ' ' + currentSection.content);
    sections.push(currentSection);

    for (const url of currentSection.urls) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allUrls.push(url);
      }
    }
  }

  return { title, description, sections, urls: allUrls };
}
