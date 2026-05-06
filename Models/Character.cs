using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OpenMU_Web.Models;

[Table("Character", Schema = "data")]
public class Character
{
    [Key] public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public long Experience { get; set; }
    public Guid CharacterClassId { get; set; }
}
