import type { KettlePhase } from "./hercules.ts";
import type { WeatherGlass } from "./weather.ts";
import type { InstrumentId } from "./officeLayout.ts";

export type RoomMood = {
  glass: WeatherGlass;
  roomDim: number;
  roomCool: number;
  promoted: InstrumentId;
};

const PHASE_PROMOTE: Record<KettlePhase, InstrumentId> = {
  morning: "calculator",
  "after-shift": "timesheet",
  sunday: "postcard",
  evening: "blotter",
};

/** Atmosphere only. Never changes CAD. */
export function resolveRoom(phase: KettlePhase, glass: WeatherGlass): RoomMood {
  let roomDim = 0;
  let roomCool = 0;
  if (glass === "rain") roomCool = 0.03;
  if (glass === "snow") roomCool = 0.04;
  if (glass === "night") roomDim = 0.06;
  if (glass === "humid") roomCool = 0.01;
  return {
    glass,
    roomDim,
    roomCool,
    promoted: PHASE_PROMOTE[phase],
  };
}

export function allRoomCombinations(): Array<{ phase: KettlePhase; glass: WeatherGlass }> {
  const phases: KettlePhase[] = ["morning", "after-shift", "sunday", "evening"];
  const glasses: WeatherGlass[] = ["clear", "rain", "snow", "night", "humid"];
  const rows: Array<{ phase: KettlePhase; glass: WeatherGlass }> = [];
  for (const phase of phases) {
    for (const glass of glasses) rows.push({ phase, glass });
  }
  return rows;
}
