using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OpenMU_Web.Models;

[Table("ItemStorage", Schema = "data")]
public class ItemStorage
{
    [Key] public Guid Id { get; set; }
    public int Money { get; set; }
}
