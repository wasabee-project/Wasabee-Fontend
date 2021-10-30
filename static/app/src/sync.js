import WasabeeMe from "./me";
import WasabeeTeam from "./team";
import { opPromise } from "./server";
import { notify } from "./notify";

export async function loadMeAndOps() {
  try {
    const nme = await WasabeeMe.waitGet(true);
    if (nme && nme.GoogleID) {
      nme.store();
      // load all available ops and teams
      await syncOps(nme);
    } else {
      console.log(nme);
      clearOpsStorage();
      throw new Error("invalid data from /me");
    }
  } catch (e) {
    notify(e, "danger", true);
    console.log(e);
    throw e;
  }
}

function storedOpsList() {
  const ids = [];
  const lsk = Object.keys(localStorage);
  for (const id of lsk) {
    if (id.length == 40) ids.push(id);
  }
  return ids;
}

export function clearOpsStorage() {
  for (const id of storedOpsList()) {
    delete localStorage[id];
  }
}

export async function syncOps(me) {
  const opsID = new Set(me.Ops.map((o) => o.ID));

  // clear unavailable ops
  const oldList = storedOpsList();
  for (const id of storedOpsList()) {
    if (!opsID.has(id)) delete localStorage[id];
  }

  const promises = new Array();
  for (const o of opsID) promises.push(opPromise(o));
  try {
    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status != "fulfilled") {
        console.log(r);
        throw new Error("Op load failed, please refresh");
      }
      r.value.store();
    }
  } catch (e) {
    console.log(e);
    notify(e, "warning", true);
    // return;
  }

  const meTeams = new Set(me.Teams.map((t) => t.ID));
  const teamPromises = new Array();
  for (const t of meTeams) teamPromises.push(WasabeeTeam.waitGet(t, 300));
  try {
    const results = await Promise.allSettled(teamPromises);
    for (const r of results) {
      if (r.status != "fulfilled") {
        console.log(r);
        // throw new Error("team load failed, please refresh");
      }
    }
  } catch (e) {
    console.log(e);
    notify(e, "warning", true);
    return;
  }
}
