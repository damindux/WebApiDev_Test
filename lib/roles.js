export const ROLES = {
	ADMINISTRATOR: "administrator",
	DISPATCHER: "dispatcher",
	PATROL_OFFICER: "patrol_officer",
};

export const ALL_READ_ROLES = [
	ROLES.ADMINISTRATOR,
	ROLES.DISPATCHER,
	ROLES.PATROL_OFFICER,
];

export function isValidRole(role) {
	return Object.values(ROLES).includes(role);
}
