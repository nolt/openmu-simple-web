using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Rewrite;
using System.Collections.Concurrent;
using OpenMU_Web.Data;
using OpenMU_Web.Endpoints;
using OpenMU_Web.Services;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// --- SERVICES ---
builder.Services.AddControllers();
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
builder.Services.AddSingleton<PasswordRateLimiter>();
builder.Services.AddSingleton<RankingRateLimiter>();

var app = builder.Build();

app.UseCors("AllowAll");

// --- 1. REDIRECTIONS (SEO and Friendly URLs) ---
var rewriteOptions = new RewriteOptions()
    .AddRewrite("^changepass$", "changepass.html", skipRemainingRules: true)
    .AddRewrite("^stats$", "stats.html", skipRemainingRules: true)
    .AddRewrite("^$", "index.html", skipRemainingRules: true);

app.UseRewriter(rewriteOptions);
app.UseStaticFiles();
app.UseDefaultFiles();

// Periodic cleanup of expired rate limiter entries (every 10 minutes)
var cleanupTimer = new PeriodicTimer(TimeSpan.FromMinutes(10));
_ = Task.Run(async () =>
{
    while (await cleanupTimer.WaitForNextTickAsync())
    {
        var now = DateTime.UtcNow;
        var ipLimit = app.Services.GetRequiredService<ConcurrentDictionary<string, DateTime>>();
        var passwordLimiter = app.Services.GetRequiredService<PasswordRateLimiter>();
        var rankingLimiter = app.Services.GetRequiredService<RankingRateLimiter>();

        foreach (var key in ipLimit.Keys)
            if (ipLimit[key] < now.AddDays(-1)) ipLimit.TryRemove(key, out _);

        passwordLimiter.Cleanup(now);
        rankingLimiter.Cleanup(now);
    }
});

// --- 2. ENDPOINTS ---
app.MapRegistrationEndpoints();
app.MapPasswordEndpoints();
app.MapRankingEndpoints();

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

app.MapControllers();
app.Run();
