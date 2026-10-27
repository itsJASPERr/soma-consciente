import MarkdownIt from 'markdown-it';

/** Markdown to escaped HTML. Raw HTML is disabled for public CMS content. */
const engine = new MarkdownIt({ html: false, breaks: true, linkify: true, typographer: true });
export const renderLearningMarkdown = (source: string | undefined): string =>
  engine.render(source || '');
