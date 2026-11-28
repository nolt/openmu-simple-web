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
            // The path is sent as built; curl must not resolve "." or ".." segments of a name.
            CURLOPT_PATH_AS_IS => true,
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
        $data = is_string($response) && $response !== '' ? json_decode($response, true) : null;

        // A wrong password of a visitor is a 401 with a status in the body; a 401 without one, or a
        // 403, is a problem of the key.
        $passwordAnswer = is_array($data) && isset($data['status']);
        if ($status === 0) {
            self::log("$method $path failed: " . curl_error($curl));
        } elseif (($status === 401 && !$passwordAnswer) || $status === 403) {
            self::log("$method $path: HTTP $status - check OPENMU_API_KEY, its role (WebManager) and the ticked functions");
        }

        return ['status' => $status, 'data' => $data, 'retryAfter' => $retryAfter];
    }

    /**
     * Returns the body of a successful GET from the cache, or loads it; false for a 404, null when it
     * failed.
     *
     * Only one request reloads an expired entry; the others meanwhile get the expired one, so a busy
     * page doesn't send every visitor to the API at once. A 404 isn't cached: every made-up character
     * name would leave a file behind.
     */
    public static function cachedGet(string $path, int $ttlSeconds): mixed
    {
        $cached = Store::read('api', $path);
        if ($cached !== null && (int)($cached['until'] ?? 0) > time()) {
            return $cached['data'] ?? null;
        }

        // The reload lock is only needed when there is an expired entry to hand out meanwhile; taking
        // it for every unknown path would leave a lock file per made-up name.
        $lock = null;
        if ($cached !== null) {
            $lock = Store::tryLock('api', $path);
            if ($lock === null) {
                return $cached['data'] ?? null;
            }
        }

        try {
            $result = self::request('GET', $path);
            if ($result['status'] === 404) {
                return false;
            }

            $data = $result['status'] === 200 ? $result['data'] : null;

            // A failure is remembered for a few seconds too: while the game server is down, every
            // page would otherwise wait for the connect timeout.
            $ttl = $data === null ? min(5, $ttlSeconds) : $ttlSeconds;
            Store::write('api', $path, ['until' => time() + $ttl, 'data' => $data]);
            return $data;
        } finally {
            Store::unlock($lock);
        }
    }

    /** Writes to the container log (docker logs) without any secret. */
    public static function log(string $message): void
    {
        error_log('[openmu-api] ' . $message);
    }
}
