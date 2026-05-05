using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Rewrite;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.RegularExpressions;
using System.Collections.Concurrent;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<OpenMuContext>(options => options.UseNpgsql(connectionString));

var app = builder.Build();

// --- 1. REDIRECTION CONFIG (HIDE .HTML) ---
var rewriteOptions = new RewriteOptions()
    .AddRewrite("^changepass$", "changepass.html", skipRemainingRules: true)
    .AddRewrite("^$", "index.html", skipRemainingRules: true);

app.UseRewriter(rewriteOptions);
app.UseStaticFiles(); // Serv files from wwwroot (js, css, images)
app.UseDefaultFiles(); // Allow index.html as default

ConcurrentDictionary<string, DateTime> ipLimit = new();

// --- 2. ENDPOINT: REGISTRATION ---
app.MapPost("/api/register", async (HttpContext context, OpenMuContext db) => {
    try {
        var remoteIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (ipLimit.TryGetValue(remoteIp, out var lastReg) && lastReg > DateTime.UtcNow.AddDays(-1))
            return Results.Content("Limit 1 konta na 24h dla tego IP.", "text/plain", System.Text.Encoding.UTF8, 429);

        var form = await context.Request.ReadFormAsync();
        var username = form["username"].ToString().Trim();
        var password = form["password"].ToString();

        if (!Regex.IsMatch(username, "^[a-zA-Z0-9]{3,12}$")) 
            return Results.Content("Zły format loginu (3-12 znaków, bez spacji).", "text/plain", System.Text.Encoding.UTF8, 400);
        
        if (password.Length < 8 || password.Length > 16) 
            return Results.Content("Hasło musi mieć 8-16 znaków.", "text/plain", System.Text.Encoding.UTF8, 400);
        
        if (await db.Accounts.AnyAsync(a => a.LoginName == username)) 
            return Results.Content("Login jest już zajęty.", "text/plain", System.Text.Encoding.UTF8, 400);

        // Creating (Vault)
        var newVault = new ItemStorage { Id = Guid.NewGuid(), Money = 0 };
        db.ItemStorages.Add(newVault);
        await db.SaveChangesAsync();

        // Creating account
        var account = new Account {
            Id = Guid.NewGuid(),
            LoginName = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            SecurityCode = form["securityCode"].ToString(),
            EMail = form["email"].ToString(),
            RegistrationDate = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
            VaultId = newVault.Id,
            LanguageIsoCode = "en",
            State = 0
        };

        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        
        ipLimit[remoteIp] = DateTime.UtcNow;
        return Results.Ok("Konto i depozyt zostały utworzone pomyślnie!");
    }
    catch (Exception ex) { 
        return Results.Content("Błąd: " + (ex.InnerException?.Message ?? ex.Message), "text/plain", System.Text.Encoding.UTF8, 500); 
    }
});

// --- 3. ENDPOINT: CHANGE PASSWORD ---
app.MapPost("/api/change-password", async (HttpContext context, OpenMuContext db) => {
    try {
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
    catch (Exception ex) {
        return Results.Content("Błąd: " + ex.Message, "text/plain", System.Text.Encoding.UTF8, 500);
    }
});

app.Run();

// --- 4. DATA MODELS ---
[Table("ItemStorage", Schema = "data")]
public class ItemStorage { 
    [Key] public Guid Id { get; set; } 
    public int Money { get; set; } 
}

[Table("Account", Schema = "data")]
public class Account {
    [Key] public Guid Id { get; set; }
    public string LoginName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string SecurityCode { get; set; } = "";
    public string EMail { get; set; } = "";
    public DateTime RegistrationDate { get; set; }
    public int State { get; set; } = 0;
    public short TimeZone { get; set; } = 0;
    public string VaultPassword { get; set; } = "";
    public bool IsVaultExtended { get; set; } = false;
    public bool IsTemplate { get; set; } = false;
    public string LanguageIsoCode { get; set; } = "en";
    public Guid? VaultId { get; set; }
}

public class OpenMuContext : DbContext { 
    public OpenMuContext(DbContextOptions<OpenMuContext> options) : base(options) { } 
    public DbSet<Account> Accounts => Set<Account>(); 
    public DbSet<ItemStorage> ItemStorages => Set<ItemStorage>(); 
}
