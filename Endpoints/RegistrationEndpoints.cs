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
                    return Results.Json(new { code = "RATE_LIMIT_IP", message = "Limit 1 konta na 24h dla tego IP." }, statusCode: 429);

                var form = await context.Request.ReadFormAsync();
                var username = form["username"].ToString().Trim();
                var password = form["password"].ToString();

                if (!System.Text.RegularExpressions.Regex.IsMatch(username, "^[a-zA-Z0-9]{3,10}$"))
                    return Results.Json(new { code = "INVALID_USERNAME", message = "Zły format loginu (3-10 znaków)." }, statusCode: 400);

                if (password.Length < 8 || password.Length > 16)
                    return Results.Json(new { code = "INVALID_PASSWORD_LENGTH", message = "Hasło musi mieć 8-16 znaków." }, statusCode: 400);

                var securityCode = form["securityCode"].ToString();
                if (!System.Text.RegularExpressions.Regex.IsMatch(securityCode, "^[0-9]{6,10}$"))
                    return Results.Json(new { code = "INVALID_SECURITY_CODE", message = "Kod bezpieczeństwa musi zawierać 6-10 cyfr." }, statusCode: 400);

                var email = form["email"].ToString().Trim();
                if (!System.Text.RegularExpressions.Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                    return Results.Json(new { code = "INVALID_EMAIL", message = "Nieprawidłowy format email." }, statusCode: 400);

                if (await db.Accounts.AnyAsync(a => a.LoginName == username))
                    return Results.Json(new { code = "USERNAME_TAKEN", message = "Login jest już zajęty." }, statusCode: 400);

                var newVault = new ItemStorage { Id = Guid.NewGuid(), Money = 0 };
                db.ItemStorages.Add(newVault);
                await db.SaveChangesAsync();

                var account = new Account
                {
                    Id = Guid.NewGuid(),
                    LoginName = username,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                    SecurityCode = form["securityCode"].ToString(),
                    EMail = email,
                    RegistrationDate = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
                    VaultId = newVault.Id,
                    LanguageIsoCode = "en",
                    State = 0
                };

                db.Accounts.Add(account);
                await db.SaveChangesAsync();

                ipLimit[remoteIp] = DateTime.UtcNow;
                return Results.Json(new { code = "REGISTRATION_SUCCESS", message = "Konto utworzone pomyślnie!" });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during registration");
                return Results.Json(new { code = "SERVER_ERROR", message = "Wystąpił nieoczekiwany błąd serwera." }, statusCode: 500);
            }
        });
    }
}
