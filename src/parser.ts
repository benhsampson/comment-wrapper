import * as vscode from "vscode";
import { Config } from "./config";

type CommentFormat = {
  // if undefined, then don't highlight line comments
  lineCommentStart?: string;
  // if undefined, then don't highlight multiline comments
  blockComment?: {
    start: string;
    end: string;
  };
};

type Contributions = {
  lineWidth: number;
};

const escapeRegex = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export class Parser {
  private config: Config;

  private vsContributions =
    vscode.workspace.getConfiguration("comment-wrapper");
  private contributions: Contributions = this.getContributions();

  private commentFormats = new Map<string, CommentFormat>();

  public constructor(config: Config) {
    this.config = config;
  }

  private getContributions(): Contributions {
    return {
      lineWidth: this.vsContributions.get("line_width")!,
    };
  }

  public loadContributions() {
    this.contributions = this.getContributions();
  }

  private async getCommentFormat(
    languageCode: string
  ): Promise<CommentFormat | null> {
    const existingCommentFormat = this.commentFormats.get(languageCode);
    if (existingCommentFormat) {
      return existingCommentFormat;
    }
    const config = await this.config.getCommentConfig(languageCode);
    if (!config) {
      return null;
    }
    let lineCommentStart;
    if (config.lineComment) {
      if (typeof config.lineComment === "string") {
        lineCommentStart = escapeRegex(config.lineComment);
      } else if (config.lineComment.length > 0) {
        lineCommentStart = config.lineComment
          .map((d) => escapeRegex(d))
          .join("|");
      }
    }
    let blockComment: CommentFormat["blockComment"];
    if (config.blockComment) {
      blockComment = {
        start: escapeRegex(config.blockComment[0]),
        end: escapeRegex(config.blockComment[1]),
      };
    }
    const commentFormat = { lineCommentStart, blockComment };
    this.commentFormats.set(languageCode, commentFormat);
    return commentFormat;
  }

  public async splitSingleLineComments(
    activeEditor: vscode.TextEditor,
    languageCode: string
  ) {
    const { document } = activeEditor;
    const commentFormat = await this.getCommentFormat(languageCode);
    if (!commentFormat?.lineCommentStart) {
      return;
    }
    const regex = new RegExp(`^${commentFormat.lineCommentStart}.*`, "g");
    let { lineCount } = document;
    for (let i = 0; i < lineCount; i++) {
      const line = document.lineAt(i);
      const match = line.text.match(regex);
      if (match) {
        const words = match[0].split(" ");
        if (words.length <= 2) {
          continue;
        }
        let lineSize = words[0].length + 1 + words[1].length;
        let split: { lhs: string; rhs: string } | undefined;
        for (let j = 2; j < words.length; j++) {
          lineSize += 1 + words[j].length;
          if (lineSize > this.contributions.lineWidth) {
            split = {
              lhs: words.slice(0, j).join(" "),
              rhs: words.slice(j).join(" "),
            };
            break;
          }
        }
        if (split) {
          await activeEditor.edit((editBuilder) => {
            editBuilder.replace(line.range, split!.lhs);
            editBuilder.insert(
              line.range.end,
              `\n${commentFormat.lineCommentStart} ${split!.rhs}`
            );
          });
          lineCount++;
        }
      }
    }
  }

  public async groupSingleLineComments(
    activeEditor: vscode.TextEditor,
    languageCode: string
  ) {
    const { document } = activeEditor;
    const commentFormat = await this.getCommentFormat(languageCode);
    if (!commentFormat?.lineCommentStart) {
      return;
    }
    const regex = new RegExp(`^${commentFormat.lineCommentStart}.*`, "g");
    let { lineCount } = document,
      previousLine = null;
    for (let i = 0; i < lineCount; i++) {
      const line = document.lineAt(i);
      const match = line.text.match(regex);
      if (match) {
        const words = match[0].split(" ").filter((w) => w);
        let split: { lhs: string; rhs?: string } | undefined;
        for (let j = 2; j <= words.length; j++) {
          if (previousLine) {
            let prevLineText = previousLine.text;
            let lhs = `${prevLineText
              .split(" ")
              .filter((w) => w)
              .concat(words.slice(1, j))
              .join(" ")}`;
            if (lhs.length <= this.contributions.lineWidth) {
              const rhs =
                j < words.length
                  ? `${commentFormat.lineCommentStart} ${words
                      .slice(j)
                      .join(" ")}`
                  : undefined;
              split = { lhs, rhs };
            }
          }
        }
        if (split) {
          await activeEditor.edit((editBuilder) => {
            editBuilder.replace(previousLine!.range, split!.lhs);
            if (split!.rhs) {
              editBuilder.replace(line.range, split!.rhs);
            } else {
              editBuilder.delete(line.rangeIncludingLineBreak);
              lineCount--;
              i--;
            }
          });
        }
        previousLine = document.lineAt(i);
      } else {
        previousLine = null;
      }
    }
  }
}
