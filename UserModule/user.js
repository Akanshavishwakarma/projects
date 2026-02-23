/* ================= API ================= */

const apiURL = "http://localhost:3000";



/* ================= SESSION ================= */

let session = null;

try {
  session = JSON.parse(localStorage.getItem("loggedInUser"));
} catch(e) {
  session = null;
}

if (!session || !session.username) {
  alert("Session expired. Please login again.");
  localStorage.clear();
  window.location.href = "../index.html";
}

const loggedUser = session.username;


/* ================= GLOBAL STATE ================= */

let selectedClientName = "";
let selectedClientId = null;
let editingPostId = null;
let deletePostId = null;


/* ================= DOM READY ================= */

document.addEventListener("DOMContentLoaded", function () {

  /* RESET STATE */

  selectedClientId = null;
  selectedClientName = "";

  document.getElementById("selectClientBtn").innerText = "Select Client";
  document.getElementById("contentTable").innerHTML = "";

  const search = document.getElementById("searchInput");
  if (search) search.value = "";


  /* ================= LOAD EMPLOYEE ================= */

  fetch(apiURL + "/employee/" + loggedUser)
    .then(res => res.json())
    .then(data => {

      console.log("Employee Loaded:", data);

      if (data.error) {
        document.getElementById("empName").innerText = "Employee Not Found";
        return;
      }

      document.getElementById("empName").innerText = data.name;
      document.getElementById("empId").innerText = data.employeeId;
      document.getElementById("empPass").innerText = data.password;

      window.assignedCustomers = data.customers || [];

      const custList = document.getElementById("custList");
      custList.innerHTML = "";

      if (!window.assignedCustomers.length) {
        custList.innerHTML = "<li>No Customers Assigned</li>";
        document.getElementById("totalAssigned").innerText = 0;
        return;
      }

      window.assignedCustomers.forEach(c => {
        custList.innerHTML += `<li>${c}</li>`;
      });

      document.getElementById("totalAssigned").innerText =
        window.assignedCustomers.length;

    })
    .catch(err => console.log("Employee Load Error:", err));


  /* ================= OPEN MODAL ================= */

  document.getElementById("openModal").onclick = function () {

    editingPostId = null;

    document.getElementById("createBtn").innerText = "Create Post";

    document.getElementById("project_name").value = "";
    document.getElementById("project_caption").value = "";
    document.getElementById("platform").value = "";
    document.getElementById("status").value = "Draft";
    document.getElementById("schedule_date").value = "";

    document.getElementById("postModal").classList.remove("hidden");
  };


  /* ================= CANCEL MODAL ================= */

  document.getElementById("cancelBtn").onclick = function () {
    document.getElementById("postModal").classList.add("hidden");
  };


  /* ================= CREATE / UPDATE POST ================= */

  document.getElementById("createBtn").onclick = function () {

    const title = document.getElementById("project_name").value.trim();
    const caption = document.getElementById("project_caption").value.trim();
    const platform = document.getElementById("platform").value;
    const status = document.getElementById("status").value;
    const date = document.getElementById("schedule_date").value;

    if (!title || !caption || !platform || !date) {
      alert("Please fill all fields");
      return;
    }

    const postData = {
      title,
      caption,
      platform,
      status,
      post_date: date,
      customer_id: selectedClientId
    };
    // ================= DATE VALIDATION =================

const selectedDate = new Date(date);
const today = new Date();

// remove time part
selectedDate.setHours(0,0,0,0);
today.setHours(0,0,0,0);

if (selectedDate < today) {

  alert("❌ Cannot create post for past date.\nPlease select today or future date.");

  return; // STOP post creation

}

    /* UPDATE */

    if (editingPostId) {

      fetch(apiURL + "/updatePost/" + editingPostId, {

        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData)

      })
      .then(res => res.json())
      .then(() => {

        alert("Post Updated Successfully");

        editingPostId = null;

        document.getElementById("createBtn").innerText =
          "Create Post";

        document.getElementById("postModal")
          .classList.add("hidden");

        loadContent(selectedClientId);

      });

    }

    /* CREATE */

    else {

      fetch(apiURL + "/addPost", {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData)

      })
      .then(res => res.json())
      .then(() => {

        alert("Post Created Successfully");

        document.getElementById("postModal")
          .classList.add("hidden");

        loadContent(selectedClientId);

      });

    }

  };


  /* ================= CLIENT SELECTION ================= */

  const selectClientBtn =
    document.getElementById("selectClientBtn");

  const clientListDiv =
    document.getElementById("clientList");

  const radioClientsDiv =
    document.getElementById("radioClients");

  const cancelClientBtn =
    document.getElementById("cancelClient");

  const confirmClientBtn =
    document.getElementById("confirmClient");


  /* OPEN CLIENT LIST */

  selectClientBtn.onclick = function () {

    clientListDiv.style.display = "block";

    radioClientsDiv.innerHTML =
      "<p>Loading clients...</p>";

    fetch(apiURL + "/customers")
      .then(res => res.json())
      .then(clients => {

        radioClientsDiv.innerHTML = "";

        if (!clients.length) {

          radioClientsDiv.innerHTML =
            "<p>No clients found</p>";

          return;
        }

        clients.forEach(client => {

          const label =
            document.createElement("label");

          label.className = "client-card";

          label.innerHTML = `
            <input type="radio"
              name="selectedClient"
              value="${client.cust_id}">
            <span>${client.cust_name}</span>
          `;

          radioClientsDiv.appendChild(label);

        });

      });

  };


  /* CANCEL */

  cancelClientBtn.onclick = function () {

    clientListDiv.style.display = "none";

    selectedClientId = null;
    selectedClientName = "";

  };


  /* CONFIRM */

  confirmClientBtn.onclick = function () {

    const selected =
      document.querySelector(
        'input[name="selectedClient"]:checked'
      );

    if (!selected) {
      alert("Please select a client");
      return;
    }

    selectedClientId = selected.value;

    selectedClientName =
      selected.nextElementSibling.innerText;

    selectClientBtn.innerText =
      selectedClientName;

    clientListDiv.style.display = "none";

    loadContent(selectedClientId);

  };

});


