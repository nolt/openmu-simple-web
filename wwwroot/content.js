// Server-wide settings shared across pages (not language-specific).
window.muConfig = {
    // Reset cap of the server. Characters who reached it get a glowing reset badge
    // in the ranking. Set to your server's real cap; 0 disables the highlight.
    maxResets: 10,

    // Download targets shown on the home page. Add/remove an entry here — no markup
    // edits. `recommended` highlights it as the preferred option; `soon` shows it as
    // an upcoming, non-clickable target.
    downloads: [
        { id: "launcher", icon: "🚀", name: "Launcher", url: "#", recommended: true },
        { id: "windows", icon: "🪟", name: "Windows", url: "#" },
        { id: "linux", icon: "🐧", name: "Linux", url: "#", soon: true },
    ],
};

window.muContent = {
    en: {
        welcomeTitle: "Welcome to OpenMU",
        welcomeText: `OpenMU is a free and open-source server emulator for MU Online.
Experience the game with custom features, active development, and a friendly community.`,
        rows: [
            [
                { label: "Experience", value: "x50" },
                { label: "Master XP", value: "x30" },
                { label: "Drop Rate", value: "70%" },
            ],
            [
                { label: "Max Level", value: "400" },
                { label: "Max Master Level", value: "200" },
            ],
            [
                { label: "Max Resets", value: "10" },
                { label: "Points per Reset", value: "400" },
            ],
            [
                { label: "Version", value: "Season 6 Ep 3" },
            ],
            [
                { label: "Discord", value: "Join our Discord", url: "https://discord.gg/your-invite" },
            ],
        ],
    },
    pl: {
        welcomeTitle: "Witaj na OpenMU",
        welcomeText: `OpenMU to darmowy, otwartoźródłowy emulator serwera MU Online.
Graj z customowymi funkcjami, aktywnym rozwojem i przyjazną społecznością.`,
        rows: [
            [
                { label: "Doświadczenie", value: "x50" },
                { label: "Master XP", value: "x30" },
                { label: "Drop", value: "70%" },
            ],
            [
                { label: "Max Level", value: "400" },
                { label: "Max Master Level", value: "200" },
            ],
            [
                { label: "Max Resetów", value: "10" },
                { label: "Punkty za reset", value: "400" },
            ],
            [
                { label: "Wersja", value: "Sezon 6 Ep 3" },
            ],
            [
                { label: "Discord", value: "Dołącz na Discord", url: "https://discord.gg/your-invite" },
            ],
        ],
    }
};

