<?php
/**
 * Example of config/site.local.php - your own settings, kept by every update.
 *
 * Copy it: cp config/site.local.example.php config/site.local.php
 * and keep only what you change. Missing keys come from config/site.php, so a short file is enough.
 * Lists (downloads, rows, timetable...) replace the default list as a whole.
 * Changes are visible after reloading the page; no rebuild or restart is needed.
 */

return [
    'siteName' => 'MyMU',
    'defaultLanguage' => 'pl',
    'maxResets' => 50,

    'downloads' => [
        ['id' => 'launcher', 'icon' => '🚀', 'name' => 'Launcher', 'url' => 'https://example.com/Launcher.zip', 'recommended' => true],
        ['id' => 'windows', 'icon' => '🪟', 'name' => 'Windows', 'url' => 'https://example.com/Client.zip'],
    ],

    // Only the Polish welcome title is changed here; the rest of the home page text stays default.
    'content' => [
        'pl' => [
            'welcomeTitle' => 'Witaj na MyMU',
        ],
    ],

    // Full timetable of the events (see the "events" section of config/site.php).
    'events' => [
        'Blood Castle' => ['timetable' => ['00:00', '02:00', '04:00'], 'durationMinutes' => 15],
        'Crywolf' => ['timetable' => ['20:00'], 'days' => [6], 'durationMinutes' => 30],
    ],
];
