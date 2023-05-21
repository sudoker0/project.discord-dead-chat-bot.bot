// import { Level } from "level";
// import { DEFAULT_CONFIG } from "../const";

// async function main(oldConfig: Level<string, Config>) {
//     for await (const i of oldConfig.keys()) {
//         var current = await oldConfig.get(i)
//         if (current == undefined || DEFAULT_CONFIG == undefined) return

//         current.test = DEFAULT_CONFIG.test

//         await oldConfig.put(i, current)
//     }
// }

// export {
//     main
// }