<?php
/**
 * Client of the OpenMU website API (admin panel, /api/website).
 */

declare(strict_types=1);

namespace SimpleWeb;

/**
 * Calls the website API of the OpenMU admin panel with the site's API key.
 *
 * <remarks>
 * The key (role WebManager) stays on the server: it is read from OPENMU_API_KEY and never sent to the
 * browser. Each function of the site needs its permission ticked on the key in the admin panel.
 * Read answers are cached for a short time, so visitors don't put load on the game server.
 * </remarks>
 */
final class OpenMuApi
{
    /**
     * Sends a request; returns the status (0 when the API couldn't be reached), the decoded body and
     * the Retry-After seconds, if any.
     *
     * @return array{status: int, data: mixed, retryAfter: ?int}
     */
    public static function request(string $method, string $path, ?array $body = null): array
    {
        $headers = ['Accept: application/json', 'X-Api-Key: ' . Config::env('OPENMU_API_KEY')];
        $curl = curl_init(rtrim(Config::env('OPENMU_API_URL', 'http://openmu-server:8080'), '/') . '/api/website' . $path);
        $retryAfter = null;
        curl_setopt_array($curl, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$retryAfter): int {
                if (preg_match('/^Retry-After:\s*(\d+)/i', $line, $match)) {
                    $retryAfter = (int)$match[1];
                }

                return strlen($line);
            },
        ]);
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
        }

        curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
        $response = curl_exec($curl);
        $status = $response === false ? 0 : (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        if ($status === 0) {
            self::log("$method $path failed: " . curl_error($curl));
        } elseif ($status === 401 || $status === 403) {
            self::log("$method $path: HTTP $status - check OPENMU_API_KEY, its role (WebManager) and the ticked functions");
        }

        $data = is_string($response) && $response !== '' ? json_decode($response, true) : null;
        return ['status' => $status, 'data' => $data, 'retryAfter' => $retryAfter];
    }

    /**
     * Returns the body of a successful GET from the cache, or loads it; null when it failed.
     * A 404 is cached as well (as false), so asking for an unknown character again doesn't reach the API.
     */
    public static function cachedGet(string $path, int $ttlSeconds): mixed
    {
        $cached = Store::read('api', $path);
        if ($cached !== null && (int)($cached['until'] ?? 0) > time()) {
            return $cached['data'] ?? null;
        }

        $result = self::request('GET', $path);
        $data = match (true) {
            $result['status'] === 200 && $result['data'] !== null => $result['data'],
            $result['status'] === 404 => false,
            default => null,
        };

        // A failure is remembered for a few seconds too: while the game server is down, every page
        // would otherwise wait for the connect timeout.
        $ttl = $data === null ? min(5, $ttlSeconds) : $ttlSeconds;
        Store::write('api', $path, ['until' => time() + $ttl, 'data' => $data]);
        return $data;
    }

    /** Writes to the container log (docker logs) without any secret. */
    public static function log(string $message): void
    {
        error_log('[openmu-api] ' . $message);
    }
}
