using System.Collections.Concurrent;

namespace OpenMU_Web.Services;

public class RateLimiter
{
    private readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> _store = new();

    public bool IsLimited(string key, int maxAttempts, TimeSpan window)
    {
        var now = DateTime.UtcNow;
        var (count, _) = _store.AddOrUpdate(key,
            _ => (1, now),
            (_, entry) =>
            {
                if (now - entry.WindowStart > window)
                    return (1, now);
                return (entry.Count + 1, entry.WindowStart);
            });

        return count > maxAttempts;
    }

    public void Cleanup(DateTime now, TimeSpan expiration)
    {
        var expiredKeys = _store
            .Where(kvp => now - kvp.Value.WindowStart > expiration)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredKeys)
            _store.TryRemove(key, out _);
    }
}
