using System.Data;
using System.Globalization;
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

    // Names of OpenMU's AggregateType and InputOperator enums, by their stored number.
    private static readonly string[] AggregateTypes = { "AddRaw", "Multiplicate", "AddFinal", "Maximum" };
    private static readonly string[] InputOperators = { "Multiply", "Add", "Exponentiate", "ExponentiateByAttribute", "Maximum", "Minimum" };

    /// <summary>
    /// One option of an equipped item, in the shape of OpenMU's website API (WebsiteItemOption),
    /// so the browser can describe it like the game client (see wwwroot/js/item-tooltip.js).
    /// </summary>
    private sealed record OptionRow(
        string Type,
        int Number,
        int Level,
        string? Attribute,
        double? Value,
        string? Aggregate,
        string? RelatedAttribute,
        string? RelatedOperator,
        double? RelatedOperand);

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
                        split_part(cc.""Name"", '||', 1) as ""ClassName"",
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
                        split_part(d.""Name"", '||', 1) as ""ItemName"",
                        i.""Level"" as ""Level"",
                        i.""HasSkill"" as ""HasSkill"",
                        i.""SocketCount"" as ""Sockets"",
                        EXISTS(SELECT 1 FROM data.""ItemOptionLink"" ol
                               JOIN config.""IncreasableItemOption"" io ON ol.""ItemOptionId"" = io.""Id""
                               JOIN config.""ItemOptionType"" ot ON io.""OptionTypeId"" = ot.""Id""
                               WHERE ol.""ItemId"" = i.""Id"" AND split_part(ot.""Name"", '||', 1) = 'Excellent Option') as ""Excellent"",
                        (SELECT split_part(sg.""Name"", '||', 1) FROM data.""ItemItemOfItemSet"" iis
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

                // 3. Structured options of those items, resolved like OpenMU's website API
                //    (WebsiteItemDetails.CreateOption): the power-up of the option's level if the option
                //    is level dependent, else its own one. Options of LevelType.ItemLevel (1, e.g. the wing
                //    options) take the item's level instead of the link's level, like the game logic.
                var optionsByItem = new Dictionary<Guid, List<OptionRow>>();
                if (rows.Count > 0)
                {
                    const string optionsSql = @"
                        SELECT
                            ol.""ItemId"" as ""ItemId"",
                            split_part(ot.""Name"", '||', 1) as ""OptType"",
                            io.""Number"" as ""OptNumber"",
                            ol.""Level"" as ""OptLevel"",
                            ad.""Designation"" as ""Target"",
                            v.""Value"" as ""Value"",
                            v.""AggregateType"" as ""Aggregate"",
                            rel.""Designation"" as ""RelatedAttribute"",
                            rel.""InputOperator"" as ""RelatedOperator"",
                            rel.""InputOperand"" as ""RelatedOperand""
                        FROM data.""Item"" i
                        JOIN data.""ItemOptionLink"" ol ON ol.""ItemId"" = i.""Id""
                        JOIN config.""IncreasableItemOption"" io ON ol.""ItemOptionId"" = io.""Id""
                        JOIN config.""ItemOptionType"" ot ON io.""OptionTypeId"" = ot.""Id""
                        LEFT JOIN config.""PowerUpDefinition"" p ON p.""Id"" = COALESCE(
                            (SELECT lvl.""PowerUpDefinitionId"" FROM config.""ItemOptionOfLevel"" lvl
                             WHERE lvl.""IncreasableItemOptionId"" = io.""Id""
                               AND lvl.""Level"" = CASE WHEN io.""LevelType"" = 1 THEN i.""Level"" ELSE ol.""Level"" END
                             LIMIT 1),
                            io.""PowerUpDefinitionId"")
                        LEFT JOIN config.""AttributeDefinition"" ad ON p.""TargetAttributeId"" = ad.""Id""
                        LEFT JOIN config.""PowerUpDefinitionValue"" v ON p.""BoostId"" = v.""Id""
                        LEFT JOIN LATERAL (
                            SELECT ia.""Designation"", r.""InputOperator"", r.""InputOperand""
                            FROM config.""AttributeRelationship"" r
                            LEFT JOIN config.""AttributeDefinition"" ia ON r.""InputAttributeId"" = ia.""Id""
                            WHERE r.""PowerUpDefinitionValueId"" = v.""Id""
                            LIMIT 1) rel ON true
                        WHERE i.""ItemStorageId"" = @inventoryId AND i.""ItemSlot"" BETWEEN 0 AND 11";

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

                        list.Add(new OptionRow(
                            reader["OptType"].ToString() ?? "",
                            Convert.ToInt32(reader["OptNumber"]),
                            Convert.ToInt32(reader["OptLevel"]),
                            reader["Target"] as string,
                            reader["Value"] != DBNull.Value ? Convert.ToDouble(reader["Value"]) : null,
                            reader["Aggregate"] != DBNull.Value ? EnumName(AggregateTypes, Convert.ToInt32(reader["Aggregate"])) : null,
                            reader["RelatedAttribute"] as string,
                            reader["RelatedOperator"] != DBNull.Value ? EnumName(InputOperators, Convert.ToInt32(reader["RelatedOperator"])) : null,
                            reader["RelatedOperand"] != DBNull.Value ? Convert.ToDouble(reader["RelatedOperand"]) : null));
                    }
                }

                // The same item fields as the website API (WebsiteItem); the tooltip is built in the browser.
                var items = rows.Select(r => new
                {
                    slot = r.Slot,
                    group = r.Group,
                    number = r.Number,
                    name = r.Name,
                    level = r.Level,
                    isExcellent = r.Excellent,
                    isAncient = r.AncientSet != null,
                    ancientSetName = r.AncientSet,
                    sockets = r.Sockets,
                    hasSkill = r.HasSkill,
                    image = BuildImageName(r.Group, r.Number, r.Level, r.Slot, r.Excellent, r.AncientSet != null),
                    options = (optionsByItem.GetValueOrDefault(r.Id) ?? new List<OptionRow>())
                        .OrderBy(o => o.Type, StringComparer.Ordinal)
                        .ThenBy(o => o.Number)
                        .Select(o => new
                        {
                            type = o.Type,
                            number = o.Number,
                            level = o.Level,
                            attribute = o.Attribute,
                            value = o.Value,
                            aggregate = o.Aggregate,
                            relatedAttribute = o.RelatedAttribute,
                            relatedOperator = o.RelatedOperator,
                            relatedOperand = o.RelatedOperand,
                        })
                        .ToList(),
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

    private static string EnumName(string[] names, int value)
        => value >= 0 && value < names.Length ? names[value] : value.ToString(CultureInfo.InvariantCulture);
}
