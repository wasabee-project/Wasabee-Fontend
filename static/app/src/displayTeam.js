import WasabeeTeam from "./team";
import {
  removeAgentFromTeamPromise,
  setAgentTeamSquadPromise,
  changeTeamOwnerPromise,
  createJoinLinkPromise,
  deleteJoinLinkPromise,
  addAgentToTeamPromise,
  sendAnnounce,
  rocksPromise,
  pullRocks,
  renameTeamPromise,
  deleteTeamPromise,
  pullV,
  configV,
} from "./server";
import { notify } from "./notify";
import WasabeeMe from "./me";
import { logEvent } from "./firebase";

import Vue from "vue";
import TeamView from "./views/Team.vue";

export function displayTeam(state) {
  const subnav = document.getElementById("wasabeeSubnav");
  while (subnav.lastChild) subnav.removeChild(subnav.lastChild);

  subnav.innerHTML = `
<nav class="navbar navbar-expand-sm navbar-light bg-light">
<button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#teamsNav" aria-controls="teamsNav" aria-expanded="false" aria-label="Toggle Subnav">
<span class="navbar-toggler-icon"></span>
</button>
<div class="collapse navbar-collapse" id="teamsNav">
  <ul class="navbar-nav" id="teamNavbar">
   <li class="nav-item"><a class="nav-link active" href="#team/list/${state.team}" id="teamList">List</a></li>
   <li class="nav-item"><a class="nav-link" href="#team/map/${state.team}" id="teamMap">Agent Map</a></li>
  </ul>
 </div>
</nav>
`;

  const teamNavbar = document.getElementById("teamNavbar");
  const teamListNav = document.getElementById("teamList");
  const teamMapNav = document.getElementById("teamMap");
  L.DomEvent.on(teamListNav, "click", (ev) => {
    L.DomEvent.stop(ev);
    for (const c of teamNavbar.children)
      for (const a of c.children) L.DomUtil.removeClass(a, "active");
    L.DomUtil.addClass(teamListNav, "active");
    list(state.team);
  });
  L.DomEvent.on(teamMapNav, "click", (ev) => {
    L.DomEvent.stop(ev);
    for (const c of teamNavbar.children)
      for (const a of c.children) L.DomUtil.removeClass(a, "active");
    L.DomUtil.addClass(teamMapNav, "active");
    map(state.team);
  });

  let owned = false;
  const me = WasabeeMe.cacheGet();
  for (const t of me.Teams) {
    if (t.ID == state.team && t.Owner == me.GoogleID) {
      owned = true;
      break;
    }
  }
  if (owned) {
    const m = `<li class="nav-item"><a class="nav-link" href="#team/manage/${state.team}" id="teamManage">Manage</a></li>`;
    teamNavbar.insertAdjacentHTML("beforeend", m);
    const teamManageNav = document.getElementById("teamManage");
    L.DomEvent.on(teamManageNav, "click", (ev) => {
      L.DomEvent.stop(ev);
      for (const c of teamNavbar.children)
        for (const a of c.children) L.DomUtil.removeClass(a, "active");
      L.DomUtil.addClass(teamManageNav, "active");
      manage(state.team);
    });

    const s = `<li class="nav-item"><a class="nav-link" href="#team/settings/${state.team}" id="teamSettings">Settings</a></li>`;
    teamNavbar.insertAdjacentHTML("beforeend", s);
    const teamSettingsNav = document.getElementById("teamSettings");
    L.DomEvent.on(teamSettingsNav, "click", (ev) => {
      L.DomEvent.stop(ev);
      for (const c of teamNavbar.children)
        for (const a of c.children) L.DomUtil.removeClass(a, "active");
      L.DomUtil.addClass(teamSettingsNav, "active");
      settings(state.team);
    });
  }

  switch (state.subscreen) {
    case "list":
      list(state.team);
      break;
    case "map":
      map(state.team);
      break;
    case "settings":
      settings(state.team);
      break;
    case "manage":
      manage(state.team);
      break;
    default:
      console.log("unknown team screen state:", state);
      list(state.team);
  }

  // const vm = new Vue({
  //   el: '#wasabeeContent',
  //   render: (h) => h(TeamView),
  // });
}

