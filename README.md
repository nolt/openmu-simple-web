# openmu-simple-web

🇵🇱 [Wersja polska](README.pl.md)

This is a simple website for OpenMU.

The website has been created for my OpenMU server builder: https://github.com/nolt/openmu-docker  
It talks to the **website API of the OpenMU admin panel** on the same Docker network; it doesn't
connect to the database.

The website is multilanguage: English and Polish.

## Website allows:
- register new account
- change password
- server status and online players
- server TOP 10
- event countdowns (BC/DS/CC etc.), optionally with the full timetable
- armory (character equipment viewer): the class picture of the character and item tooltips like in the game
  (stats, requirements, options, ancient set bonuses, sockets); the class renders, item pictures and the
  item data in `wwwroot/data` come from the MU Online game client (MuMain, Season 6)
- chat commands reference

## How it works

Two containers from official images, nothing is built:

- **nginx** serves the files of `wwwroot/` (pages' scripts, styles, pictures) and passes the rest to PHP,
- **PHP-FPM** renders the pages and answers the page scripts; the data comes from the OpenMU website
  API (`/api/website/...`), with a short cache, so visitors don't put load on the game server.

The code is mounted from this folder, so an update is `git pull` - no rebuild, no restart.
Your own texts and settings live in `config/site.local.php`, which an update never touches.

## Requirements
- Docker with Docker Compose
- OpenMU with the website API (master from November 2026 on) on the Docker network `openmu-network`

## Installation

```bash
git clone https://github.com/nolt/openmu-simple-web.git
cd openmu-simple-web
cp .env.example .env                                  # then fill it in, see below
cp config/site.local.example.php config/site.local.php   # optional: your texts and links
docker compose up -d
```

The site listens on `WEB_PORT` (default 8088).

## The OpenMU API key

The site needs an API key with the role **Website (selected functions only)** (`WebManager`):

1. In the admin panel open **API keys** and create a key (e.g. `website`) with that role.
2. Under **Website functions** tick: **Server status**, **Register accounts**, **Character ranking**,
   **Event schedule**, **Character profiles (equipped items)** and **Change account passwords**.
   A function which isn't ticked answers `403`; the site then shows the server as offline or the
   page as unavailable, and writes the reason to its log (`docker logs openmu-website-php`).
3. Copy the key - it is shown only once - into `.env` as `OPENMU_API_KEY=...` and run
   `docker compose up -d`.

`OPENMU_API_URL` is the admin panel as seen from the site's container, by default
`http://openmu-server:8080`. The key stays on the server; it never reaches the browser.

## Your settings and texts (`config/site.local.php`)

`config/site.php` holds the defaults: the site name, languages, home page texts, server details,
download links. Don't edit it - an update replaces it. Put what you change into
`config/site.local.php` (start from `config/site.local.example.php`):

```php
<?php
return [
    'siteName' => 'MyMU',
    'defaultLanguage' => 'pl',
    'content' => [
        'pl' => ['welcomeTitle' => 'Witaj na MyMU'],
    ],
];
```

- Only the keys you change are needed; the rest comes from `config/site.php`, so new settings of
  an update show up with their default value.
- Lists (`downloads`, `rows`, `timetable`...) replace the default list as a whole - copy the whole list.
- A change is visible after reloading the page.

### Download links

```php
'downloads' => [
    ['id' => 'launcher', 'icon' => '🚀', 'name' => 'Launcher', 'url' => 'https://...', 'recommended' => true],
    ['id' => 'android', 'icon' => '📱', 'name' => 'Android', 'url' => '#', 'soon' => true],
    ['id' => 'linux', 'icon' => '🐧', 'name' => 'Linux', 'url' => 'https://...'],
    ['id' => 'windows', 'icon' => '🪟', 'name' => 'Windows', 'url' => 'https://...'],
],
```

- `url` - the download link. **The shipped values are `#` placeholders - set your own.**
- `recommended` - highlights the entry (e.g. the auto-updating launcher).
- `soon` - shows it as an upcoming, non-clickable target.

The Discord link in the home page details (`url` of the `Discord` entry in `content`, one per
language) is a `#` placeholder as well - put your server's invite there.

### Event timetable

The OpenMU API tells the next start of each active event, so every event shows its countdown and
start time. To show the full timetable, the duration and the experience multiplier as well, add
them to the `events` section, by the name shown on the page:

```php
'events' => [
    'Blood Castle' => ['timetable' => ['00:00', '02:00', '04:00'], 'durationMinutes' => 15],
    'Happy Hour' => ['timetable' => ['20:00'], 'durationMinutes' => 60, 'experienceMultiplier' => 1.5],
    // weekly events: the day of each start, 0 = Sunday
    'Crywolf' => ['timetable' => ['20:00', '20:00'], 'days' => [3, 6], 'durationMinutes' => 30],
],
```

You don't have to type it: `tools/events-timetable.sql` prints this section from the OpenMU
database (read only), ready to paste:

```bash
docker exec -i openmu-postgres psql -U postgres -d openmu -At < tools/events-timetable.sql
```

These are copies of the game server configuration: when you change a schedule in the admin panel,
run it again. The countdown of the daily events always comes from the server. Crywolf and Castle
Siege have their own schedules, which the API doesn't list - they appear on the page only with an
entry here, and their next start is worked out from it.

The times are shown in the time zone `TIMEZ` from `.env` (e.g. `Europe/Warsaw`). Set it to the time
zone of the game server (admin panel, system configuration), the one the timetable is written in.

## Adding a new language

1. **Create a translation file**
   - Copy `wwwroot/template_lang.js` (an empty skeleton with every key) - or the already-translated
     `wwwroot/en.js` - to your language code, e.g. `de.js` for German.
   - Change the object key on line 2 (`window.muTranslations.xx`) to your code, e.g. `.de`.
   - Fill in every value with your translation.

2. **Add it to `languages`** in `config/site.local.php`, e.g. `'languages' => ['en', 'pl', 'de']`.
   Every page loads the listed languages; the switch buttons follow this order.

3. **Home page texts (optional)** - add a `de` section to `content`. Without it the home page uses
   the texts of the default language.

4. **Armory item tooltip (optional)** - copy `wwwroot/js/item-texts.pl.js` to `item-texts.de.js`,
   change `window.muItemTexts.pl` to `.de`, translate the values (the keys are the English texts) and
   add it to the scripts in `app/views/pages/armory.php`. Without it the tooltip stays in English.

The button label is the uppercased code (e.g. `DE`); for a nicer label add an entry to the `LABELS`
map in `wwwroot/lang.js`. To start in another language, set `defaultLanguage`.

## Updating

```bash
git pull
```

That's all: nginx and PHP read the files from this folder, so the new version is live right away.
Run `docker compose up -d` only when `docker-compose.yaml` or `.env` changed.
After an update, visitors may need to reload a page once (Ctrl+F5) to get the new scripts.

## Behind a reverse proxy (HAProxy, nginx…)

Registration (1 account per 24h per IP), password change and the request limits work per
visitor IP. Behind a proxy the site sees only the proxy's address, so all visitors share
one limit. To fix it:

1. Let the proxy send the visitor IP: HAProxy `option forwardfor` in the backend
   (`mode http`), nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.
2. Put the address the proxy connects from into `.env` as `TRUSTED_PROXIES=...`
   (comma separated IPs or CIDR). For a proxy on the Docker host that is the gateway of the
   site's Docker network: `docker inspect openmu-website -f '{{range .NetworkSettings.Networks}}{{.Gateway}} {{end}}'`.
3. Run `docker compose up -d`.

Only the listed proxies are trusted, so visitors can't get around the limits with a forged header.

## Migrating from the C# version

Up to version 1 the site was an ASP.NET application reading the database. That version stays
available on the branch `csharp` (tag `v1-csharp`). To move to this version:

1. Create the API key as described above and note it.
2. Save your texts: the old `wwwroot/content.js` becomes `config/site.local.php` - copy your
   welcome texts, server details, `maxResets` and download links into it (same names, PHP syntax).
3. Stop the old site: `docker compose down`, then `git pull` (if git refuses because of your
   changed `content.js`, `git stash` first - your old file stays in the stash). Make sure
   `wwwroot/content.js` is gone afterwards: a file there would be served instead of your settings.
   The event timetable doesn't need copying - `tools/events-timetable.sql` prints it.
4. Write the new `.env` from `.env.example`: `OPENMU_API_URL`, `OPENMU_API_KEY`; the `DB_*` and
   `SERVER_CHECK_*` settings are gone. `WEB_PORT`, `TRUSTED_PROXIES` and `TIMEZ` stay.
5. `docker compose up -d`. The old image `openmu-web:latest` can be removed: `docker image rm openmu-web:latest`.

What changed for the players:
- Registration no longer asks for a security code (the API doesn't take one). Such an account
  deletes characters in the game with the account password.
- The ranking is the server's: ordered by resets, master level, level; bots and game masters aren't listed.
- The password change refuses while the account is in the game or offline leveling, and the server
  locks an account for 15 minutes after 5 wrong passwords.

---
Example:
![Website](assets/example.webp)
---
More info about OpenMU project you will find here:
https://github.com/MUnique/OpenMU

## License
[MIT](LICENSE)

Original author: [Nolt](https://github.com/nolt).
