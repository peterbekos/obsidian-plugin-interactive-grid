# Release checklist

1. Run `npm ci`, `npm run package`, and `npm audit --omit=dev`.
2. Run the desktop smoke test below. Check horizontal scrolling and keyboard controls, and try touch on a mobile device when available.
3. Push the source and commit history to the project’s GitHub repository. Create a GitHub release tagged exactly as the manifest version. For 1.0.0, attach `main.js`, `manifest.json`, and `styles.css` from `dist/1.0.0/`.
4. Sign into the Obsidian Community directory, connect the owner’s GitHub account, and submit the repository. Review the directory’s automated scan before publishing the listing. Follow the [Obsidian submission guide](https://docs.obsidian.md/plugins/releasing/submit-plugin).

## Desktop smoke test

On macOS, prepare an isolated profile and a disposable copy of the demo vault. Keep the original fixture notes intact. The remote debugging endpoint is for this local test only.

```sh
npm run demo
grid_test=$(mktemp -d /tmp/interactive-grid.XXXXXX)
cp -R test-vault "$grid_test/vault"
mkdir "$grid_test/profile"
printf '{"vaults":{"grid-demo":{"path":"%s/vault","ts":%s000,"open":true}}}\n' \
  "$grid_test" "$(date +%s)" > "$grid_test/profile/obsidian.json"
printf '{"livePreview":true}\n' > "$grid_test/vault/.obsidian/app.json"
open -na /Applications/Obsidian.app --args \
  --user-data-dir="$grid_test/profile" --remote-debugging-port=9431
```

After the test vault opens, run:

```sh
npm run test:obsidian -- http://localhost:9431 "$grid_test/vault"
```

The test edits both notes. Restore them from `test-vault` before rerunning. Close the isolated Obsidian window after testing.

## Questions for follow-up

- What are the confirmed Milwaukee times, locations, shuttle instructions, and checkout details?
- Should card details support Markdown formatting or links?
- Should undo survive reopening Obsidian or support a longer history?
