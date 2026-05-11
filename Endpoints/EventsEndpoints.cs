using System.Data;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenMU_Web.Data;
using OpenMU_Web.Services;

namespace OpenMU_Web.Endpoints;

public static class EventsEndpoints
{
    private static readonly Dictionary<Guid, string> EventNames = new()
    {
        [Guid.Parse("548A76CC-242C-441C-BC9D-6C22745A2D72")] = "Red Dragon Invasion",
        [Guid.Parse("06D18A9E-2919-4C17-9DBC-6E4F7756495C")] = "Golden Invasion",
        [Guid.Parse("95E68C14-AD87-4B3C-AF46-45B8F1C3BC2A")] = "Blood Castle",
        [Guid.Parse("3AD96A70-ED24-4979-80B8-169E461E548F")] = "Chaos Castle",
        [Guid.Parse("61C61A58-211E-4D6A-9EA1-D25E0C4A47C5")] = "Devil Square",
        [Guid.Parse("6542E452-9780-45B8-85AE-4036422E9A6E")] = "Happy Hour",
    };

    public static void MapEventsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/public/events", async (OpenMuContext db, HttpContext context, [FromKeyedServices("events")] RateLimiter rateLimiter, [FromServices] ILogger<Program> logger) =>
        {
            try
            {
                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                if (rateLimiter.IsLimited(ip, 30, TimeSpan.FromMinutes(1)))
                    return Results.Json(new { code = "RATE_LIMIT_RANKING", message = "Too many requests. Try again later." }, statusCode: 429);

                var guids = EventNames.Keys.ToList();
                var paramList = string.Join(", ", guids.Select((_, i) => $"@g{i}::uuid"));

                var sql = $@"
                    SELECT ""TypeId"", ""IsActive"", ""CustomConfiguration""
                    FROM config.""PlugInConfiguration""
                    WHERE ""TypeId"" IN ({paramList})
                    AND ""IsActive"" = true";

                var connection = db.Database.GetDbConnection();
                if (connection.State != ConnectionState.Open) await connection.OpenAsync();

                var tz = TimeZoneInfo.Local;
                var nowUtc = DateTime.UtcNow;
                var nowLocal = TimeZoneInfo.ConvertTime(nowUtc, tz);
                var result = new List<object>();

                using (var command = connection.CreateCommand())
                {
                    command.CommandText = sql;
                    for (int i = 0; i < guids.Count; i++)
                    {
                        var p = command.CreateParameter();
                        p.ParameterName = $"g{i}";
                        p.Value = guids[i];
                        command.Parameters.Add(p);
                    }

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var typeId = (Guid)reader["TypeId"];
                            var customConfig = reader["CustomConfiguration"] as string;
                            var isActive = (bool)reader["IsActive"];

                            if (!isActive || string.IsNullOrEmpty(customConfig))
                                continue;

                            using var doc = JsonDocument.Parse(customConfig);
                            var timetableElement = doc.RootElement.GetProperty("Timetable");
                            if (timetableElement.ValueKind == JsonValueKind.Object && timetableElement.TryGetProperty("$values", out var values))
                                timetableElement = values;
                            var timetable = timetableElement.EnumerateArray()
                                .Select(t => TimeOnly.Parse(t.GetString()!))
                                .OrderBy(t => t)
                                .ToList();

                            var durationStr = doc.RootElement.GetProperty("TaskDuration").GetString();
                            var duration = TimeSpan.Parse(durationStr!);

                            TimeOnly? nextTime = null;
                            foreach (var t in timetable)
                            {
                                var candidate = new DateTime(nowLocal.Year, nowLocal.Month, nowLocal.Day, t.Hour, t.Minute, t.Second);
                                if (candidate > nowLocal)
                                {
                                    nextTime = t;
                                    break;
                                }
                            }

                            nextTime ??= timetable.First();

                            var nextLocalDate = new DateTime(nowLocal.Year, nowLocal.Month, nowLocal.Day, nextTime.Value.Hour, nextTime.Value.Minute, nextTime.Value.Second);
                            if (nextLocalDate <= nowLocal)
                                nextLocalDate = nextLocalDate.AddDays(1);

                            var nextUtcDate = TimeZoneInfo.ConvertTimeToUtc(nextLocalDate, tz);

                            result.Add(new
                            {
                                name = EventNames.GetValueOrDefault(typeId, "Unknown Event"),
                                nextRunUtc = nextUtcDate.ToString("o"),
                                countdownSeconds = (int)(nextUtcDate - nowUtc).TotalSeconds,
                                durationMinutes = (int)duration.TotalMinutes,
                                timetable = timetable.Select(t => t.ToString("HH:mm")).ToList(),
                                nextRunLocal = nextTime.Value.ToString("HH:mm"),
                                experienceMultiplier = doc.RootElement.TryGetProperty("ExperienceMultiplier", out var exp) ? exp.GetSingle() : (float?)null,
                            });
                        }
                    }
                }

                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error fetching events");
                    return Results.Json(new { code = "DATABASE_ERROR", message = "Database error. Please try again later." }, statusCode: 500);
            }
        });
    }
}
