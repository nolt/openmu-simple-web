using System.Data;
using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenMU_Web.Data;
using OpenMU_Web.Services;

namespace OpenMU_Web.Endpoints;

public static class ArmoryEndpoints
{
    // Maps the item level to the level used in the item image file name (mirrors the admin panel item editor).
    private static readonly int[] LevelMapping = { 0, 0, 0, 3, 3, 5, 5, 7, 7, 9, 9, 11, 11, 13, 13, 15, 15 };

    private const int WingsSlot = 7;
    private const int PetSlot = 8;

    private sealed class ItemRow
    {
        public Guid Id;
        public int Slot;
        public int Group;
        public int Number;
        public string Name = "";
        public int Level;
        public bool HasSkill;
        public int Sockets;
        public bool Excellent;
        public string? AncientSet;
    }

    private sealed class OptionRow
    {
        public string OptType = "";
        public string? Target;
        public double? Value;
    }

    public static void MapArmoryEndpoints(this WebApplication app)
    {
        app.MapGet("/api/public/armory/{name}", async (string name, OpenMuContext db, HttpContext context, [FromKeyedServices("armory")] RateLimiter rateLimiter, [FromServices] ILogger<Program> logger) =>
        {
            try
            {
                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                if (rateLimiter.IsLimited(ip, 30, TimeSpan.FromMinutes(1)))
                    return Results.Json(new { code = "RATE_LIMIT_ARMORY", message = "Too many requests. Try again later." }, statusCode: 429);

                name = name.Trim();
                if (name.Length is < 1 or > 10)
                    return Results.Json(new { code = "ARMORY_NOT_FOUND", message = "Character not found." }, statusCode: 404);

                var connection = db.Database.GetDbConnection();
                if (connection.State != ConnectionState.Open) await connection.OpenAsync();

                // 1. Character header (class, level, resets, master level) and its inventory id.
                Guid inventoryId;
                string className;
                int level, resets, masterLevel;

                const string headerSql = @"
                    SELECT
                        cc.""Name"" as ""ClassName"",
                        c.""InventoryId"",
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
                    WHERE c.""Name"" = @name
                    LIMIT 1";

                using (var command = connection.CreateCommand())
                {
                    command.CommandText = headerSql;
                    AddParameter(command, "name", name);
                    using var reader = await command.ExecuteReaderAsync();
                    if (!await reader.ReadAsync() || reader["InventoryId"] == DBNull.Value)
                        return Results.Json(new { code = "ARMORY_NOT_FOUND", message = "Character not found." }, statusCode: 404);

                    className = reader["ClassName"].ToString() ?? "";
                    inventoryId = (Guid)reader["InventoryId"];
                    level = reader["Level"] != DBNull.Value ? Convert.ToInt32(reader["Level"]) : 1;
                    resets = reader["Resets"] != DBNull.Value ? Convert.ToInt32(reader["Resets"]) : 0;
                    masterLevel = reader["MasterLevel"] != DBNull.Value ? Convert.ToInt32(reader["MasterLevel"]) : 0;
                }

                // 2. Equipped items only (slots 0-11 of the character inventory).
                const string itemsSql = @"
                    SELECT
                        i.""Id"" as ""Id"",
                        i.""ItemSlot"" as ""Slot"",
                        d.""Group"" as ""Grp"",
                        d.""Number"" as ""Num"",
                        d.""Name"" as ""ItemName"",
                        i.""Level"" as ""Level"",
                        i.""HasSkill"" as ""HasSkill"",
                        i.""SocketCount"" as ""Sockets"",
                        EXISTS(SELECT 1 FROM data.""ItemOptionLink"" ol
                               JOIN config.""IncreasableItemOption"" io ON ol.""ItemOptionId"" = io.""Id""
                               JOIN config.""ItemOptionType"" ot ON io.""OptionTypeId"" = ot.""Id""
                               WHERE ol.""ItemId"" = i.""Id"" AND ot.""Name"" = 'Excellent Option') as ""Excellent"",
                        (SELECT sg.""Name"" FROM data.""ItemItemOfItemSet"" iis
                         JOIN config.""ItemOfItemSet"" ois ON iis.""ItemOfItemSetId"" = ois.""Id""
                         JOIN config.""ItemSetGroup"" sg ON ois.""ItemSetGroupId"" = sg.""Id""
                         WHERE iis.""ItemId"" = i.""Id"" AND ois.""AncientSetDiscriminator"" > 0 LIMIT 1) as ""AncientSet""
                    FROM data.""Item"" i
                    JOIN config.""ItemDefinition"" d ON i.""DefinitionId"" = d.""Id""
                    WHERE i.""ItemStorageId"" = @inventoryId AND i.""ItemSlot"" BETWEEN 0 AND 11
                    ORDER BY i.""ItemSlot""";

                var rows = new List<ItemRow>();
                using (var command = connection.CreateCommand())
                {
                    command.CommandText = itemsSql;
                    AddParameter(command, "inventoryId", inventoryId);
                    using var reader = await command.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        rows.Add(new ItemRow
                        {
                            Id = (Guid)reader["Id"],
                            Slot = Convert.ToInt32(reader["Slot"]),
                            Group = Convert.ToInt32(reader["Grp"]),
                            Number = Convert.ToInt32(reader["Num"]),
                            Name = reader["ItemName"].ToString() ?? "",
                            Level = Convert.ToInt32(reader["Level"]),
                            HasSkill = reader["HasSkill"] != DBNull.Value && Convert.ToBoolean(reader["HasSkill"]),
                            Sockets = reader["Sockets"] != DBNull.Value ? Convert.ToInt32(reader["Sockets"]) : 0,
                            Excellent = Convert.ToBoolean(reader["Excellent"]),
                            AncientSet = reader["AncientSet"] != DBNull.Value ? reader["AncientSet"].ToString() : null,
                        });
                    }
                }

                // 3. Concrete options of those items, with the resolved target attribute and value.
                //    Level dependent options (e.g. the regular "+option") take their value from the
                //    matching ItemOptionOfLevel; the others use the option's own power up definition.
                var optionsByItem = new Dictionary<Guid, List<OptionRow>>();
                if (rows.Count > 0)
                {
                    const string optionsSql = @"
                        SELECT
                            ol.""ItemId"" as ""ItemId"",
                            ot.""Name"" as ""OptType"",
                            COALESCE(
                                (SELECT ad.""Designation"" FROM config.""ItemOptionOfLevel"" lvl
                                 JOIN config.""PowerUpDefinition"" p ON lvl.""PowerUpDefinitionId"" = p.""Id""
                                 JOIN config.""AttributeDefinition"" ad ON p.""TargetAttributeId"" = ad.""Id""
                                 WHERE lvl.""IncreasableItemOptionId"" = io.""Id"" AND lvl.""Level"" = ol.""Level"" LIMIT 1),
                                (SELECT ad.""Designation"" FROM config.""PowerUpDefinition"" p
                                 JOIN config.""AttributeDefinition"" ad ON p.""TargetAttributeId"" = ad.""Id""
                                 WHERE p.""Id"" = io.""PowerUpDefinitionId"" LIMIT 1)
                            ) as ""Target"",
                            COALESCE(
                                (SELECT v.""Value"" FROM config.""ItemOptionOfLevel"" lvl
                                 JOIN config.""PowerUpDefinition"" p ON lvl.""PowerUpDefinitionId"" = p.""Id""
                                 JOIN config.""PowerUpDefinitionValue"" v ON p.""BoostId"" = v.""Id""
                                 WHERE lvl.""IncreasableItemOptionId"" = io.""Id"" AND lvl.""Level"" = ol.""Level"" LIMIT 1),
                                (SELECT v.""Value"" FROM config.""PowerUpDefinition"" p
                                 JOIN config.""PowerUpDefinitionValue"" v ON p.""BoostId"" = v.""Id""
                                 WHERE p.""Id"" = io.""PowerUpDefinitionId"" LIMIT 1)
                            ) as ""Value""
                        FROM data.""Item"" i
                        JOIN data.""ItemOptionLink"" ol ON ol.""ItemId"" = i.""Id""
                        JOIN config.""IncreasableItemOption"" io ON ol.""ItemOptionId"" = io.""Id""
                        JOIN config.""ItemOptionType"" ot ON io.""OptionTypeId"" = ot.""Id""
                        WHERE i.""ItemStorageId"" = @inventoryId AND i.""ItemSlot"" BETWEEN 0 AND 11
                        ORDER BY ol.""ItemId"", ot.""Name""";

                    using var command = connection.CreateCommand();
                    command.CommandText = optionsSql;
                    AddParameter(command, "inventoryId", inventoryId);
                    using var reader = await command.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var itemId = (Guid)reader["ItemId"];
                        if (!optionsByItem.TryGetValue(itemId, out var list))
                        {
                            list = new List<OptionRow>();
                            optionsByItem[itemId] = list;
                        }

                        list.Add(new OptionRow
                        {
                            OptType = reader["OptType"].ToString() ?? "",
                            Target = reader["Target"] != DBNull.Value ? reader["Target"].ToString() : null,
                            Value = reader["Value"] != DBNull.Value ? Convert.ToDouble(reader["Value"]) : null,
                        });
                    }
                }

                var items = rows.Select(r => new
                {
                    slot = r.Slot,
                    image = BuildImageName(r.Group, r.Number, r.Level, r.Slot, r.Excellent, r.AncientSet != null),
                    description = BuildDescription(r, optionsByItem.GetValueOrDefault(r.Id)),
                    excellent = r.Excellent,
                    ancient = r.AncientSet != null,
                    sockets = r.Sockets,
                }).ToList();

                return Results.Ok(new { name, className, level, resets, masterLevel, items });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error fetching armory");
                return Results.Json(new { code = "DATABASE_ERROR", message = "Database error. Please try again later." }, statusCode: 500);
            }
        });
    }

    private static void AddParameter(System.Data.Common.DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static string BuildImageName(int group, int number, int level, int slot, bool excellent, bool ancient)
    {
        // Wings and pets always use the base image; everything else maps the level to an effect tier.
        int effectLevel = slot is WingsSlot or PetSlot
            ? 0
            : (level >= 0 && level < LevelMapping.Length ? LevelMapping[level] : 0);

        var suffix = ancient ? "_a" : (group < 12 && excellent ? "_e" : string.Empty);
        return $"item_{group}_{number}_{effectLevel}{suffix}.png";
    }

    private static string BuildDescription(ItemRow item, List<OptionRow>? options)
    {
        var header = new StringBuilder();
        if (item.Excellent)
        {
            header.Append("Excellent ");
        }

        if (!string.IsNullOrEmpty(item.AncientSet))
        {
            header.Append(item.AncientSet).Append(' ');
        }

        header.Append(item.Name);
        if (item.Level > 0)
        {
            header.Append('+').Append(item.Level);
        }

        // Each meaningful option is listed on its own line so the tooltip explains the item.
        var lines = new List<string> { header.ToString() };
        var allOptions = options ?? Enumerable.Empty<OptionRow>();

        // Luck is always listed first, directly under the item name.
        if (allOptions.Any(o => o.OptType.StartsWith("Luck", StringComparison.Ordinal)))
        {
            lines.Add("+ Luck");
        }

        // Then all the other options.
        foreach (var option in allOptions)
        {
            if (option.OptType.StartsWith("Luck", StringComparison.Ordinal))
            {
                continue;
            }

            // Individual socket seeds are represented by the socket count below.
            if (option.OptType == "Socket Option" || string.IsNullOrEmpty(option.Target))
            {
                continue;
            }

            // The value is only shown for additive "Option" bonuses; the others (excellent, wing,
            // fenrir, guardian, ...) are often percentages/chances, so they are listed by name only.
            var line = option.OptType switch
            {
                "Option" => $"+ {option.Target}{FormatValue(option.Value)}",
                "Excellent Option" => $"+ Exc: {option.Target}",
                "Wing Option" => $"+ Wing: {option.Target}",
                "Socket Bonus Option" => $"+ Socket Bonus: {option.Target}",
                _ => $"+ {option.Target}",
            };
            lines.Add(line);
        }

        if (item.Sockets > 0)
        {
            lines.Add($"+ {item.Sockets} Socket{(item.Sockets > 1 ? "s" : "")}");
        }

        // Skill is always listed last.
        if (item.HasSkill)
        {
            lines.Add("+ Skill");
        }

        return string.Join("\n", lines);
    }

    private static string FormatValue(double? value)
    {
        if (value is null)
        {
            return string.Empty;
        }

        // Option values are additive, so show them as a rounded "+N" bonus. Fractional values below 1
        // are multipliers/percentages rather than flat bonuses, so they are shown by name only (no "+0").
        var rounded = Math.Round(value.Value, MidpointRounding.AwayFromZero);
        if (Math.Abs(rounded) < 1)
        {
            return string.Empty;
        }

        return " +" + rounded.ToString("0", CultureInfo.InvariantCulture);
    }
}
