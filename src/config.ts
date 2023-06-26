import * as vscode from "vscode";
import * as path from "path";
import * as json5 from "json5";

type CommentConfig = {
  lineComment?: string | string[]; // e.g. "//" or "#"
  blockComment?: [string, string]; // [start, end] e.g. "/*" and "*/"
};

type PackageJSON = {
  contributes?: {
    languages?: [
      {
        id: string;
        configuration?: string;
      }
    ];
  };
};

export class Config {
  private readonly languageFilePaths = new Map<string, string>();
  private readonly commentConfig = new Map<string, CommentConfig>();

  public constructor() {
    this.updateLanguageFilePaths();
  }

  public updateLanguageFilePaths() {
    for (let extension of vscode.extensions.all) {
      const json: PackageJSON = extension.packageJSON;
      for (const { id, configuration } of json.contributes?.languages || []) {
        if (configuration) {
          const configPath = path.join(extension.extensionPath, configuration);
          this.languageFilePaths.set(id, configPath);
        }
      }
    }
  }

  public async getCommentConfig(languageCode: string) {
    const existingConfig = this.commentConfig.get(languageCode);
    if (existingConfig) {
      return existingConfig;
    }
    const languageFilePath = this.languageFilePaths.get(languageCode);
    if (!languageFilePath) {
      return null;
    }
    try {
      const rawContent = await vscode.workspace.fs.readFile(
        vscode.Uri.file(languageFilePath)
      );
      const content = new TextDecoder().decode(rawContent);
      const config: { comments: CommentConfig } = json5.parse(content);
      this.commentConfig.set(languageCode, config.comments);
      return config.comments;
    } catch (error) {
      this.commentConfig.delete(languageCode);
      return null;
    }
  }
}
