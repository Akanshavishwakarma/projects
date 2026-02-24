require("dotenv").config();
console.log("SERVER FILE LOADED");

console.log("META_APP_ID =", process.env.META_APP_ID);

const express = require("express");
const cors = require("cors");
const db = require("./db");
const multer = require("multer");
const path = require("path");

const axios = require("axios");
const session = require("express-session");

const app = express();

/* ===== MIDDLEWARES ===== */

app.use(cors());
app.use(express.json());

/* ===== SESSION MIDDLEWARE (CORRECT PLACE) ===== */

app.use(
  session({
    secret: "postpolit_secret",
    resave: false,
    saveUninitialized: true,
  })
);

/* ===== STATIC FOLDER ===== */

app.use("/uploads", express.static("uploads"));

/* ================= MULTER STORAGE ================= */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },

  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
});
/* ===== TEST ROUTE ===== */
app.get("/", (req, res) => {
  res.send("API WORKING");
});

/* ================= EMPLOYEES ================= */

app.get("/employees", (req, res) => {
  db.query("SELECT * FROM employees", (err, result) => {
    if (err) return res.status(500).send(err);
    res.send(result);
  });
});

app.post("/employees", (req, res) => {
  const { name, empId, password } = req.body;

  db.query(
    "SELECT * FROM employees WHERE emp_id=? OR password=?",
    [empId, password],
    (err, result) => {
      if (err) return res.status(500).send("Database error");
      if (result.length > 0) {
        const existsId = result.some((r) => r.emp_id === empId);
        const existsPassword = result.some((r) => r.password === password);
        let msg = "Already exists: ";
        if (existsId && existsPassword) msg += "ID and Password";
        else if (existsId) msg += "ID";
        else if (existsPassword) msg += "Password";
        return res.status(400).send(msg);
      }

      db.query(
        "INSERT INTO employees (emp_name, emp_id, password) VALUES (?,?,?)",
        [name, empId, password],
        (err) => {
          if (err) return res.status(500).send("Database error");
          res.send("Employee added 🎉!!!");
        }
      );
    }
  );
});

/* ================= CUSTOMERS ================= */

app.get("/customers", (req, res) => {
  db.query("SELECT * FROM customers", (err, result) => {
    if (err) return res.status(500).send(err);
    res.send(result);
  });
});

app.post("/customers", (req, res) => {
  const { name, custId, password } = req.body;

  // Check if ID or password already exists
  db.query(
    "SELECT * FROM customers WHERE cust_id=? OR password=?",
    [custId, password],
    (err, result) => {
      if (err) return res.status(500).send("Database error");
      if (result.length > 0) {
        const existsId = result.some((r) => r.cust_id === custId);
        const existsPassword = result.some((r) => r.password === password);
        let msg = "Already exists: ";
        if (existsId && existsPassword) msg += "ID and Password";
        else if (existsId) msg += "ID";
        else if (existsPassword) msg += "Password";
        return res.status(400).send(msg);
      }

      // If no duplicates, insert
      db.query(
        "INSERT INTO customers (cust_name, cust_id, password) VALUES (?,?,?)",
        [name, custId, password],
        (err) => {
          if (err) return res.status(500).send("Database error");
          res.send("Customer added 🎉!!!");
        }
      );
    }
  );
});

/* ================= ASSIGN ================= */

app.post("/assign", (req, res) => {
  const { empId, customers } = req.body;

  db.query(
    "UPDATE employees SET assigned_customers=? WHERE emp_id=?",
    [customers.join(", "), empId],
    (err) => {
      if (err) return res.status(500).send(err);
      res.send("Assigned");
    }
  );
});

app.delete("/employees/:empId", (req, res) => {
  db.query(
    "DELETE FROM employees WHERE emp_id=?",
    [req.params.empId],
    (err) => {
      if (err) return res.status(500).send(err);
      res.send("Employee deleted successfully 🎉!!!");
    }
  );
});

