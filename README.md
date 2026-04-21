# Erdos AI Contribution Atlas

Standalone browser dashboard for the `AI-contributions-to-Erdos-problems` wiki page:

- Source wiki: <https://github.com/teorth/erdosproblems/wiki/AI-contributions-to-Erd%C5%91s-problems>
- Local dataset generator: `build-data.mjs`
- Browser entry point: `index.html`

## Refresh the dataset

```powershell
node build-data.mjs
```

That regenerates:

- `wiki-source.md`
- `app-data.js`

If `app-data.js` would be identical apart from `metadata.generatedAt`, the script preserves the
previous timestamp so automated refresh jobs do not create pointless commits.

## Scheduled refreshes

This repo includes [`.github/workflows/refresh-data.yml`](./.github/workflows/refresh-data.yml),
which runs:

- on manual dispatch
- on pushes to `master`
- once per hour at `HH:17 UTC`

The workflow:

- runs `node build-data.mjs`
- commits `wiki-source.md` and `app-data.js`
- skips the commit entirely when the wiki-derived output did not change
- avoids `uses:` marketplace actions, which is useful when the repo only allows actions
  from repositories you own

## Open the dashboard

Open `index.html` in any modern browser.

## Notes

- The app keeps every wiki row and builds an exhaustive release catalog over the AI-system names found in the wiki.
- Release entries are labeled as either `official` or `inferred`.
- Inferred dates come from the earliest positive wiki entry for that system name, or first appearance when no positive entry exists.
- Some release entries include both an initial announcement/preview date and a later broad-public date.
