import { ROLES } from "../lib/roles.js";

export function vehicleFilterForUser(user) {
	if (user.role === ROLES.PATROL_OFFICER) {
		return { station_id: user.station_id };
	}
	return {};
}

export function canAccessVehicle(user, vehicle) {
	if (user.role !== ROLES.PATROL_OFFICER) {
		return true;
	}
	return vehicle.station_id === user.station_id;
}