app.delete("/customers/:custId", (req, res) => {
  const custId = req.params.custId;

  // 1️⃣ Get customer name
  db.query(
    "SELECT cust_name FROM customers WHERE cust_id=?",
    [custId],
    (err, result) => {
      if (err) return res.status(500).send("Database error");

      if (result.length === 0) {
        return res.status(404).send("Customer not found");
      }

      const custName = result[0].cust_name;

      // 2️⃣ Remove customer from employees.assigned_customers
      db.query(
        "SELECT emp_id, assigned_customers FROM employees",
        (err, employees) => {
          if (err) return res.status(500).send("Database error");

          employees.forEach((emp) => {
            if (emp.assigned_customers) {
              const updated = emp.assigned_customers
                .split(",")
                .map((c) => c.trim())
                .filter((c) => c !== custName)
                .join(", ");

              db.query(
                "UPDATE employees SET assigned_customers=? WHERE emp_id=?",
                [updated, emp.emp_id]
              );
            }
          });

          // 3️⃣ Finally delete customer
          db.query("DELETE FROM customers WHERE cust_id=?", [custId], (err) => {
            if (err) return res.status(500).send("Database error");
            res.send("Customer deleted and unassigned successfully 🎉!!!");
          });
        }
      );
    }
  );
});

/* 🔐 ADMIN LOGIN */
app.post("/login", (req, res) => {
  console.log("LOGIN HIT:", req.body);
  const { username, password } = req.body;

  // ADMIN CHECK
  if (username === "admin2026" && password === "admin2026") {
    return res.json({ role: "admin" });
  }

  // EMPLOYEE CHECK
  const sql = "SELECT * FROM employees WHERE emp_name=? AND password=?";

  db.query(sql, [username, password], (err, result) => {
    if (err) return res.status(500).json({ role: "error" });

    if (result.length > 0) {
      return res.json({
        role: "user",
        name: result[0].emp_name,
      });
    } else {
      return res.json({ role: "invalid" });
    }
  });
});

/* ===== VERIFY USER FOR FORGOT PASSWORD ===== */

app.post("/verify-user", (req, res) => {
  const { username, userid } = req.body;

  db.query(
    "SELECT * FROM employees WHERE emp_name=? AND emp_id=?",
    [username, userid],
    (err, result) => {
      if (err) return res.status(500).json({ success: false });

      if (result.length > 0) {
        res.json({ success: true });
      } else {
        res.json({ success: false });
      }
    }
  );
});

/* ===== CHANGE PASSWORD ===== */

app.put("/change-password", (req, res) => {
  const { empId, password } = req.body;

  db.query(
    "UPDATE employees SET password=? WHERE emp_id=?",
    [password, empId],
    (err) => {
      if (err) return res.status(500).send("Database error");

      res.send("Password updated");
    }
  );
});

/*==================NOT ASSIGN============*/
app.put("/unassign/:empId", (req, res) => {
  const empId = req.params.empId;

  db.query(
    "UPDATE employees SET assigned_customers=NULL WHERE emp_id=?",
    [empId],
    (err) => {
      if (err) return res.status(500).send("Database error");
      res.send("All customers unassigned successfully");
    }
  );
});

/* ================= GET CUSTOMER DETAILS ================= */

app.get("/customer-details/:custId", (req, res) => {
  const custId = req.params.custId;

  const sql = `
    SELECT 
      project_name AS title,
      project_caption AS caption,
      platform,
      status,
      schedule_date
    FROM content
    WHERE customer_name = (
      SELECT cust_name FROM customers WHERE cust_id = ?
    )
    ORDER BY schedule_date DESC
  `;

  db.query(sql, [custId], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database error");
    }

    res.json(result);
  });
});
/* ================= GET EMPLOYEE DATA ================= */

app.get("/employee/:name", (req, res) => {
  const name = req.params.name;

  db.query(
    "SELECT emp_name, emp_id, password, assigned_customers FROM employees WHERE emp_name=?",
    [name],
    (err, result) => {
      if (err) return res.status(500).send(err);
      if (result.length === 0) {
        return res.json({ error: "Employee not found" });
      }

      const employee = result[0];

      const customers = employee.assigned_customers
        ? employee.assigned_customers.split(", ").map((c) => c.trim())
        : [];

      res.json({
        name: employee.emp_name,
        employeeId: employee.emp_id,
        password: employee.password,
        customers: customers,
      });
    }
  );
});

