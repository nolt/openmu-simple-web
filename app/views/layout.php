<?php
/**
 * Shared layout of every page: head with the language and content scripts, the language switch,
 * the page body, the footer navigation and the page's own scripts.
 *
 * Expects from the front controller:
 *   $page   page settings set by the page view (title, bodyClass, containerClass, active, styles,
 *           scripts, bodyEnd, footerNav)
 *   $body   the rendered page body
 *   $route  the path of the page, e.g. "/stats"
 */

declare(strict_types=1);

use SimpleWeb\Config;

$site = Config::site();
$e = static fn (string $text): string => htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

// Only plain language codes become script names (e.g. "pl", "pt-BR").
$languages = array_values(array_filter((array)($site['languages'] ?? ['en']),
    static fn ($code): bool => is_string($code) && preg_match('/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/', $code) === 1));
$defaultLanguage = in_array($site['defaultLanguage'] ?? '', $languages, true) ? $site['defaultLanguage'] : ($languages[0] ?? 'en');

// Tab title: the one set for this page in the config, else "<siteName> - <page title>".
$siteName = (string)($site['siteName'] ?? 'OpenMU');
$customTitle = $site['pageTitles'][$route] ?? '';
$title = is_string($customTitle) && $customTitle !== ''
    ? $customTitle
    : (($page['title'] ?? '') === '' ? $siteName : $siteName . ' - ' . $page['title']);

// Footer navigation shared by every page (from the config); the current page is left out.
$nav = array_values(array_filter((array)($site['nav'] ?? []), static fn ($link): bool => is_array($link) && count($link) === 3));
$active = $page['active'] ?? null;
if (isset($page['footerNav'])) {
    // The account pages bring their own links.
    $nav = $page['footerNav'];
} elseif ($active === '/') {
    // The home page doubles as the account hub: account links first, then the game pages.
    array_unshift($nav, ['/register', 'navRegister', 'Register Account'], ['/changepass', 'navChangePass', 'Change Password']);
}
?>
<!DOCTYPE html>
<html lang="<?= $e($defaultLanguage) ?>">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $e($title) ?></title>
    <link rel="stylesheet" href="/style.css">
<?php foreach ($languages as $language): ?>
    <script src="/<?= $e($language) ?>.js"></script>
<?php endforeach; ?>
    <script src="/content.js"></script>
    <script src="/lang.js" data-default="<?= $e($defaultLanguage) ?>"></script>
<?php foreach ($page['styles'] ?? [] as $style): ?>
    <link rel="stylesheet" href="<?= $e($style) ?>">
<?php endforeach; ?>
</head>

<body class="<?= $e($page['bodyClass'] ?? '') ?>">
    <div class="container <?= $e($page['containerClass'] ?? '') ?>">
<?php if (count($languages) > 1): // A single language needs no switch. ?>
        <div class="lang-switch" id="lang-switch"></div>
<?php endif; ?>

<?= $body ?>

        <div class="footer-nav">
<?php foreach ($nav as [$href, $key, $label]): ?>
<?php if ($href !== $active): ?>
            <a href="<?= $e((string)$href) ?>" class="nav-link"><span data-i18n="<?= $e((string)$key) ?>"><?= $e((string)$label) ?></span></a>
<?php endif; ?>
<?php endforeach; ?>
        </div>
    </div>
    <div class="credits">
        <a href="https://github.com/nolt" target="_blank">
            <span>&lt;/&gt; with ❤️ by</span> Nolt
        </a>
    </div>

<?php // Outside .container on purpose: its backdrop-filter would make it the containing block of
      // position:fixed overlays like the armory item tooltip, which must follow the viewport. ?>
<?= $page['bodyEnd'] ?? '' ?>

<?php foreach ($page['scripts'] ?? [] as $script): ?>
    <script src="<?= $e($script) ?>"></script>
<?php endforeach; ?>
</body>

</html>
