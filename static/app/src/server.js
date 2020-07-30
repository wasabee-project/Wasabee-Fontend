import WasabeeOp from "./operation";
import WasabeeMe from "./me";
import WasabeeAgent from "./agent";
import WasabeeTeam from "./team";
import WasabeeMarker from "./marker";
import { notify } from "./notify";

export function sendTokenToWasabee(token) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/me/firebase`;
    const req = new XMLHttpRequest();
    req.open("POST", url, true);
    req.withCredentials = true;

    req.onload = function () {
      if (req.status === 200) {
        console.log("token sent OK");
        resolve();
      } else {
        reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    req.send(token);
  });
}

export function loadMe(force = false) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/me?json=y`;
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.withCredentials = true;

    if (!force) {
      const lsme = localStorage["me"];
      if (lsme) {
        const maxCacheAge = Date.now() - 1000 * 60 * 59;
        const l = new WasabeeMe(lsme);
        if (l.fetched && l.fetched > maxCacheAge) {
          resolve(lsme);
        }
      }
    }

    req.onload = function () {
      if (req.status === 200) {
        try {
          resolve(req.response);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    req.send();
  });
}

export function loadLogout() {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/me/logout`;
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.withCredentials = true;

    req.onload = function () {
      if (req.status === 200) {
        try {
          resolve(req.response);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    req.send();
  });
}

export function loadOp(opID) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/draw/${opID}`;
    const req = new XMLHttpRequest();
    const localop = new WasabeeOp(localStorage[opID]);

    req.open("GET", url);
    req.withCredentials = true;
    if (localop != null && localop.fetched) {
      req.setRequestHeader("If-Modified-Since", localop.fetched);
    }

    req.onload = function () {
      switch (req.status) {
        case 200:
          try {
            const op = new WasabeeOp(req.response);
            op.store();
            resolve(op);
          } catch (e) {
            reject(e);
          }
          break;
        case 304: // If-Modified-Since replied NotModified
          // console.debug("server copy is older/unmodified, keeping local copy");
          resolve(localop);
          break;
        case 401:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    req.send();
  });
}

export const loadAgent = function (GID) {
  return new Promise(function (resolve, reject) {
    if (GID == null || GID == "null" || GID == "") {
      reject("null gid");
    }

    const url = `${window.wasabeewebui.server}/api/v1/agent/${GID}`;
    const req = new XMLHttpRequest();

    req.open("GET", url);
    req.withCredentials = true;

    req.onload = function () {
      if (req.status === 200) {
        try {
          resolve(WasabeeAgent.create(req.response));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    req.send();
  });
};

export const loadConfig = function () {
  return new Promise(function (resolve, reject) {
    const url = `/static/wasabee-webui-config.json`;
    const req = new XMLHttpRequest();

    req.open("GET", url);
    // req.withCredentials = true;

    req.onload = function () {
      if (req.status === 200) {
        try {
          resolve(JSON.parse(req.response));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    req.send();
  });
};

export async function syncOps(ops) {
  const promises = new Array();
  const opsID = new Set(ops.map((o) => o.ID));
  for (const o of opsID) promises.push(loadOp(o));

  try {
    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status != "fulfilled") {
        console.log(r);
        notify("Op load failed, please refresh", "warning", true);
      }
    }
  } catch (e) {
    console.log(e);
    notify(e, "warning", true);
    return;
  }

  // pre-cache team (and agent) data
  // we could do this in the results loop above, but this gives better error handling
  const teamSet = new Set();
  const teamPromises = new Array();
  for (const o of opsID) {
    const op = new WasabeeOp(localStorage[o]);
    for (const t of op.teamlist) teamSet.add(t.teamid);
  }
  for (const t of teamSet) teamPromises.push(loadTeam(t));
  try {
    await Promise.allSettled(teamPromises);
    // ignore errors, disabled teams give a 401 that we can safely ignore
  } catch (e) {
    console.log(e);
    notify(e, "warning", true);
    return;
  }
}

export function startSendLoc() {
  if (localStorage["sendLocation"] != "true") return;
  _sendLocation();

  window.wasabeewebui.sendLocInterval = setInterval(() => {
    _sendLocation();
  }, 60000);
}

export function stopSendLoc() {
  clearInterval(window.wasabeewebui.sendLocInterval);
  delete window.wasabeewebui.sendLocInterval;
}

function _sendLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // skip if no change
        if (
          window.wasabeewebui.lastPosition &&
          window.wasabeewebui.lastPosition.latitude ==
            position.coords.latitude &&
          window.wasabeewebui.lastPosition.longitude ==
            position.coords.longitude
        ) {
          console.log("location unchanged, skipping send");
          return;
        }
        window.wasabeewebui.lastPostion = position;
        _sendLoc(position.coords.latitude, position.coords.longitude).then(
          () => {
            // console.log("location sent");
          },
          (reject) => {
            notify("Unable to send location to server", "warning", true);
            console.log(reject);
            stopSendLoc();
          }
        );
      },
      (error) => {
        notify("Unable to determine location", "secondary", false);
        console.log(error);
        if (window.wasabeewebui.sendLocInterval) {
          stopSendLoc();
        }
      }
    );
  }
}

