// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Config } from "./config";
import { Parser } from "./parser";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const config = new Config();
  const parser = new Parser(config);

  const main = async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    const languageCode = activeEditor.document.languageId;
    await parser.splitSingleLineComments(activeEditor, languageCode);
    await parser.groupSingleLineComments(activeEditor, languageCode);
  };

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(
    vscode.commands.registerCommand("comment-wrapper.wrap", async () => {
      await main();
    })
  );

  vscode.extensions.onDidChange(
    () => {
      config.updateLanguageFilePaths();
    },
    null,
    context.subscriptions
  );

  // vscode.workspace.onDidSaveTextDocument(
  //   async (event) => {
  //     await main();
  //     await event.save();
  //   },
  //   null,
  //   context.subscriptions
  // );

  vscode.workspace.onDidChangeConfiguration(
    (e) => {
      parser.loadContributions();
    },
    null,
    context.subscriptions
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
