<?php
/**
 * POST /api/change-password (form: username, oldPassword, newPassword) -> {code, message}
 *
 * Changes the password through the API's PUT /accounts/{login}/password (permission
 * "Change password"). The game server checks the current password, locks the account for 15 minutes
 * after 5 wrong ones, and refuses while the account is in the game or offline leveling.
 * A wrong login and a wrong password give the same answer, so the form can't be used to find accounts.
 *
 * Limit per IP: 5 attempts per 15 minutes.
 */

declare(strict_types=1);

use SimpleWeb\ClientIp;
use SimpleWeb\Http;
use SimpleWeb\OpenMuApi;
use SimpleWeb\RateLimiter;

Http::requireAjax();
if (!RateLimiter::hit('password', ClientIp::get(), 5, 900)) {
    Http::error(429, 'RATE_LIMIT_PASSWORD', 'Too many attempts. Try again in 15 minutes.');
}

$username = trim(Http::post('username'));
$oldPassword = Http::post('oldPassword');
$newPassword = Http::post('newPassword');

$length = strlen($newPassword);
if ($length < 8 || $length > 16) {
    Http::error(400, 'INVALID_PASSWORD_LENGTH', 'Password must be 8-16 characters long.');
}

if (!preg_match('/^[\x20-\x7E]+$/', $newPassword)) {
    Http::error(400, 'INVALID_PASSWORD_CHARS', 'The password contains characters the game does not accept.');
}

// Logins and passwords the game can't have are wrong anyway; no need to ask the server.
if (!preg_match('/^[\x21-\x7E]{1,10}$/', $username) || !preg_match('/^[\x20-\x7E]{1,20}$/', $oldPassword)) {
    Http::error(401, 'INVALID_OLD_PASSWORD', 'Incorrect login or current password.');
}

$result = OpenMuApi::request('PUT', '/accounts/' . rawurlencode($username) . '/password', [
    'currentPassword' => $oldPassword,
    'newPassword' => $newPassword,
]);
$status = is_array($result['data']) ? (string)($result['data']['status'] ?? '') : '';
switch ($result['status']) {
    case 200:
    case 204:
        Http::error(200, 'PASSWORD_CHANGE_SUCCESS', 'Password changed successfully!');
    case 401:
        Http::error(401, 'INVALID_OLD_PASSWORD', 'Incorrect login or current password.');
    case 409:
        $status === 'OfflineLeveling'
            ? Http::error(409, 'OFFLINE_LEVELING', 'Stop the offline leveling first.')
            : Http::error(409, 'ACCOUNT_ONLINE', 'Log out of the game first.');
    case 429:
        Http::error(429, 'RATE_LIMIT_PASSWORD', 'Too many attempts. Try again in 15 minutes.');
    default:
        OpenMuApi::log('password change failed: HTTP ' . $result['status'] . ' ' . $status);
        Http::error(500, 'SERVER_ERROR', 'An unexpected server error occurred.');
}
