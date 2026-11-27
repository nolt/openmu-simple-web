# openmu-simple-web

🇵🇱 [Wersja polska](README.pl.md)

This is simple website for OpenMU. 

Website has been created for mine OpenMU server builder: https://github.com/nolt/openmu-docker  
It connects to same docker network where database is.

Website is multilanguage English and Polish.

## Website allows:
- register new account
- change password
- server status
- server TOP 10
- event status info (BC/DS/CC etc.)
- armory (character equipment viewer): the class picture of the character and item tooltips like in the game
  (stats, requirements, options, ancient set bonuses, sockets); the class renders, item pictures and the
  item data in `wwwroot/data` come from the MU Online game client (MuMain, Season 6)
- chat commands reference

## Requirements
- Docker
- Docker Compose

## Building
- clone this repository
- replace values in .env to your own
- build

Build your service:

```docker compose up -d --build```

## Online players counter (OpenMU API key)

The online players counter reads `/api/status` from the OpenMU admin panel (port 8080).
OpenMU protects its API with API keys: as soon as the first admin account exists, requests
without a key get `401` and the counter disappears.

1. In the admin panel open **API keys**, create a key (e.g. `website`) with the role **Viewer**
   and copy it — it is shown only once.
2. Put it into `.env` as `SERVER_CHECK_API_KEY=...` and restart the site.

The key is sent server-side in the `X-Api-Key` header; it never reaches the browser.
Do this before creating the first admin, so the counter does not blink.

## Adding a new language

The pages share a single Razor layout (`Pages/Shared/_Layout.cshtml`), so adding a language
means editing **one config list** — no per-page changes (only the armory item tooltip has its own
text file, see step 4).

1. **Create a translation file**
   - Copy `wwwroot/template_lang.js` (an empty skeleton with every key) — or the
     already-translated `wwwroot/en.js` — to your language code, e.g. `de.js` for German.
   - Change the object key on line 2 (`window.muTranslations.xx`) to your code, e.g. `.de`.
   - Fill in every value with your translation.

2. **Register it in the site config**
   Add the code to the `Site:Languages` array in `appsettings.json` — the single place the
   language list lives. The shared layout emits the `<script>` tag for every listed language
   on every page automatically:
   ```json
   "Site": {
     "Languages": [ "en", "pl", "de" ],
     "DefaultLanguage": "en"
   }
   ```

3. **Update content.js (optional)**
   The homepage rates and welcome text come from `window.muContent` in `wwwroot/content.js`.
   Add your language section there, following the same pattern as `en` and `pl`.

4. **Translate the armory item tooltip (optional)**
   The tooltip texts have their own file: copy `wwwroot/js/item-texts.pl.js` to e.g.
   `item-texts.de.js`, change `window.muItemTexts.pl` to `.de`, translate the values (the keys are
   the English texts) and include it in `Pages/Armory.cshtml` next to the Polish one. Without it the
   tooltip stays in English.

5. **Done**
   `lang.js` builds the switch buttons automatically from every language found in
   `window.muTranslations` — no per-page button editing. The button label is the uppercased
   code (e.g. `DE`); for a nicer label add an entry to the `LABELS` map in `wwwroot/lang.js`.

To start the site in another language by default, set `Site:DefaultLanguage` (e.g. `"de"`) in
`appsettings.json`. That single value is handed to `lang.js`; no page edits.

## Setting the download links

The home page download menu is driven by `window.muConfig.downloads` in `wwwroot/content.js`.
Each entry is one target:

```js
downloads: [
    { id: "launcher", icon: "🚀", name: "Launcher", url: "https://...", recommended: true },
    { id: "android",  icon: "📱", name: "Android",  url: "#", soon: true },
    { id: "linux",    icon: "🐧", name: "Linux",    url: "https://..." },
    { id: "windows",  icon: "🪟", name: "Windows",  url: "https://..." },
],
```

- `url` — the download link. **The shipped values are `#` placeholders — set your own.**
- `recommended` — highlights the entry (e.g. the auto-updating launcher).
- `soon` — shows it as an upcoming, non-clickable target.

Add or remove a platform by editing this list — no markup changes. The generic labels
(Download / recommended / soon) come from the `dl*` keys in the language files.

The Discord link in the home page details (`url` of the `Discord` entries in `window.muContent`,
one per language) is a `#` placeholder as well — put your server's invite there.

---
Example:
![Website](assets/example.webp)
---
More info about OpenMU project you will find here:
https://github.com/MUnique/OpenMU

## Behind a reverse proxy (HAProxy, nginx…)

Registration (1 account per 24h per IP), password change and the API rate limits work per
visitor IP. Behind a proxy the site sees only the proxy's address, so all visitors share
one limit. To fix it:

1. Let the proxy send the visitor IP: HAProxy `option forwardfor` in the backend
   (`mode http`), nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.
2. Put the address the proxy connects from into `.env` as `TRUSTED_PROXIES=...`
   (comma separated IPs or CIDR). For a proxy on the Docker host that is the gateway of the
   site's Docker network: `docker inspect openmu-website -f '{{range .NetworkSettings.Networks}}{{.Gateway}} {{end}}'`.
3. Restart the site.

Only listed proxies are trusted, so visitors cannot fake the header to bypass the limits.

## License
[MIT](LICENSE)

Original author: [Nolt](https://github.com/nolt).
