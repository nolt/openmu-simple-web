<?php
/** Chat commands page; the command list is in /js/commands.js. */
$page = ['title' => 'Commands', 'bodyClass' => 'stats-body', 'active' => '/commands',
    'styles' => ['/css/commands.css'], 'scripts' => ['/js/commands.js']];
?>
<h2 data-i18n="commandsTitle">Chat Commands</h2>
<p class="commands-intro" data-i18n="commandsIntro">Commands available to players.</p>

<div id="commandsContainer"></div>

<div class="cmd-hint" id="cmdHint" data-i18n="cmdHint"></div>
