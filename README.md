# BKalendar x Oxazite

Convert HCMUT myBK timetables and exam schedules into Google Calendar events or `.ics` files.
Paste a schedule directly. The app detects its type and opens another paste field for additional
pages or an exam schedule.

## Local development

Use Node.js 24 and pnpm 12. Run `pnpm install --frozen-lockfile`, then `pnpm dev`.
Use `pnpm run check`, `pnpm test`, `pnpm run lint`, and `pnpm run build` to verify changes.
Use `pnpm preview` to preview the static build.

## Deployment

Set the repository's GitHub Pages source to GitHub Actions. The workflow builds and deploys the
site on pushes to `main`. Google Calendar export uses the HCMUT OAuth client configured for this
edition. To use your own web client, set the `PUBLIC_GOOGLE_CLIENT_ID` build variable and authorize
the exact site origin in Google Cloud. For local OAuth, authorize the origin of your local dev or
preview server as well. The optional `PUBLIC_GOOGLE_API_KEY` variable supplies an API key.

The `.ics` downloads and individual exam links are available without authorizing the app.

The app and original parser code are derived from [BKalendar](https://github.com/bkalendar/bkalendar.github.io)
and [BKalendar Core](https://github.com/bkalendar/core), under their MIT licenses.
