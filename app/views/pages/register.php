<?php
/** Registration form, sent by /js/register.js to /api/register. */
$page = ['title' => 'Registration', 'scripts' => ['/js/register.js'],
    'footerNav' => [['/', 'navHome', 'Home'], ['/changepass', 'navChangePass', 'Change Password']]];
?>
<h2 data-i18n="title">OpenMU</h2>
<form id="regForm">
    <div class="form-group">
        <label data-i18n="login">Login</label>
        <input type="text" name="username" required minlength="3" maxlength="10" pattern="[a-zA-Z0-9]{3,10}"
               data-i18n-placeholder="placeholderLogin">
    </div>
    <div class="form-group">
        <label data-i18n="email">Email</label>
        <input type="email" name="email" required data-i18n-placeholder="placeholderEmail">
    </div>
    <div class="form-group">
        <label data-i18n="pass">Password</label>
        <input type="password" name="password" required minlength="8" maxlength="16"
               data-i18n-placeholder="placeholderPass">
    </div>
    <div class="form-group">
        <label data-i18n="confirmPass">Confirm Password</label>
        <input type="password" name="confirmPassword" required minlength="8" maxlength="16"
               data-i18n-placeholder="placeholderConfirmPass">
    </div>
    <button type="submit" id="submitBtn">
        <span id="btnText" data-i18n="btnReg">Create Account</span>
        <div id="btnLoader" class="spinner-loader"></div>
    </button>
</form>
<div id="message"></div>
