<?php
/**
 * GET /api/public/armory/{name} -> {name, className, level, resets, masterLevel, guildName, items: [...]}
 *
 * From the API's /characters/{name} (permission "Character"). The items keep the API's shape, which
 * the item tooltip (wwwroot/js/item-tooltip.js) reads as it is. The server shows the saved state,
 * and hides bots and game masters (404).
 */

declare(strict_types=1);

use SimpleWeb\ClientIp;
use SimpleWeb\Http;
use SimpleWeb\OpenMuApi;
use SimpleWeb\RateLimiter;

/** @var string $characterName set by the front controller, already URL-decoded */

if (!RateLimiter::hit('armory', ClientIp::get(), 30, 60)) {
    Http::error(429, 'RATE_LIMIT_ARMORY', 'Too many requests. Try again later.');
}

// Character names are at most 10 printable ASCII characters; anything else can't exist.
$name = trim($characterName);
if (!preg_match('/^[\x21-\x7E]{1,10}$/', $name)) {
    Http::error(404, 'ARMORY_NOT_FOUND', 'Character not found.');
}

$character = OpenMuApi::cachedGet('/characters/' . rawurlencode($name), 30);
if ($character === false) {
    Http::error(404, 'ARMORY_NOT_FOUND', 'Character not found.');
}

if (!is_array($character)) {
    Http::error(500, 'DATABASE_ERROR', 'The armory is not available.');
}

Http::json(200, [
    'name' => (string)($character['name'] ?? $name),
    'className' => (string)($character['className'] ?? ''),
    'level' => (int)($character['level'] ?? 1),
    'resets' => (int)($character['resets'] ?? 0),
    'masterLevel' => (int)($character['masterLevel'] ?? 0),
    'guildName' => $character['guildName'] ?? null,
    'items' => array_values(array_filter((array)($character['equippedItems'] ?? []), 'is_array')),
]);
