export interface Config {
  dataSourceUrl: string;
  searchMode: 'database' | 'workspace';
  model: string;
  anthropicApiKey?: string;
}

export interface PageContent {
  title: string;
  url: string;  // full page URL from notion-fetch response
  text: string; // Notion-flavored Markdown, wrapped in <page> XML tag
}

export interface SearchHit {
  id: string;
  title: string;
  url: string;      // UUID without dashes — format as https://www.notion.so/{url} for mention-page links
  highlight: string;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  content: string;
}
