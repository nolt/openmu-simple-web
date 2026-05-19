using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenMU_Web.Data;
using OpenMU_Web.Services;

namespace OpenMU_Web.Endpoints;

public static class RankingEndpoints
{
    public static void MapRankingEndpoints(this WebApplication app)
    {
        app.MapGet("/api/public/ranking", async (OpenMuContext db, HttpContext context, [FromKeyedServices("ranking")] RateLimiter rateLimiter, [FromServices] ILogger<Program> logger) =>
        {
            try
            {
                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                if (rateLimiter.IsLimited(ip, 30, TimeSpan.FromMinutes(1)))
                    return Results.Json(new { code = "RATE_LIMIT_RANKING", message = "Too many requests. Try again later." }, statusCode: 429);

                    var sql = @"
                    SELECT
                        c.""Name"",
                        c.""Experience"",
                        cc.""Name"" as ""ClassName"",
                        (SELECT a.""Value"" FROM data.""StatAttribute"" a
                         JOIN config.""AttributeDefinition"" ad ON a.""DefinitionId"" = ad.""Id""
                         WHERE a.""CharacterId"" = c.""Id"" AND ad.""Designation"" = 'Level' LIMIT 1) as ""Level"",
                        (SELECT a.""Value"" FROM data.""StatAttribute"" a
                         JOIN config.""AttributeDefinition"" ad ON a.""DefinitionId"" = ad.""Id""
                         WHERE a.""CharacterId"" = c.""Id"" AND ad.""Designation"" = 'Resets' LIMIT 1) as ""Resets"",
                        (SELECT a.""Value"" FROM data.""StatAttribute"" a
                         JOIN config.""AttributeDefinition"" ad ON a.""DefinitionId"" = ad.""Id""
                         WHERE a.""CharacterId"" = c.""Id"" AND ad.""Designation"" = 'Master Level' LIMIT 1) as ""MasterLevel""
                    FROM data.""Character"" c
                    JOIN config.""CharacterClass"" cc ON c.""CharacterClassId"" = cc.""Id""
                    ORDER BY COALESCE((SELECT a.""Value"" FROM data.""StatAttribute"" a
                     JOIN config.""AttributeDefinition"" ad ON a.""DefinitionId"" = ad.""Id""
                     WHERE a.""CharacterId"" = c.""Id"" AND ad.""Designation"" = 'Master Level' LIMIT 1), 0) DESC,
                             COALESCE((SELECT a.""Value"" FROM data.""StatAttribute"" a
                     JOIN config.""AttributeDefinition"" ad ON a.""DefinitionId"" = ad.""Id""
                     WHERE a.""CharacterId"" = c.""Id"" AND ad.""Designation"" = 'Resets' LIMIT 1), 0) DESC
                    LIMIT 10";

                var result = new List<object>();

                var connection = db.Database.GetDbConnection();
                if (connection.State != ConnectionState.Open) await connection.OpenAsync();

                using (var command = connection.CreateCommand())
                {
                    command.CommandText = sql;
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            result.Add(new
                            {
                                name = reader["Name"].ToString(),
                                experience = reader["Experience"],
                                className = reader["ClassName"].ToString(),
                                level = reader["Level"] != DBNull.Value ? Convert.ToInt32(reader["Level"]) : 1,
                                resets = reader["Resets"] != DBNull.Value ? Convert.ToInt32(reader["Resets"]) : 0,
                                masterLevel = reader["MasterLevel"] != DBNull.Value ? Convert.ToInt32(reader["MasterLevel"]) : 0
                            });
                        }
                    }
                }

                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error fetching ranking");
                    return Results.Json(new { code = "DATABASE_ERROR", message = "Database error. Please try again later." }, statusCode: 500);
            }
        });
    }
}