/* ================= CREATE POST (ONLY ONE ROUTE NOW) ================= */

app.post("/addPost", (req, res) => {
  const { customer_id, title, caption, platform, status, post_date } = req.body;

  if (!customer_id) {
    return res.status(400).json({ error: "Customer not selected" });
  }

  const sql = `
      INSERT INTO content 
      (customer_name, project_name, project_caption, platform, status, schedule_date) 
      VALUES (
        (SELECT cust_name FROM customers WHERE cust_id=?),
        ?, ?, ?, ?, ?
      )
  `;

  db.query(
    sql,
    [customer_id, title, caption, platform, status, post_date],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

/* ================= ADD POST WITH MEDIA ================= */

app.post("/addPostWithMedia", upload.array("media"), (req, res) => {
  const { title, caption, platform, status, post_date, customer_id } = req.body;

  db.query(
    "INSERT INTO content (title, caption, platform, status, post_date, customer_id) VALUES (?,?,?,?,?,?)",

    [title, caption, platform, status, post_date, customer_id],

    (err, result) => {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }

      const postId = result.insertId;

      if (req.files) {
        req.files.forEach((file) => {
          db.query(
            "INSERT INTO post_media (post_id, media_path) VALUES (?,?)",
            [postId, file.filename]
          );
        });
      }

      res.json({ success: true });
    }
  );
});

/* ================= LOAD POSTS (CLIENT FILTER FIX ADDED) ================= */

app.get("/posts", (req, res) => {
  const customerId = req.query.customer;

  let sql = `
  SELECT 
    content_id AS post_id,
    project_name AS title,
    project_caption AS caption,
    platform,
    status,
    schedule_date AS post_date
  FROM content
  `;

  const values = [];

  if (customerId) {
    sql += `
      WHERE customer_name = (
        SELECT cust_name FROM customers WHERE cust_id = ?
      )
    `;
    values.push(customerId);
  }

  sql += " ORDER BY content_id DESC";

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

/* ================= DELETE POST ================= */

app.delete("/deletePost/:id", (req, res) => {
  db.query("DELETE FROM content WHERE content_id=?", [req.params.id], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ success: true });
  });
});

/* ================= UPDATE POST ================= */

app.put("/updatePost/:id", (req, res) => {
  const { title, caption, platform, status, post_date } = req.body;

  db.query(
    `UPDATE content 
     SET project_name=?, project_caption=?, platform=?, status=?, schedule_date=?
     WHERE content_id=?`,
    [title, caption, platform, status, post_date, req.params.id],
    (err) => {
      if (err) return res.status(500).send(err);
      res.json({ success: true });
    }
  );
});
/* ================= CONNECT INSTAGRAM ================= */

app.get("/connectInstagram", (req, res) => {
  const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${process.env.META_REDIRECT_URI}&scope=pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish&response_type=code`;

  res.redirect(url);
});

/* ================= CONNECT FACEBOOK ================= */

app.get("/connectFacebook", (req, res) => {
  const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${process.env.META_REDIRECT_URI}&scope=pages_show_list,pages_manage_posts&response_type=code`;

  res.redirect(url);
});
/* ================= META CALLBACK ================= */

/* ================= META CALLBACK ================= */

app.get("/auth/meta/callback", async (req, res) => {
  const code = req.query.code;

  if (!req.session.employeeId) {
    return res.send("Session expired. Login again.");
  }

  try {
    const tokenRes = await axios.get(
      "https://graph.facebook.com/v18.0/oauth/access_token",
      {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: process.env.META_REDIRECT_URI,
          code: code,
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get("https://graph.facebook.com/me", {
      params: {
        access_token: accessToken,
      },
    });

    const socialId = userRes.data.id;

    /* SAVE IN DATABASE */

    db.query(
      `INSERT INTO social_accounts
      (employee_id, platform, social_id, access_token)
      VALUES (?, ?, ?, ?)`,

      [req.session.employeeId, "meta", socialId, accessToken]
    );

    res.redirect("/UserModule/user.html");
  } catch (err) {
    console.log(err);

    res.send("Connection failed");
  }
});
/* ================= SERVER ================= */

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
