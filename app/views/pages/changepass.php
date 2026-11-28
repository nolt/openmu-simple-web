<?php
/** Password change form, sent by /js/changepass.js to /api/change-password. */
$page = ['title' => 'Change Password', 'scripts' => ['/js/changepass.js'],
    'footerNav' => [['/', 'navHome', 'Home']]];
?>
<h2 data-i18n="titleChange">Change Password</h2>
<form id="changePassForm">
    <div class="form-group">
        <label data-i18n="login">Login</label>
        <input type="text" name="username" required maxlength="10" data-i18n-placeholder="placeholderLogin">
    </div>
    <div class="form-group">
        <label data-i18n="oldPass">Current Password</label>
        <input type="password" name="oldPassword" required maxlength="20" data-i18n-placeholder="placeholderPass">
    </div>
    <div class="form-group">
        <label data-i18n="newPass">New Password</label>
        <input type="password" name="newPassword" required minlength="8" maxlength="16"
               data-i18n-placeholder="placeholderPass">
    </div>
    <button type="submit" id="submitBtn">
        <span id="btnText" data-i18n="btnChange">Update Password</span>
        <div id="btnLoader" class="spinner-loader"></div>
    </button>
</form>
<div id="message"></div>
