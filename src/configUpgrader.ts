import { Level } from "level"
import { log } from "./function"

const TIMELINE: { [x in number]: string } = {
    //2: "./configUpgradeScript/testUpgradeScript",
}

async function upgradeConfig(oldVersion: number, currentVersion: number, configDb: Level<string, Config>) {
    for (var i = oldVersion + 1; i <= currentVersion; i++) {
        await log(`Upgrading config from version ${oldVersion} to ${oldVersion + 1}`)
        const SCRIPT = require(TIMELINE[i])
        await SCRIPT.main(configDb)
    }
    await log(`Successfully upgraded`)
}

export { upgradeConfig }