using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenMU_Web.Data;
using OpenMU_Web.Models;
using System.Collections.Concurrent;

namespace OpenMU_Web.Endpoints;

public static class RegistrationEndpoints
{
    public static void MapRegistrationEndpoints(this WebApplication app)
    {
        app.MapPost("/api/register", async (HttpContext context, OpenMuContext db, ConcurrentDictionary<string, DateTime> ipLimit, [FromServices] ILogger<Program> logger) =>
        {
            try
            {
                if (!context.Request.Headers.TryGetValue("X-Requested-With", out var v) || v != "XMLHttpRequest")
                    return Results.Json(new { code = "INVALID_REQUEST" }, statusCode: 400);

                var remoteIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                if (ipLimit.TryGetValue(remoteIp, out var lastReg) && lastReg > DateTime.UtcNow.AddDays(-1))
                    return Results.Json(new { code = "RATE_LIMIT_IP", message = "Limit of 1 account per 24h for this IP." }, statusCode: 429);

                var form = await context.Request.ReadFormAsync();
                var username = form["username"].ToString().Trim();
                var password = form["password"].ToString();
                var confirmPassword = form["confirmPassword"].ToString();

                if (!System.Text.RegularExpressions.Regex.IsMatch(username, "^[a-zA-Z0-9]{3,10}$"))
                    return Results.Json(new { code = "INVALID_USERNAME", message = "Invalid username format (3-10 characters)." }, statusCode: 400);

                if (password.Length < 8 || password.Length > 16)
                    return Results.Json(new { code = "INVALID_PASSWORD_LENGTH", message = "Password must be 8-16 characters." }, statusCode: 400);

                if (password != confirmPassword)
                    return Results.Json(new { code = "PASSWORDS_DO_NOT_MATCH", message = "Passwords do not match." }, statusCode: 400);

                var securityCode = form["securityCode"].ToString();
                if (!System.Text.RegularExpressions.Regex.IsMatch(securityCode, "^[0-9]{6,10}$"))
                    return Results.Json(new { code = "INVALID_SECURITY_CODE", message = "Security code must be 6-10 digits." }, statusCode: 400);

                var email = form["email"].ToString().Trim();
                if (!System.Net.Mail.MailAddress.TryCreate(email, out _))
                    return Results.Json(new { code = "INVALID_EMAIL", message = "Invalid email format." }, statusCode: 400);

                if (await db.Accounts.AnyAsync(a => a.LoginName == username))
                    return Results.Json(new { code = "USERNAME_TAKEN", message = "Username is already taken." }, statusCode: 400);

                var newVault = new ItemStorage { Id = Guid.NewGuid(), Money = 0 };
                var account = new Account
                {
                    Id = Guid.NewGuid(),
                    LoginName = username,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                    SecurityCode = form["securityCode"].ToString(),
                    EMail = email,
                    RegistrationDate = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
                    VaultId = newVault.Id,
                    LanguageIsoCode = form["language"].ToString() ?? "en",
                    State = 0
                };

                // OpenMU's DB rejects inserting the vault and the account in a single
                // SaveChanges, so they go in sequence (vault first, for the FK). Wrapping
                // both in one transaction keeps that order but makes them atomic: if the
                // account insert fails (e.g. a race on the unique login), both roll back
                // and no orphan vault is left behind.
                await using var tx = await db.Database.BeginTransactionAsync();
                db.ItemStorages.Add(newVault);
                await db.SaveChangesAsync();
                db.Accounts.Add(account);
                try
                {
                    await db.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    return Results.Json(new { code = "USERNAME_TAKEN", message = "Username is already taken." }, statusCode: 400);
                }
                await tx.CommitAsync();

                ipLimit[remoteIp] = DateTime.UtcNow;
                return Results.Json(new { code = "REGISTRATION_SUCCESS", message = "Account created successfully!" });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during registration");
                    return Results.Json(new { code = "SERVER_ERROR", message = "An unexpected server error occurred." }, statusCode: 500);
            }
        });
    }
}
