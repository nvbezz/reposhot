export interface ReposhotConfig {
  rootDir: string;
  output: string;
  include: string[];
  ignore: string[];
  respectGitignore: boolean;
  showLineNumbers: boolean;
  removeComments: boolean;
}

export interface PackResult {
  outputPath: string;
  fileCount: number;
  totalChars: number;
  totalTokens: number;
  skippedCount: number;
  durationMs: number;
}

export interface PackedFile {
  path: string;
  relPath: string;
  content: string;
}
