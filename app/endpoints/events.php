<?php
/**
 * GET /api/public/events -> the events of the events page
 *   [{name, nextRunUtc, countdownSeconds, nextRunLocal, timetable, durationMinutes, experienceMultiplier,
 *     [timetableDays, dayOfWeek]}]
 *
 * The next start of each event comes from the API's /events (permission "Events"); the timetable,
 * duration and experience multiplier come from the "events" section of the site config, when set.
 * An event running on several game servers is shown once, with its earliest start.
 * Times are shown in the server time zone (TZ of the container, set by TIMEZ in .env).
 */

declare(strict_types=1);

use SimpleWeb\ClientIp;
use SimpleWeb\Config;
use SimpleWeb\Http;
use SimpleWeb\OpenMuApi;
use SimpleWeb\RateLimiter;

/**
 * Names of the known event plugins by their id. The page picks the icon, colour and order by these
 * names, and the API's name of a plugin may change between OpenMU versions; the id doesn't.
 */
const EVENT_NAMES = [
    '548a76cc-242c-441c-bc9d-6c22745a2d72' => 'Red Dragon Invasion',
    '06d18a9e-2919-4c17-9dbc-6e4f7756495c' => 'Golden Invasion',
    '95e68c14-ad87-4b3c-af46-45b8f1c3bc2a' => 'Blood Castle',
    '3ad96a70-ed24-4979-80b8-169e461e548f' => 'Chaos Castle',
    '61c61a58-211e-4d6a-9ea1-d25e0c4a47c5' => 'Devil Square',
    '3ad96a70-ed24-4979-80b8-169e464e545f' => 'Illusion Temple',
    '6542e452-9780-45b8-85ae-4036422e9a6e' => 'Happy Hour',
    '4b5d0f55-5b26-4447-b9c0-c272e5d0a141' => 'White Wizard Invasion',
    'a8f3c2d1-9e74-4ecb-8963-08a3697278c4' => 'Kanturu Refinery Tower',
    '3e8b5c27-9d41-4a6f-b2c8-7f1d6e0a9b34' => 'Crywolf',
    'b7f62fa9-59e6-49e9-b499-0358a14957cf' => 'Castle Siege',
];

if (!RateLimiter::hit('events', ClientIp::get(), 30, 60)) {
    Http::error(429, 'RATE_LIMIT_RANKING', 'Too many requests. Try again later.');
}

$servers = OpenMuApi::cachedGet('/events', 30);
if (!is_array($servers)) {
    Http::error(500, 'DATABASE_ERROR', 'The events are not available.');
}

// The earliest start of each event over all game servers.
$next = [];
foreach ($servers as $server) {
    foreach ((array)($server['events'] ?? []) as $event) {
        if (!is_array($event) || !is_string($event['nextStartUtc'] ?? null)) {
            continue;
        }

        try {
            $start = new DateTimeImmutable($event['nextStartUtc']);
        } catch (Exception) {
            continue;
        }

        $id = strtolower((string)($event['id'] ?? ''));
        $name = EVENT_NAMES[$id] ?? (string)($event['name'] ?? $id);
        if (!isset($next[$name]) || $start < $next[$name]) {
            $next[$name] = $start;
        }
    }
}

$zone = new DateTimeZone(date_default_timezone_get());
$now = time();
$details = (array)(Config::site()['events'] ?? []);

// Crywolf and Castle Siege have their own schedules, which the API doesn't list. When the site config
// has their weekly timetable (times + days), the next start is worked out from it here.
foreach ($details as $name => $extra) {
    if (isset($next[$name]) || !is_array($extra)) {
        continue;
    }

    $start = next_weekly_start($extra, $zone, $now);
    if ($start !== null) {
        $next[$name] = $start;
    }
}

$result = [];
foreach ($next as $name => $start) {
    $local = $start->setTimezone($zone);
    $nextLocal = $local->format('H:i');
    $extra = is_array($details[$name] ?? null) ? $details[$name] : [];
    $timetable = array_values(array_filter((array)($extra['timetable'] ?? []), 'is_string'));
    $entry = [
        'name' => $name,
        'nextRunUtc' => $start->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'),
        'countdownSeconds' => max(0, $start->getTimestamp() - $now),
        'nextRunLocal' => $nextLocal,
        'timetable' => $timetable === [] ? [$nextLocal] : $timetable,
        'durationMinutes' => is_numeric($extra['durationMinutes'] ?? null) ? (int)$extra['durationMinutes'] : null,
        'experienceMultiplier' => is_numeric($extra['experienceMultiplier'] ?? null) ? (float)$extra['experienceMultiplier'] : null,
    ];

    // Weekly events: the day of each timetable entry, and the day of the next start to highlight it.
    $days = array_values(array_filter((array)($extra['days'] ?? []), 'is_int'));
    if ($timetable !== [] && count($days) === count($timetable)) {
        $entry['timetableDays'] = $days;
        $entry['dayOfWeek'] = (int)$local->format('w');
    }

    $result[] = $entry;
}

Http::json(200, $result);

/**
 * Next start of a weekly event from its configured 'timetable' (HH:MM) and 'days' (0 = Sunday),
 * in the server time zone; null when the entry has no valid weekly timetable.
 */
function next_weekly_start(array $extra, DateTimeZone $zone, int $now): ?DateTimeImmutable
{
    $times = (array)($extra['timetable'] ?? []);
    $days = (array)($extra['days'] ?? []);
    if ($times === [] || count($times) !== count($days)) {
        return null;
    }

    $today = (new DateTimeImmutable('@' . $now))->setTimezone($zone)->setTime(0, 0);
    $best = null;
    foreach ($times as $i => $time) {
        $day = $days[$i] ?? null;
        if (!is_string($time) || !preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/', $time, $hm) || !is_int($day) || $day < 0 || $day > 6) {
            return null;
        }

        // Days ahead until that weekday; a start earlier today means next week.
        $ahead = ($day - (int)$today->format('w') + 7) % 7;
        $start = $today->modify("+$ahead days")->setTime((int)$hm[1], (int)$hm[2]);
        if ($start->getTimestamp() <= $now) {
            $start = $start->modify('+7 days');
        }

        $best = $best === null || $start < $best ? $start : $best;
    }

    return $best;
}
