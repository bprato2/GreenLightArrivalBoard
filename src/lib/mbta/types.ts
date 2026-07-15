/** Minimal JSON:API shapes used from the MBTA V3 stream. */

export interface MbtaRelationshipData {
  id: string;
  type: string;
}

export interface MbtaRelationships {
  [key: string]: {
    data: MbtaRelationshipData | MbtaRelationshipData[] | null;
  };
}

export interface MbtaResource<TAttrs extends object = object> {
  id: string;
  type: string;
  attributes: TAttrs;
  relationships?: MbtaRelationships;
}

export interface PredictionAttributes {
  arrival_time: string | null;
  departure_time: string | null;
  direction_id: number;
  status: string | null;
  stop_sequence: number | null;
  schedule_relationship: string | null;
}

export interface VehicleAttributes {
  current_status: "INCOMING_AT" | "STOPPED_AT" | "IN_TRANSIT_TO" | string;
  current_stop_sequence: number | null;
  direction_id: number;
  latitude: number | null;
  longitude: number | null;
  bearing: number | null;
  label: string | null;
  speed: number | null;
  updated_at: string | null;
  occupancy_status: string | null;
}

export interface StopAttributes {
  name: string;
  platform_name: string | null;
  platform_code: string | null;
}

export interface TripAttributes {
  headsign: string;
  name: string | null;
  direction_id: number;
}

export type PredictionResource = MbtaResource<PredictionAttributes>;
export type VehicleResource = MbtaResource<VehicleAttributes>;
export type StopResource = MbtaResource<StopAttributes>;
export type TripResource = MbtaResource<TripAttributes>;

export type MbtaStreamEventType = "reset" | "add" | "update" | "remove";

export interface StreamCollection {
  predictions: Map<string, PredictionResource>;
  vehicles: Map<string, VehicleResource>;
  stops: Map<string, StopResource>;
  trips: Map<string, TripResource>;
}

export type ArrivalStatus = "on_time" | "delayed" | "approaching" | "boarding" | "unknown";

export type BoardRowKind = "live" | "scheduled";

export interface Arrival {
  id: string;
  vehicleId: string | null;
  tripId: string | null;
  /** 1 = inbound (toward Union Square / downtown), 0 = outbound (toward Riverside). */
  directionId: number;
  headsign: string;
  /** Predicted arrival / departure Instant (ms). Prefer arrival_time, else departure. */
  etaMs: number;
  /** Whole minutes remaining (floored, never negative for display logic). */
  minutesAway: number;
  status: ArrivalStatus;
  scheduleRelationship: string | null;
  /** Human-readable current location, e.g. "Currently at Waban". */
  locationLabel: string | null;
  /** Station index of the vehicle for the mini-map (-1 if unknown). */
  vehicleStationIndex: number | null;
  /** Fractional progress between stations for animation (0–1 within segment). */
  vehicleProgress: number;
  isDelayed: boolean;
  isApproaching: boolean;
  /** Raw MBTA prediction status (e.g. "Approaching", "Boarding"). */
  mbtaStatus: string | null;
  /** Distinguishes live predictions from static schedule rows. */
  rowKind?: BoardRowKind;
}

export interface ScheduleAttributes {
  arrival_time: string | null;
  departure_time: string | null;
  direction_id: number;
  stop_sequence: number | null;
}

export type ScheduleResource = MbtaResource<ScheduleAttributes>;

export interface MapTrain {
  id: string;
  label: string | null;
  directionId: number;
  stationIndex: number;
  /** 0 = at station, 1 = at next station — for interpolation. */
  progress: number;
  status: string;
}

export interface MbtaBoardState {
  arrivals: Arrival[];
  trains: MapTrain[];
  connected: boolean;
  lastEventAt: number | null;
  error: string | null;
}
