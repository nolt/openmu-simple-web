-- Prints the "events" section of config/site.local.php from the OpenMU database: the timetable,
-- duration and experience multiplier of every active event, as the events page shows them.
--
-- The website itself never reads the database; run this once, and again after you change a
-- schedule in the admin panel. Read only - it changes nothing.
--
-- Usage (openmu-docker; the container name of your database may differ):
--   docker exec -i openmu-postgres psql -U postgres -d openmu -At < tools/events-timetable.sql
-- then paste the output into config/site.local.php:
--   return [
--       'events' => [
--           ...output...
--       ],
--   ];
--
-- Times are the server's local times (admin panel -> system configuration -> time zone); set
-- TIMEZ in .env to the same zone. Days: 0 = Sunday.

WITH
-- Event plugins shown on the events page, by their plugin id.
names (type_id, name) AS (VALUES
    ('548a76cc-242c-441c-bc9d-6c22745a2d72'::uuid, 'Red Dragon Invasion'),
    ('06d18a9e-2919-4c17-9dbc-6e4f7756495c'::uuid, 'Golden Invasion'),
    ('95e68c14-ad87-4b3c-af46-45b8f1c3bc2a'::uuid, 'Blood Castle'),
    ('3ad96a70-ed24-4979-80b8-169e461e548f'::uuid, 'Chaos Castle'),
    ('61c61a58-211e-4d6a-9ea1-d25e0c4a47c5'::uuid, 'Devil Square'),
    ('3ad96a70-ed24-4979-80b8-169e464e545f'::uuid, 'Illusion Temple'),
    ('6542e452-9780-45b8-85ae-4036422e9a6e'::uuid, 'Happy Hour'),
    ('4b5d0f55-5b26-4447-b9c0-c272e5d0a141'::uuid, 'White Wizard Invasion'),
    ('a8f3c2d1-9e74-4ecb-8963-08a3697278c4'::uuid, 'Kanturu Refinery Tower'),
    ('3e8b5c27-9d41-4a6f-b2c8-7f1d6e0a9b34'::uuid, 'Crywolf')
),
-- Active plugin configurations as JSON. Lists are stored either plain or as {"$values": [...]}.
active AS (
    SELECT n.name, p."CustomConfiguration"::jsonb AS cfg
    FROM config."PlugInConfiguration" p
    JOIN names n ON n.type_id = p."TypeId"
    WHERE p."IsActive" AND p."CustomConfiguration" IS NOT NULL
),
-- Events with a daily timetable: start times, duration (TaskDuration, "hh:mm:ss") and experience multiplier.
periodic AS (
    SELECT a.name,
        (SELECT string_agg(quote_literal(left(t, 5)), ', ' ORDER BY t)
         FROM jsonb_array_elements_text(coalesce(a.cfg -> 'Timetable' -> '$values', a.cfg -> 'Timetable')) t) AS times,
        NULL::text AS days,
        -- The tower of Kanturu stays open for hours; the old site didn't show that as a duration either.
        CASE WHEN a.name <> 'Kanturu Refinery Tower' AND a.cfg ->> 'TaskDuration' ~ '^\d{2}:\d{2}:\d{2}$'
             THEN floor(extract(epoch FROM (a.cfg ->> 'TaskDuration')::interval) / 60)::int END AS minutes,
        nullif(a.cfg ->> 'ExperienceMultiplier', '') AS multiplier
    FROM active a
    WHERE jsonb_typeof(coalesce(a.cfg -> 'Timetable' -> '$values', a.cfg -> 'Timetable')) = 'array'
),
-- Crywolf: every start time on every start day; the duration is notify 1 + notify 2 + ready + battle.
crywolf AS (
    SELECT a.name,
        string_agg(quote_literal(left(t, 5)), ', ' ORDER BY d.day, t) AS times,
        string_agg(d.day::text, ', ' ORDER BY d.day, t) AS days,
        max(floor(extract(epoch FROM
              coalesce((a.cfg ->> 'Notify1Duration')::interval, '10 minutes')
            + coalesce((a.cfg ->> 'Notify2Duration')::interval, '5 minutes')
            + coalesce((a.cfg ->> 'ReadyDuration')::interval, '150 seconds')
            + coalesce((a.cfg ->> 'BattleDuration')::interval, '15 minutes')) / 60))::int AS minutes,
        NULL::text AS multiplier
    FROM active a
    CROSS JOIN LATERAL (
        SELECT CASE WHEN v ~ '^\d+$' THEN v::int
                    ELSE array_position(ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], v) - 1 END AS day
        FROM jsonb_array_elements_text(coalesce(a.cfg -> 'StartDays' -> '$values', a.cfg -> 'StartDays')) v
    ) d
    CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(a.cfg -> 'StartTimes' -> '$values', a.cfg -> 'StartTimes')) t
    WHERE a.name = 'Crywolf' AND d.day IS NOT NULL
    GROUP BY a.name
),
-- Castle Siege: the battle (state 7) of the enabled siege; it lasts until the next state of the week.
siege_schedule AS (
    SELECT s."State" AS state, s."DayOfWeek" AS day, s."Hour" AS hour, s."Minute" AS minute,
        s."DayOfWeek" * 1440 + s."Hour" * 60 + s."Minute" AS week_minute
    FROM config."CastleSiegeStateScheduleEntry" s
    JOIN config."CastleSiegeConfiguration" c ON c."Id" = s."CastleSiegeConfigurationId"
    WHERE c."Enabled"
      AND EXISTS (SELECT 1 FROM config."PlugInConfiguration" p
                  WHERE p."TypeId" = 'b7f62fa9-59e6-49e9-b499-0358a14957cf' AND p."IsActive")
),
siege AS (
    SELECT 'Castle Siege'::text AS name,
        quote_literal(lpad(b.hour::text, 2, '0') || ':' || lpad(b.minute::text, 2, '0')) AS times,
        b.day::text AS days,
        (SELECT min((n.week_minute - b.week_minute + 10080) % 10080) FROM siege_schedule n
         WHERE n.week_minute <> b.week_minute) AS minutes,
        NULL::text AS multiplier
    FROM siege_schedule b
    WHERE b.state = 7
    LIMIT 1
),
everything AS (
    SELECT * FROM periodic UNION ALL SELECT * FROM crywolf UNION ALL SELECT * FROM siege
)
SELECT format('    %s => [''timetable'' => [%s]%s%s%s],',
              quote_literal(name), times,
              CASE WHEN days IS NOT NULL THEN format(', ''days'' => [%s]', days) ELSE '' END,
              CASE WHEN minutes IS NOT NULL AND minutes > 0 THEN format(', ''durationMinutes'' => %s', minutes) ELSE '' END,
              CASE WHEN multiplier IS NOT NULL THEN format(', ''experienceMultiplier'' => %s', multiplier) ELSE '' END)
FROM everything
WHERE times IS NOT NULL
ORDER BY name;
