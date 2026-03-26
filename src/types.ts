export interface Config {
  dataSourceUrl: string;
  searchMode: 'database' | 'workspace';
  model: string;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  content: string;
}
