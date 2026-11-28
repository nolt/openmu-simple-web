<?php
/**
 * Finds the visitor's IP address, also behind a trusted reverse proxy.
 */

declare(strict_types=1);

namespace SimpleWeb;

/**
 * Resolves the IP address the per-visitor limits are counted for.
 *
 * <remarks>
 * The connection address is the visitor, unless it is one of TRUSTED_PROXIES (comma separated IPs or
 * CIDR ranges). Only then the X-Forwarded-For header is read, from the right, skipping the trusted
 * proxies - the entries left of them could be made up by the visitor.
 * </remarks>
 */
final class ClientIp
{
    /** Returns the visitor's IP address. */
    public static function get(): string
    {
        $remote = (string)($_SERVER['REMOTE_ADDR'] ?? '');
        $trusted = self::trustedProxies();
        if ($trusted === [] || !self::matchesAny($remote, $trusted)) {
            return $remote;
        }

        $forwarded = (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
        $hops = array_reverse(array_filter(array_map('trim', explode(',', $forwarded))));
        $client = $remote;
        foreach ($hops as $hop) {
            if (filter_var($hop, FILTER_VALIDATE_IP) === false) {
                break;
            }

            $client = $hop;
            if (!self::matchesAny($hop, $trusted)) {
                break;
            }
        }

        return $client;
    }

    /** @return list<string> the configured proxy addresses and ranges */
    private static function trustedProxies(): array
    {
        return array_values(array_filter(array_map('trim', explode(',', Config::env('TRUSTED_PROXIES')))));
    }

    /** @param list<string> $ranges */
    private static function matchesAny(string $ip, array $ranges): bool
    {
        foreach ($ranges as $range) {
            if (self::matches($ip, $range)) {
                return true;
            }
        }

        return false;
    }

    /** Checks an address against one IP or CIDR range, IPv4 and IPv6. */
    private static function matches(string $ip, string $range): bool
    {
        [$network, $bits] = array_pad(explode('/', $range, 2), 2, null);
        $ipBin = @inet_pton($ip);
        $netBin = @inet_pton((string)$network);
        if ($ipBin === false || $netBin === false || strlen($ipBin) !== strlen($netBin)) {
            return false;
        }

        $maxBits = strlen($ipBin) * 8;
        $bits = $bits === null ? $maxBits : (ctype_digit($bits) ? (int)$bits : -1);
        if ($bits < 0 || $bits > $maxBits) {
            return false;
        }

        $bytes = intdiv($bits, 8);
        if (strncmp($ipBin, $netBin, $bytes) !== 0) {
            return false;
        }

        $rest = $bits % 8;
        if ($rest === 0) {
            return true;
        }

        $mask = (0xFF << (8 - $rest)) & 0xFF;
        return (ord($ipBin[$bytes]) & $mask) === (ord($netBin[$bytes]) & $mask);
    }
}
