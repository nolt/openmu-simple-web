using Microsoft.EntityFrameworkCore;
using OpenMU_Web.Models;

namespace OpenMU_Web.Data;

public class OpenMuContext : DbContext
{
    public OpenMuContext(DbContextOptions<OpenMuContext> options) : base(options) { }

    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<ItemStorage> ItemStorages => Set<ItemStorage>();
    public DbSet<Character> Characters => Set<Character>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Account>()
            .HasOne<ItemStorage>()
            .WithMany()
            .HasForeignKey(a => a.VaultId);
    }
}
