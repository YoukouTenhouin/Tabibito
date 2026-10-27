import { useEffect, useSyncExternalStore } from "react";
import {
  loadPlaceNames,
  placeNamesVersion,
  subscribePlaceNames,
} from "./places";

export function usePlaceNames() {
  const version = useSyncExternalStore(
    subscribePlaceNames,
    placeNamesVersion,
    () => 0,
  );
  useEffect(() => {
    void loadPlaceNames();
  }, []);
  return version;
}
