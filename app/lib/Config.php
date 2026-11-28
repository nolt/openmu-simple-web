<?php
/**
 * Site configuration: config/site.php with config/site.local.php on top, plus environment settings.
 */

declare(strict_types=1);

namespace SimpleWeb;

/**
 * Gives the merged site settings and the environment settings of the container.
 *
 * <remarks>
 * The local file is optional and only holds what differs from the defaults. Associative arrays are
 * merged key by key, lists replace the default list, so a changed download list doesn't keep
 * entries the admin removed.
 * </remarks>
 */
final class Config
{
    private static ?array $site = null;

    /** Returns the merged site settings (cached for the request). */
    public static function site(): array
    {
        if (self::$site === null) {
            $root = dirname(__DIR__, 2) . '/config';
            $site = require $root . '/site.php';
            $localFile = $root . '/site.local.php';
            if (is_file($localFile)) {
                $local = require $localFile;
                if (is_array($local)) {
                    $site = self::merge($site, $local);
                }
            }

            self::$site = $site;
        }

        return self::$site;
    }

    /** Returns an environment variable, or the default when it's unset or empty. */
    public static function env(string $name, string $default = ''): string
    {
        $value = getenv($name);
        return $value === false || $value === '' ? $default : $value;
    }

    /** Merges the local settings into the defaults, see the class remarks. */
    private static function merge(array $base, array $override): array
    {
        foreach ($override as $key => $value) {
            if (is_array($value) && isset($base[$key]) && is_array($base[$key])
                && !array_is_list($value) && !array_is_list($base[$key])) {
                $base[$key] = self::merge($base[$key], $value);
            } else {
                $base[$key] = $value;
            }
        }

        return $base;
    }
}
