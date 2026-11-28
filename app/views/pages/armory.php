<?php
/**
 * Armory page: class picture and equipped items of a character with in-game tooltips.
 * Scripts: Polish tooltip texts (English is built in), the tooltip builder, then the page.
 */
$page = ['title' => 'Armory', 'bodyClass' => 'armory-body', 'active' => '/armory',
    'scripts' => ['/js/item-texts.pl.js', '/js/item-tooltip.js', '/js/armory.js'],
    'bodyEnd' => '    <div id="itemTooltip" class="item-tooltip" role="tooltip"></div>' . "\n"];
?>
<h2 data-i18n="armoryTitle">Armory</h2>

<div class="server-status" id="serverStatus">
    <span class="status-dot" id="statusDot"></span>
    <span id="statusText">Checking...</span>
</div>

<form class="armory-search" id="armorySearch">
    <input type="text" id="charInput" maxlength="10" autocomplete="off"
           data-i18n-placeholder="armorySearch" placeholder="Character name...">
    <button type="submit" data-i18n="armoryBtn">Search</button>
</form>

<div class="armory-content">
    <!-- Left: character panel (class picture, or the placeholder, + basic info) -->
    <div class="armory-char">
        <img id="charImage" class="armory-char-image" src="/img/char-placeholder.svg" alt="Character">
        <div class="armory-char-info" id="charInfo"></div>
    </div>

    <!-- Right: equipped items (paper doll) -->
    <div class="armory-equip" id="armoryEquip">
        <p class="armory-message" id="armoryMessage" data-i18n="armoryHint">
            Search for a character to view their equipment.
        </p>
    </div>
</div>
