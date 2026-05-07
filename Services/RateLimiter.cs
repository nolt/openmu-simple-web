using System.Collections.Concurrent;

namespace OpenMU_Web.Services;

public class RateLimiter
{
    private readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> _store = new();

    public bool IsLimited(string key, int maxAttempts, TimeSpan window)
    {
        var now = DateTime.UtcNow;
        var entry = _store.GetOrAdd(key, _ => (0, now));

        if (now - entry.WindowStart > window)
        {
            _store[key] = (1, now);
            return false;
        }

        if (entry.Count >= maxAttempts)
            return true;

        _store[key] = (entry.Count + 1, entry.WindowStart);
        return false;
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