function _sendLoc(lat, lon) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/me?lat=${lat}&lon=${lon}`;
    const req = new XMLHttpRequest();

    req.open("GET", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    req.send();
  });
}

export function loadTeam(teamID) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}`;
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.withCredentials = true;

    // XXX server does not yet support If-Modified-Since on teams (07/29/2020)
    const localTeam = WasabeeTeam.get(teamID);
    if (localTeam != null && localTeam.fetched) {
      req.setRequestHeader("If-Modified-Since", localTeam.fetched);
    }

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(WasabeeTeam.create(req.response));
          break;
        case 304: // If-Modified-Since replied NotModified
          // console.debug("server copy is older/unmodified, keeping local copy");
          resolve(localTeam);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    req.send();
  });
}

export function addAgentToTeam(teamID, googleID) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/${googleID}`;
    const req = new XMLHttpRequest();
    req.open("POST", url, true);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };

    const fd = new FormData();
    req.send(fd);
  });
}

export function removeAgentFromTeam(teamID, googleID) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/${googleID}`;
    const req = new XMLHttpRequest();
    req.open("DELETE", url, true);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    req.send();
  });
}

export function setSquad(teamID, googleID, squad) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/${googleID}/squad`;
    const req = new XMLHttpRequest();
    req.open("POST", url, true);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };
    const fd = new FormData();
    fd.append("squad", squad);
    req.send(fd);
  });
}

export function setDisplayName(teamID, googleID, displayname) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/${googleID}/displayname`;
    const req = new XMLHttpRequest();
    req.open("POST", url, true);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };

    const fd = new FormData();
    fd.append("displayname", displayname);
    req.send(fd);
  });
}

export function setTeamState(teamID, state) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/me/${teamID}?state=${state}`;
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };

    req.send();
  });
}

export function leaveTeam(teamID) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/me/${teamID}`;
    const req = new XMLHttpRequest();
    req.open("DELETE", url, true);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };

    req.send();
  });
}

export function changeTeamOwnerPromise(teamID, newOwner) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/chown?to=${newOwner}`;
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };

    req.send();
  });
}

export function createJoinLinkPromise(teamID) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/genJoinKey`;
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };

    req.send();
  });
}

export function deleteJoinLinkPromise(teamID) {
  return new Promise(function (resolve, reject) {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/delJoinKey`;
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(req.response);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };
    req.onerror = function () {
      reject(Error(`Network Error: ${req.responseText}`));
    };

    req.send();
  });
}

export const addPermPromise = function (opID, teamID, role) {
  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/draw/${opID}/perms`;
    const req = new XMLHttpRequest();

    req.open("POST", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    const fd = new FormData();
    fd.append("team", teamID);
    fd.append("role", role);
    req.send(fd);
  });
};

export const deletePermPromise = function (opID, teamID, role) {
  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/draw/${opID}/perms`;
    const req = new XMLHttpRequest();

    req.open("DELETE", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    const fd = new FormData();
    fd.append("team", teamID);
    fd.append("role", role);
    req.send(fd);
  });
};

export const setAssignmentStatus = function (op, object, completed) {
  let type = "link";
  if (object instanceof WasabeeMarker) type = "marker";
  let c = "incomplete";
  if (completed) c = "complete";

  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/draw/${op.ID}/${type}/${object.ID}/${c}`;
    const req = new XMLHttpRequest();

    req.open("GET", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    req.send();
  });
};

export const updateKeyCount = function (op, portalID, count, capsule) {
  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/draw/${op.ID}/portal/${portalID}/keyonhand`;
    const req = new XMLHttpRequest();

    req.open("POST", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    const fd = new FormData();
    fd.append("portal", portalID);
    fd.append("onhand", count);
    fd.append("capsule", capsule);
    req.send(fd);
  });
};

export const sendAnnounce = function (teamID, message) {
  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/announce`;
    const req = new XMLHttpRequest();

    req.open("POST", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    const fd = new FormData();
    fd.append("m", message);
    req.send(fd);
  });
};

export const pullRocks = function (teamID) {
  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/rocks`;
    const req = new XMLHttpRequest();

    req.open("GET", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    req.send();
  });
};

export const rocksCfg = function (teamID, rockscomm, rockskey) {
  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/team/${teamID}/rockscfg?rockscomm=${rockscomm}&rockskey=${rockskey}`;
    const req = new XMLHttpRequest();

    req.open("GET", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    req.send();
  });
};

export const reverseLinkDirection = function (opID, linkID) {
  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/draw/${opID}/link/${linkID}/swap`;
    const req = new XMLHttpRequest();

    req.open("GET", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    req.send();
  });
};

export const setMarkerComment = function (opID, markerID, comment) {
  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/draw/${opID}/marker/${markerID}/comment`;
    const req = new XMLHttpRequest();

    req.open("POST", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    const fd = new FormData();
    fd.append("comment", comment);
    req.send(fd);
  });
};

export const setLinkComment = function (opID, linkID, desc) {
  return new Promise((resolve, reject) => {
    const url = `${window.wasabeewebui.server}/api/v1/draw/${opID}/link/${linkID}/desc`;
    const req = new XMLHttpRequest();

    req.open("POST", url);
    req.withCredentials = true;

    req.onload = function () {
      switch (req.status) {
        case 200:
          resolve(true);
          break;
        default:
          reject(Error(`${req.status}: ${req.statusText} ${req.responseText}`));
          break;
      }
    };

    req.onerror = function () {
      reject(`Network Error: ${req.responseText}`);
    };

    const fd = new FormData();
    fd.append("desc", desc);
    req.send(fd);
  });
};
