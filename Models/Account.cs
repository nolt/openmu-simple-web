using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OpenMU_Web.Models;

[Table("Account", Schema = "data")]
public class Account
{
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
