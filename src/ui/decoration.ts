/**
 * Helps to manage decorations for the TOML files.
 */
import {
  window,
  DecorationOptions,
  Range,
  TextEditor,
  MarkdownString,
} from "vscode";

import {
  diff as semverDiff,
  maxSatisfying as semverMaxSatisfying,
  validRange as semverValidRange,
  parse as semverParse
} from "semver";
import Item from "../core/Item";
import { status, ReplaceItem } from "../toml/commands";

export const latestVersion = (text: string) =>
  window.createTextEditorDecorationType({
    after: {
      margin: "2em",
    },
  });

/**
 * Create a decoration for the given crate.
 * @param editor
 * @param crate
 * @param version
 * @param versions
 */
export default function decoration(
  editor: TextEditor,
  item: Item,
  versions: string[],
  compatibleDecorator: string,
  incompatibleDecorator: string,
  errorDecorator: string,
  error?: string,
): DecorationOptions {
  // Also handle json valued dependencies

  const start = item.start;
  const endofline = editor.document.lineAt(editor.document.positionAt(item.end)).range.end;
  const decoPosition = editor.document.offsetAt(endofline);
  const end = item.end;

  if (item.value === undefined) throw new Error("The version needs to be specified for the dependency");
  const itemValue = item.value.trim();

  const latestVersion = semverParse(versions[0]);
  if (latestVersion === null) throw new Error("Parsing the SemVer of the latest release failed.");


  // Cargo treats plain versions the same way as with caret, see:
  // https://doc.rust-lang.org/cargo/reference/resolver.html#semver-compatibility
  // So we test if the version is a plain one, and if so add a ^ before it, otherwise just use it's value
  let currVersionRange = (/\d+(.\d+){0,2}/.test(itemValue[0]) ? "^" : "") + itemValue;

  // Validating the range.
  currVersionRange = semverValidRange(currVersionRange);

  if (currVersionRange === null) throw new Error("Could not parse semver of dependency");

  // How big is the semver difference between the latest version & current range supported.
  let semDiff = null;

  // Get the max possible version from the versions. (Simplifying, cargo actually matches ranges with other deps)
  const maxCurrVersion = semverMaxSatisfying(versions, currVersionRange);

  if (maxCurrVersion !== null) {
    semDiff = semverDiff(latestVersion, maxCurrVersion)
  } // If there are no supported versions for current semver
  else semDiff = "major";

  const hoverMessage = error ? new MarkdownString(`**${error}**`) : new MarkdownString(`#### Versions`);
  hoverMessage.appendMarkdown(` _( [Check Reviews](https://web.crev.dev/rust-reviews/crate/${item.key.replace(/"/g, "")}) )_`);
  hoverMessage.isTrusted = true;

  if (versions.length > 0) {
    status.replaceItems.push({
      item: `"${versions[0]}"`,
      start,
      end,
    });
  }

  for (let i = 0; i < versions.length; i++) {
    const version = versions[i];
    const replaceData: ReplaceItem = {
      item: `"${version}"`,
      start,
      end,
    };
    const isCurrent = version === currVersionRange;
    const encoded = encodeURI(JSON.stringify(replaceData));
    const docs = (i === 0 || isCurrent) ? `[(docs)](https://docs.rs/crate/${item.key}/${version})` : "";
    const command = `${isCurrent ? "**" : ""}[${version}](command:crates.replaceVersion?${encoded})${docs}${isCurrent ? "**" : ""}`;
    hoverMessage.appendMarkdown("\n * ");
    hoverMessage.appendMarkdown(command);
  }

  let latestText = compatibleDecorator.replace("${version}", "");
  if (semDiff === "patch") {
    latestText = compatibleDecorator.replace("${version}", versions[0]);
  } else if (semDiff === "minor") {
    latestText = incompatibleDecorator.replace("${version}", versions[0]);

  } else if (semDiff === "major") {
    latestText = incompatibleDecorator.replace("${version}", versions[0]);

  }
  const contentText = error ? errorDecorator : latestText;

  const deco = {
    range: new Range(
      editor.document.positionAt(start),
      editor.document.positionAt(decoPosition),
    ),
    hoverMessage,
    renderOptions: {
      after: {},
    },
  };
  if (contentText.length > 0) {
    deco.renderOptions.after = { contentText };
  }
  return deco;
}
