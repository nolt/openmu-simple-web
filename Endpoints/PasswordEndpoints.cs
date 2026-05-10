using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenMU_Web.Data;
using OpenMU_Web.Services;

namespace OpenMU_Web.Endpoints;

public static class PasswordEndpoints
{
    public static void MapPasswordEndpoints(this WebApplication app)
    {
        app.MapPost("/api/change-password", async (HttpContext context, OpenMuContext db, [FromKeyedServices("password")] RateLimiter rateLimiter, [FromServices] ILogger<Program> logger) =>
        {
            try
            {
                if (!context.Request.Headers.TryGetValue("X-Requested-With", out var v) || v != "XMLHttpRequest")
                    return Results.Json(new { code = "INVALID_REQUEST" }, statusCode: 400);

                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                if (rateLimiter.IsLimited(ip, 5, TimeSpan.FromMinutes(15)))
                    return Results.Json(new { code = "RATE_LIMIT_PASSWORD", message = "Too many attempts. Try again in 15 minutes." }, statusCode: 429);

                var form = await context.Request.ReadFormAsync();
                var username = form["username"].ToString().Trim();
                var oldPassword = form["oldPassword"].ToString();
                var newPassword = form["newPassword"].ToString();

                if (string.IsNullOrEmpty(oldPassword))
                    return Results.Json(new { code = "INVALID_OLD_PASSWORD", message = "Current password is incorrect." }, statusCode: 401);

                var account = await db.Accounts.FirstOrDefaultAsync(a => a.LoginName == username);
                if (account == null)
                    return Results.Json(new { code = "USER_NOT_FOUND", message = "User not found." }, statusCode: 404);

                if (!BCrypt.Net.BCrypt.Verify(oldPassword, account.PasswordHash))
                    return Results.Json(new { code = "INVALID_OLD_PASSWORD", message = "Current password is incorrect." }, statusCode: 401);

                if (newPassword.Length < 8 || newPassword.Length > 16)
                    return Results.Json(new { code = "INVALID_PASSWORD_LENGTH", message = "New password must be 8-16 characters." }, statusCode: 400);

                account.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
                await db.SaveChangesAsync();

                    return Results.Json(new { code = "PASSWORD_CHANGE_SUCCESS", message = "Password changed successfully!" });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during password change");
                    return Results.Json(new { code = "SERVER_ERROR", message = "Failed to change password." }, statusCode: 500);
            }
        });
    }
}
