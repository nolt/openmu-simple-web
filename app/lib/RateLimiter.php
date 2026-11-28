<?php
/**
 * Per-visitor limits of the endpoints (counted per IP address).
 */

declare(strict_types=1);

namespace SimpleWeb;

/**
 * Fixed-window limits per IP, as in the former C# site.
 *
 * <remarks>
 * The OpenMU API sees only the web server, never the visitor, so limits per visitor have to be kept
 * here (the API only locks an account after wrong passwords).
 * </remarks>
 */
final class RateLimiter
{
    /** Counts a request and tells whether it is still within the limit of the window. */
    public static function hit(string $bucket, string $ip, int $limit, int $windowSeconds): bool
    {
        $now = time();
        $record = Store::update('limits', $bucket . '|' . $ip, static function (?array $record) use ($now, $windowSeconds): array {
            if ($record === null || $now - (int)($record['start'] ?? 0) >= $windowSeconds) {
                $record = ['start' => $now, 'count' => 0];
            }

            $record['count']++;
            return $record;
        });

        return $record['count'] <= $limit;
    }

    /** Tells whether an action succeeded for this IP within the last given seconds. */
    public static function succeededWithin(string $bucket, string $ip, int $seconds): bool
    {
        $record = Store::read('limits', $bucket . '|' . $ip);
        return $record !== null && time() - (int)($record['at'] ?? 0) < $seconds;
    }

    /** Remembers a successful action of this IP, see succeededWithin(). */
    public static function recordSuccess(string $bucket, string $ip): void
    {
        Store::write('limits', $bucket . '|' . $ip, ['at' => time()]);
    }
}
