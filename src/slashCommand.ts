import {
    SlashCommandBuilder,
    Interaction,
    EmbedBuilder,
    Events,
    ButtonBuilder,
    ActionRowBuilder,
    PermissionFlagsBits
} from "discord.js"
import {
    THEME_COLOR,
    CONFIG_EXPLAIN,
    DEFAULT_CONFIG,
    RESET_VALUE,
    MODAL_LIMIT,
    INTERACTION_BACK_BUTTON,
    INTERACTION_NEXT_BUTTON,
    STARTUP_TIME,
    REPO_URL,
    DATABASES
} from "./const"
import {
    configValueValidator,
    configValueConverter,
    splitStringIntoBlocks,
    updateLeaderboard,
    reloadDatabase,
} from "./function"
import { join } from "path"

async function enableBot(interaction: Interaction) {
    var statusMsg = ""

    if (!interaction.isChatInputCommand()) return

    const STATUS = await DATABASES.status.value.get(interaction.guildId || "")
    if (STATUS) {
        statusMsg = "Bot is already enabled, no need to enable it twice. Seriously."
    } else {
        await DATABASES.status.value.put(interaction.guildId || "", true)
        statusMsg = "Bot is now enabled."
    }

    interaction.reply({ content: statusMsg })
}

async function disableBot(interaction: Interaction) {
    var statusMsg = ""

    if (!interaction.isChatInputCommand()) return

    const STATUS = await DATABASES.status.value.get(interaction.guildId || "")
    if (STATUS) {
        await DATABASES.status.value.put(interaction.guildId || "", false)
        statusMsg = "Bot is now disabled."
    } else {
        statusMsg = "Bot is already disabled, don't try and do it twice. It won't work. Really."
    }

    interaction.reply({ content: statusMsg })
}

async function getConfig(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return

    var config = await DATABASES.config.value.get(interaction.guildId || "")
    if (config == undefined) return

    var showConfig = ""
    var position = 0

    for (const i of Object.keys(config)) {
        showConfig += ` - ${i}: ${JSON.stringify(config[i as keyof Config])}\n`
    }

    const MESSAGE_ARRAY = splitStringIntoBlocks(showConfig, MODAL_LIMIT)
    const SHOW_CONFIG_MODAL = (pageNum: number = 0) => {
        var pageNumMsg = "", topEllipsis = "", bottomEllipsis = ""
        var backButton = INTERACTION_BACK_BUTTON(),
            nextButton = INTERACTION_NEXT_BUTTON()

        if (MESSAGE_ARRAY.length > 1) pageNumMsg = ` (Page ${pageNum} / ${MESSAGE_ARRAY.length - 1})`
        if (pageNum > 0) topEllipsis = "...\n"
        if (pageNum < MESSAGE_ARRAY.length - 1) bottomEllipsis = "\n..."

        const HEADER = `**\`configname\`: \`value\`${pageNumMsg}**`
        const CONTENT =
            `${HEADER}\n` +
            "```yml\n" +
            `${topEllipsis}${MESSAGE_ARRAY[pageNum]}${bottomEllipsis}\n` +
            "```"
        const MODAL = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle("Configuration for this server")
            .setDescription(CONTENT)
            .addFields({
                "name": "Notice",
                "value": `For values that have a type of channel (ex: logging_channel, notification_channel), the bot will output the channel ID (which is that long string of number).`
            })
        const BUTTONS = new ActionRowBuilder<ButtonBuilder>()

        if (pageNum <= 0) { //back
            backButton = backButton.setDisabled(true)
        }
        if (pageNum >= MESSAGE_ARRAY.length - 1) {
            nextButton = nextButton.setDisabled(true)
        }

        BUTTONS.addComponents(backButton, nextButton)
        return { MODAL, BUTTONS }
    }

    const { BUTTONS, MODAL } = SHOW_CONFIG_MODAL()
    await interaction.reply({embeds: [MODAL], components: [BUTTONS], ephemeral: true})

    interaction.client.on(Events.InteractionCreate, async (inter) => {
        if (!inter.isButton()) return

        switch (inter.customId) {
            case "back":
                position--
                break
            case "next":
                position++
                break
        }

        const { BUTTONS, MODAL } = SHOW_CONFIG_MODAL(position)
        await interaction.editReply({embeds: [MODAL], components: [BUTTONS]})
        await inter.deferUpdate()
    })
}

async function setConfig(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return

    const CONFIGNAME = interaction.options.get("configname")
    const VALUE = interaction.options.get("value")
    if (CONFIGNAME == null) return

    var config = await DATABASES.config.value.get(interaction.guildId || "")
    var response = ""
    var newValue

    if (config == undefined || DEFAULT_CONFIG == undefined) return
    if (typeof CONFIGNAME.value == "string" && CONFIGNAME.value in config) {
        if (VALUE == null || typeof VALUE.value != "string" || !configValueValidator(CONFIG_EXPLAIN[CONFIGNAME.value as keyof Config][1], VALUE.value)) {
            response = `A valid value was not passed into the value arguments, please try again`
        } else {
            newValue = configValueConverter(CONFIG_EXPLAIN[CONFIGNAME.value as keyof Config][1], VALUE.value)
            if (newValue == RESET_VALUE) newValue = DEFAULT_CONFIG[CONFIGNAME.value as keyof Config]

            //@ts-ignore
            //? Sometimes you gonna do what you have to do
            config[CONFIGNAME.value as keyof Config] = newValue

            await DATABASES.config.value.put(interaction.guildId || "", config)
            response = `Successfully changed "${CONFIGNAME.value}" to "${newValue}"`
        }
    } else {
        response = `\`${CONFIGNAME.value}\` is not a valid configname arguments, please try again`
    }

    interaction.reply({ content: response, ephemeral: true })
}

