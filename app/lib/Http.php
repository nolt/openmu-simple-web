<?php
/**
 * Small helpers to send the JSON answers of the site's own endpoints.
 */

declare(strict_types=1);

namespace SimpleWeb;

/**
 * Sends JSON answers and checks the request basics of the endpoints.
 *
 * <remarks>
 * Errors keep the shape of the former C# site, {code, message}: the pages show the translation of
 * `code` and fall back to `message`.
 * </remarks>
 */
final class Http
{
    /** Sends a JSON answer and ends the request. */
    public static function json(int $status, mixed $data): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        exit;
    }

    /** Sends an error answer {code, message} and ends the request. */
    public static function error(int $status, string $code, string $message): never
    {
        self::json($status, ['code' => $code, 'message' => $message]);
    }

    /**
     * Rejects form posts which don't come from the site's own scripts.
     *
     * A cross-site form can't set this header and the site allows no cross-origin requests,
     * so this also stops cross-site request forgery.
     */
    public static function requireAjax(): void
    {
        if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') {
            self::error(400, 'INVALID_REQUEST', 'Invalid request.');
        }
    }

    /** Returns a posted text field, or an empty string when it's missing or not a string. */
    public static function post(string $name): string
    {
        $value = $_POST[$name] ?? '';
        return is_string($value) ? $value : '';
    }
}
