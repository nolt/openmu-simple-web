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
                var remoteIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                if (ipLimit.TryGetValue(remoteIp, out var lastReg) && lastReg > DateTime.UtcNow.AddDays(-1))
                    return Results.Content("Limit 1 konta na 24h dla tego IP.", "text/plain", System.Text.Encoding.UTF8, 429);

                var form = await context.Request.ReadFormAsync();
                var username = form["username"].ToString().Trim();
                var password = form["password"].ToString();

                if (!System.Text.RegularExpressions.Regex.IsMatch(username, "^[a-zA-Z0-9]{3,12}$"))
                    return Results.Content("Zły format loginu (3-12 znaków).", "text/plain", System.Text.Encoding.UTF8, 400);

                if (password.Length < 8 || password.Length > 16)
                    return Results.Content("Hasło musi mieć 8-16 znaków.", "text/plain", System.Text.Encoding.UTF8, 400);

                var securityCode = form["securityCode"].ToString();
                if (!System.Text.RegularExpressions.Regex.IsMatch(securityCode, "^[0-9]{6,10}$"))
                    return Results.Content("Kod bezpieczeństwa musi zawierać 6-10 cyfr.", "text/plain", System.Text.Encoding.UTF8, 400);

                var email = form["email"].ToString().Trim();
                if (!System.Text.RegularExpressions.Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                    return Results.Content("Nieprawidłowy format email.", "text/plain", System.Text.Encoding.UTF8, 400);

                if (await db.Accounts.AnyAsync(a => a.LoginName == username))
                    return Results.Content("Login jest już zajęty.", "text/plain", System.Text.Encoding.UTF8, 400);

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
                return Results.Ok("Konto utworzone pomyślnie!");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during registration");
                return Results.Content("Wystąpił nieoczekiwany błąd serwera.", "text/plain", System.Text.Encoding.UTF8, 500);
            }
        });
    }
}