async function listConfig(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return

    var helpConfigMsg = ""
    var position = 0

    for (const i of Object.keys(CONFIG_EXPLAIN)) {
        helpConfigMsg +=
            `${i}:\n` +
            `"${CONFIG_EXPLAIN[i as keyof Config][0]} (TYPE: ${CONFIG_EXPLAIN[i as keyof Config][1]})"\n` +
            `----------\n`
    }

    const MESSAGE_ARRAY = splitStringIntoBlocks(helpConfigMsg, MODAL_LIMIT)
    const HELP_MODAL = (pageNum: number = 0) => {
        var pageNumMsg = "", topEllipsis = "", bottomEllipsis = ""
        var backButton = INTERACTION_BACK_BUTTON(),
            nextButton = INTERACTION_NEXT_BUTTON()

        if (MESSAGE_ARRAY.length > 1) pageNumMsg = ` (Page ${pageNum} / ${MESSAGE_ARRAY.length - 1})`
        if (pageNum > 0) topEllipsis = "...\n"
        if (pageNum < MESSAGE_ARRAY.length - 1) bottomEllipsis = "\n..."

        const HEADER = `**\`configname\`: \`what_is_it_for\`${pageNumMsg}**`
        const CONTENT =
            `${HEADER}\n` +
            "```yml\n" +
            `${topEllipsis}${MESSAGE_ARRAY[pageNum]}${bottomEllipsis}\n` +
            "```"
        const MODAL = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle("List of configs")
            .setDescription(`Just in case you forgot it (which is very likely)\n${CONTENT}`)
            .addFields({
                "name": "Example",
                "value": "`/config allow_bot_to_revive true\n/config logging_channel #general`"
            })
            .addFields({
                "name": "Notice",
                "value": `To reset the value of any \`configname\`, in the \`value\` arguments, put: \`${RESET_VALUE}\``
            })
            .addFields({
                "name": "Another notice",
                "value": `For values that have a type of channel (example: logging_channel, notification_channel), the bot will output the channel ID (which is that long number string).`
            })
        const BUTTONS = new ActionRowBuilder<ButtonBuilder>()

        if (pageNum <= 0) { //back
            backButton = backButton.setDisabled(true)
        }
        if (pageNum >= MESSAGE_ARRAY.length - 1) {
            nextButton = nextButton.setDisabled(true)
        }

        BUTTONS.addComponents(backButton, nextButton)
        return { MODAL, BUTTONS }
    }

    const { BUTTONS, MODAL } = HELP_MODAL()
    await interaction.reply({embeds: [MODAL], components: [BUTTONS], ephemeral: true})

    interaction.client.on(Events.InteractionCreate, async (inter) => {
        if (!inter.isButton()) return

        switch (inter.customId) {
            case "back":
                position--
                break
            case "next":
                position++
                break
        }

        const { BUTTONS, MODAL } = HELP_MODAL(position)
        await interaction.editReply({embeds: [MODAL], components: [BUTTONS]})
        await inter.deferUpdate()
    })
}

async function aboutBot(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return

    const { config_version, version } = require(join(__dirname, "../package.json"))
    const UPTIME = ((new Date()).getTime() - STARTUP_TIME.getTime()) / 1000

    const MODAL = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("About the bot")
        .setDescription(
            `Repository URL: ${REPO_URL}\n` +
            `Version: "${version}"\n` +
            `Config version: "${config_version}"\n` +
            `Uptime: ${UPTIME} seconds\n`
        )

    interaction.reply({ embeds: [MODAL], ephemeral: true })
}

