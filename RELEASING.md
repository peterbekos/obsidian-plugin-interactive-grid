# Release checklist

## Prepare the build

Run `npm ci`, `npm run package`, and `npm audit --omit=dev`. Run the desktop smoke test below. Touch controls still need verification on a physical iOS or Android device.

## Put the source on GitHub

1. Create a public repository named `obsidian-plugin-interactive-grid` under your account. Leave the README, license, and gitignore options unselected so the remote starts empty. [GitHub repository setup](https://github.com/new)
2. From the local repository, replace `YOUR-USERNAME` and run:

   ```sh
   git remote add origin https://github.com/YOUR-USERNAME/obsidian-plugin-interactive-grid.git
   git push -u origin main
   ```

   Public Git history includes the email recorded on existing commits. Check `git log --format='%ae' | sort -u` before the first push if you want to review it. [GitHub's guide to pushing local code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
3. Verify that GitHub renders the README screenshots and that the **Check** workflow passed in the **Actions** tab.

## Publish the GitHub release

1. Open **Releases → Draft a new release**. Create tag `1.1.0` targeting `main` and use **Interactive Grid 1.1.0** as the title. The tag must match `manifest.json` exactly.
2. Attach `main.js`, `manifest.json`, and `styles.css` individually from `dist/1.1.0/`. GitHub generates its own source archives.
3. Paste the [1.1.0 release notes](CHANGELOG.md#110) into the description, with the upgrade steps first.
4. Publish as a regular release. Check that all three files appear under **Assets**. [GitHub release guide](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release)

For an existing Community listing, publish the GitHub release and check its review in the directory dashboard. The submission steps below are for the initial listing.

## Submit to Obsidian

1. Sign into the [Obsidian Community directory](https://community.obsidian.md/) and connect GitHub in your Community profile.
2. Open **Plugins → New plugin**. Paste the public repository URL, choose yourself as owner, review the developer policies and maintenance commitment, then submit. [Obsidian submission guide](https://docs.obsidian.md/plugins/releasing/submit-plugin)
3. Review the automated results for the manifest, release assets, source, and build. Resolve errors before publishing the listing. Use **Edit listing** to add the desktop screenshots from `screenshots/` if you want them in the listing itself. [Listing management guide](https://docs.obsidian.md/community-directory/manage-entry)
4. Once the listing is live, install it from **Settings → Community plugins** in a fresh test vault. Future versions use new GitHub releases with matching manifest versions and tags.

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
