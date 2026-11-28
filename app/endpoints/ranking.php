<?php
/**
 * GET /api/public/ranking -> top 10 characters [{name, className, level, resets, masterLevel, guildName}]
 *
 * From the API's /ranking (permission "Ranking"). The order is the server's: resets, master level,
 * level. Bots and game masters are left out by the server.
 */

declare(strict_types=1);

use SimpleWeb\ClientIp;
use SimpleWeb\Http;
use SimpleWeb\OpenMuApi;
use SimpleWeb\RateLimiter;

if (!RateLimiter::hit('ranking', ClientIp::get(), 30, 60)) {
    Http::error(429, 'RATE_LIMIT_RANKING', 'Too many requests. Try again later.');
}

$ranking = OpenMuApi::cachedGet('/ranking?count=10', 60);
if (!is_array($ranking)) {
    Http::error(500, 'DATABASE_ERROR', 'The ranking is not available.');
}

Http::json(200, array_map(static fn (array $entry): array => [
    'name' => (string)($entry['name'] ?? ''),
    'className' => (string)($entry['className'] ?? ''),
    'level' => (int)($entry['level'] ?? 1),
    'resets' => (int)($entry['resets'] ?? 0),
    'masterLevel' => (int)($entry['masterLevel'] ?? 0),
    'guildName' => $entry['guildName'] ?? null,
], array_values(array_filter($ranking, 'is_array'))));
