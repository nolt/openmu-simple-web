<?php
/**
 * Per-visitor limits of the endpoints (counted per IP address).
 */

declare(strict_types=1);

namespace SimpleWeb;

/**
 * Fixed-window limits per visitor, as in the former C# site.
 *
 * <remarks>
 * The OpenMU API sees only the web server, never the visitor, so limits per visitor have to be kept
 * here (the API only locks an account after wrong passwords). An IPv6 visitor is counted per /64
 * network: one home connection usually gets a whole /64, so counting single addresses would give
 * it countless fresh limits.
 * </remarks>
 */
final class RateLimiter
{
    /** Counts a request and tells whether it is still within the limit of the window. */
    public static function hit(string $bucket, string $ip, int $limit, int $windowSeconds): bool
    {
        $now = time();
        $record = Store::update('limits', self::key($bucket, $ip), static function (?array $record) use ($now, $windowSeconds): array {
            if ($record === null || $now - (int)($record['start'] ?? 0) >= $windowSeconds) {
                $record = ['start' => $now, 'count' => 0];
            }

            $record['count']++;
            return $record;
        });

        // Without storage the limit can't be counted; refusing is safer than letting everything pass.
        return $record !== null && $record['count'] <= $limit;
    }

    /**
     * Reserves the single success a visitor may have within the given seconds (e.g. one account a day).
     *
     * Checked and taken under one lock, so parallel requests can't all pass before the first one
     * succeeded. Returns false when the visitor already succeeded, or another attempt is running.
     * Call confirm() after the success, release() after a failure.
     */
    public static function reserve(string $bucket, string $ip, int $seconds, int $pendingSeconds): bool
    {
        $now = time();
        $reserved = false;
        Store::update('limits', self::key($bucket, $ip), static function (?array $record) use ($now, $seconds, $pendingSeconds, &$reserved): array {
            $record ??= [];
            $succeeded = $now - (int)($record['at'] ?? 0) < $seconds;
            $running = $now - (int)($record['pending'] ?? 0) < $pendingSeconds;
            if ($succeeded || $running) {
                return $record;
            }

            $reserved = true;
            $record['pending'] = $now;
            return $record;
        });

        return $reserved;
    }

    /** Turns the reservation into the success that blocks this visitor for the window of reserve(). */
    public static function confirm(string $bucket, string $ip): void
    {
        Store::update('limits', self::key($bucket, $ip), static fn (): array => ['at' => time()]);
    }

    /** Gives the reservation back after a failed attempt. */
    public static function release(string $bucket, string $ip): void
    {
        Store::update('limits', self::key($bucket, $ip), static function (?array $record): array {
            unset($record['pending']);
            return $record ?? [];
        });
    }

    /** The visitor part of a limit: the IPv4 address, or the /64 network of an IPv6 address. */
    private static function key(string $bucket, string $ip): string
    {
        $binary = @inet_pton($ip);
        if ($binary !== false && strlen($binary) === 16) {
            $ip = inet_ntop(substr($binary, 0, 8) . str_repeat("\0", 8)) . '/64';
        }

        return $bucket . '|' . $ip;
    }
}