async function list(teamID) {
  history.pushState(
    { screen: "team", team: teamID, subscreen: "list" },
    "team list",
    `#team/list/${teamID}`
  );
  logEvent("screen_view", { screen_name: "team list" });

  const content = document.getElementById("wasabeeContent");
  while (content.lastChild) content.removeChild(content.lastChild);

  content.innerHTML = `
<div class="container"><div class="row"><div class="col">
<h1 id="teamName"></h1>
<table class="table table-striped">
<thead>
<tr>
<th scope="col">&nbsp;</th>
<th scope="col">Agent</th>
<th scope="col">Sharing Location</th>
<th scope="col">Sharing WD Keys</th>
<th scope="col">Squad</th>
</tr>
</thead>
<tbody id="teamTable">
</tbody>
</table>
</div></div></div>
`;

  const teamName = document.getElementById("teamName");
  const teamTable = document.getElementById("teamTable");

  try {
    const team = await WasabeeTeam.waitGet(teamID);
    teamName.textContent = team.name;
    for (const a of team.agents) {
      let state = "";
      if (a.state)
        state = `<img src="${window.wasabeewebui.cdnurl}/img/checkmark.png" alt="sharing location">`;
      let keys = "";
      if (a.ShareWD)
        keys = `<img src="${window.wasabeewebui.cdnurl}/img/checkmark.png" alt="sharing wd keys">`;
      const row = `
<tr>
<td><img src="${a.pic}" height="50" width="50"></td>
<td>${a.name}</td>
<td>${state}</td>
<td>${keys}</td>
<td>${a.squad}</td>
</tr>`;
      teamTable.insertAdjacentHTML("beforeend", row);
    }
  } catch (e) {
    console.log(e);
    notify(e, "danger", true);
  }
}

async function map(teamID) {
  history.pushState(
    { screen: "team", team: teamID, subscreen: "map" },
    "team map",
    `#team/map/${teamID}`
  );
  logEvent("screen_view", { screen_name: "team map" });

  const content = document.getElementById("wasabeeContent");
  while (content.lastChild) content.removeChild(content.lastChild);
  const height = Math.max(window.innerHeight - 300, 200);

  content.innerHTML = `
<div class="container-fluid"><div class="row"><div class="col">
<h1 id="teamName"></h1>
<div id="map" style="height: ${height}"></div>
</div></div></div>
`;

  const map = L.map("map");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const teamName = document.getElementById("teamName");
  // const mapDiv = document.getElementById("map");

  try {
    const team = await WasabeeTeam.waitGet(teamID);
    const lls = new Array();
    teamName.textContent = team.name;
    for (const a of team.agents) {
      if (a.lat) {
        const m = L.marker([a.lat, a.lng], {
          title: a.name,
          icon: L.icon({
            iconUrl: a.pic,
            shadowUrl: null,
            iconSize: L.point(41, 41),
            iconAnchor: L.point(25, 41),
            popupAnchor: L.point(-1, -48),
          }),
          id: a.id,
        });

        m.bindPopup(a.name);
        m.addTo(map);
        lls.push([a.lat, a.lng]);
      }
    }
    // zoom to agents
    if (lls.length == 0) map.fitWorld();
    if (lls.length == 1) map.setView(lls[0], 13);
    if (lls.length > 1) {
      const bounds = L.latLngBounds(lls);
      map.fitBounds(bounds);
    }
  } catch (e) {
    notify(e, "danger", true);
    console.log(e);
  }
}

