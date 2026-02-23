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

app.use(session({
  secret: "postpolit_secret",
  resave: false,
  saveUninitialized: true
}));

/* ===== STATIC FOLDER ===== */

app.use("/uploads", express.static("uploads"));

/* ================= MULTER STORAGE ================= */

const storage = multer.diskStorage({

  destination: function(req, file, cb){
    cb(null, "uploads/");
  },

  filename: function(req, file, cb){

    const uniqueName =
      Date.now() + "-" + file.originalname;

    cb(null, uniqueName);
  }

});

const upload = multer({
  storage: storage
});
/* ===== TEST ROUTE ===== */
app.get("/", (req, res) => {
  res.send("API WORKING");
});

/* ================= EMPLOYEES ================= */

app.get("/employees", (req, res) => {
  console.log("GET EMPLOYEES HIT");
  db.query("SELECT * FROM employees", (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.post("/employees", (req, res) => {
  console.log("ADD EMPLOYEE HIT:", req.body);

  const { name, empId, password } = req.body;

  db.query(
    "SELECT * FROM employees WHERE emp_id=? OR password=?",
    [empId, password],
    (err, result) => {
      if (err) return res.status(500).send("Database error");

      if (result.length > 0) {
        return res.status(400).send("ID or Password already exists");
      }

      db.query(
        "INSERT INTO employees (emp_name, emp_id, password) VALUES (?,?,?)",
        [name, empId, password],
        (err) => {
          if (err) return res.status(500).send("Insert error");
          res.send("Employee added");
        }
      );
    }
  );
});

app.delete("/employees/:empId", (req, res) => {
  db.query(
    "DELETE FROM employees WHERE emp_id=?",
    [req.params.empId],
    (err) => {
      if (err) return res.status(500).send(err);
      res.send("Employee deleted");
    }
  );
});

/* ================= CUSTOMERS ================= */

app.get("/customers", (req, res) => {
  db.query("SELECT * FROM customers", (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.post("/customers", (req, res) => {
  const { name, custId, password } = req.body;

  db.query(
    "SELECT * FROM customers WHERE cust_id=? OR password=?",
    [custId, password],
    (err, result) => {
      if (err) return res.status(500).send("Database error");

      if (result.length > 0) {
        return res.status(400).send("ID or Password already exists");
      }

      db.query(
        "INSERT INTO customers (cust_name, cust_id, password) VALUES (?,?,?)",
        [name, custId, password],
        (err) => {
          if (err) return res.status(500).send("Insert error");
          res.send("Customer added");
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

/* ================= DELETE CUSTOMER ================= */

app.delete("/customers/:custId", (req, res) => {
  const custId = req.params.custId;

  db.query(
    "SELECT cust_name FROM customers WHERE cust_id=?",
    [custId],
    (err, result) => {

      if (err) return res.status(500).send(err);
      if (result.length === 0) return res.send("Customer not found");

      const custName = result[0].cust_name;

      db.query(
        "UPDATE employees SET assigned_customers = REPLACE(assigned_customers, ?, '')",
        [custName],
        () => {
          db.query(
            "DELETE FROM customers WHERE cust_id=?",
            [custId],
            () => {
              res.send("Customer deleted and unassigned");
            }
          );
        }
      );
    }
  );
});

/* ================= LOGIN ================= */

/* ================= LOGIN ================= */

app.post("/login", (req, res) => {

  const { username, password } = req.body;

  /* ================= CHECK ADMIN ================= */

  db.query(
    "SELECT * FROM admin WHERE username=? AND password=?",
    [username, password],
    (err, adminResult) => {

      if (err) return res.status(500).send(err);

      if (adminResult.length > 0) {

        return res.json({
          role: "admin",
          username: adminResult[0].username
        });

      }


      /* ================= CHECK EMPLOYEE ================= */

      db.query(
        "SELECT * FROM employees WHERE emp_name=? AND password=?",
        [username, password],
        (err, empResult) => {

          if (err) return res.status(500).send(err);

          if (empResult.length > 0) {

            const employee = empResult[0];

            /* ✅ SAVE SESSION */
            req.session.employeeId = employee.emp_id;

            return res.json({

              role: "user",

              username: employee.emp_name,

              employeeId: employee.emp_id,

              assigned_customers: employee.assigned_customers

            });

          }


          /* ================= INVALID LOGIN ================= */

          return res.json({
            role: "invalid"
          });

        }
      );

    }
  );

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
        ? employee.assigned_customers.split(", ").map(c => c.trim())
        : [];

      res.json({
        name: employee.emp_name,
        employeeId: employee.emp_id,
        password: employee.password,
        customers: customers
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

  db.query(sql,
    [customer_id, title, caption, platform, status, post_date],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

/* ================= ADD POST WITH MEDIA ================= */

app.post(
  "/addPostWithMedia",
  upload.array("media"),
  (req,res)=>{

    const {
      title,
      caption,
      platform,
      status,
      post_date,
      customer_id
    } = req.body;

    db.query(

      "INSERT INTO content (title, caption, platform, status, post_date, customer_id) VALUES (?,?,?,?,?,?)",

      [
        title,
        caption,
        platform,
        status,
        post_date,
        customer_id
      ],

      (err,result)=>{

        if(err){
          console.log(err);
          return res.sendStatus(500);
        }

        const postId = result.insertId;

        if(req.files){

          req.files.forEach(file=>{

            db.query(
              "INSERT INTO post_media (post_id, media_path) VALUES (?,?)",
              [postId, file.filename]
            );

          });

        }

        res.json({success:true});

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

  db.query(
    "DELETE FROM content WHERE content_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).send(err);
      res.json({ success: true });
    }
  );

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

app.get("/connectInstagram", (req,res)=>{

  const url =
  `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${process.env.META_REDIRECT_URI}&scope=pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish&response_type=code`;

  res.redirect(url);

});


/* ================= CONNECT FACEBOOK ================= */

app.get("/connectFacebook", (req,res)=>{

  const url =
  `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${process.env.META_REDIRECT_URI}&scope=pages_show_list,pages_manage_posts&response_type=code`;

  res.redirect(url);

});
/* ================= META CALLBACK ================= */

/* ================= META CALLBACK ================= */

app.get("/auth/meta/callback", async (req,res)=>{

  const code = req.query.code;

  if(!req.session.employeeId){

    return res.send("Session expired. Login again.");

  }

  try{

    const tokenRes =
    await axios.get(
      "https://graph.facebook.com/v18.0/oauth/access_token",
      {
        params:{
          client_id:process.env.META_APP_ID,
          client_secret:process.env.META_APP_SECRET,
          redirect_uri:process.env.META_REDIRECT_URI,
          code:code
        }
      }
    );

    const accessToken = tokenRes.data.access_token;


    const userRes =
    await axios.get(
      "https://graph.facebook.com/me",
      {
        params:{
          access_token:accessToken
        }
      }
    );

    const socialId = userRes.data.id;


    /* SAVE IN DATABASE */

    db.query(

      `INSERT INTO social_accounts
      (employee_id, platform, social_id, access_token)
      VALUES (?, ?, ?, ?)`,

      [

        req.session.employeeId,

        "meta",

        socialId,

        accessToken

      ]

    );


    res.redirect("/UserModule/user.html");

  }
  catch(err){

    console.log(err);

    res.send("Connection failed");

  }

});
/* ================= SERVER ================= */

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
