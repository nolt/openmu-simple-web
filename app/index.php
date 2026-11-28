<?php
/**
 * Front controller: every request nginx doesn't find as a file in wwwroot/ ends up here.
 *
 * Routes the pages (rendered with views/layout.php), /content.js and the JSON endpoints the page
 * scripts call; the endpoints get their data from the OpenMU website API (lib/OpenMuApi.php).
 */

declare(strict_types=1);

namespace SimpleWeb;

foreach (['Config', 'Http', 'ClientIp', 'Store', 'RateLimiter', 'OpenMuApi'] as $class) {
    require __DIR__ . '/lib/' . $class . '.php';
}

// Times are shown in the server time zone, given by the TZ variable of the container (TIMEZ in .env).
$zone = Config::env('TZ', 'UTC');
date_default_timezone_set(in_array($zone, \DateTimeZone::listIdentifiers(), true) ? $zone : 'UTC');

// Old cache and limit records are removed now and then, instead of by a separate job.
// The longest window is the 24 hours of the registration limit.
if (random_int(1, 100) === 1) {
    Store::cleanUp(25 * 3600);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
if ($path !== '/') {
    $path = rtrim($path, '/');
}

if ($method === 'GET' || $method === 'HEAD') {
    // Every view in views/pages/ is a page: "/" is index.php, "/stats" is stats.php, and so on.
    // A new page is just a new file there (plus a link in the "nav" setting).
    $view = $path === '/' ? 'index' : substr($path, 1);
    if (preg_match('/^[a-z][a-z0-9-]*$/', $view) && $path !== '/index' && is_file(__DIR__ . '/views/pages/' . $view . '.php')) {
        $page = [];
        $route = $path;
        ob_start();
        require __DIR__ . '/views/pages/' . $view . '.php';
        $body = ob_get_clean();
        header('Content-Type: text/html; charset=utf-8');
        require __DIR__ . '/views/layout.php';
        exit;
    }

    switch ($path) {
        case '/content.js':
            require __DIR__ . '/endpoints/content.php';
            exit;
        case '/api/public/server-status':
            $statusField = 'online';
            require __DIR__ . '/endpoints/status.php';
            exit;
        case '/api/public/online-players':
            $statusField = 'players';
            require __DIR__ . '/endpoints/status.php';
            exit;
        case '/api/public/ranking':
            require __DIR__ . '/endpoints/ranking.php';
            exit;
        case '/api/public/events':
            require __DIR__ . '/endpoints/events.php';
            exit;
    }

    if (preg_match('#^/api/public/armory/([^/]+)$#', $path, $match)) {
        $characterName = rawurldecode($match[1]);
        require __DIR__ . '/endpoints/armory.php';
        exit;
    }
}

if ($method === 'POST' && $path === '/api/register') {
    require __DIR__ . '/endpoints/register.php';
    exit;
}

if ($method === 'POST' && $path === '/api/change-password') {
    require __DIR__ . '/endpoints/password.php';
    exit;
}

if (str_starts_with($path, '/api/')) {
    Http::error(404, 'NOT_FOUND', 'Not found.');
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "Not found.\n";
