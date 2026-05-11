# openmu-simple-web
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

## Requirements
- Docker
- Docker Compose

## Building
- clone this repository
- replace values in .env to your own
- build

Build your service:

```docker compose up -d --build```

## Adding a new language

1. **Create a translation file**
   - Copy `wwwroot/template_lang.js` and rename it to your language code, e.g. `de.js` for German.
   - Replace `XX` on line 2 with your language code, e.g. `de`.
   - Fill in all empty strings with your translations.

2. **Add the script to each HTML file**
   In each of these 5 files, add a `<script>` tag for your new language AFTER `en.js` and BEFORE `pl.js`:
   - `wwwroot/index.html`
   - `wwwroot/register.html`
   - `wwwroot/changepass.html`
   - `wwwroot/stats.html`
   - `wwwroot/events.html`

   Example (for German, `de.js`):
   ```html
   <script src="en.js"></script>
   <script src="de.js"></script>
   <script src="pl.js"></script>
   ```

3. **Update content.js (optional)**
   If you also want the homepage text and server info translated, add your language section to the `window.muContent` object in `wwwroot/content.js`, following the same pattern as `en` and `pl`.

4. **Done**
   The language switcher in the top-right corner automatically picks up all languages that exist in `window.muTranslations`. No other changes needed.

---
Example:
![Website](assets/example.webp)
---
More info about OpenMU project you will find here:
https://github.com/MUnique/OpenMU

