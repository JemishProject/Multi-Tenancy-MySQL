const express = require("express")
const app = express()
require("dotenv").config();

const { Pool } = require('pg');
app.use(express.json())
// Connection pool for managing database connections
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'root',
  password: '1234',
  port: 5432,
  max: 20,
});

async function getDbForTenant(tenantId) {
    const dbName = `${tenantId}`; 
    const client = await pool.connect();
    try {
      const checkDbResult = await client.query(`SELECT datname FROM pg_database WHERE datname = '${dbName}'`);
      const dbExists = checkDbResult.rowCount > 0;
      if (!dbExists) {
        await client.query(`CREATE DATABASE ${dbName}`);
      }

      client.release();
      const newPool = new Pool({
        user: 'postgres',
        host: 'localhost',
        database: dbName,
        password: '1234',
        port: 5432,
        max: 20,
      });
      const newClient = await newPool.connect();
      return newClient;
  } catch (error) {
    console.error('Error getting database for tenant:', error);
    client.release();
    throw error;
  }
}

// Middleware to set the request context
function setTenantContext(req, res, next) {
  const tenantId = req.headers['x-tenant-id']; // Assuming tenant ID is passed in headers
  req.tenantId = tenantId;
  next();
}

// Example route that uses the tenant's database
app.get('/data', setTenantContext, async (req, res) => {
  const tenantId = req.tenantId;
  const client = await getDbForTenant(tenantId);
  try {
    const result = await client.query('SELECT * FROM your_table');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

app.post('/add-cust', setTenantContext, async (req, res) => {
    const tenantId = req.tenantId;
    const client = await getDbForTenant(tenantId);
    const {fName,lName} = req.body;
    try {
        const checkDbResult = await client.query(`SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = 'customers'
        )`);
        if(!checkDbResult?.rows[0]?.exists){
            await client.query(`
            CREATE TABLE customers (
                id SERIAL PRIMARY KEY,
                firstName VARCHAR(255),
                lastName VARCHAR(255),
                createdAt TIMESTAMP NOT NULL,
                updatedAt TIMESTAMP NOT NULL
            );`)
        }

        await client.query(`INSERT INTO customers (firstName, lastName, createdAt, updatedAt) VALUES ('${fName}', '${lName}', NOW(), NOW())`)

        
        return res.send("customer Saved");
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      client.release();
    }
  });

  app.get('/get-cust', setTenantContext, async (req, res) => {
    const tenantId = req.tenantId;
    const client = await getDbForTenant(tenantId);
    try {
        const checkDbResult = await client.query(`SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = 'customers'
        )`);
        if(!checkDbResult?.rows[0]?.exists){
            await client.query(`
            CREATE TABLE customers (
                id SERIAL PRIMARY KEY,
                firstName VARCHAR(255),
                lastName VARCHAR(255),
                createdAt TIMESTAMP NOT NULL,
                updatedAt TIMESTAMP NOT NULL
            );`)
        }

        const result = await client.query(`SELECT * FROM customers;`)
      
        return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      client.release();
    }
  });
app.post('/add', async (req, res) => {
    try {
        const {fName,lName, company,email} = req.body;
        const client = await pool.connect();

        await client.query(`INSERT INTO Users (firstName, lastName, email, tenantId, createdAt, updatedAt)
        VALUES ('${fName}', '${lName}', '${email}', '${company}', NOW(), NOW())`)

        return res.status(200).json({
            message: "User Saved", 
            user: {
                first_name: fName,
                last_name: lName,
                tenantId: company,
                email: email,
            }
        });
    } catch (error) {
        return res.status(200).send("add error")
    }
})

const port = process.env.PORT
app.listen(port, () => {
    console.log(`Server is running on ${port}`);
})