async function leaderboard(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return

    await updateLeaderboard(interaction.guildId || "")

    const LEADERBOARD = await DATABASES.leaderboard.value.get(interaction.guildId || "")
    const CONFIG = await DATABASES.config.value.get(interaction.guildId || "")
    if (CONFIG == undefined) return

    if (!CONFIG.leaderboard_enable) {
        await interaction.reply({ content: "Leaderboard has been disabled" })
        return
    }

    var message = ""
    var position = 0

    for (const [i, value] of LEADERBOARD.entries()) {
        var reviver = CONFIG.leaderboard_show_reviver ? ` (reviver: <@${value.reviver}>)` : ""
        message += `\`#${i + 1}\`: <#${value.channel}> - \`${value.duration} seconds\`${reviver}\n`
    }

    const MESSAGE_ARRAY = splitStringIntoBlocks(message, MODAL_LIMIT)

    const LEADERBOARD_MODAL = (pageNum: number = 0) => {
        var pageNumMsg = "", topEllipsis = "", bottomEllipsis = ""
        var backButton = INTERACTION_BACK_BUTTON(),
            nextButton = INTERACTION_NEXT_BUTTON()

        if (MESSAGE_ARRAY.length > 1) pageNumMsg = ` (Page ${pageNum} / ${MESSAGE_ARRAY.length - 1})`
        if (pageNum > 0) topEllipsis = "...\n"
        if (pageNum < MESSAGE_ARRAY.length - 1) bottomEllipsis = "\n..."

        if (MESSAGE_ARRAY.length == 0) {
            MESSAGE_ARRAY[0] = "The bot currently has no data about the channels in this server."
        }

        const HEADER = `**Top \"dead channel\" duration${pageNumMsg}**`
        const CONTENT =
            `${HEADER}\n` +
            `${topEllipsis}${MESSAGE_ARRAY[pageNum]}${bottomEllipsis}\n`
        const MODAL = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle("Leaderboard")
            .setDescription(CONTENT)
        const BUTTONS = new ActionRowBuilder<ButtonBuilder>()

        if (pageNum <= 0) { //back
            backButton = backButton.setDisabled(true)
        }
        if (pageNum >= MESSAGE_ARRAY.length - 1) {
            nextButton = nextButton.setDisabled(true)
        }

        BUTTONS.addComponents(backButton, nextButton)
        return { MODAL, BUTTONS }
    }

    const { BUTTONS, MODAL } = LEADERBOARD_MODAL()
    await interaction.reply({embeds: [MODAL], components: [BUTTONS], ephemeral: true})

    interaction.client.on(Events.InteractionCreate, async (inter) => {
        if (!inter.isButton()) return

        switch (inter.customId) {
            case "back":
                position--
                break
            case "next":
                position++
                break
        }

        const { BUTTONS, MODAL } = LEADERBOARD_MODAL(position)
        await interaction.editReply({embeds: [MODAL], components: [BUTTONS]})
        await inter.deferUpdate()
    })
}

const SLASH_COMMANDS: SlashCommands = [
    {
        "commands": new SlashCommandBuilder()
            .setName("about")
            .setDescription("Information about the bot"),
        "execute": aboutBot
    },
    {
        "commands": new SlashCommandBuilder()
            .setName("enable")
            .setDescription("Enable the bot. That's it")
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .setDMPermission(false),
        "execute": enableBot
    },
    {
        "commands": new SlashCommandBuilder()
            .setName("disable")
            .setDescription("Disable the bot. It's basically the enable command, but reversed.")
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .setDMPermission(false),
        "execute": disableBot
    },
    {
        "commands": new SlashCommandBuilder()
            .setName("config")
            .setDescription("Bot configuration")
            .addSubcommand(e => e
                .setName("get")
                .setDescription("Get the current configuration of the bot")
            )
            .addSubcommand(e => e
                .setName("set")
                .setDescription("Change the configuration of the bot")
                .addStringOption(v => v
                    .setName("configname")
                    .setDescription("Config name to change")
                    .setRequired(true)
                    .addChoices(...Object.keys(DEFAULT_CONFIG as Object).map(v => { return {"name": v, "value": v} }))
                )
                .addStringOption(v => v
                    .setName("value")
                    .setDescription("Value for the config")
                    .setRequired(true)
                    .setMaxLength(1024)
                )
            )
            .addSubcommand(e => e
                .setName("help")
                .setDescription("Show list of available configuration")
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .setDMPermission(false),
        "execute": async (interaction: Interaction) => {
            if (!interaction.isChatInputCommand()) return

            switch (interaction.options.getSubcommand()) {
                case "get":
                    await getConfig(interaction)
                    break
                case "set":
                    await setConfig(interaction)
                    break
                case "help":
                    await listConfig(interaction)
                    break
            }
        }
    },
    {
        commands: new SlashCommandBuilder()
            .setName("leaderboard")
            .setDescription("Leaderboard for top dead channels's duration"),
        execute: async (interaction: Interaction) => {
            if (!interaction.isChatInputCommand()) return
            await leaderboard(interaction)
        }
    },
    {
        "commands": new SlashCommandBuilder()
            .setName("reset")
            .setDescription("Reset data")
            .addStringOption(v => v
                .setName("data")
                .setDescription("Data to reset")
                .setRequired(true)
                .addChoices(...Object.keys(DATABASES)
                    .filter(v => DATABASES[v as keyof typeof DATABASES].resettable)
                    .map(v => { return {"name": v, "value": v} }))
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .setDMPermission(false),
        "execute": async (interaction: Interaction) => {
            if (!interaction.isChatInputCommand()) return
            const DATA = interaction.options.get("data")
            if (DATA == null) return

            await reloadDatabase(interaction.client, DATA.value as keyof typeof DATABASES, `-${interaction.guildId}`)
            await reloadDatabase(interaction.client, DATA.value as keyof typeof DATABASES, `+${interaction.guildId}`)

            interaction.reply({
                content: `Successfully reset \`${DATA.value}\``
            })
        }
    }
]

export {
    SLASH_COMMANDS
}