<?php
/**
 * File storage for the API cache and the rate limits, without PHP extensions or a database.
 */

declare(strict_types=1);

namespace SimpleWeb;

/**
 * Keeps small JSON records in files under CACHE_DIR (default: the temp folder of the container).
 *
 * <remarks>
 * Plain files instead of APCu, because APCu would have to be compiled into the PHP image, and the site
 * runs on the official image as is. The data is disposable: losing it only empties the cache and
 * resets the limits, like a restart of the former C# site did.
 * </remarks>
 */
final class Store
{
    /** Returns the stored record, or null when there is none. */
    public static function read(string $space, string $key): ?array
    {
        $content = @file_get_contents(self::path($space, $key));
        if ($content === false) {
            return null;
        }

        $data = json_decode($content, true);
        return is_array($data) ? $data : null;
    }

    /** Replaces the record atomically, so readers never see a half written file. */
    public static function write(string $space, string $key, array $data): void
    {
        $path = self::path($space, $key);
        $temp = $path . '.' . bin2hex(random_bytes(4));
        if (@file_put_contents($temp, json_encode($data, JSON_THROW_ON_ERROR)) !== false) {
            @rename($temp, $path);
        }
    }

    /**
     * Reads and changes a record under an exclusive lock, so parallel requests are counted one by one.
     *
     * @param callable(?array): array $change gets the current record, returns the new one
     * @return ?array the new record; null when the storage can't be written (e.g. full), so the
     *                caller can refuse instead of letting everything through
     */
    public static function update(string $space, string $key, callable $change): ?array
    {
        $handle = @fopen(self::path($space, $key), 'c+');
        if ($handle === false) {
            error_log('[store] cannot write ' . $space . ' records - is CACHE_DIR full?');
            return null;
        }

        try {
            flock($handle, LOCK_EX);
            $current = json_decode((string)stream_get_contents($handle), true);
            $new = $change(is_array($current) ? $current : null);
            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode($new, JSON_THROW_ON_ERROR));
            fflush($handle);
            return $new;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /**
     * Takes the reload lock of a record without waiting; null when another request holds it
     * (or the storage can't be written).
     *
     * @return resource|null
     */
    public static function tryLock(string $space, string $key): mixed
    {
        $handle = @fopen(self::path($space, $key) . '.lock', 'c');
        if ($handle === false) {
            return null;
        }

        if (!flock($handle, LOCK_EX | LOCK_NB)) {
            fclose($handle);
            return null;
        }

        return $handle;
    }

    /** Releases a lock of tryLock(); does nothing for null. */
    public static function unlock(mixed $handle): void
    {
        if (is_resource($handle)) {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /**
     * Deletes records not touched for the given time; called now and then by the front controller.
     *
     * The folders are read entry by entry and the run stops after the time budget, so even a huge
     * number of files (e.g. from many visitors) neither exhausts the memory nor holds up the request.
     */
    public static function cleanUp(int $maxAgeSeconds, float $budgetSeconds = 0.5): void
    {
        $limit = time() - $maxAgeSeconds;
        $deadline = microtime(true) + $budgetSeconds;
        foreach (['api', 'limits'] as $space) {
            $dir = self::root() . '/' . $space;
            $handle = @opendir($dir);
            if ($handle === false) {
                continue;
            }

            while (($name = readdir($handle)) !== false) {
                if ($name[0] !== '.' && @filemtime($dir . '/' . $name) < $limit) {
                    @unlink($dir . '/' . $name);
                }

                if (microtime(true) > $deadline) {
                    closedir($handle);
                    return;
                }
            }

            closedir($handle);
        }
    }

    /** The file of a record; the key is hashed, so it may contain any characters (IPs, names). */
    private static function path(string $space, string $key): string
    {
        $dir = self::root() . '/' . $space;
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }

        return $dir . '/' . hash('sha256', $key);
    }

    private static function root(): string
    {
        return rtrim(Config::env('CACHE_DIR', sys_get_temp_dir() . '/openmu-web'), '/');
    }
}