async function manage(teamID) {
  history.pushState(
    { screen: "team", team: teamID, subscreen: "manage" },
    "team manage",
    `#team/manage/${teamID}`
  );
  logEvent("screen_view", { screen_name: "team manage" });

  const content = document.getElementById("wasabeeContent");
  while (content.lastChild) content.removeChild(content.lastChild);

  content.innerHTML = `
<div class="container"><div class="row"><div class="col">
<h1 id="teamName"></h1>
<label>Add Agent:
  <input type="text" id="addAgent" placeholder="GoogleID or Agent Name" />
</label>
<button id="addAgentButton">Add</button>
<table class="table table-striped">
<thead>
<tr>
<th scope="col">&nbsp;</th>
<th scope="col">Agent</th>
<th scope="col">Sharing Location</th>
<th scope="col">Squad</th>
<th scope="col">&nbsp;</th>
</tr>
</thead>
<tbody id="teamTable">
</tbody>
</table>
</div></div></div>
`;

  const teamName = document.getElementById("teamName");
  const teamTable = document.getElementById("teamTable");
  const addAgent = document.getElementById("addAgent");
  const addAgentButton = document.getElementById("addAgentButton");

  L.DomEvent.on(addAgentButton, "click", () => {
    addAgentToTeamPromise(addAgent.value, teamID).then(
      () => {
        // just reload the screen
        manage(teamID);
      },
      (reject) => {
        console.log(reject);
        notify(reject, "danger", true);
      }
    );
  });

  try {
    const team = await WasabeeTeam.waitGet(teamID);
    teamName.textContent = team.name;
    for (const a of team.agents) {
      let state = "";
      if (a.state)
        state = `<img src="${window.wasabeewebui.cdnurl}/img/checkmark.png" alt="sharing location with this team">`;
      let remove = "";
      if (!team.RockCommunity) {
        remove = `<button id="${teamID}.${a.id}.remove">Remove</button>`;
      }
      const row = `
<tr>
<td><img src="${a.pic}" height="50" width="50"></td>
<td>${a.name}</td>
<td>${state}</td>
<td><input type="text" value="${a.squad}" id="${teamID}.${a.id}.squad" /></td>
<td>${remove}</td>
</tr>`;
      teamTable.insertAdjacentHTML("beforeend", row);
    }
    for (const a of team.agents) {
      const remove = document.getElementById(`${teamID}.${a.id}.remove`);
      L.DomEvent.on(remove, "click", (ev) => {
        L.DomEvent.stop(ev);
        removeAgentFromTeamPromise(a.id, teamID).then(
          () => {
            manage(teamID);
          },
          (reject) => {
            notify(reject, "danger", true);
            console.log(reject);
          }
        );
      });

      const squad = document.getElementById(`${teamID}.${a.id}.squad`);
      L.DomEvent.on(squad, "change", (ev) => {
        L.DomEvent.stop(ev);
        setAgentTeamSquadPromise(a.id, teamID, squad.value).then(
          () => {
            manage(teamID);
          },
          (reject) => {
            notify(reject, "danger", true);
            console.log(reject);
          }
        );
      });
    }
  } catch (e) {
    notify(e, "danger", true);
    console.log(e);
  }
}

