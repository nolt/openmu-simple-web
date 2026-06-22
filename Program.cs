using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using OpenMU_Web.Data;
using OpenMU_Web.Endpoints;
using OpenMU_Web.Services;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// --- SERVICES ---
builder.Services.AddRazorPages();
builder.Services.AddDbContext<OpenMuContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", p => p
        .AllowAnyOrigin()
        .AllowAnyMethod()
        .AllowAnyHeader());
});

// Rate limiting stores
builder.Services.AddSingleton<ConcurrentDictionary<string, DateTime>>(_ => new ConcurrentDictionary<string, DateTime>());
builder.Services.AddKeyedSingleton<RateLimiter>("password");
builder.Services.AddKeyedSingleton<RateLimiter>("ranking");
builder.Services.AddKeyedSingleton<RateLimiter>("events");
builder.Services.AddKeyedSingleton<RateLimiter>("armory");
builder.Services.AddHttpClient();

var app = builder.Build();

app.UseCors("AllowAll");

// Friendly URLs are now owned by Razor Pages (Pages/*.cshtml, routed via @@page "/route");
// no URL rewriting needed. Static assets (css/js/img/translations) are served from wwwroot.
app.UseStaticFiles();

// Periodic cleanup of expired rate limiter entries (every 10 minutes)
var cleanupTimer = new PeriodicTimer(TimeSpan.FromMinutes(10));
_ = Task.Run(async () =>
{
    while (await cleanupTimer.WaitForNextTickAsync())
    {
        var now = DateTime.UtcNow;
        var ipLimit = app.Services.GetRequiredService<ConcurrentDictionary<string, DateTime>>();
        var passwordLimiter = app.Services.GetRequiredKeyedService<RateLimiter>("password");
        var rankingLimiter = app.Services.GetRequiredKeyedService<RateLimiter>("ranking");
        var eventsLimiter = app.Services.GetRequiredKeyedService<RateLimiter>("events");
        var armoryLimiter = app.Services.GetRequiredKeyedService<RateLimiter>("armory");

        foreach (var key in ipLimit.Keys)
            if (ipLimit[key] < now.AddDays(-1)) ipLimit.TryRemove(key, out _);

        passwordLimiter.Cleanup(now, TimeSpan.FromMinutes(15));
        rankingLimiter.Cleanup(now, TimeSpan.FromMinutes(1));
        eventsLimiter.Cleanup(now, TimeSpan.FromMinutes(1));
        armoryLimiter.Cleanup(now, TimeSpan.FromMinutes(1));
    }
});

// --- 2. ENDPOINTS ---
app.MapRazorPages();
app.MapRegistrationEndpoints();
app.MapPasswordEndpoints();
app.MapRankingEndpoints();
app.MapEventsEndpoints();
app.MapArmoryEndpoints();

var serverCheckConfig = builder.Configuration.GetSection("ServerCheck");
var serverHost = serverCheckConfig["Host"] ?? "openmu-server";
var serverPort = int.Parse(serverCheckConfig["Port"] ?? "44406");

app.MapGet("/api/public/server-status", async () =>
{
    try
    {
        using var tcp = new System.Net.Sockets.TcpClient();
        await tcp.ConnectAsync(serverHost, serverPort).WaitAsync(TimeSpan.FromSeconds(2));
        return Results.Json(new { online = true });
    }
    catch
    {
        return Results.Json(new { online = false });
    }
});

app.MapGet("/api/public/online-players", async (ILogger<Program> logger, IHttpClientFactory httpClientFactory) =>
{
    try
    {
        using var http = httpClientFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(3);
        var response = await http.GetStringAsync($"http://{serverHost}:8080/api/status");
        using var doc = JsonDocument.Parse(response);
        var players = doc.RootElement.GetProperty("players").GetInt32();
        return Results.Json(new { playerCount = players });
    }
    catch (Exception ex)
    {
        logger.LogDebug(ex, "Failed to fetch player count");
        return Results.Json(new { playerCount = (int?)null });
    }
});

app.Run();
