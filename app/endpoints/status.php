<?php
/**
 * GET /api/public/server-status -> {"online": bool}
 * GET /api/public/online-players -> {"playerCount": int|null}
 *
 * Both come from one cached call of the API's /status (permission "Server status").
 * The server counts as online when at least one of its game servers is.
 */

declare(strict_types=1);

use SimpleWeb\Http;
use SimpleWeb\OpenMuApi;

/** @var string $statusField set by the front controller: "online" or "players" */

$status = OpenMuApi::cachedGet('/status', 15);
$servers = is_array($status) && is_array($status['servers'] ?? null) ? $status['servers'] : [];

if ($statusField === 'online') {
    $online = false;
    foreach ($servers as $server) {
        $online = $online || (is_array($server) && ($server['isOnline'] ?? false) === true);
    }

    Http::json(200, ['online' => $online]);
}

Http::json(200, ['playerCount' => is_array($status) && is_int($status['players'] ?? null) ? $status['players'] : null]);
