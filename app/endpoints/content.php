<?php
/**
 * GET /content.js -> window.muConfig and window.muContent for the pages, built from the site config.
 *
 * Replaces the former static wwwroot/content.js, so the texts live in config/site.local.php and an
 * update of the site never overwrites them. Not cached by the browser, so a change shows on reload.
 */

declare(strict_types=1);

use SimpleWeb\Config;

$site = Config::site();
$content = (array)($site['content'] ?? []);

// Every language of the switch needs a home page text; a missing one takes the default language's
// (or the first one), instead of breaking the home page.
$fallback = $content[$site['defaultLanguage'] ?? ''] ?? (reset($content) ?: ['welcomeTitle' => '', 'welcomeText' => '', 'rows' => []]);
foreach ((array)($site['languages'] ?? []) as $language) {
    $content[$language] ??= $fallback;
}

// JSON_HEX_TAG keeps a "</script>" inside a text from ending the script early.
$flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_THROW_ON_ERROR;
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache');
echo "// Generated from config/site.php and config/site.local.php - edit those, not this output.\n";
echo 'window.muConfig = ' . json_encode([
    'maxResets' => (int)($site['maxResets'] ?? 0),
    'downloads' => array_values((array)($site['downloads'] ?? [])),
], $flags) . ";\n";
echo 'window.muContent = ' . json_encode((object)$content, $flags) . ";\n";
