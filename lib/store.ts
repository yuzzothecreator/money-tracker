import Dexie, { type Table } from "dexie";
import { Data } from "./finance";
class Store extends Dexie {
  state!: Table<{ id: string; data: Data; revision?: number }, string>;
  constructor() {
    super("moneyflow-v1");
    this.version(1).stores({ state: "id" });
  }
}
export const db = new Store();