/* ================= LOAD CONTENT ================= */

function loadContent(clientId) {

  if (!clientId) return;

  const table =
    document.getElementById("contentTable");

  table.innerHTML =
    "<tr><td colspan='5'>Loading...</td></tr>";

  fetch(apiURL + "/posts?customer=" + clientId)
    .then(res => res.json())
    .then(data => {

      table.innerHTML = "";

      if (!data.length) {

        table.innerHTML =
          "<tr><td colspan='5'>No Posts Found</td></tr>";

        return;
      }

      data.forEach(post => {

        table.innerHTML += `
        <tr>

          <td>${post.title}</td>
          <td>${post.platform}</td>
          <td>${post.status}</td>
          <td>${new Date(post.post_date).toLocaleDateString("en-GB")}</td>

          <td class="action-cell">

            <div class="menu-wrapper">

              <button class="menu-btn">⋮</button>

              <div class="menu-dropdown" style="display:none;">

                <p class="edit-btn"
                   data-id="${post.post_id}"
                   data-title="${post.title}"
                   data-caption="${post.caption || ''}"
                   data-platform="${post.platform}"
                   data-status="${post.status}"
                   data-date="${post.post_date}">

                   ✏️ Edit

                </p>

                <p class="delete-btn"
                   data-id="${post.post_id}">

                   🗑️ Delete

                </p>

              </div>

            </div>

          </td>

        </tr>`;
      });

    });

}


/* ================= DROPDOWN ================= */

document.addEventListener("click", function (e) {

  const isMenuBtn = e.target.classList.contains("menu-btn");
  const isInsideMenu = e.target.closest(".menu-dropdown");

  // close all menus first
  document.querySelectorAll(".menu-dropdown")
    .forEach(menu => {
      menu.style.display = "none";
    });

  // open clicked menu
  if (isMenuBtn) {

    e.stopPropagation();

    const menu = e.target.nextElementSibling;

    if (menu) {

      menu.style.display = "block";
      menu.style.position = "absolute";
      menu.style.zIndex = "99999";

    }

  }

  // prevent closing when clicking inside menu
  if (isInsideMenu) {
    e.stopPropagation();
  }

});


/* ================= DELETE ================= */

document.addEventListener("click", function(e){

  if (e.target.classList.contains("delete-btn")) {

    deletePostId = e.target.dataset.id;

    document.getElementById("deleteModal")
      .style.display = "flex";

  }

});


document.getElementById("cancelDeleteBtn").onclick =
function(){

  deletePostId = null;

  document.getElementById("deleteModal")
    .style.display = "none";

};


document.getElementById("confirmDeleteBtn").onclick =
function(){

  if (!deletePostId) return;

  fetch(apiURL + "/deletePost/" + deletePostId,
  { method:"DELETE" })
  .then(()=>{

    document.getElementById("deleteModal")
      .style.display="none";

    loadContent(selectedClientId);

  });

};


/* ================= EDIT ================= */

document.addEventListener("click", function(e){

  if (e.target.classList.contains("edit-btn")) {

    editingPostId =
      e.target.dataset.id;

    document.getElementById("project_name").value =
      e.target.dataset.title;

    document.getElementById("project_caption").value =
      e.target.dataset.caption;

    document.getElementById("platform").value =
      e.target.dataset.platform;

    document.getElementById("status").value =
      e.target.dataset.status;

    document.getElementById("schedule_date").value =
      e.target.dataset.date.split("T")[0];

    document.getElementById("createBtn").innerText =
      "Update Post";

    document.getElementById("postModal")
      .classList.remove("hidden");

  }

});
/* ================= SEARCH BAR FILTER ================= */

document
  .getElementById("searchInput")
  .addEventListener("input", function () {

    const searchValue =
      this.value.toLowerCase().trim();

    const rows =
      document.querySelectorAll(
        "#contentTable tr"
      );

    rows.forEach(row => {

      const title =
        row.children[0]?.innerText
        .toLowerCase() || "";

      const status =
        row.children[2]?.innerText
        .toLowerCase() || "";

      const date =
        row.children[3]?.innerText
        .toLowerCase() || "";

      const combinedText =
        title + " " +
        status + " " +
        date;

      if (combinedText.includes(searchValue)) {

        row.style.display = "";

      } else {

        row.style.display = "none";

      }

    });

});
/* ================= CONNECT BUTTONS ================= */

document
.getElementById("connectInstagramBtn")
.onclick = function(){

  window.location.href =
  apiURL + "/connectInstagram";

};


document
.getElementById("connectFacebookBtn")
.onclick = function(){

  window.location.href =
  apiURL + "/connectFacebook";

};