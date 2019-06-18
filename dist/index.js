/** @format */
import * as Debug from "debug";
import * as minimist from "minimist";
import * as fs from "fs-extra";
import * as Hapi from "hapi";
import * as marked from "marked";
import * as MarkedTerminalRenderer from "marked-terminal";
import * as path from "path";
import * as crypto from "crypto";
import * as boom from "boom";
import * as shell from "shelljs";
function logger(module) {
    return Debug("hook:" + module);
}
/** Shorthand for outputting important messages to the user. */
function say(message) {
    console.error(message);
}
class ConfigError extends Error {
}
const token_FILE_NAME = ".hook.token";
(async function () {
    const log = logger("setup");
    if (!shell.which("git")) {
        throw new ConfigError("Please install `git` onto your system.");
    }
    // Parse the arguments
    log("parsing arguments...");
    const args = minimist(process.argv.slice(2));
    if (args.help || args.h) {
        log("setting up renderer to display help...");
        marked.setOptions({
            renderer: new MarkedTerminalRenderer(),
        });
        log("rendering and printing help...");
        say(marked((await fs.readFile(path.resolve(__dirname + "/../readme.md"))).toString()));
        process.exit(0);
    }
    let serverArg = args._[0];
    let directoryArg = args._[1];
    if (!serverArg) {
        throw new ConfigError("Missing server argument. See documentation.");
    }
    if (!directoryArg) {
        throw new ConfigError("Missing directory argument. See documentation.");
    }
    log("serverArg:", serverArg);
    log("directory:", directoryArg);
    // remove leading port number ":" character from server string
    serverArg = serverArg.replace(":", "");
    const s = serverArg.split("/");
    const port = s[0];
    const route = s[1] || "/";
    // Load the directory and ensure it is a valid git repo
    log("trying to read git directory");
    directoryArg = path.resolve(directoryArg); // get long path
    const exists = await fs.pathExists(directoryArg + "/.git");
    if (!exists) {
        throw new ConfigError("Directory does not appear to be a valid git repository.");
    }
    log("directory seems like a valid repo, cool");
    // configure the gitlab header
    let token = "";
    if (!args.gitlab) {
        throw new ConfigError("--gitlab wasn't passed. Only Gitlab hooks are supported at this time.");
    }
    if (args.gitlab === true) {
        const log = logger("setup/token");
        // try to read the token
        const tokenPath = path.join(directoryArg, token_FILE_NAME);
        try {
            log("loading existing token from:", tokenPath);
            token = (await fs.readFile(tokenPath)).toString();
            log("okay. token loaded from disk");
        }
        catch (ex) {
            log("could not read the file", ex.message);
            log("generating a token...");
            token = crypto.randomBytes(64).toString("base64");
            log("writing the token to the file...");
            await fs.writeFile(tokenPath, token);
            say("✨  Written a new token to `" + tokenPath + "`. You might want to add " + token_FILE_NAME + " to your .gitignore file if it's not already there!");
        }
    }
    else {
        log("using gitlab token from command line", args.gitlab);
        token = args.gitlab;
    }
    say(" 🔑  Use `" + token + "` as the Secret Token in your Gitlab webhook.");
    // Start the hapi server
    log("starting hapi server...");
    const server = new Hapi.Server({ port });
    server.route({
        path: "/" + route,
        method: "POST",
        handler: async (req, h) => {
            const log = logger("server");
            const reqToken = req.headers["x-gitlab-token"];
            log("got a request");
            if (reqToken === token) {
                say(" 👋  Gitlab just triggered our webhook.");
                shell.cd(directoryArg);
                const result = shell.exec("git pull");
                if (result.code === 0) {
                    say(" 👌  Pulled the repo successfully.");
                }
                else {
                    say(" 👎  Failed to pull the repo. Consult the logs for more information.");
                }
                return "Success.";
            }
            else {
                log("token is invalid, returning 401");
                throw boom.unauthorized();
            }
        },
    });
    await server.start();
    log("hapi server up");
})().catch((ex) => {
    if (ex instanceof ConfigError) {
        say("☠️  Could not start Hook. " + ex.message + "\nThis is probably a problem with the arguments you provided to Hook. Try doing `" + process.argv[1] + " --help`");
    }
    else {
        throw ex;
    }
    process.exit(1);
});
//# sourceMappingURL=index.js.map