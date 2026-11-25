// Item tooltip of the armory, in the words, numbers, colours and order of the Season 6 game client.
//
// The armory API (/api/public/armory/{name}) sends an equipped item like OpenMU's website API: its
// identity (group, number), + level, excellent/ancient flags, ancient set name and the options in a
// neutral, technical form (option type, number, level, target attribute, boost value, aggregate type,
// related attribute). This file turns that into the tooltip the player knows from the game:
//
// - the option lines, e.g. "Excellent Damage rate +10%" instead of "Excellent Damage Chance";
// - with the client item data in /data (items.json, item-sets.json, skills.json, generated from the
//   MuMain client data): the white stat lines (damage, defense, attack speed, durability,
//   requirements), the class lines, the skill line with its mana, the item's own description lines
//   and the ancient set block, computed with the client's formulas.
//
// It is a port of the item tooltip of the WordPress plugin openmu-wp-connect (item-options.php and
// item-data.php), which reproduces MuMain's ItemStats.cpp, ZzzInventory.cpp, ItemTooltipValues.cpp
// and CSItemOption.cpp. An item the client data doesn't know gets the option lines only, and an
// option this file has no text for is shown as "attribute +value", so nothing disappears silently.
//
// Texts are English; other languages come from window.muItemTexts[lang] (e.g. item-texts.pl.js),
// keyed by the English text. Usage:
//   await ItemTooltip.load();
//   const { title, titleKind, lines } = ItemTooltip.build(item, character);
// lines are { text, kind } pairs; kind is the colour class (option, excellent, ancient, stat, gap, ...).
(function () {
    'use strict';

    // Client item data, loaded once by load(); empty lists until then (option lines only).
    let data = { items: {}, stats: {}, texts: {}, sets: {}, skills: {} };

    // ---------- Text helpers ----------

    // Translates an English text into the current page language, or keeps it.
    function __(text) {
        const lang = typeof window.currentLang === 'function' ? window.currentLang() : 'en';
        const table = (window.muItemTexts || {})[lang];
        return (table && table[text]) || text;
    }

    // printf-style formatting for the texts: %d, %s, %% and numbered %1$d / %2$s.
    function sprintf(format, ...args) {
        let next = 0;
        return format.replace(/%(?:(\d+)\$)?([ds%])/g, (match, position, type) => {
            if (type === '%') return '%';
            const value = position ? args[Number(position) - 1] : args[next++];
            return type === 'd' ? String(Math.trunc(Number(value) || 0)) : String(value ?? '');
        });
    }

    // Whole-number division like PHP's intdiv() / C++ integer division (towards zero).
    function intdiv(a, b) {
        return Math.trunc(a / b);
    }

    // PHP round(): halves away from zero (Math.round rounds -0.5 up).
    function round(value) {
        return Math.sign(value) * Math.round(Math.abs(value));
    }

    function line(text, kind) {
        return { text, kind };
    }

    function gap() {
        return line('', 'gap');
    }

    function optionTypes(item) {
        return (item.options || []).map(option => String(option.type || ''));
    }

    // ---------- Title ----------

    // Tooltip title like the game: "Excellent", the ancient set name, the item name and "+level".
    function itemTitle(item) {
        let title = String(item.name || '');
        const set = String(item.ancientSetName || '');
        if (set !== '') title = sprintf(__('%1$s %2$s'), set, title);
        if (item.isExcellent) title = sprintf(__('Excellent %s'), title);
        const level = Number(item.level || 0);
        if (level > 0) title += ' +' + level;

        // The Horn of Fenrir is named after its option, like in the client's item data.
        const types = optionTypes(item);
        if (types.includes('Gold Fenrir Option')) title = sprintf(__('%s +Illusion'), title);
        else if (types.includes('Blue Fenrir Option')) title = sprintf(__('%s +Protect'), title);
        else if (types.includes('Black Fenrir Option')) title = sprintf(__('%s +Destroy'), title);
        return title;
    }

    // Colour of the title, in the client's order (StandardItemNameColor in ZzzInventory.cpp).
    function itemTitleKind(item, lines) {
        // Divine Archangel weapons have their own purple name in the client's item data.
        const archangel = ['0/19', '2/13', '4/18', '5/10', '5/36'];
        if (archangel.includes(`${item.group}/${item.number}`)) return 'purple';
        if (item.isAncient || String(item.ancientSetName || '') !== '') return 'set';
        if (item.isExcellent) return 'excellent';
        if (Number(item.sockets || 0) > 0) return 'violet';
        if (Number(item.level || 0) >= 7) return 'ancient';
        return lines.length > 0 || item.hasSkill ? 'option' : 'plain';
    }

    // ---------- Option lines (item-options.php) ----------

    // Maps the neutral option type name of the server configuration to a section of the tooltip.
    function optionSection(type) {
        if (type.startsWith('Luck')) return 'luck';
        switch (type) {
            case 'Excellent Option': return 'excellent';
            case 'Wing Option': return 'wing';
            case 'Option': return 'option';
            case 'Jewel of Harmony Option':
            case 'Harmony Option': return 'harmony';
            case 'Guardian Option': return 'guardian';
            case 'Ancient Bonus Option': return 'ancientBonus';
            case 'Socket Option': return 'socket';
            case 'Socket Bonus Option': return 'socketBonus';
            case 'Blue Fenrir Option':
            case 'Black Fenrir Option':
            case 'Gold Fenrir Option':
            case 'Dark Horse Option': return 'pet';
            default: return 'other';
        }
    }

    // The number shown in an option text, from the boost value:
    // int (rounded), percent (chance 0.1 or multiplier 1.04/0.9 in percent), inverse (1/8 → 8),
    // per_level (divisor of a value per character level), fraction (percent below 1, else int).
    function optionNumber(option, mode) {
        const value = Number(option.value || 0);
        const operand = Number(option.relatedOperand || 0);
        switch (mode) {
            case 'percent': return round(option.aggregate === 'Multiplicate' ? Math.abs(value - 1) * 100 : value * 100);
            case 'inverse': return value > 0 ? round(1 / value) : 0;
            case 'per_level': return operand > 0 ? round(1 / operand) : 0;
            case 'fraction': return round(Math.abs(value) < 1 ? value * 100 : value);
            default: return round(value);
        }
    }

    // A float for the fallback text: at most three decimals, without trailing zeros.
    function formatFloat(value) {
        return Number(value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    }

    // An option without a text: "attribute +value", with the related part of a relative bonus.
    function optionFallback(option) {
        let text = String(option.attribute || '') || String(option.type || '');
        const value = option.value != null ? Number(option.value) : 0;
        if (value !== 0) text += ' +' + formatFloat(value);
        const related = String(option.relatedAttribute || '');
        if (related !== '') {
            text = sprintf(__('%1$s + %2$s × %3$s'), text, related, formatFloat(Number(option.relatedOperand || 0)));
        }
        return text !== '' ? text : __('Unknown option');
    }

    // The text table, per section: target attribute (designation in OpenMU) → [format, value mode],
    // a list of those for options with two lines, or by_aggregate when the aggregate type decides.
    // English texts of the MuMain client, with its typos corrected. Built per call, so the language counts.
    function optionTexts() {
        return {
            // Excellent options (ExcellentOptions.cs).
            excellent: {
                'Mana recover after Monster kill, multiplier of max mana': [__('Increases acquisition rate of Mana after hunting monsters +Mana/%d'), 'inverse'],
                'Health recover after Monster kill, multiplier of max health': [__('Increases acquisition rate of Life after hunting monsters +life/%d'), 'inverse'],
                'Attack Speed Any': [__('Increase Attacking(Wizardry)speed +%d'), 'int'],
                'Physical Base Damage Increase': [__('Increase Damage +%d%%'), 'percent'],
                'Wizardry Base Damage Increase': [__('Increase Wizardry Dmg +%d%%'), 'percent'],
                'Physical Base Damage (min and max)': [__('Increase Damage +level/%d'), 'per_level'],
                'Wizardry Base Damage (min and max)': [__('Increase Wizardry Dmg +level/%d'), 'per_level'],
                'Excellent Damage Chance': [__('Excellent Damage rate +%d%%'), 'percent'],
                'Money Drop Amount Rate': [__('Increases acquisition rate of Zen after hunting monsters +%d%%'), 'percent'],
                'Defense Rate (PvM)': [__('Defense success rate +%d%%'), 'percent'],
                'Damage Reflection': [__('Reflect Damage +%d%%'), 'percent'],
                'Armor Damage Decrease': [__('Damage Decrease +%d%%'), 'percent'],
                'Maximum Mana': [__('Increase Max Mana +%d%%'), 'percent'],
                'Maximum Health': [__('Increase Max HP +%d%%'), 'percent'],
            },
            // Options of the 2nd and 3rd wings and the capes (Wings.cs).
            wing: {
                'Maximum Health': [__('HP +%d increased'), 'int'],
                'Maximum Mana': [__('Mana +%d increased'), 'int'],
                'Defense Ignore Chance': [__("Ignore opponent's defensive power by %d%%"), 'percent'],
                'Total Leadership': [__('Increase command +%d'), 'int'],
                'Chance to fully reflect damage when getting hit': [__("Returns the enemy's attack power in %d%%"), 'percent'],
                'Chance to fully recover health when getting hit': [__('Complete recovery of life in %d%% rate'), 'percent'],
                'Chance to fully recover mana when getting hit': [__('Complete recovery of Mana in %d%% rate'), 'percent'],
            },
            // The regular "+option" (Jewel of Life) and the Dinorant options.
            option: {
                'Physical Base Damage (min and max)': [__('Additional Dmg +%d'), 'int'],
                'Wizardry Base Damage (min and max)': [__('Additional Wizardry Dmg +%d'), 'int'],
                'Curse Base Damage (min and max)': [__('Additional Curse Spell +%d'), 'int'],
                // Magic Gladiator swords: the client writes the damage and the wizardry damage line.
                'Base Damage Bonus (physical and wizardry, min and max)': [
                    [__('Additional Dmg +%d'), 'int'],
                    [__('Additional Wizardry Dmg +%d'), 'int'],
                ],
                'Base Defense': [__('Additional defense +%d'), 'int'],
                'Defense Rate (PvM)': [__('Additional defense rate +%d'), 'int'],
                'Health Recovery Multiplier': [__('Automatic HP recovery %d%%'), 'percent'],
                'Maximum Mana': [__('Max mana increased by %d%%'), 'percent'],
                'Maximum Ability': {
                    by_aggregate: {
                        Multiplicate: [__('Max AG increased by %d%%'), 'percent'], // Pendant of Ability
                        '*': [__('Max AG +%d increased'), 'int'],                   // Horn of Dinorant
                    },
                },
                'Damage Receive Multiplier': [__('Absorb %d%% additional damage'), 'percent'],
                'Attack Speed Any': [__('Increase Attacking(Wizardry)speed +%d'), 'int'],
            },
            // Jewel of Harmony options (HarmonyOptions.cs).
            harmony: {
                'Minimum Physical Base Damage': [__('Min. attack increase +%d'), 'int'],
                'Maximum Physical Base Damage': [__('Max. attack increase +%d'), 'int'],
                'Strength Requirement reduction': [__('Required strength decrease +%d'), 'int'],
                'Agility Requirement reduction': [__('Required agility decrease +%d'), 'int'],
                'Physical Base Damage (min and max)': [__('Attack increase(Min,Max) +%d'), 'int'],
                'Wizardry Base Damage (min and max)': [__('Wizardry increase +%d'), 'int'],
                'Critical Damage Bonus': [__('Critical damage increase +%d'), 'int'],
                'Skill Damage Bonus': [__('Skill attack increase +%d'), 'int'],
                'Attack Rate (PvP)': [__('Attack success rate increase(PVP) +%d'), 'int'],
                'SD decrease rate increase': [__('SD decrement increase +%d'), 'fraction'],
                'Shield Bypass Chance': [__('SD bypass rate increase +%d'), 'fraction'],
                'Base Defense': [__('Defense increase +%d'), 'int'],
                'Maximum Ability': [__('Max. AG increase +%d'), 'int'],
                'Maximum Health': [__('Max. HP increase +%d'), 'int'],
                'Health Recovery Absolute Increase': [__('Life auto increment increase +%d'), 'int'],
                'Mana Recovery Absolute Increase': [__('Mana auto increment increase +%d'), 'int'],
                'Defense Rate (PvP)': [__('Defense success rate increase(PVP) +%d'), 'int'],
                'Armor Damage Decrease': [__('Damage decrement increase +%d%%'), 'fraction'],
                'SD Rate Increase': [__('SD ratio increase +%d'), 'fraction'],
            },
            // Options of the level 380 items (GuardianOptions.cs).
            guardian: {
                'Attack Rate (PvP)': [__('Attack success rate increase +%d'), 'int'],
                'Final Damage Increase (PvP)': [__('Additional Damage +%d'), 'int'],
                'Defense Rate (PvP)': [__('Defense success rate increase +%d'), 'int'],
                'Defense (PvP)': [__('Defensive skill +%d'), 'int'],
                'Maximum Health': [__('Max. HP increase +%d'), 'int'],
                'Maximum Shield': [__('Max. SD increase +%d'), 'int'],
                'Shield Recovery Active Everywhere': [__('SD auto recovery'), 'none'],
                'Shield Recovery Multiplier': [__('SD recovery rate increase +%d%%'), 'int'],
            },
            // The +5/+10 stat option of ancient items; the client calls vitality stamina.
            ancientBonus: {
                'Total Strength': [__('Increase strength +%d'), 'int'],
                'Total Agility': [__('Increase agility +%d'), 'int'],
                'Total Vitality': [__('Increase stamina +%d'), 'int'],
                'Total Energy': [__('Increase energy +%d'), 'int'],
            },
            // Fenrir options (Pets.cs), keyed by "type|attribute".
            pet: {
                'Black Fenrir Option|Attack Damage Increase': [__('Increase final damage %d%%'), 'percent'],
                'Blue Fenrir Option|Damage Receive Multiplier': [__('Absorb final damage %d%%'), 'percent'],
                'Gold Fenrir Option|Maximum Health': [__('Added %s of Life'), 'level'],
                'Gold Fenrir Option|Maximum Mana': [__('Added %s of Mana'), 'level'],
                'Gold Fenrir Option|Physical Base Damage (min and max)': [__('Added %s Attack'), 'level'],
                'Gold Fenrir Option|Wizardry Base Damage (min and max)': [__('Added %s Wizardry'), 'level'],
            },
            // Seed spheres (SocketSystem.cs): attribute → [element, option name, value mode].
            socket: {
                'Base Damage Bonus (physical and wizardry, min and max)|related': [__('Fire'), __('(Level type)Attack/Wizardry increase'), 'per_level'],
                'Attack Speed Any': [__('Fire'), __('Attack speed increase'), 'int'],
                'Base Max Damage Bonus (physical and wizardry)': [__('Fire'), __('Maximum attack/Wizardry increase'), 'int'],
                'Base Min Damage Bonus (physical and wizardry)': [__('Fire'), __('Minimum attack/Wizardry increase'), 'int'],
                'Base Damage Bonus (physical and wizardry, min and max)': [__('Fire'), __('Attack/Wizardry increase'), 'int'],
                'Ability Usage Reduction': [__('Fire'), __('AG cost decrease'), 'percent'],
                'Defense Rate (PvM)': [__('Water'), __('Block rating increase'), 'percent'],
                'Final Defense': [__('Water'), __('Defense increase'), 'int'],
                'Shield Item Defense Increase Multiplier': [__('Water'), __('Shield protection increase'), 'percent'],
                'Armor Damage Decrease': [__('Water'), __('Damage reduction'), 'percent'],
                'Damage Reflection': [__('Water'), __('Damage reflection'), 'percent'],
                'Health recover after Monster kill, multiplier of max health': [__('Ice'), __('Monster destruction for the Life increase'), 'inverse'],
                'Mana recover after Monster kill, multiplier of max mana': [__('Ice'), __('Monster destruction for the Mana increase'), 'inverse'],
                'Skill Damage Bonus': [__('Ice'), __('Skill attack increase'), 'int'],
                'Attack Rate (PvM)': [__('Ice'), __('Attack rating increase'), 'int'],
                'Weapon Duration Increase': [__('Ice'), __('Item durability increase'), 'percent'],
                'Health Recovery Absolute Increase': [__('Wind'), __('Automatic Life recovery increase'), 'int'],
                'Maximum Health|Multiplicate': [__('Wind'), __('Maximum Life increase'), 'percent'],
                'Maximum Mana': [__('Wind'), __('Maximum Mana increase'), 'percent'],
                'Mana Recovery Absolute Increase': [__('Wind'), __('Automatic Mana recovery increase'), 'int'],
                'Maximum Ability': [__('Wind'), __('Maximum AG increase'), 'int'],
                'Ability Recovery Absolute Increase': [__('Wind'), __('AG value increase'), 'int'],
                'Excellent Damage Bonus': [__('Lightning'), __('Excellent damage increase'), 'int'],
                'Excellent Damage Chance': [__('Lightning'), __('Excellent damage rate increase'), 'percent'],
                'Critical Damage Bonus': [__('Lightning'), __('Critical damage increase'), 'int'],
                'Critical Damage Chance': [__('Lightning'), __('Critical damage rate increase'), 'percent'],
                'Maximum Health': [__('Earth'), __('Health increase'), 'int'],
            },
            // Socket bonus options by their number (SocketSystem.cs).
            socketBonus: {
                0: __('Attack power increase'),
                1: __('Skill attack increase'),
                2: __('Attack/Wizardry increase'),
                3: __('Skill attack increase'),
                4: __('Defense increase'),
                5: __('Maximum Life increase'),
            },
        };
    }

    // One option → its tooltip lines (empty for options the game doesn't show).
    function optionLines(option, section, characterLevel, texts) {
        const attribute = String(option.attribute || '');
        const type = String(option.type || '');

        // A "+option" of level 0 has no power-up: the item can take the option, but hasn't got it yet.
        if (section === 'option' && option.value == null && String(option.relatedAttribute || '') === '') return [];
        // The Fenrir's movement speed is the separate "Increase speed" line.
        if (section === 'pet' && attribute.startsWith('Movement Speed')) return [];

        const kind = ['excellent', 'wing', 'harmony', 'guardian'].includes(section) ? section : 'option';
        let rules = (texts[section] || {})[attribute];
        if (section === 'pet') rules = texts.pet[type + '|' + attribute];
        if (rules && !Array.isArray(rules) && rules.by_aggregate) {
            rules = rules.by_aggregate[String(option.aggregate || '')] || rules.by_aggregate['*'];
        }
        if (!Array.isArray(rules)) return [line(optionFallback(option), kind)];

        // A rule is [format, mode], or a list of them for options with more than one line.
        const list = Array.isArray(rules[0]) ? rules : [rules];
        return list.map(([format, mode]) => {
            if (mode === 'none') return line(format, kind);
            if (mode === 'level') {
                // Per character level: the number for a known wearer, else the formula "level/2".
                const divisor = optionNumber(option, 'per_level');
                const shown = characterLevel > 0 && divisor > 0
                    ? String(intdiv(characterLevel, divisor))
                    : sprintf(__('level/%d'), divisor);
                return line(sprintf(format, shown), kind);
            }
            return line(sprintf(format, optionNumber(option, mode)), kind);
        });
    }

    // The socket block: heading, one line per socket (empty ones as "No item application") and the bonus.
    function socketLines(sockets, socketOptions, socketBonus, texts) {
        sockets = Math.max(sockets, socketOptions.length);
        if (sockets === 0) return [];

        const lines = [line(__('Socket Item option info'), 'socket')];
        for (let index = 0; index < sockets; index++) {
            const option = socketOptions[index];
            let text;
            let kind = 'option';
            if (!option) {
                text = __('No item application');
                kind = 'muted';
            } else {
                // Fire has a fixed and a per-level attack bonus; Earth's health is absolute, Wind's a multiplier.
                const attribute = String(option.attribute || '');
                let key = attribute;
                if (String(option.relatedAttribute || '') !== '') key += '|related';
                else if (option.aggregate === 'Multiplicate' && texts.socket[attribute + '|Multiplicate']) key += '|Multiplicate';

                const rule = texts.socket[key];
                if (rule) {
                    const [element, name, mode] = rule;
                    const number = optionNumber(option, mode);
                    const value = mode === 'percent' ? `+${number}%`
                        : mode === 'inverse' ? sprintf(__('+life/%d'), number)
                        : mode === 'per_level' ? sprintf(__('+level/%d'), number)
                        : `+${number}`;
                    text = sprintf(__('%1$s(%2$s %3$s)'), element, name, value);
                } else {
                    text = optionFallback(option);
                }
            }
            lines.push(line(sprintf(__('Socket %1$d: %2$s'), index + 1, text), kind));
        }

        socketBonus.forEach(option => {
            const name = texts.socketBonus[Number(option.number ?? -1)];
            lines.push(line(__('Bonus socket option'), 'socket'));
            lines.push(line(name != null
                ? sprintf(__('%1$s +%2$d'), name, optionNumber(option, 'int'))
                : optionFallback(option), 'option'));
        });
        return lines;
    }

    // The option lines and the socket block, apart, in the client's order: guardian, harmony,
    // ancient bonus, wing, skill, luck, "+option", excellent (highest number first), pet, others.
    function optionParts(item, characterLevel) {
        const texts = optionTexts();
        const rank = { guardian: 10, harmony: 20, ancientBonus: 30, wing: 40, skill: 50, luck: 60, option: 70, excellent: 80, pet: 90, other: 100 };
        const goldFenrirOrder = ['Maximum Health', 'Maximum Mana', 'Physical Base Damage (min and max)', 'Wizardry Base Damage (min and max)'];
        const entries = [];
        const socketOptions = [];
        const socketBonus = [];
        let hasLuck = false;

        (item.options || []).forEach(option => {
            const section = optionSection(String(option.type || ''));
            if (section === 'luck') { hasLuck = true; return; }
            if (section === 'socket') { socketOptions.push(option); return; }
            if (section === 'socketBonus') { socketBonus.push(option); return; }

            const number = Number(option.number || 0);
            let order = number;
            if (section === 'excellent') order = -number;
            // PHP array_search() returns false (→ 0) for an attribute not in the list.
            else if (section === 'pet') order = Math.max(0, goldFenrirOrder.indexOf(String(option.attribute || '')));
            entries.push({ rank: rank[section] ?? rank.other, order, index: entries.length, lines: optionLines(option, section, characterLevel, texts) });
        });

        const types = optionTypes(item);
        // The client closes the Gold Fenrir options with two green lines.
        if (types.includes('Gold Fenrir Option')) {
            entries.push({
                rank: rank.pet, order: Number.MAX_SAFE_INTEGER, index: entries.length,
                lines: [gap(), line(__('Golden Fenrir'), 'note'), line(__('Exclusive edition only given to MU Heroes'), 'note')],
            });
        }
        // The black and blue Fenrir also make the rider faster.
        if (types.includes('Black Fenrir Option') || types.includes('Blue Fenrir Option')) {
            entries.push({ rank: rank.pet, order: Number.MAX_SAFE_INTEGER, index: entries.length, lines: [line(__('Increase speed'), 'option')] });
        }
        if (item.hasSkill) {
            const skill = skillLines(item);
            entries.push({ rank: rank.skill, order: 0, index: entries.length, lines: skill.length ? skill : [line(__('Skill'), 'skill')] });
        }
        if (hasLuck) {
            entries.push({
                rank: rank.luck, order: 0, index: entries.length,
                lines: [line(__('Luck (success rate of Jewel of Soul +25%)'), 'luck'), line(__('Luck (critical damage rate +5%)'), 'luck')],
            });
        }

        entries.sort((a, b) => (a.rank - b.rank) || (a.order - b.order) || (a.index - b.index));
        return {
            options: entries.flatMap(entry => entry.lines),
            sockets: socketLines(Number(item.sockets || 0), socketOptions, socketBonus, texts),
        };
    }

    // Option lines plus "Set: name" and sockets: the tooltip of an item the client data doesn't know.
    function optionOnlyLines(item, characterLevel) {
        const parts = optionParts(item, characterLevel);
        const lines = parts.options.slice();
        const set = String(item.ancientSetName || '');
        if (set !== '') lines.push(line(sprintf(__('Set: %s'), set), 'ancient'));
        return lines.concat(parts.sockets);
    }

    // ---------- Full tooltip with the client item data (item-data.php) ----------

    function definitionOf(item) {
        return data.items[`${item.group}-${item.number}`] || null;
    }

    // Limits a value to the client's item fields (0 to 65535), like LimitToItemValue().
    function limit(value) {
        return Math.max(0, Math.min(65535, value));
    }

    // What the + level adds to a stat, from a bonus table of ItemStats.json.
    function levelBonus(table, level) {
        const tables = (data.stats && data.stats.tables) || {};
        if (table == null || !tables[table]) return 0;
        return Number(tables[table].v[Math.max(0, Math.min(15, level))] || 0) + Number(tables[table].p) * Math.max(0, level);
    }

    // base + excellent part + ancient part + level bonus (AddUpStat in ItemStats.cpp).
    function addUpStat(terms, base, excellentBase, fixedCounts, context) {
        if (base === 0) return 0;
        const dropLevel = context.dropLevel;
        let excellent = 0;
        const exc = terms.exc;
        if (context.excellent && dropLevel > 0 && exc && typeof exc === 'object') {
            excellent = fixedCounts && context.fixed !== 0
                ? context.fixed
                : intdiv(excellentBase * exc.t, dropLevel) + exc.a + (exc.d > 0 ? intdiv(dropLevel, exc.d) : 0);
        }
        const bonus = levelBonus(terms.table ?? null, context.level);
        let ancient = 0;
        const anc = terms.anc;
        if (context.ancient && anc && typeof anc === 'object') {
            const ancientDrop = dropLevel + Number((data.stats.dropLevelBonus || {}).ancient || 0);
            const value = base + excellent + (anc.after ? bonus : 0);
            ancient = (ancientDrop > 0 ? intdiv(value * anc.t, ancientDrop) : 0) + anc.a + (anc.d > 0 ? intdiv(ancientDrop, anc.d) : 0);
        }
        return limit(base + excellent + ancient + bonus);
    }

    // Requirements of an item (ComputeRequirements in ItemStats.cpp).
    function requirements(definition, terms, level, excellent, ancient, wing, optionLevel) {
        const names = ['level', 'strength', 'dexterity', 'energy', 'vitality', 'leadership'];
        const req = definition.req || [];
        const base = {};
        names.forEach((name, i) => { base[name] = Number(req[i] || 0); });
        const byLevel = definition.reqByLevel || {};

        let requiredLevel = 0;
        if (byLevel.level) requiredLevel = Number(byLevel.level[level] || 0);
        else if (base.level > 0) requiredLevel = limit(base.level + Number(terms.lvPer || 0) * level);
        const raisesLevel = Number(definition.excRaisesLevel ?? 1) > 0;
        if (excellent && requiredLevel > 0 && !wing && raisesLevel) requiredLevel = limit(requiredLevel + Number(terms.excAdd || 0));

        const levelBasis = byLevel.level ? Number(byLevel.level[level] || 0) : base.level;
        const bonuses = data.stats.dropLevelBonus || {};
        const dropLevel = Number(definition.drop || 0) + (excellent ? Number(bonuses.excellent || 0) : (ancient ? Number(bonuses.ancient || 0) : 0));

        const result = { level: requiredLevel };
        ['strength', 'dexterity', 'energy', 'vitality', 'leadership'].forEach(stat => {
            if (byLevel[stat]) { result[stat] = Number(byLevel[stat][level] || 0); return; }
            const formula = terms[stat] ?? 'base';
            const value = base[stat];
            if (value === 0 || typeof formula !== 'object' || formula === null) {
                result[stat] = value; // no requirement, or the formula keeps the base value
            } else if (formula.basis && levelBasis > 0) {
                result[stat] = limit(formula.add + intdiv(value * levelBasis * formula.pct, 100));
            } else {
                const weighted = Math.min(value * (dropLevel + level * formula.w), 100 * 65536);
                result[stat] = limit(formula.add + intdiv(weighted * formula.pct, 100));
            }
        });
        result.strength = limit(result.strength + Number(terms.strOpt || 0) * optionLevel);
        return result;
    }

    // Maximum durability (CalcMaxDurability in ZzzInventory.cpp).
    function maxDurability(definition, level, excellent, ancient, tags) {
        let durability = Number(definition.mdur || 0) > 0 ? Number(definition.mdur) : Number(definition.dur || 0);
        // Each + level adds 1 (+1..+4), 2 (+5..+9), then 3..8; the last two stop at 255.
        for (let step = 0; step < level && !definition.durFixed; step++) {
            if (step >= 14) durability = Math.min(255, durability + 8);
            else if (step === 13) durability = Math.min(255, durability + 7);
            else if (step >= 9) durability += step - 6;
            else if (step >= 4) durability += 2;
            else durability += 1;
        }
        if (tags.includes('darkLordPet')) durability = 255;
        const upperWing = ['second', 'third'].includes(definition.wing || '');
        if (ancient) durability += 20;
        else if (excellent && !upperWing && !tags.includes('divineArchangelWeapon')) durability += 15;
        return tags.includes('luckyItem') ? 255 : durability;
    }

    // The numbers of the tooltip: stats, durability, requirements, resistances
    // (ComputeItemStats/ComputeRequirements, ComputeItemTooltipValues, CalcMaxDurability).
    function itemValues(definition, item) {
        const profiles = (data.stats && data.stats.profiles) || {};
        const profile = profiles[definition.profile || 'default'] || profiles.default || {};
        const level = Math.max(0, Math.min(15, Number(item.level || 0)));
        const wing = definition.slot === 'wings';
        const excellent = !!item.isExcellent;
        const ancient = !!item.isAncient || String(item.ancientSetName || '') !== '';
        const tags = definition.tags || [];

        // The "+option" level raises the strength requirement; harmony options change stats and requirements.
        let optionLevel = 0;
        const harmony = { min: 0, max: 0, defense: 0, strength: 0, dexterity: 0 };
        (item.options || []).forEach(option => {
            const type = String(option.type || '');
            if (type === 'Option') {
                optionLevel = Number(option.level || 0);
            } else if ((type === 'Jewel of Harmony Option' || type === 'Harmony Option') && level >= Number(option.level || 0)) {
                const value = round(Number(option.value || 0));
                const targets = {
                    'Minimum Physical Base Damage': ['min'],
                    'Maximum Physical Base Damage': ['max'],
                    'Physical Base Damage (min and max)': ['min', 'max'],
                    'Base Defense': ['defense'],
                    'Strength Requirement reduction': ['strength'],
                    'Agility Requirement reduction': ['dexterity'],
                }[String(option.attribute || '')] || [];
                targets.forEach(target => { harmony[target] += value; });
            }
        });

        // Ancient items count as excellent for the stats, wings' options don't.
        const context = {
            level,
            dropLevel: Number(definition.drop || 0),
            excellent: (excellent && !wing) || ancient,
            ancient,
            fixed: Number(definition.excBonus || 0),
        };
        const damage = profile.damage || {};
        const damageMin = addUpStat(damage, Number(definition.dmin || 0), Number(definition.dmin || 0), true, context);
        const damageMax = addUpStat(damage, Number(definition.dmax || 0), Number(definition.dmin || 0), true, context);

        let magicPower = 0;
        const magicBase = Number(definition.magic || 0);
        if (magicBase > 0) {
            const terms = profile.magicPower || {};
            const sum = addUpStat(terms, magicBase, magicBase, true, context);
            magicPower = limit(intdiv(sum, 2) + Number(terms.half || 0) * level);
        }

        const blockBase = Number(definition.block || 0);
        const defBase = Number(definition.def || 0);
        const mdefBase = Number(definition.mdef || 0);
        const blockRate = Math.min(255, addUpStat(profile.blockRate || {}, blockBase, blockBase, false, context));
        const defense = addUpStat(profile.defense || {}, defBase, defBase, false, context);
        const magicDefense = addUpStat(profile.magicDefense || {}, mdefBase, mdefBase, false, context);

        // A harmony bonus that lifts the minimum over the maximum shows the maximum twice.
        const shownMax = damageMax + harmony.max;
        const shownMin = Math.min(damageMin + harmony.min, shownMax);

        const req = requirements(definition, profile.req || {}, level, excellent, ancient, wing, optionLevel);
        const resistances = {};
        ['ice', 'poison', 'lightning', 'fire', 'earth', 'wind', 'water'].forEach((element, index) => {
            resistances[element] = (definition.res || [])[index] ? level + 1 : 0;
        });
        const maxDur = maxDurability(definition, level, excellent, ancient, tags);

        return {
            level, excellent, ancient,
            hasDamage: damageMin > 0,
            damageMin: shownMin,
            damageMax: shownMax,
            damageHarmony: harmony.min !== 0 || harmony.max !== 0,
            defense: defense + harmony.defense,
            defenseHarmony: harmony.defense !== 0,
            magicDefense, blockRate,
            attackSpeed: Number(definition.speed || 0),
            walkSpeed: Number(definition.walk || 0),
            magicPower,
            // The wear of an item isn't stored for the website: shown as fully repaired.
            durability: maxDur,
            maxDurability: maxDur,
            resistances,
            requiredLevel: req.level,
            requiredStrength: req.strength - harmony.strength,
            requiredDexterity: req.dexterity - harmony.dexterity,
            requiredEnergy: req.energy,
            requiredVitality: req.vitality,
            requiredLeadership: req.leadership,
            strengthAsked: req.strength !== 0,
            dexterityAsked: req.dexterity !== 0,
            strengthReduced: harmony.strength !== 0,
            dexterityReduced: harmony.dexterity !== 0,
            tags,
        };
    }

    // A class at the class level an item needs; a level the class skips names its next one.
    function className(classIndex, classLevel) {
        const names = [
            [__('Dark Wizard'), __('Soul Master'), __('Grand Master')],
            [__('Dark Knight'), __('Blade Knight'), __('Blade Master')],
            [__('Elf'), __('Muse Elf'), __('High Elf')],
            [__('Magic Gladiator'), null, __('Dual Master')],
            [__('Dark Lord'), null, __('Lord Emperor')],
            [__('Summoner'), __('Bloody Summoner'), __('Dimension Master')],
            [__('Rage Fighter'), null, __('Fist Master')],
        ];
        for (let step = Math.max(classLevel, 1); step <= 3; step++) {
            const name = (names[classIndex] || [])[step - 1];
            if (name != null) return name;
        }
        return null;
    }

    // The lines before the options: stats, description, durability, resistances, requirements,
    // class lines and the wizardry line of staffs, in the client's default layout.
    function statLines(definition, item, values, characterLevel) {
        const lines = [];
        const add = (text, kind = 'stat') => lines.push(line(text, kind));
        const tags = values.tags;
        const layout = String(definition.layout || '');
        const hidden = (definition.layoutChanges && definition.layoutChanges.hide) || [];
        const armour = ['helm', 'armor', 'pants', 'gloves', 'boots'].includes(definition.slot || '');

        if (values.hasDamage) {
            const kind = values.damageHarmony ? 'harmony' : (values.excellent ? 'option' : 'stat');
            add(definition.twoHanded
                ? sprintf(__('Two-Handed Damage: %1$d ~ %2$d'), values.damageMin, values.damageMax)
                : sprintf(__('One-Handed Damage: %1$d ~ %2$d'), values.damageMin, values.damageMax), kind);
        }
        if (values.defense > 0) {
            add(sprintf(__('Defense: %d'), values.defense), values.defenseHarmony ? 'harmony' : (armour && values.excellent ? 'option' : 'stat'));
        }
        if (values.magicDefense > 0) add(sprintf(__('Spell resistance: %d'), values.magicDefense));
        if (values.blockRate > 0) add(sprintf(__('Defense rate: %d'), values.blockRate), values.excellent ? 'option' : 'stat');
        if (values.attackSpeed > 0) add(sprintf(__('Attack speed: %d'), values.attackSpeed));
        if (values.walkSpeed > 0) add(sprintf(__('Moving speed: %d'), values.walkSpeed));

        lines.push(...descriptionLines(definition, item, values, characterLevel, false));

        const noDurability = ['noDurabilityLine', 'noClassOrDurabilityLines'].includes(layout) || hidden.includes('durability');
        if (definition.hasDur && !noDurability) {
            add(sprintf(__('Durability: [%1$d/%2$d]'), values.durability, values.maxDurability));
        }

        const resistanceTexts = {
            ice: __('Ice Resistance: %d'),
            poison: __('Poison Resistance: %d'),
            lightning: __('Lightning Resistance: %d'),
            fire: __('Fire Resistance: %d'),
            earth: __('Earth Resistance: %d'),
            wind: __('Wind Resistance: %d'),
            water: __('Water Resistance: %d'),
        };
        Object.entries(resistanceTexts).forEach(([element, format]) => {
            if (values.resistances[element] > 0) add(sprintf(format, values.resistances[element]));
        });

        // Requirements; the lucky items don't show their stat requirements.
        if (values.requiredLevel > 0) add(sprintf(__('Minimum Level Requirement: %d'), values.requiredLevel));
        if (!tags.includes('luckyItem')) {
            if (values.strengthAsked) add(sprintf(__('Strength Requirement: %d'), values.requiredStrength), values.strengthReduced ? 'harmony' : 'stat');
            if (values.dexterityAsked) add(sprintf(__('Agility Requirement: %d'), values.requiredDexterity), values.dexterityReduced ? 'harmony' : 'stat');
            if (values.requiredVitality > 0) add(sprintf(__('Stamina Requirement: %d'), values.requiredVitality));
            if (values.requiredEnergy > 0) add(sprintf(__('Energy Requirement: %d'), values.requiredEnergy));
            if (values.requiredLeadership > 0) add(sprintf(__('Charisma Requirement: %d'), values.requiredLeadership));
        }

        // Class lines: one per class that can wear the item, unless every first class can.
        const classes = [0, 1, 2, 3, 4, 5, 6].map(i => Number((definition.classes || [])[i] || 0));
        const noClasses = ['noClassLines', 'noClassOrDurabilityLines'].includes(layout) || hidden.includes('classLines');
        if (!noClasses && classes.some(c => c !== 1)) {
            lines.push(gap());
            classes.forEach((classLevel, classIndex) => {
                const name = classLevel !== 0 ? className(classIndex, classLevel) : null;
                if (name != null) add(sprintf(__('Can be equipped by %s'), name));
            });
        }

        // The boots' and gloves' texts from +5, the wizardry line of staffs and books, the sceptres' pet line.
        const level = values.level;
        if (definition.slot === 'boots' && level >= 5) { lines.push(gap()); add(__('Increases moving speed'), 'emphasis'); }
        if (definition.slot === 'gloves' && level >= 5) { lines.push(gap()); add(__('Swimming speed increase'), 'emphasis'); }
        if (['staff', 'book'].includes(String(definition.kind || '')) || tags.includes('magicSword')) {
            lines.push(gap());
            add(tags.includes('summonerBook')
                ? sprintf(__('Curse Spell increment %d%%'), values.magicPower)
                : sprintf(__('Wizardry Dmg %d%% rise'), values.magicPower), 'emphasis');
        }
        if (tags.includes('sceptre')) {
            lines.push(gap());
            add(sprintf(__('Increase pet attack as %d%%'), values.magicPower), 'emphasis');
        }
        return lines;
    }

    // Shared tooltip texts of the client (Tooltip.json) that descriptions name, translatable.
    function sharedTexts() {
        return {
            durability: __('Durability: [{durability}/{maxDurability}]'),
            life: __('Life: {durability}'),
            damageIncrease: __('Increase {percent}% of Damage'),
            damageAbsorb: __('Absorb {percent}% of Damage'),
            increaseSpeed: __('Increase speed'),
            automaticHpRecovery3: __('Automatic HP recovery 3%'),
            cannotRepair: __('Cannot Repair'),
            additionalDamagePlusOne: __('Additional Dmg +1'),
            unableToEquipWithADifferentTransformationRing: __('Unable to Equip with a Different Transformation Ring'),
        };
    }

    // Conditions of a description line: states, "tag:x" and "level>=5"; a leading "!" negates.
    function conditionsHold(conditions, values, item) {
        return (conditions || []).every(raw => {
            let condition = String(raw);
            const negated = condition.startsWith('!');
            condition = condition.replace(/^!+/, '');
            let holds;
            const match = condition.match(/^(\w+)\s*(>=|<=|!=|=|>|<)\s*(-?\d+)$/);
            if (match) {
                const candidate = match[1] === 'level' ? values.level : values[match[1]];
                const actual = typeof candidate === 'number' ? candidate : null;
                const number = Number(match[3]);
                holds = actual !== null && ({
                    '>=': actual >= number, '<=': actual <= number, '!=': actual !== number,
                    '=': actual === number, '>': actual > number, '<': actual < number,
                })[match[2]];
            } else if (condition.startsWith('tag:')) {
                holds = values.tags.includes(condition.slice(4));
            } else {
                holds = {
                    timed: false, expired: false, // the website shows no rented items
                    excellent: values.excellent,
                    ancient: values.ancient,
                    hasOptions: (item.options || []).length > 0 || !!item.hasSkill,
                }[condition] || false;
            }
            return holds !== negated;
        });
    }

    // Colour name of the client data → line kind.
    function colorKind(color) {
        return {
            blue: 'option', darkBlue: 'option', red: 'requirement',
            yellow: 'ancient', darkYellow: 'ancient', orange: 'ancient',
            green: 'note', darkRed: 'darkred', purple: 'purple', violet: 'violet',
            redPurple: 'guardian', gray: 'muted', greenBlue: 'set',
        }[color] || 'stat';
    }

    // The item's own description lines of the client data, e.g. the wings' "Increase 69% of Damage".
    function descriptionLines(definition, item, values, characterLevel, afterOptions) {
        const shared = sharedTexts();
        const lines = [];
        (definition.desc || []).forEach(entry => {
            if ((entry.after === 'options') !== afterOptions) return;
            const levels = entry.levels || [0, 15];
            if (values.level < Number(levels[0] ?? 0) || values.level > Number(levels[1] ?? 15)) return;
            if (!conditionsHold(entry.when, values, item)) return;

            const ref = String(entry.ref || '');
            // Counts the website doesn't know (arrows in a stack, uses left) aren't shown.
            if (['numberOfItems', 'usableTimes', 'piecesOfTwenty'].includes(ref)) return;
            const template = ref !== '' ? (shared[ref] ?? String(data.texts[ref] || '')) : String(entry.text || '');
            if (template === '') { lines.push(gap()); return; }

            const replace = {
                '{name}': String(item.name || definition.name || ''),
                '{level}': String(values.level),
                '{durability}': String(values.durability),
                '{maxDurability}': String(values.maxDurability),
                '{heroLevel}': String(characterLevel),
                '{magicPower}': String(values.magicPower),
                '{defense}': String(values.defense),
            };
            Object.entries(entry.values || {}).forEach(([placeholder, source]) => {
                source = String(source);
                replace['{' + placeholder + '}'] = source.startsWith('table:')
                    ? String(levelBonus(source.slice(6), values.level))
                    : String(values[source] ?? '');
            });

            let kind = colorKind(String(entry.color || 'white'));
            for (const rule of entry.colors || []) {
                if (conditionsHold(rule.when, values, item)) { kind = colorKind(String(rule.color || 'white')); break; }
            }
            const text = template.replace(/\{\w+\}/g, token => (token in replace ? replace[token] : token));
            lines.push(line(text, entry.bold && kind === 'option' ? 'emphasis' : kind));
        });
        return lines;
    }

    // The skill line with its mana cost (GetSpecialOptionText) and the class note of some pet skills.
    function skillLines(item) {
        const definition = definitionOf(item);
        const skill = Number((definition && definition.skill) || 0);
        if (skill === 0) return [];
        const formats = {
            18: __('Defend skill (Mana:%d)'),
            19: __('Falling Slash skill (Mana:%d)'),
            20: __('Lunge skill (Mana:%d)'),
            21: __('Uppercut skill (Mana:%d)'),
            22: __('Cyclone Cutting skill (Mana:%d)'),
            23: __('Slashing skill (Mana:%d)'),
            24: __('Triple Shot skill (Mana:%d)'),
            49: __('Raid Skill (Mana:%d)'),
            54: __('4 shot skill (Mana: %d)'),
            56: __('Power Slash Skill (Mana:%d)'),
            60: __('Long spear skill (mana:%d)'),
            62: __('Earth shake skill (mana:%d)'),
            66: __('Force wave skill (mana:%d)'),
            76: __('Plasma storm skill (Mana:%d)'),
            223: __('Explosion Skill (Mana: %d)'),
            224: __('Requiem (Mana: %d)'),
            225: __('Pollution skill (Mana: %d)'),
            260: __('Killing Blow (Mana: %d)'),
            261: __('Beast Uppercut (Mana: %d)'),
        };
        const skillData = data.skills[String(skill)];
        if (!formats[skill] || !skillData) {
            // A skill without an item text (e.g. the Phoenix Shot): its name from the skill data.
            return skillData ? [line(String(skillData.name), 'skill')] : [];
        }
        const lines = [line(sprintf(formats[skill], Number(skillData.mana)), 'skill')];
        if (skill === 49) lines.push(line(__('Knight specific skill'), 'darkred'));
        else if (skill === 62) lines.push(line(__('Dark Lord exclusive skill'), 'darkred'));
        return lines;
    }

    // The closing lines of the Horn of Fenrir.
    function fenrirLines(item) {
        if (Number(item.group) !== 13 || Number(item.number) !== 37) return [];
        const lines = [gap(), line(__('Can summon the Fenrir when equipped.'), 'ancient')];
        const types = optionTypes(item);
        if (!['Black Fenrir Option', 'Blue Fenrir Option', 'Gold Fenrir Option'].some(t => types.includes(t))) {
            lines.push(line(__('Skills will improve through upgrading.'), 'ancient'));
        }
        return lines;
    }

    // Set name for comparison: lower case, without the possessive "'s" and apostrophes ("Hyon's" → "hyon").
    function foldSetName(name) {
        return String(name).trim().toLowerCase().replace(/['’]s$/u, '').replace(/['’]/gu, '');
    }

    // The ancient set number of an item: the client data has two sets per item, named like "Hyon's".
    function setNumber(definition, item) {
        const name = foldSetName(item.ancientSetName || '');
        if (name === '') return 0;
        const candidates = (definition.sets || []).map(Number).filter(Boolean);
        for (const number of candidates) {
            if (foldSetName((data.sets[String(number)] || {}).name || '') === name) return number;
        }
        // A renamed set: an item with only one set can only mean that one.
        return candidates.length === 1 ? candidates[0] : 0;
    }

    // One ancient set bonus (kSetOptionFormats in CSItemOption.cpp); null for one the client doesn't show.
    function setOptionText(option, value, set) {
        if (value === 0 || (option >= 29 && (set.classes || []).every(c => Number(c) === 0))) return null;
        const formats = {
            0: __('Increase strength +%d'),
            1: __('Increase agility +%d'),
            2: __('Increase energy +%d'),
            3: __('Increase stamina +%d'),
            4: __('Increase command +%d'),
            5: __('Increase min. damage +%d'),
            6: __('Increase max. damage +%d'),
            7: __('Increase Wizardry Dmg +%d%%'),
            8: __('Increase damage +%d'),
            9: __('Increase damage success rate +%d'),
            10: __('Increase defensive skill +%d'),
            11: __('Increase max. life +%d'),
            12: __('Increase max. mana +%d'),
            13: __('Increase max. AG +%d'),
            14: __('Increase AG increase rate +%d'),
            15: __('Increase critical damage rate %d%%'),
            16: __('Increase critical damage +%d'),
            17: __('Increase excellent damage rate %d%%'),
            18: __('Increase excellent damage +%d'),
            19: __('Increase skill attacking rate +%d'),
            20: __('Double damage rate %d%%'),
            21: __('Ignore enemies defensive skill %d%%'),
            22: __('Increase defensive skill when using shield weapons %d%%'),
            23: __('Increase damage when using two handed weapons +%d%%'),
            29: __('Ice attribute skill increase damage +%d'),
            30: __('Poison attribute skill increase damage +%d'),
            31: __('Lightning attribute skill increase damage +%d'),
            32: __('Fire attribute skill increase damage +%d'),
            33: __('Earth attribute skill increase damage +%d'),
            34: __('Wind attribute skill increase damage +%d'),
            35: __('Water attribute skill increase damage +%d'),
        };
        return formats[option] != null ? sprintf(formats[option], value) : null;
    }

    // The ancient set block: the worn pieces decide which bonuses are active (blue/green/yellow), the
    // others are grey. With a single piece the client lists nothing; here the list is grey, so a
    // visitor still sees what the set gives.
    function setLines(definition, item, equipped) {
        const number = setNumber(definition, item);
        const set = data.sets[String(number)];
        if (!set) {
            return String(item.ancientSetName || '') !== '' ? [line(sprintf(__('Set: %s'), item.ancientSetName), 'ancient')] : [];
        }

        let worn = 0;
        (equipped || []).forEach(other => {
            const otherDefinition = definitionOf(other);
            if (otherDefinition && setNumber(otherDefinition, other) === number) worn++;
        });
        worn = Math.max(1, worn);
        const complete = worn >= Number(set.items);

        const lines = [gap(), line(__('Set Item option info'), 'ancient'), gap()];
        const add = (option, value, active, activeKind) => {
            const text = setOptionText(Number(option), Number(value), set);
            if (text != null) lines.push(line(text, active ? activeKind : 'muted'));
        };
        const standardCount = Math.min(Number(set.items) - 1, 6);
        for (let index = 0; index < standardCount; index++) {
            ((set.std || [])[index] || []).forEach(o => add(o[0], o[1], complete || index < worn - 1, 'option'));
        }
        (set.ext || []).forEach(o => add(o[0], o[1], complete || worn >= 2, 'note'));
        (set.full || []).forEach(o => add(o[0], o[1], complete, 'ancient'));
        return lines;
    }

    // Drops empty rows at the start and end and merges empty rows that follow each other.
    function tidyGaps(lines) {
        const result = [];
        lines.forEach(entry => {
            const isGap = entry.kind === 'gap';
            if (isGap && (result.length === 0 || result[result.length - 1].kind === 'gap')) return;
            result.push(entry);
        });
        while (result.length && result[result.length - 1].kind === 'gap') result.pop();
        return result;
    }

    // All tooltip lines of an item in the client's order: stats, requirements, classes, options,
    // set block, sockets. Falls back to the option lines for an item the client data doesn't know.
    function tooltipLines(item, character) {
        const characterLevel = Number((character && character.level) || 0);
        const definition = definitionOf(item);
        if (!definition) return optionOnlyLines(item, characterLevel);

        const values = itemValues(definition, item);
        const parts = optionParts(item, characterLevel);
        let lines = statLines(definition, item, values, characterLevel);
        lines.push(gap());
        lines = lines.concat(parts.options);
        lines.push(gap());
        lines = lines.concat(descriptionLines(definition, item, values, characterLevel, true));
        lines = lines.concat(fenrirLines(item));
        lines = lines.concat(setLines(definition, item, (character && character.items) || []));
        lines = lines.concat(parts.sockets);
        return tidyGaps(lines);
    }

    // ---------- Public API ----------

    // Loads the client item data once; without it (missing files) the tooltips have the option lines only.
    let loading = null;
    function load() {
        if (!loading) {
            const get = file => fetch('/data/' + file).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
            loading = Promise.all([get('items.json'), get('item-sets.json'), get('skills.json')]).then(parts => {
                parts.forEach(part => { delete part._source; Object.assign(data, part); });
            });
        }
        return loading;
    }

    // Title, title colour and lines of an item; character = { level, items } of the armory API.
    function build(item, character) {
        const level = Number((character && character.level) || 0);
        return {
            title: itemTitle(item),
            titleKind: itemTitleKind(item, optionParts(item, level).options),
            lines: tooltipLines(item, character),
        };
    }

    window.ItemTooltip = { load, build };
})();
