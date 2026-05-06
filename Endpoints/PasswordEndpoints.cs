using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenMU_Web.Data;
using OpenMU_Web.Services;

namespace OpenMU_Web.Endpoints;

public static class PasswordEndpoints
{
    public static void MapPasswordEndpoints(this WebApplication app)
    {
        app.MapPost("/api/change-password", async (HttpContext context, OpenMuContext db, PasswordRateLimiter rateLimiter, [FromServices] ILogger<Program> logger) =>
        {
            try
            {
                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                if (rateLimiter.IsLimited(ip, 5, TimeSpan.FromMinutes(15)))
                    return Results.Content("Zbyt wiele prób. Spróbuj ponownie za 15 minut.", "text/plain", System.Text.Encoding.UTF8, 429);

                var form = await context.Request.ReadFormAsync();
                var username = form["username"].ToString().Trim();
                var oldPassword = form["oldPassword"].ToString();
                var newPassword = form["newPassword"].ToString();

                var account = await db.Accounts.FirstOrDefaultAsync(a => a.LoginName == username);
                if (account == null)
                    return Results.Content("Użytkownik nie istnieje.", "text/plain", System.Text.Encoding.UTF8, 404);

                if (!BCrypt.Net.BCrypt.Verify(oldPassword, account.PasswordHash))
                    return Results.Content("Obecne hasło jest nieprawidłowe.", "text/plain", System.Text.Encoding.UTF8, 401);

                if (newPassword.Length < 8 || newPassword.Length > 16)
                    return Results.Content("Nowe hasło musi mieć od 8 do 16 znaków.", "text/plain", System.Text.Encoding.UTF8, 400);

                account.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
                await db.SaveChangesAsync();

                return Results.Ok("Hasło zostało zmienione!");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during password change");
                return Results.Content("Nie udało się zmienić hasła.", "text/plain", System.Text.Encoding.UTF8, 500);
            }
        });
    }
}
