"use strict";
/**
 * This extension helps to manage crate dependency versions.
 */
import {
  window,
  workspace,
  ExtensionContext,
  TextDocumentChangeEvent,
} from "vscode";
import tomlListener from "./core/listener";
import TomlCommands from "./toml/commands";

export function activate(context: ExtensionContext) {
  // Add active text editor listener and run once on start.
  context.subscriptions.push(window.onDidChangeActiveTextEditor(tomlListener));

  context.subscriptions.push(
    workspace.onDidChangeTextDocument((e:TextDocumentChangeEvent) => {
      const { fileName } = e.document;
      if (!e.document.isDirty && fileName.toLocaleLowerCase().endsWith("cargo.toml")) {
        tomlListener(window.activeTextEditor);
      }
    }),
  );

  tomlListener(window.activeTextEditor);

  // Add commands
  context.subscriptions.push(TomlCommands.replaceVersion);
}

export function deactivate() {}
