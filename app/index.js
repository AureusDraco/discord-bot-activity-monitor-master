//node imports
const FileSystem = require("fs");

//external lib imports
const JsonFile = require("jsonfile");

//my imports
const GuildSetupHelper = require("./guild-setup-helper.js");
const GuildData = require("./guild-data.js");
const DiscordUtil = require("discordjs-util");

//gloabl vars
const SAVE_FILE = "./guilds.json";
const setupHelpers = [];

//when loaded with require() by an external script, this acts as a kind of "on ready" function
module.exports = (client) => {
	const config = require("./config.json");

	//load data from file and set up periodic saving back to file
	const guildsData = FileSystem.existsSync(SAVE_FILE) ? fromJSON(JsonFile.readFileSync(SAVE_FILE)) : {};
	setInterval(() => writeFile(guildsData), config.saveIntervalSec * 1000);

	//check all the guild members against their guild's threshold now, and set up a daily check
	Activity.checkUsersInAllGuilds(client, guildsData);
	setInterval(() => Activity.checkUsersInAllGuilds(client, guildsData), 1 * 24 * 60 * 60 * 1000);

	client.on("message", message => {
		if (message.channel.type !== "text" || !message.member)
			return;
		
		if (message.content.startsWith(client.user.toString()) //user is @mention-ing the bot
			&& message.member.permissions.has("ADMINISTRATOR") //user is admin
			&& message.member.id !== client.user.id) //user is not the bot accidentally triggering itself
		{
			const params = message.content.split(" ");
			const guildData = guildsData[message.guild.id] = guildsData[message.guild.id] || new GuildData(); //initialise this guildData within guildsData as {} if it's not already initialised

			switch (params[1].toLowerCase()) {
				case config.commands.setup:
					setupFromMessage(client, message, guildData, () => writeFile(guildsData));
					break;
				case config.commands.viewSettings:
					message.reply("```JavaScript\n" + guildData.toString() + "```");
					break;
			}
		}

		Activity.registerActivity(message.guild, message.member, guildsData[message.channel.guild.id]);
	});
};

const Activity = {
	checkUsersInAllGuilds: (client, guildsData) => client.guilds.forEach(guild => {
		const guildData = guildsData[guild.id];
		if (guildData) {
			guildData.checkUsers(client);
			writeFile(guildsData);
		}
	}),
	registerActivity: (guild, member, guildData) => {
		if (guildData) {
			guildData.users[member.id] = new Date(); //store now as the latest date this user has interacted

			if (guildData.allowRoleAddition && guildData.activeRoleID && guildData.activeRoleID.length > 0) { //check if we're allowed to assign roles as well as remove them in this guild
				let activeRole = guild.roles.get(guildData.activeRoleID);

				//if the member doesn't already have the active role, and they aren't in the list of ignored IDs, give it to them
				if (activeRole && !member.roles.get(activeRole.id) && !guildData.ignoredUserIDs.includes(message.member.id))
					member.addRole(activeRole)
						.catch(e => DiscordUtil.dateError("Error adding active role to user " + member.user.username + " in guild " + guild.name, e));
			}
		}
	},
	registerExisting: (guild, guildData) => {
		guild.roles.get(guildData.activeRoleID).members.forEach(member => {
			if (!guildData.ignoredUserIDs.includes(member.id))
				guildData.users[member.id] = new Date();
		});
	}
};

function setupFromMessage(client, message, guildData, callback) {
	//create the helper to setup the guild
	const helper = new GuildSetupHelper(message);
	let idx = setupHelpers.push(helper);

	const existingUsers = guildData ? guildData.users : null; //extract any saved users if this guild has already run setup before

	helper.walkThroughSetup(client, message.channel, message.member, existingUsers)
		.then(responseData => {
			Object.assign(guildData, responseData); //map all the response data into our guild data object
			callback();
			message.reply("Setup complete!");
		})
		.catch(e => DiscordUtil.dateError("Error walking through guild setup for guild " + message.guild.name, e))
		.then(() => setupHelpers.splice(idx - 1, 1)); //always remove this setup helper
}

function writeFile(guildsData) {
	JsonFile.writeFile(SAVE_FILE, guildsData, err => { if (err) DiscordUtil.dateError("Error writing file", err); });
}

function fromJSON(json) {
	Object.keys(json).forEach(guildID => {
		json[guildID] = new GuildData().fromJSON(json[guildID]);
	});
	return json;
}