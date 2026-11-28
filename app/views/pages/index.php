<?php
/** Home page: welcome text and server details (from the site config), status, players, downloads. */
$page = ['title' => '', 'containerClass' => 'index-container', 'active' => '/',
    'styles' => ['/css/index.css'], 'scripts' => ['/js/index.js']];

// The title is in the page from the start (in the default language), so it doesn't flicker
// until the script has put in the visitor's language.
$siteConfig = \SimpleWeb\Config::site();
$welcomeTitle = (string)($siteConfig['content'][$siteConfig['defaultLanguage'] ?? '']['welcomeTitle'] ?? '');
?>
<div class="index-grid">
    <div class="index-left">
        <div class="index-title" id="welcomeTitle"><?= htmlspecialchars($welcomeTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></div>
        <div class="index-text" id="welcomeText"></div>
        <div class="details-list" id="detailsList"></div>
    </div>

    <div class="index-right">
        <div class="index-status-row">
            <div class="index-status">
                <div class="status-dot-box" id="indexStatusDot"></div>
                <div class="status-value" id="indexStatusText">---</div>
                <div class="status-label" data-i18n="srvStatus">Server Status</div>
            </div>
            <div class="index-status">
                <div class="players-value" id="indexPlayersText">0</div>
                <div class="status-label" data-i18n="playersOnline">Online Players</div>
            </div>
        </div>
        <div id="downloadArea" class="dl-area"></div>
    </div>
</div>
