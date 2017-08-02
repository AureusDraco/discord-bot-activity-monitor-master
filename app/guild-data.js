const DateDiff = require("date-diff");
const DiscordUtil = require("discordjs-util");

module.exports = class GuildData {
	/**
	 * Constructs an instance of GuildData
	 * @param {string} id ID of the guild
	 * @param {int} inactiveThresholdDays Number of days users should be marked inactive after
	 * @param {string} activeRoleID ID of the role to use to remove from inactive users
	 * @param {object} [users = {}] Object containing user IDs as keys and DateTime as values
	 * @param {bool} [allowRoleAddition = false] Should the bot be allowed to *add* as well as remove the role?
	 * @param {string[]} [ignoredUserIDs = new Array()] IDs to ignore when checking if users are active
	 */
	constructor(id, inactiveThresholdDays, activeRoleID, users, allowRoleAddition, ignoredUserIDs) {
		this.id = id;
		this.inactiveThresholdDays = inactiveThresholdDays;
		this.activeRoleID = activeRoleID;
		this.users = users instanceof Object ? users : {};
		this.allowRoleAddition = allowRoleAddition ? true : false;
		this.ignoredUserIDs = Array.isArray(ignoredUserIDs) ? ignoredUserIDs : [];
	}

	checkUsers(client) {
		const guild = client.guilds.get(this.id);
		if (guild) {
			const now = new Date();

			Object.keys(this.users).forEach(userID => {
				const activeDate = this.users[userID];
				const diff = new DateDiff(now, Date.parse(activeDate));

				if (diff.days() > this.inactiveThresholdDays) {
					const member = guild.members.get(userID);
					if (member)
						guild.members.get(userID).removeRole(this.activeRoleID).catch(DiscordUtil.dateError);
					
					delete this.users[userID]; //un-save the user's last active time, as they don't matter anymore
				}
			});
		}
	}

	fromJSON(data) {
		return Object.assign(this, data);
	}
};