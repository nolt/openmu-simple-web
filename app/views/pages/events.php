<?php
/** Events page: next start, countdown and timetable of each event, filled by /js/events.js. */
$page = ['title' => 'Events', 'bodyClass' => 'stats-body', 'active' => '/events',
    'styles' => ['/css/events.css'], 'scripts' => ['/js/events.js']];
?>
<h2 data-i18n="eventsTitle">Nadchodzące Wydarzenia</h2>

<div class="server-status" id="serverStatus">
    <span class="status-dot" id="statusDot"></span>
    <span id="statusText">Checking...</span>
</div>

<div id="eventsContainer">
    <div class="event-loader">...</div>
</div>
