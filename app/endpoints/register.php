<?php
/**
 * POST /api/register (form: username, email, password, confirmPassword) -> {code, message}
 *
 * Creates the account through the API's POST /accounts (permission "Registration"); the game server
 * hashes the password. The account has no security code, so deleting a character in the game asks
 * for the account password instead.
 *
 * Limits per IP: 1 created account per 24 hours, 20 attempts per hour (the API has no limit of its
 * own, and every attempt tells whether a login name is taken).
 */

declare(strict_types=1);

use SimpleWeb\ClientIp;
use SimpleWeb\Http;
use SimpleWeb\OpenMuApi;
use SimpleWeb\RateLimiter;

Http::requireAjax();
$ip = ClientIp::get();
if (!RateLimiter::hit('register', $ip, 20, 3600)) {
    Http::error(429, 'RATE_LIMIT', 'Too many attempts. Try again later.');
}

$username = trim(Http::post('username'));
$password = Http::post('password');
$email = trim(Http::post('email'));

if (!preg_match('/^[a-zA-Z0-9]{3,10}$/', $username)) {
    Http::error(400, 'INVALID_USERNAME', 'Invalid username format.');
}

$length = strlen($password);
if ($length < 8 || $length > 16) {
    Http::error(400, 'INVALID_PASSWORD_LENGTH', 'Password must be 8-16 characters long.');
}

// The game client sends the password as single-byte characters; any other one could never log in.
if (!preg_match('/^[\x20-\x7E]+$/', $password)) {
    Http::error(400, 'INVALID_PASSWORD_CHARS', 'The password contains characters the game does not accept.');
}

if (!hash_equals($password, Http::post('confirmPassword'))) {
    Http::error(400, 'PASSWORDS_DO_NOT_MATCH', 'Passwords do not match.');
}

if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    Http::error(400, 'INVALID_EMAIL', 'Invalid email format.');
}

// The one account a day is reserved before the API call: parallel requests of one visitor would
// otherwise all pass the check while the first account is still being created.
if (!RateLimiter::reserve('register-success', $ip, 86400, 30)) {
    Http::error(429, 'RATE_LIMIT_IP', 'Limit: 1 account per 24h per IP.');
}

$result = OpenMuApi::request('POST', '/accounts', ['loginName' => $username, 'password' => $password, 'eMail' => $email]);
if ($result['status'] === 200 || $result['status'] === 201) {
    RateLimiter::confirm('register-success', $ip);
    Http::error(200, 'REGISTRATION_SUCCESS', 'Account created successfully!');
}

RateLimiter::release('register-success', $ip);
switch ($result['status']) {
    case 409:
        Http::error(400, 'USERNAME_TAKEN', 'Username is already taken.');
    default:
        OpenMuApi::log('registration failed: HTTP ' . $result['status'] . ' ' . json_encode($result['data']));
        Http::error(500, 'SERVER_ERROR', 'An unexpected server error occurred.');
}