async function settings(teamID) {
  history.pushState(
    { screen: "team", team: teamID, subscreen: "settings" },
    "team settings",
    `#team/settings/${teamID}`
  );
  logEvent("screen_view", { screen_name: "team settings" });

  const content = document.getElementById("wasabeeContent");
  while (content.lastChild) content.removeChild(content.lastChild);

  content.innerHTML = `
<div class="container"><div class="row"><div class="col">
<h1 id="teamName"></h1>
 <div class="card mb-2">
  <div class="card-header">Join Link</div>
  <div class="card-body" id="joinLink"></div>
 </div>
 <div class="card mb-2">
  <div class="card-header">Admin Functions</div>
  <div class="card-body">
    <div><label>Rename Team <input type="text" id="rename"></label></div>
    <div><hr/><label>Delete this team </label><button id="delete">Delete</button></div>
  </div>
 </div>
 <div class="card mb-2">
  <div class="card-header">enlightened.rocks Integration</div>
   <div class="card-body">
     <div>Rocks Community Identifier: <input type="text" name="rockscomm" id="rockscomm" placeholder="afdviaren.com"/> <span class="dim small">Typically looks like "randomstring.com"</span></div>
     <div>Rocks Community API Key: <input type="text" name="rockskey" id="rockskey" placeholder="VnNfDerpL1nKsppMerZvwaXX"  /> <span class="dim small">24 letter string</span></div>
     <div class="dim small">If you want this team to have its membership populated from an .rocks community, you will need to get the community ID and API key from the community's settings and add them here. Do not do this unless you trust the enl.rocks community.</div>
    <button id="rockspull">Pull associated enl.rocks community members onto this team</button>
   </div>
  </div>
 <div class="card mb-2">
  <div class="card-header">V integration</div>
   <div class="card-body">
     <div>V Team ID #: <input type="text" name="vteam" id="vteam" placeholder="1234"/></div>
     <div>V Team Role: <select id="vrole">
     <option value="0">All</option>
     <option value="1">Planner</option>
     <option value="2">Operator</option>
     <option value="3">Linker</option>
     <option value="4">Keyfarming</option>
     <option value="5">Cleaner</option>
     <option value="6">Field Agent</option>
     <option value="7">Item Sponsor</option>
     <option value="8">Key Transport</option>
     <option value="9">Recharging</option>
     <option value="10">Software Support</option>
     <option value="11">Anomaly TL</option>
     <option value="12">Team Lead</option>
     <option value="13">Other</option>
     <option value="100">Team-0</option>
     <option value="101">Team-1</option>
     <option value="102">Team-2</option>
     <option value="103">Team-3</option>
     <option value="104">Team-4</option>
     <option value="105>"Team-5</option>
     <option value="106>"Team-6</option>
     <option value="107">Team-7</option>
     <option value="108">Team-8</option>
     <option value="109">Team-9</option>
     <option value="110">Team-10</option>
     <option value="111">Team-11</option>
     <option value="112">Team-12</option>
     <option value="113">Team-13</option>
     <option value="114">Team-14</option>
     <option value="115">Team-15</option>
     <option value="116">Team-16</option>
     <option value="117">Team-17</option>
     <option value="118">Team-18</option>
     <option value="119">Team-19</option>
	 </select></div>
     <div class="dim small">You must set a valid V API token in your settings tab.</div>
    <button id="vpull">Pull associated V team/role members onto this team</button>
   </div>
  </div>
 <div class="card mb-2">
  <div class="card-header">Send Announcement</div>
   <div class="card-body">
    <textarea name="m" id="announceContent"></textarea>
    <button id="announce">Send</button>
   </div>
  </div>
 <div class="card mb-2">
  <div class="card-header">Change Ownership</div>
   <div class="card-body">
    <input type="text" placeholder="new owner" id="newOwner"></input>
    <div class="dim small">agent name or googleID -- once you change ownership, you can no longer manage this team</div>
   </div>
  </div>
 <div class="card mb-2">
  <div class="card-header">Team Info</div>
   <div class="card-body">
    Wasabee Team ID: <span id="teamid"></span>
   </div>
  </div>
</div></div></div>
`;

  const teamid = document.getElementById("teamid");
  const teamName = document.getElementById("teamName");
  const rockscomm = document.getElementById("rockscomm");
  const rockskey = document.getElementById("rockskey");
  const rockspull = document.getElementById("rockspull");
  const vpull = document.getElementById("vpull");
  const newOwner = document.getElementById("newOwner");
  const joinLink = document.getElementById("joinLink");
  const announce = document.getElementById("announce");
  const deleteButton = document.getElementById("delete");
  const rename = document.getElementById("rename");
  const vteam = document.getElementById("vteam");
  const vrole = document.getElementById("vrole");

  L.DomEvent.on(announce, "click", () => {
    const announceContent = document.getElementById("announceContent");
    sendAnnounce(teamID, announceContent.value);
    notify("Message Sent");
    announceContent.value = "";
  });

  L.DomEvent.on(newOwner, "change", (ev) => {
    L.DomEvent.stop(ev);
    changeTeamOwnerPromise(teamID, newOwner.value).then(
      () => {
        list(teamID);
      },
      (reject) => {
        newOwner.value = "";
        console.log(reject);
        notify(reject, "danger", true);
      }
    );
  });

  L.DomEvent.on(rockspull, "click", (ev) => {
    L.DomEvent.stop(ev);
    rockspull.textContent = "pulling... please wait";
    rockspull.disabled = true;
    pullRocks(teamID).then(
      () => {
        notify("Rocks Community fetched", "success");
        rockspull.textContent = "done";
      },
      (reject) => {
        notify(reject, "danger");
        console.log(reject);
        rockspull.textContent = reject;
      }
    );
  });

  L.DomEvent.on(rockscomm, "change", (ev) => {
    L.DomEvent.stop(ev);
    rocksPromise(teamID, rockscomm.value, rockskey.value).then(
      () => {},
      (reject) => {
        console.log(reject);
        notify(reject, "danger");
      }
    );
  });

  L.DomEvent.on(rockskey, "change", (ev) => {
    L.DomEvent.stop(ev);
    rocksPromise(teamID, rockscomm.value, rockskey.value).then(
      () => {},
      (reject) => {
        console.log(reject);
        notify(reject, "danger");
      }
    );
  });

  L.DomEvent.on(vpull, "click", (ev) => {
    L.DomEvent.stop(ev);
    vpull.textContent = "pulling... please wait";
    vpull.disabled = true;
    pullV(teamID).then(
      () => {
        notify("V Team fetched", "success");
        vpull.textContent = "done";
      },
      (reject) => {
        notify(reject, "danger");
        console.log(reject);
        vpull.textContent = reject;
      }
    );
  });

  L.DomEvent.on(vteam, "change", async (ev) => {
    L.DomEvent.stop(ev);
    try {
      await configV(teamID, vteam.value, vrole.value);
      notify("updated V team link");
    } catch (e) {
      console.log(e);
      notify(e, "danger", true);
    }
  });

  L.DomEvent.on(vrole, "change", async (ev) => {
    L.DomEvent.stop(ev);
    try {
      await configV(teamID, vteam.value, vrole.value);
      notify("updated V team link");
    } catch (e) {
      console.log(e);
      notify(e, "danger", true);
    }
  });

  L.DomEvent.on(rename, "change", (ev) => {
    L.DomEvent.stop(ev);
    renameTeamPromise(teamID, rename.value).then(
      () => {
        settings(teamID);
      },
      (reject) => {
        console.log(reject);
        notify(reject, "danger");
      }
    );
  });

  L.DomEvent.on(deleteButton, "click", (ev) => {
    L.DomEvent.stop(ev);
    deleteTeamPromise(teamID).then(
      () => {
        window.location.assign("/me");
      },
      (reject) => {
        console.log(reject);
        notify(reject, "danger");
      }
    );
  });

  try {
    const team = await WasabeeTeam.waitGet(teamID);
    teamName.textContent = team.name;
    teamid.textContent = team.id;

    if (team.rc) rockscomm.value = team.rc;
    if (team.rk) rockskey.value = team.rk;
    if (team.vt) vteam.value = team.vt;
    if (team.vr) vrole.value = team.vr;

    // join link
    if (team.jlt) {
      joinLink.innerHTML = `<a href="/api/v1/team/${team.id}/join/${team.jlt}">copy this link</a> to share with agents`;
      const dbutton = L.DomUtil.create("button", null, joinLink);
      dbutton.textContent = "remove";
      L.DomEvent.on(dbutton, "click", () => {
        deleteJoinLinkPromise(team.id).then(
          () => {
            joinLink.textContent = "deleted";
          },
          (reject) => {
            console.log(reject);
            notify(reject, "danger", true);
          }
        );
      });
    } else {
      const generate = L.DomUtil.create("button", null, joinLink);
      generate.textContent = "Generate Join Link";
      L.DomEvent.on(generate, "click", (ev) => {
        L.DomEvent.stop(ev);
        createJoinLinkPromise(team.id).then(
          (resolve) => {
            try {
              const k = JSON.parse(resolve);
              notify("Join link created: " + k.Key, "success", false);
              joinLink.innerHTML = `<a href="/api/v1/team/${team.id}/join/${k.Key}">copy this link</a> to share with agents`;
            } catch (e) {
              console.log(e);
              notify(e, "danger", true);
            }
          },
          (reject) => {
            joinLink.textContent = "unable to create link";
            console.log(reject);
            notify(reject, "danger", true);
          }
        );
      });
    }
  } catch (e) {
    console.log(e);
    notify(e, "danger", true);
  }
}
