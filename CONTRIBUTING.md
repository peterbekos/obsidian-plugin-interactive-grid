# Contributing to Interactive Grid

Use GitHub Issues to report bugs or suggest changes. For a bug, include your Obsidian and plugin versions, platform, whether you were in Reading view or Live Preview, and steps to reproduce it. A small example grid with personal details removed helps.

To develop locally, run `npm ci` and `npm run demo`. Open `test-vault` as a separate Obsidian vault and enable Interactive Grid there. Re-run `npm run demo` after changes and reload the plugin in Obsidian.

Before opening a pull request, run `npm run check`. For changes to card interactions or note saving, also run the desktop smoke test in [RELEASING.md](RELEASING.md) and include what you tested in your pull request.
